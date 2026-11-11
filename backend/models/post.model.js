import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    user: { type: String, ref: "User", required: true, index: true },
    content: { type: String, default: "" },
    image_urls: [{ type: String }],
    post_type: {
      type: String,
      enum: ["text", "text_with_image", "image"],
      required: true,
      default: "text",
    },
    likes_count: [{ type: String, ref: "User" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  },
  { timestamps: true },
);

postSchema.index({ createdAt: -1 });
postSchema.index({ user: 1, createdAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
