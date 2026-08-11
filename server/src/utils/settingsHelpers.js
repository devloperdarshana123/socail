import { transactionRunner } from "../config/transaction.js";
import {
  userRepository,
  socialPostRepository,
  storyRepository,
  sessionRepository,
} from "../config/repositories.js";
import * as UserHelper from "./userHelpers.js";

// Persistence for the settings domain now flows through the repository
// layer (Phase 7A) instead of the Prisma client directly. Database/behavior
// are unchanged — every query below is the same shape as the prisma.* call
// it replaces; only the access path moved.
//
// Business logic stays entirely in this helper, unchanged: the fullName/bio
// validation rules and their thrown Error messages, the null-coercion of
// optional profile fields, Nominatim geocoding (including its
// swallow-and-continue catch), the Google-vs-normal password branch, the
// 30-day reactivation window, and every returned message string.
//
// Both callback-form transactions now run through transactionRunner.run()
// and pass `{ tx }` to each repository call, so ordering and whole-callback
// rollback are preserved exactly — see the transaction-semantics tests in
// the settings characterization suite.
//
// NOTE: every findById here passes an explicit `select` except
// getFullUserById, which deliberately omits one so the repository returns
// the complete row that sendUserToken consumes — matching the original
// unprojected findUnique.

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ── Get user profile ────────────────────────────────────────────────────
export const getUserProfile = async (userId) => {
  const user = await userRepository.findById(userId, {
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      avatar: true,
      coverPhoto: true,
      bio: true,
      designation: true,
      website: true,
      gender: true,
      dateOfBirth: true,
      businessCategory: true,
      location: true,
      isPrivate: true,
      isVerifiedBadge: true,
      authProvider: true,
      accountStatus: true,
      isOnboardingComplete: true,
      createdAt: true,
    },
  });

  return user;
};

// ── Account-lookup helpers (extracted verbatim from setting.controller.js
//    so the controller no longer touches Prisma directly — Milestone 5
//    helpers-as-boundary. Each query is byte-identical to the one it
//    replaces; returns null for a missing user, as findUnique does. ───────

// permanentlyDeleteAccount: fetch the stored hash to verify the password.
export const getPasswordForVerification = async (userId) => {
  return userRepository.findById(userId, {
    select: { password: true },
  });
};

// reactivateAccount: status + password + onboarding, for verify & response.
export const getUserForReactivation = async (userId) => {
  return userRepository.findById(userId, {
    select: {
      id: true,
      accountStatus: true,
      password: true,
      isOnboardingComplete: true,
      onboardingStep: true,
    },
  });
};

// reactivateAccount: full user row handed to sendUserToken after restore.
export const getFullUserById = async (userId) => {
  return userRepository.findById(userId);
};

