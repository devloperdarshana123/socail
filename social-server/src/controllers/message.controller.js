
import { Message, Conversation } from "../models/Message.model.js";
import SocialUser from "../models/User.model.js";
import cloudinary from "../config/cloudinary.js";
import { emitToUser } from "../socket.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const uploadBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Get or Create Conversation
// ─────────────────────────────────────────────────────────────────────────────

export const getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (currentUserId.toString() === userId) {
      return res.status(400).json({ message: "Apne aap se conversation nahi bana sakte" });
    }

    const otherUser = await SocialUser.findOne({ _id: userId, isDeleted: false });
    if (!otherUser) return res.status(404).json({ message: "User nahi mila" });

    const { conversation, isNew } = await Conversation.findOrCreate(currentUserId, userId);

    await conversation.populate("participants", "name username avatar lastSeen");

    return res.json({ conversation, isNew });
  } catch (err) {
    console.error("getOrCreateConversation error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get All Conversations
// ─────────────────────────────────────────────────────────────────────────────

export const getConversations = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const conversations = await Conversation.find({
      participants: req.user._id,
      deletedFor:   { $nin: [req.user._id] },
    })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("participants", "name username avatar lastSeen")
      .populate({
        path:   "lastMessage",
        select: "text messageType isDeleted createdAt sender",
      })
      .lean();

    // Unread count har conversation ke liye
    const result = conversations.map((conv) => ({
      ...conv,
      unreadCount: conv.unreadCount?.[req.user._id.toString()] || 0,
    }));

    return res.json({ conversations: result, page: parseInt(page) });
  } catch (err) {
    console.error("getConversations error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get Messages in Conversation (paginated)
// ─────────────────────────────────────────────────────────────────────────────

export const getMessages = async (req, res) => {
  try {
    const { conversationId }       = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Access check
    const conversation = await Conversation.findOne({
      _id:          conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(403).json({ message: "Is conversation ka access nahi hai" });
    }

    const messages = await Message.find({
      conversation: conversationId,
      deletedFor:   { $nin: [req.user._id] },
      isDeleted:    false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("sender",  "name username avatar")
      .populate("replyTo", "text messageType sender")
      .lean();

    // Read mark karo + unread reset
    const unreadIds = messages
      .filter((m) => !m.readBy?.includes(req.user._id.toString()))
      .map((m) => m._id);

    if (unreadIds.length > 0) {
      Message.updateMany(
        { _id: { $in: unreadIds } },
        { $addToSet: { readBy: req.user._id } }
      ).exec();

      await conversation.resetUnread(req.user._id);
    }

    return res.json({
      messages: messages.reverse(),
      page:     parseInt(page),
    });
  } catch (err) {
    console.error("getMessages error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Send Message
// ─────────────────────────────────────────────────────────────────────────────

export const sendMessage = async (req, res) => {
  try {
    const { conversationId }            = req.params;
    const { text, messageType, replyTo } = req.body;
    const file                           = req.file;

    // Access check
    const conversation = await Conversation.findOne({
      _id:          conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(403).json({ message: "Is conversation ka access nahi hai" });
    }

    if (!text?.trim() && !file) {
      return res.status(400).json({ message: "Message text ya media zaroori hai" });
    }

    let media       = null;
    let msgType     = messageType || "text";

    if (file) {
      const isVideo      = file.mimetype.startsWith("video/");
      const resourceType = isVideo ? "video" : "image";
      msgType            = isVideo ? "video" : "image";

      const result = await uploadBuffer(file.buffer, {
        folder:        "social/messages",
        resource_type: resourceType,
        quality:       "auto",
      });

      media = { url: result.secure_url, publicId: result.public_id };
    }

    const message = await Message.create({
      conversation: conversationId,
      sender:       req.user._id,
      messageType:  msgType,
      text:         text?.trim() || "",
      media,
      replyTo:      replyTo || null,
    });

    // Conversation update karo
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt:   new Date(),
    });

    // Unread count doosre participants ke liye
    const otherParticipants = conversation.participants.filter(
      (id) => id.toString() !== req.user._id.toString()
    );

    for (const participantId of otherParticipants) {
      await conversation.incrementUnread(participantId);
      emitToUser(participantId.toString(), "newMessage", {
        message,
        conversationId,
      });
    }

    await message.populate("sender", "name username avatar");

    return res.status(201).json({ message });
  } catch (err) {
    console.error("sendMessage error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete Message
// ─────────────────────────────────────────────────────────────────────────────

export const deleteMessage = async (req, res) => {
  try {
    const { messageId }  = req.params;
    const { deleteFor }  = req.body; // "me" | "everyone"

    const message = await Message.findById(messageId);
    if (!message || message.isDeleted) {
      return res.status(404).json({ message: "Message nahi mila" });
    }

    if (deleteFor === "everyone") {
      // Sirf sender delete kar sakta hai, aur sirf 10 minute ke andar
      if (message.sender.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Sirf apna message delete kar sakte ho" });
      }
      const ageMs = Date.now() - new Date(message.createdAt).getTime();
      if (ageMs > 10 * 60 * 1000) {
        return res.status(400).json({ message: "10 minute ke baad sabke liye delete nahi hota" });
      }

      await message.deleteForAll();

      // Socket pe broadcast karo
      const conversation = await Conversation.findById(message.conversation);
      conversation?.participants.forEach((pId) => {
        emitToUser(pId.toString(), "messageDeleted", { messageId, conversationId: message.conversation });
      });
    } else {
      // Sirf apne liye delete
      await message.deleteForUser(req.user._id);
    }

    return res.json({ message: "Message delete ho gaya" });
  } catch (err) {
    console.error("deleteMessage error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Edit Message
// ─────────────────────────────────────────────────────────────────────────────

export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text }      = req.body;

    if (!text?.trim()) return res.status(400).json({ message: "Naya text do" });

    const message = await Message.findById(messageId);
    if (!message || message.isDeleted) {
      return res.status(404).json({ message: "Message nahi mila" });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Sirf apna message edit kar sakte ho" });
    }

    if (message.messageType !== "text") {
      return res.status(400).json({ message: "Sirf text messages edit ho sakte hain" });
    }

    await message.editMessage(text.trim());

    // Socket broadcast
    const conversation = await Conversation.findById(message.conversation);
    conversation?.participants.forEach((pId) => {
      emitToUser(pId.toString(), "messageEdited", {
        messageId,
        newText:   message.text,
        isEdited:  true,
        editedAt:  message.editedAt,
      });
    });

    return res.json({ message: "Message edit ho gaya", updatedMessage: message });
  } catch (err) {
    console.error("editMessage error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Get Total Unread
// ─────────────────────────────────────────────────────────────────────────────

export const getTotalUnread = async (req, res) => {
  try {
    const conversations = await Conversation.find({ 
      participants: req.user._id,
      deletedFor: { $nin: [req.user._id] }
    }).lean();
    
    const total = conversations.reduce((sum, c) => {
      return sum + (c.unreadCount?.[req.user._id.toString()] || 0);
    }, 0);
    
    return res.json({ success: true, unread: total });
  } catch (err) {
    console.error("getTotalUnread error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete Conversation (sirf apne liye)
// ─────────────────────────────────────────────────────────────────────────────

export const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id:          req.params.conversationId,
      participants: req.user._id,
    });

    if (!conversation) return res.status(404).json({ message: "Conversation nahi mili" });

    conversation.deletedFor.addToSet(req.user._id);
    await conversation.save({ validateBeforeSave: false });

    return res.json({ message: "Conversation delete ho gayi (sirf tumhare liye)" });
  } catch (err) {
    console.error("deleteConversation error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// React to Message
// ─────────────────────────────────────────────────────────────────────────────

export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji }     = req.body;
    if (!emoji) return res.status(400).json({ message: "Emoji do" });

    const message = await Message.findById(messageId);
    if (!message || message.isDeleted) {
      return res.status(404).json({ message: "Message nahi mila" });
    }

    const existing = message.reactions.findIndex(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (existing !== -1) {
      message.reactions[existing].emoji = emoji;
    } else {
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save({ validateBeforeSave: false });

    // Broadcast
    const conversation = await Conversation.findById(message.conversation);
    conversation?.participants.forEach((pId) => {
      emitToUser(pId.toString(), "messageReaction", {
        messageId,
        reactions: message.reactions,
      });
    });

    return res.json({ reactions: message.reactions });
  } catch (err) {
    console.error("reactToMessage error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


export const getFollowingForMessages = async (req, res) => {
  try {
    const currentUser = await SocialUser.findById(req.user._id)
      .select("following")
      .populate("following", "name username avatar designation");

    const followingIds = currentUser.following.map((u) => u._id);

    // Conversations dhundho jin mein yeh users hain
    const conversations = await Conversation.find({
      participants: { $in: [req.user._id] },
    })
      .populate("participants", "name username avatar designation")
      .populate("lastMessage")
      .lean();

    const followingList = currentUser.following.map((u) => {
      const conv = conversations.find((c) =>
        c.participants.some((p) => p._id.toString() === u._id.toString())
      );

      const myUnread = conv
        ? (conv.unreadCounts?.find(
            (uc) => uc.user?.toString() === req.user._id.toString()
          )?.count || 0)
        : 0;

      return {
        user: {
          _id:         u._id,
          name:        u.name,
          username:    u.username,
          avatar: u.avatar?.url || (typeof u.avatar === "string" && u.avatar.trim() ? u.avatar : null),
          designation: u.designation,
        },
        conversation: conv || null,
        myUnread,
      };
    });

    return res.json({ followingList });
  } catch (err) {
    console.error("getFollowingForMessages error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};