import fs from "fs";
import imagekit from "../config/imageKit.js";
import { inngest } from "../inngest/index.js";
import Story from "../models/story.model.js";
import User from "../models/user.model.js";
import { emitToUsers } from "../realtime/socket.js";

const addUserStory = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { content, media_type, background_color } = req.body;
    let media = req.file;
    let media_url = "";

    if ((media_type === "image" || media_type === "video") && media) {
      try {
        const fileBuffer = fs.readFileSync(media.path);
        const response = await imagekit.files.upload({
          file: fileBuffer.toString("base64"),
          fileName: media.originalname,
          folder: `story`,
        });
        media_url = response.url;
      } finally {
        try {
          fs.unlinkSync(media.path);
        } catch (_) {}
      }
    }

    const createdStory = await Story.create({
      user: userId,
      content,
      background_color,
      media_url,
      media_type,
    });

    const [story, author] = await Promise.all([
      createdStory.populate("user"),
      User.findById(userId).select("connections followers").lean(),
    ]);

    // Schedule the story deletion after 24 hours
    try {
      await inngest.send({
        name: "app/story.delete",
        data: { storyId: story._id },
      });
    } catch (inngestErr) {
      console.warn("Inngest story deletion scheduling warning:", inngestErr.message);
    }

    emitToUsers(
      [userId, ...(author?.connections || []), ...(author?.followers || [])],
      "story:created",
      story,
    );

    return res
      .status(201)
      .json({ success: true, message: "Story Created", story });
  } catch (error) {
    console.error("Error in addUserStory:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getStory = async (req, res) => {
  try {
    const { userId } = req.auth();
    const user = await User.findById(userId).select("connections following").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const userIds = [userId, ...(user.connections || []), ...(user.following || [])];
    const stories = await Story.find({ user: { $in: userIds } })
      .populate("user")
      .sort({ createdAt: -1 })
      .lean();

    return res
      .status(200)
      .json({ success: true, message: "Stories fetched", stories });
  } catch (error) {
    console.error("Error in getStory:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export { addUserStory, getStory };
