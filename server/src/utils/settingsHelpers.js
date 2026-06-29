import prisma from "../config/prisma.js";
import * as UserHelper from "./userHelpers.js";

const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ── Get user profile ────────────────────────────────────────────────────
export const getUserProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateFields,
  });

  return updated;
};

// ── Update password ─────────────────────────────────────────────────────
export const updatePassword = async (userId, oldPassword, newPassword) => {
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters long.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true, authProvider: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const isGoogleUser = user.authProvider === "google" && !user.password;

  if (isGoogleUser) {
    // Google user — set password without verification
    const hashedPassword = await UserHelper.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

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
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // Log out all sessions — remove all refresh tokens
  await prisma.refreshToken.deleteMany({ where: { userId } });

  return { message: "Password updated successfully." };
};

// ── Deactivate account ──────────────────────────────────────────────────
export const deactivateAccount = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Soft delete — anonymize
 await prisma.$transaction(async (tx) => {
  // Soft delete — anonymize
await tx.user.update({
    where: { id: userId },
    data: {
      accountStatus: "deactivated",
      deactivatedAt: new Date(),
      bio: "",
      designation: "",
      avatar: null,
    },
  });

  // Posts hide karo
  await tx.post.updateMany({
    where: { authorId: userId },
    data: { isDeleted: true },
  });

  // Stories hide karo
  await tx.story.updateMany({
    where: { authorId: userId },
    data: { isDeleted: true },
  });

  // Sessions remove karo
  await tx.refreshToken.deleteMany({ where: { userId } });
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
  await prisma.user.delete({ where: { id: userId } });

  return { message: "Account permanently deleted." };
};


// ── Reactivate account ──────────────────────────────────────────────────
export const reactivateAccount = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  await prisma.$transaction(async (tx) => {
    // Account wapas active karo
    await tx.user.update({
      where: { id: userId },
      data: { accountStatus: "active" },
    });

    // Posts wapas visible karo
    await tx.post.updateMany({
      where: { authorId: userId, isDeleted: true },
      data: { isDeleted: false },
    });

    // Stories wapas visible karo
    await tx.story.updateMany({
      where: { authorId: userId, isDeleted: true },
      data: { isDeleted: false },
    });
  });

  return { message: "Account reactivated successfully." };
};