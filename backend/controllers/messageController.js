import fs from "fs";
import imagekit from "../config/imageKit.js";
import Message from "../models/message.model.js";
import { emitToUser, emitToUsers } from "../realtime/socket.js";

const sendMessage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { to_user_id, text } = req.body;
    const media = req.file;
    let media_url = "";

    if (!text && !media) {
      return res.status(400).json({ success: false, message: "Message required" });
    }

    const message_type = media ? "media" : "text";
    if (message_type === "media") {
      try {
        const fileBuffer = fs.readFileSync(media.path);
        const response = await imagekit.files.upload({
          file: fileBuffer.toString("base64"),
          fileName: media.originalname,
          folder: `messagemedia`,
        });
        media_url = response.url;
      } finally {
        try {
          fs.unlinkSync(media.path);
        } catch (_) {}
      }
    }

    const message = await Message.create({
      from_user_id: userId,
      to_user_id,
      text: text || "",
      message_type,
      media_url,
    });

    const messageWithUserData = await Message.findById(message._id)
      .populate("from_user_id")
      .populate("to_user_id")
      .lean();

    res.status(200).json({ success: true, message: messageWithUserData || message });

    // Emit to both recipient AND sender for real-time multi-tab / multi-device sync
    emitToUsers([userId, to_user_id], "message:new", messageWithUserData || message);
    emitToUsers([userId, to_user_id], "conversation:updated", {
      userIds: [userId, to_user_id],
      messageId: message._id,
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.body;
    const { userId } = req.auth();

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Only the sender can delete their message
    if (message.from_user_id !== userId) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to delete this message" });
    }

    const to_user_id = message.to_user_id;
    await Message.findByIdAndDelete(messageId);

    // Emit to both sender and recipient so multi-device stays in sync
    emitToUsers([userId, to_user_id], "message:deleted", { messageId });
    emitToUsers([userId, to_user_id], "conversation:updated", {
      userIds: [userId, to_user_id],
      messageId,
    });

    res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error in deleteMessage:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get chat messages
const getMessage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { to_user_id } = req.body;

    const messages = await Message.find({
      $or: [
        { from_user_id: userId, to_user_id },
        { from_user_id: to_user_id, to_user_id: userId },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    // Mark incoming messages as seen
    const updateResult = await Message.updateMany(
      { from_user_id: to_user_id, to_user_id: userId, seen: false },
      { seen: true },
    );

    if (updateResult.modifiedCount > 0) {
      emitToUser(to_user_id, "message:seen", { by_user_id: userId });
      emitToUsers([userId, to_user_id], "conversation:updated", {
        userIds: [userId, to_user_id],
      });
    }

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error in getMessage:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Mark conversation as seen via API
const markSeen = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { from_user_id } = req.body;

    if (!from_user_id) {
      return res.status(400).json({ success: false, message: "from_user_id required" });
    }

    const updateResult = await Message.updateMany(
      { from_user_id, to_user_id: userId, seen: false },
      { seen: true },
    );

    if (updateResult.modifiedCount > 0) {
      emitToUser(from_user_id, "message:seen", { by_user_id: userId });
      emitToUsers([userId, from_user_id], "conversation:updated", {
        userIds: [userId, from_user_id],
      });
    }

    res.status(200).json({ success: true, message: "Messages marked as seen" });
  } catch (error) {
    console.error("Error in markSeen:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getUserRecentMessages = async (req, res) => {
  try {
    const { userId } = req.auth();
    const messages = await Message.find({
      $or: [{ to_user_id: userId }, { from_user_id: userId }],
    })
      .populate("from_user_id to_user_id")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error in getUserRecentMessages:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export {
  getUserRecentMessages,
  getMessage,
  sendMessage,
  deleteMessage,
  markSeen,
};