// ── Update profile ──────────────────────────────────────────────────────
export const updateUserProfile = async (userId, updateData) => {
  const {
    fullName,
    bio,
    designation,
    dateOfBirth,
    gender,
    website,
    businessCategory,
    location,
  } = updateData;

  const updateFields = {};

  if (fullName !== undefined) {
    if (fullName.trim().length < 2 || fullName.trim().length > 50) {
      throw new Error("Full name must be between 2 and 50 characters.");
    }
    updateFields.fullName = fullName.trim();
  }

  if (bio !== undefined) {
    if (bio.length > 300) {
      throw new Error("Bio cannot exceed 300 characters.");
    }
    updateFields.bio = bio;
  }

  if (designation !== undefined) updateFields.designation = designation;
  if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth || null;
  if (gender !== undefined) updateFields.gender = gender || null;
  if (website !== undefined) updateFields.website = website || null;
  if (businessCategory !== undefined) updateFields.businessCategory = businessCategory || null;

  // Location + Nominatim geocoding
  if (location !== undefined) {
    if (!location) {
      updateFields.location = null;
    } else {
      updateFields.location = location;

      // Geocode location
      if (location.city || location.state || location.country) {
        try {
          const query = [location.city, location.state, location.country]
            .filter(Boolean)
            .join(", ");

          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              query
            )}&format=json&limit=1`,
            { headers: { "User-Agent": "Erovians/1.0" } }
          );

          const geoData = await geoRes.json();
          if (geoData?.[0]) {
            updateFields.location = {
              ...location,
              coordinates: {
                type: "Point",
                coordinates: [parseFloat(geoData[0].lon), parseFloat(geoData[0].lat)],
              },
            };
          }
        } catch {
          // Geocoding fail — save location without coordinates
        }
      }
    }
  }

  const updated = await userRepository.update(userId, updateFields);

  return updated;
};

// ── Update password ─────────────────────────────────────────────────────
export const updatePassword = async (userId, oldPassword, newPassword) => {
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters long.");
  }

  const user = await userRepository.findById(userId, {
    select: { id: true, password: true, authProvider: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const isGoogleUser = user.authProvider === "google" && !user.password;

  if (isGoogleUser) {
    // Google user — set password without verification
    const hashedPassword = await UserHelper.hashPassword(newPassword);
    await userRepository.update(userId, { password: hashedPassword });

    return { message: "Password created successfully. You can now login with email too." };
  }

  // Normal user — verify old password
  if (!oldPassword) {
    throw new Error("Current password is required.");
  }

  if (oldPassword === newPassword) {
    throw new Error("New password must be different from old password.");
  }

  const isMatch = await UserHelper.isPasswordCorrect(user, oldPassword);
  if (!isMatch) {
    throw new Error("The current password is incorrect.");
  }

  const hashedPassword = await UserHelper.hashPassword(newPassword);
  await userRepository.update(userId, { password: hashedPassword });

  // Log out all sessions — remove all refresh tokens
  await sessionRepository.deleteManyByUserId(userId);

  return { message: "Password updated successfully." };
};

// ── Deactivate account ──────────────────────────────────────────────────
export const deactivateAccount = async (userId) => {
  const user = await userRepository.findById(userId, {
    select: { id: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Soft delete — anonymize
 await transactionRunner.run(async (tx) => {
  // Soft delete — anonymize
await userRepository.update(
    userId,
    {
      accountStatus: "deactivated",
      deactivatedAt: new Date(),
      bio: "",
      designation: "",
      avatar: null,
    },
    { tx }
  );

  // Posts hide karo
  await socialPostRepository.updateManyWhere(
    { authorId: userId },
    { isDeleted: true },
    { tx }
  );

  // Stories hide karo
  await storyRepository.updateManyWhere(
    { authorId: userId },
    { isDeleted: true },
    { tx }
  );

  // Sessions remove karo
  await sessionRepository.deleteManyByUserId(userId, { tx });
});

return { message: "Account deactivated successfully." };
};

// ── Delete all user data (hard delete) ───────────────────────────────────
// export const hardDeleteAccount = async (userId) => {
//   // Delete user and cascade delete all related data
//   await Promise.all([
//     prisma.post.deleteMany({ where: { authorId: userId } }),
//     prisma.comment.deleteMany({ where: { authorId: userId } }),
//     prisma.like.deleteMany({ where: { userId } }),
//     prisma.saved.deleteMany({ where: { userId } }),
//     prisma.follow.deleteMany({
//       where: { OR: [{ followerId: userId }, { followingId: userId }] },
//     }),
//     prisma.story.deleteMany({ where: { authorId: userId } }),
//     prisma.storyView.deleteMany({ where: { viewerId: userId } }),
//     prisma.conversation.updateMany({
//       where: { participants: { some: { id: userId } } },
//       data: { participants: { disconnect: { id: userId } } },
//     }),
//     prisma.refreshToken.deleteMany({ where: { userId } }),
//     prisma.oTP.deleteMany({ where: { userId } }),
//   ]);

//   // Finally delete user
//   await prisma.user.delete({ where: { id: userId } });

//   return { message: "Account permanently deleted." };
// };


// ── Delete all user data (hard delete) ───────────────────────────────────
export const hardDeleteAccount = async (userId) => {
  // Schema mein onDelete: Cascade already set hai most relations pe,
  // isliye sirf user delete karna kaafi hai — DB khud sab cascade kar dega
  // (userRepository.delete is a HARD delete, matching the original.)
  await userRepository.delete(userId);

  return { message: "Account permanently deleted." };
};


// ── Reactivate account ──────────────────────────────────────────────────
export const reactivateAccount = async (userId) => {
  const user = await userRepository.findById(userId, {
    select: { id: true, accountStatus: true, deactivatedAt: true },
  });

  if (!user) throw new Error("User not found");
  if (user.accountStatus !== "deactivated") throw new Error("Account is not deactivated");

  // 30 din check
  if (user.deactivatedAt) {
    const daysDiff = (Date.now() - new Date(user.deactivatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      throw new Error("Reactivation period has expired. Account cannot be restored after 30 days.");
    }
  }

  await transactionRunner.run(async (tx) => {
    // Account wapas active karo
    await userRepository.update(userId, { accountStatus: "active" }, { tx });

    // Posts wapas visible karo
    await socialPostRepository.updateManyWhere(
      { authorId: userId, isDeleted: true },
      { isDeleted: false },
      { tx }
    );

    // Stories wapas visible karo
    await storyRepository.updateManyWhere(
      { authorId: userId, isDeleted: true },
      { isDeleted: false },
      { tx }
    );
  });

  return { message: "Account reactivated successfully." };
};