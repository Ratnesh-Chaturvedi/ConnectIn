import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema(
  {
    user: {
      type: String,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    likes_count: [
      {
        type: Schema.Types.ObjectId,
        ref: "Likes",
      },
    ],
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, createdAt: -1 });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
