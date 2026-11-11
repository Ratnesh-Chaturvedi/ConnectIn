import fs from "fs";
import imagekit from "../config/imageKit.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Comment from "../models/comment.model.js";
import { emitToRooms } from "../realtime/socket.js";

const emitPostChange = (post, event, payload) => {
  const userId = post.user?._id || post.user;
  emitToRooms(
    ["feed", `profile:${userId}`, `post:${post._id}`],
    event,
    payload,
  );
};

// Add a post
const addPost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { content, post_type } = req.body;
    const images = req.files;
    let image_urls = [];

    if (images && images.length > 0) {
      image_urls = await Promise.all(
        images.map(async (image) => {
          try {
            const fileBuffer = fs.readFileSync(image.path);
            const response = await imagekit.files.upload({
              file: fileBuffer.toString("base64"),
              fileName: image.originalname,
              folder: `posts`,
            });
            return response.url;
          } finally {
            try {
              fs.unlinkSync(image.path);
            } catch (_) {}
          }
        }),
      );
    }

    // Accurately determine post_type
    let finalPostType = post_type;
    if (image_urls.length > 0 && content?.trim()) {
      finalPostType = "text_with_image";
    } else if (image_urls.length > 0) {
      finalPostType = "image";
    } else {
      finalPostType = "text";
    }

    const createdPost = await Post.create({
      user: userId,
      content: content || "",
      image_urls,
      post_type: finalPostType,
    });
    const post = await createdPost.populate("user");

    emitPostChange(post, "post:created", post);
    return res.status(201).json({ success: true, post, message: "Post created" });
  } catch (error) {
    console.error("Error in addPost:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getFeedPost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { seenPosts = [] } = req.body;

    const seenPostsArr = Array.isArray(seenPosts)
      ? seenPosts.filter((id) => typeof id === "string")
      : [];

    const LIMIT = 10;

    const user = await User.findById(userId).select("connections following").lean();
    const priorityUsers = [
      userId,
      ...(user?.connections || []),
      ...(user?.following || []),
    ];

    // Step 1: Priority posts from connections/following
    let priorityPosts = await Post.find({
      user: { $in: priorityUsers },
      _id: { $nin: seenPostsArr },
    })
      .sort({ createdAt: -1 })
      .limit(Math.ceil(LIMIT / 2))
      .populate("user")
      .lean();

    priorityPosts = priorityPosts.filter((p) => p.user);

    // Step 2: Random posts from other users
    const remaining = LIMIT - priorityPosts.length;
    let randomPosts = [];

    if (remaining > 0) {
      const randomRaw = await Post.aggregate([
        {
          $match: {
            user: { $nin: priorityUsers },
            _id: { $nin: seenPostsArr },
          },
        },
        { $sample: { size: remaining * 2 } },
      ]);

      const populated = await Post.populate(randomRaw, { path: "user" });
      randomPosts = populated.filter((p) => p.user);
    }

    // Step 3: Fill remaining if needed
    let finalPosts = [...priorityPosts, ...randomPosts];
    if (finalPosts.length < LIMIT) {
      const extra = await Post.find({
        _id: {
          $nin: [...seenPostsArr, ...finalPosts.map((p) => p._id.toString())],
        },
      })
        .sort({ createdAt: -1 })
        .limit(LIMIT - finalPosts.length)
        .populate("user")
        .lean();

      finalPosts = [...finalPosts, ...extra.filter((p) => p.user)];
    }

    // Step 4: Remove duplicates
    const seenIds = new Set();
    finalPosts = finalPosts.filter((p) => {
      const idStr = p._id.toString();
      if (seenIds.has(idStr)) return false;
      seenIds.add(idStr);
      return true;
    });

    // Step 5: Light shuffle
    finalPosts.sort(() => Math.random() - 0.5);

    return res.status(200).json({ success: true, posts: finalPosts });
  } catch (error) {
    console.error("Error in getFeedPost:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const toggleLikePost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { postId } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    if (post.likes_count.includes(userId)) {
      post.likes_count = post.likes_count.filter(
        (user) => user.toString() !== userId,
      );
    } else {
      post.likes_count.push(userId);
    }
    await post.save();

    const payload = { postId: post._id, likes_count: post.likes_count };
    emitPostChange(post, "post:updated", payload);

    return res.status(200).json({
      success: true,
      likes_count: post.likes_count,
      message: post.likes_count.includes(userId) ? "Post liked" : "Post Unliked",
    });
  } catch (error) {
    console.error("Error in toggleLikePost:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get single post
const singlePost = async (req, res) => {
  try {
    const { userId } = req.auth();
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not Authenticated" });
    }
    const { postId } = req.params;
    if (!postId) {
      return res.status(404).json({ success: false, message: "Postid is mandatory" });
    }
    const post = await Post.findById(postId).populate("user").lean();
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    return res.status(200).json({ success: true, post, message: "Post fetched" });
  } catch (error) {
    console.error("Error in singlePost:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const { userId } = req.auth();
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not Authenticated" });
    }
    const { postId } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    if (post.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own posts",
      });
    }

    await post.deleteOne();
    await Comment.deleteMany({ post: postId });

    emitPostChange(post, "post:deleted", { postId: post._id });
    return res.status(200).json({ success: true, message: "Post Deleted" });
  } catch (error) {
    console.error("Error in deletePost:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export { addPost, getFeedPost, toggleLikePost, singlePost, deletePost };
