

import SocialUser from "../models/User.model.js";
import { emitToUser } from "../socket.js";
// ── Send Follow Request ──────────────────────────────────────────────────────
export const sendFollowRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId === currentUserId.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself!" });
    }

    const targetUser = await SocialUser.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found!" });
    }

    const currentUser = await SocialUser.findById(currentUserId);

    if (currentUser.following.includes(userId)) {
      return res.status(400).json({ message: "You are already following this user!" });
    }

    if (targetUser.followRequests?.includes(currentUserId)) {
      return res.status(400).json({ message: "Follow request already sent!" });
    }

    targetUser.followRequests = targetUser.followRequests || [];
    targetUser.followRequests.push(currentUserId);
    await targetUser.save();
    // Chat server ko notify karo
emitToUser(userId, "follow_request_received", {
  from: { _id: currentUser._id, name: currentUser.name, avatar: currentUser.avatar }
});

    res.json({ 
      success: true, 
      message: "Follow request sent successfully!",
      isPending: true 
    });
  } catch (err) {
    console.error("sendFollowRequest ERROR:", err);``
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Accept Follow Request ────────────────────────────────────────────────────
export const acceptFollowRequest = async (req, res) => {
  try {
    const { requesterId } = req.params;
    const currentUserId = req.user._id;

    const requester = await SocialUser.findById(requesterId);
    if (!requester) {
      return res.status(404).json({ message: "User not found!" });
    }

    const currentUser = await SocialUser.findById(currentUserId);

    if (!currentUser.followRequests?.includes(requesterId)) {
      return res.status(400).json({ message: "No follow request found!" });
    }

    currentUser.followRequests = currentUser.followRequests.filter(
      (id) => id.toString() !== requesterId
    );

    currentUser.followers = currentUser.followers || [];
    currentUser.followers.push(requesterId);

    requester.following = requester.following || [];
    requester.following.push(currentUserId);

    await currentUser.save();
    await requester.save();
    // Follow accept notification
emitToUser(requesterId.toString(), "follow_request_accepted", {
  by: { _id: currentUser._id, name: currentUser.name, avatar: currentUser.avatar }
});

    res.json({ 
      success: true, 
      message: "Follow request accepted!",
      isFollowing: true 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Reject Follow Request ────────────────────────────────────────────────────
export const rejectFollowRequest = async (req, res) => {
  try {
    const { requesterId } = req.params;
    const currentUserId = req.user._id;

    const currentUser = await SocialUser.findById(currentUserId);

    if (!currentUser.followRequests?.includes(requesterId)) {
      return res.status(400).json({ message: "No follow request found!" });
    }

    currentUser.followRequests = currentUser.followRequests.filter(
      (id) => id.toString() !== requesterId
    );

    await currentUser.save();

    res.json({ 
      success: true, 
      message: "Follow request rejected!",
      isRejected: true 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Unfollow User ────────────────────────────────────────────────────────────
export const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId === currentUserId.toString()) {
      return res.status(400).json({ message: "You cannot unfollow yourself!" });
    }

    const targetUser = await SocialUser.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found!" });
    }

    const currentUser = await SocialUser.findById(currentUserId);

    if (!currentUser.following.includes(userId)) {
      return res.status(400).json({ message: "You are not following this user!" });
    }

    currentUser.following = currentUser.following.filter(
      (id) => id.toString() !== userId
    );
    targetUser.followers = targetUser.followers.filter(
      (id) => id.toString() !== currentUserId.toString()
    );

    await currentUser.save();
    await targetUser.save();

    res.json({ 
      success: true, 
      message: "Unfollowed successfully!",
      isFollowing: false 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Get Follow Requests (Pending) ────────────────────────────────────────────
export const getFollowRequests = async (req, res) => {
  try {
    const currentUser = await SocialUser.findById(req.user._id)
      .populate("followRequests", "name avatar role designation followers following");

    res.json({ 
      success: true, 
      requests: currentUser.followRequests || [] 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Get Followers List ───────────────────────────────────────────────────────
export const getFollowers = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.params.userId || req.user._id)
      .populate("followers", "name avatar role designation followers following");

    res.json({ 
      success: true, 
      followers: user.followers || [] 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Get Following List ───────────────────────────────────────────────────────
export const getFollowing = async (req, res) => {
  try {
    const user = await SocialUser.findById(req.params.userId || req.user._id)
      .populate("following", "name avatar role designation followers following");

    res.json({ 
      success: true, 
      following: user.following || [] 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Cancel Follow Request ─────────────────────────────────────────────────────
export const cancelFollowRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const targetUser = await SocialUser.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found!" });
    }

    if (!targetUser.followRequests?.includes(currentUserId)) {
      return res.status(400).json({ message: "No pending follow request found!" });
    }

    targetUser.followRequests = targetUser.followRequests.filter(
      (id) => id.toString() !== currentUserId.toString()
    );

    await targetUser.save();

    res.json({ 
      success: true, 
      message: "Follow request cancelled!",
      isPending: false 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};


// ── Get Sent (Pending) Follow Requests ───────────────────────────────────────
export const getSentFollowRequests = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Woh users jinke followRequests mein current user ka ID hai
    const usersWithMyRequest = await SocialUser.find({
      followRequests: { $in: [currentUserId] }
    }).select("_id");

    const sentUserIds = usersWithMyRequest.map((u) => u._id.toString());

    res.json({ success: true, sentRequests: sentUserIds });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};



export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user._id;
    if (!q?.trim()) return res.json({ success: true, users: [] });

    const users = await SocialUser.find({
      _id: { $ne: currentUserId },
      name: { $regex: q.trim(), $options: "i" },
      isSuspended: false,
    }).select("_id name avatar designation followers followRequests").limit(8);

    const currentUser = await SocialUser.findById(currentUserId).select("following");

    const usersWithStatus = users.map((u) => ({
      _id: u._id,
      name: u.name,
      avatar: u.avatar,
      designation: u.designation,
      followersCount: u.followers.length,
      isFollowing: currentUser.following.map(String).includes(String(u._id)),
      isPending: u.followRequests.map(String).includes(String(currentUserId)),
    }));

    res.json({ success: true, users: usersWithStatus });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};