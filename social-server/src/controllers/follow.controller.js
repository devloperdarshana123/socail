

import SocialUser from "../models/User.model.js";
import Notification from "../models/Notification.model.js";
import { emitToUser } from "../socket.js";

// ─────────────────────────────────────────────────────────────────────────────
// Follow / Unfollow (Public follow system — no requests)
// ─────────────────────────────────────────────────────────────────────────────

export const toggleFollow = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId }    = req.params;

    if (currentUserId.toString() === userId) {
      return res.status(400).json({ message: "Apne aap ko follow nahi kar sakte" });
    }

    const [currentUser, targetUser] = await Promise.all([
      SocialUser.findById(currentUserId).select("following blockedUsers"),
      SocialUser.findById(userId).select("followers blockedUsers isDeleted isSuspended"),
    ]);

    if (!targetUser || targetUser.isDeleted || targetUser.isSuspended) {
      return res.status(404).json({ message: "User nahi mila" });
    }

    // Block check
    if (
      targetUser.blockedUsers?.some((id) => id.toString() === currentUserId.toString()) ||
      currentUser.blockedUsers?.some((id) => id.toString() === userId)
    ) {
      return res.status(403).json({ message: "Follow nahi kar sakte" });
    }

    const isFollowing = currentUser.following.some((id) => id.toString() === userId);

    if (isFollowing) {
      // Unfollow — atomic
      await Promise.all([
        SocialUser.findByIdAndUpdate(currentUserId, { $pull: { following: userId } }),
        SocialUser.findByIdAndUpdate(userId, { $pull: { followers: currentUserId } }),
      ]);

      return res.json({ message: "Unfollow ho gaya", isFollowing: false });
    } else {
      // Follow — atomic
      await Promise.all([
        SocialUser.findByIdAndUpdate(currentUserId, { $addToSet: { following: userId } }),
        SocialUser.findByIdAndUpdate(userId, { $addToSet: { followers: currentUserId } }),
      ]);

      // Notification
      const notif = await Notification.createUnique({
        recipient: userId,
        sender:    currentUserId,
        type:      "follow",
      });

      if (notif) {
        emitToUser(userId, "notification", notif);
      }

      return res.json({ message: "Follow ho gaya", isFollowing: true });
    }
  } catch (err) {
    console.error("toggleFollow error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Remove Follower (apne followers mein se hatao)
// ─────────────────────────────────────────────────────────────────────────────

export const removeFollower = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId }    = req.params;

    await Promise.all([
      SocialUser.findByIdAndUpdate(currentUserId, { $pull: { followers: userId } }),
      SocialUser.findByIdAndUpdate(userId, { $pull: { following: currentUserId } }),
    ]);

    return res.json({ message: "Follower hata diya" });
  } catch (err) {
    console.error("removeFollower error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Block / Unblock
// ─────────────────────────────────────────────────────────────────────────────

export const toggleBlock = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId }    = req.params;

    if (currentUserId.toString() === userId) {
      return res.status(400).json({ message: "Apne aap ko block nahi kar sakte" });
    }

    const currentUser = await SocialUser.findById(currentUserId).select("blockedUsers");
    const isBlocked   = currentUser.blockedUsers.some((id) => id.toString() === userId);

    if (isBlocked) {
      await SocialUser.findByIdAndUpdate(currentUserId, { $pull: { blockedUsers: userId } });
      return res.json({ message: "Unblock ho gaya", isBlocked: false });
    } else {
      // Block karte waqt follow bhi hatao dono taraf se
      await Promise.all([
        SocialUser.findByIdAndUpdate(currentUserId, {
          $addToSet: { blockedUsers: userId },
          $pull:     { following: userId, followers: userId },
        }),
        SocialUser.findByIdAndUpdate(userId, {
          $pull: { following: currentUserId, followers: currentUserId },
        }),
      ]);

      return res.json({ message: "Block ho gaya", isBlocked: true });
    }
  } catch (err) {
    console.error("toggleBlock error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get Followers List
// ─────────────────────────────────────────────────────────────────────────────

export const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    console.log("getFollowers userId:", userId); // ← sahi jagah

    const user = await SocialUser.findById(userId)
      .select("followers")
      .populate({
        path: "followers",
        select: "name username avatar designation followers",
        match: { isDeleted: { $ne: true } },
      });

    console.log("DB followers count:", user?.followers?.length); // ← populate ke baad

    if (!user) return res.status(404).json({ message: "User nahi mila" });

    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginatedFollowers = user.followers.slice(start, start + parseInt(limit));

    const currentUser  = await SocialUser.findById(req.user._id).select("following");
    const followingSet = new Set(currentUser.following.map(String));

    const followers = paginatedFollowers.map((f) => ({
      ...f.toObject(),
      avatar: f.avatar?.url || f.avatar || "",
      isFollowing: followingSet.has(f._id.toString()),
      followersCount: f.followers?.length || 0,
    }));

    return res.json({ followers, page: parseInt(page) });
  } catch (err) {
    console.error("getFollowers error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get Following List
// ─────────────────────────────────────────────────────────────────────────────

export const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const user = await SocialUser.findById(userId)
      .select("following")
      .populate({
        path: "following",
        select: "name username avatar designation followers",
        match: { isDeleted: { $ne: true } },
        // ← options HATAO
      });

    if (!user) return res.status(404).json({ message: "User nahi mila" });

    // Manual pagination
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginatedFollowing = user.following.slice(start, start + parseInt(limit)); // ← ADD

    const currentUser  = await SocialUser.findById(req.user._id).select("following");
    const followingSet = new Set(currentUser.following.map(String));

    const following = paginatedFollowing.map((f) => ({ // ← paginatedFollowing use karo
      ...f.toObject(),
      avatar: f.avatar?.url || f.avatar || "",
      isFollowing: followingSet.has(f._id.toString()),
      followersCount: f.followers?.length || 0,
    }));

    return res.json({ following, page: parseInt(page) });
  } catch (err) {
    console.error("getFollowing error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Suggestions — "People you may know"
// ─────────────────────────────────────────────────────────────────────────────

export const getSuggestions = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const currentUser   = await SocialUser.findById(currentUserId).select("following blockedUsers");

    const excludeIds = [
      currentUserId,
      ...currentUser.following,
      ...currentUser.blockedUsers,
    ];

    // Following ke following — 2nd degree connections
    const followingUsers = await SocialUser.find({
      _id: { $in: currentUser.following },
    }).select("following");

    const secondDegreeIds = [
      ...new Set(
        followingUsers
          .flatMap((u) => u.following.map(String))
          .filter((id) => !excludeIds.map(String).includes(id))
      ),
    ];

    let suggestions = [];

    if (secondDegreeIds.length >= 5) {
      // 2nd degree connections prefer karo
      suggestions = await SocialUser.find({
        _id:         { $in: secondDegreeIds },
        isDeleted:   false,
        isSuspended: false,
      })
        .select("name username avatar designation followersCount businessCategory")
        .limit(20)
        .lean();
    }

    // Agar kam hain toh random fill karo
    if (suggestions.length < 10) {
      const more = await SocialUser.find({
        _id:         { $nin: [...excludeIds, ...suggestions.map((s) => s._id)] },
        isDeleted:   false,
        isSuspended: false,
      })
        .select("name username avatar designation followersCount businessCategory")
        .limit(20 - suggestions.length)
        .lean();
      suggestions = [...suggestions, ...more];
    }

    return res.json({ suggestions });
  } catch (err) {
    console.error("getSuggestions error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};