
import Conversation from "../models/Conversation.model.js";
import Message from "../models/Message.model.js";
import SocialUser from "../models/User.model.js";
import mongoose from "mongoose";

// ── Get or Create Conversation ────────────────────────────────────────────────
export const getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id.toString();

    if (userId === currentUserId) {
      return res.status(400).json({ message: "Cannot message yourself!" });
    }

    const currentObjId = new mongoose.Types.ObjectId(currentUserId);
    const otherObjId   = new mongoose.Types.ObjectId(userId);

    let conversation = await Conversation.findOne({
      participants: { $all: [currentObjId, otherObjId], $size: 2 },
    })
      .populate("participants", "name avatar designation")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name avatar" },
      });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentObjId, otherObjId],
        unreadCount: { [currentUserId]: 0, [userId]: 0 },
      });
      conversation = await Conversation.findById(conversation._id)
        .populate("participants", "name avatar designation")
        .populate({
          path: "lastMessage",
          populate: { path: "sender", select: "name avatar" },
        });
    }

    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Get Following List for Messages sidebar ───────────────────────────────────
// Yeh woh log hain jinse hum baat kar sakte hain
export const getFollowingForMessages = async (req, res) => {
  try {
    const currentUser = await SocialUser.findById(req.user._id)
      .select("following")
      .populate("following", "name avatar designation");

    // Saare conversations fetch karo
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name avatar designation")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name avatar" },
      })
      .sort({ updatedAt: -1 });

    const followingIds = new Set(
      (currentUser.following || []).map((u) => u._id.toString())
    );

    // Following users with conversations
    const followingList = (currentUser.following || []).map((followedUser) => {
      const existingConv = conversations.find((conv) =>
        conv.participants.some((p) => p._id.toString() === followedUser._id.toString())
      );
      return {
        user: followedUser,
        conversation: existingConv || null,
        myUnread: existingConv
          ? existingConv.unreadCount?.get(req.user._id.toString()) || 0
          : 0,
      };
    });

    // Ab conversation wale users jo following mein nahi hain unhe bhi add karo
    conversations.forEach((conv) => {
      const otherUser = conv.participants.find(
        (p) => p._id.toString() !== req.user._id.toString()
      );
      if (!otherUser) return;
      if (!followingIds.has(otherUser._id.toString())) {
        followingList.push({
          user: otherUser,
          conversation: conv,
          myUnread: conv.unreadCount?.get(req.user._id.toString()) || 0,
        });
      }
    });

    // Latest conversation wale pehle dikhao
    followingList.sort((a, b) => {
      const aTime = a.conversation?.updatedAt
        ? new Date(a.conversation.updatedAt) : new Date(0);
      const bTime = b.conversation?.updatedAt
        ? new Date(b.conversation.updatedAt) : new Date(0);
      return bTime - aTime;
    });

    res.json({ success: true, followingList });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Get All Conversations ─────────────────────────────────────────────────────
export const getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name avatar designation")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name avatar" },
      })
      .sort({ updatedAt: -1 });

    const result = conversations.map((c) => ({
      ...c.toObject(),
      myUnread: c.unreadCount?.get(req.user._id.toString()) || 0,
    }));

    res.json({ success: true, conversations: result });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Get Messages ──────────────────────────────────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip  = (page - 1) * limit;

    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ message: "Conversation not found!" });

    const isParticipant = conv.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) return res.status(403).json({ message: "Access denied!" });

    const messages = await Message.find({
      conversation: conversationId,
      isDeleted: false,
    })
      .populate("sender", "name avatar")
      .populate({ path: "replyTo", populate: { path: "sender", select: "name" } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({
      conversation: conversationId,
      isDeleted: false,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      [`unreadCount.${req.user._id}`]: 0,
    });
    await Message.updateMany(
      { conversation: conversationId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: { page, total, hasMore: page * limit < total },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Send Message ──────────────────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text, image } = req.body;

    if (!text && !image) {
      return res.status(400).json({ message: "Message cannot be empty!" });
    }

    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ message: "Conversation not found!" });

    const isParticipant = conv.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) return res.status(403).json({ message: "Access denied!" });

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      text: text || "",
      image: image || "",
      readBy: [req.user._id],
    });

    await message.populate("sender", "name avatar");

    const others = conv.participants.filter(
      (p) => p.toString() !== req.user._id.toString()
    );
    const unreadUpdate = {};
    others.forEach((uid) => {
      unreadUpdate[`unreadCount.${uid}`] =
        (conv.unreadCount?.get(uid.toString()) || 0) + 1;
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      ...unreadUpdate,
    });

    res.status(201).json({ success: true, message });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Delete Message ────────────────────────────────────────────────────────────
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found!" });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Cannot delete others' messages!" });
    }
    message.isDeleted = true;
    message.text = "";
    message.image = "";
    await message.save();
    res.json({ success: true, message: "Message deleted!" });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};

// ── Get Total Unread ──────────────────────────────────────────────────────────
export const getTotalUnread = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id });
    const total = conversations.reduce((sum, c) => {
      return sum + (c.unreadCount?.get(req.user._id.toString()) || 0);
    }, 0);
    res.json({ success: true, unread: total });
  } catch (err) {
    res.status(500).json({ message: "Server error!", error: err.message });
  }
};