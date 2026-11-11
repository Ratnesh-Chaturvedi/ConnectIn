import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    user: { type: String, ref: "User", required: true, index: true },
    content: { type: String, default: "" },
    media_url: [{ type: String }],
    media_type: {
      type: String,
      enum: ["text", "image", "video"],
      required: true,
    },
    views_count: { type: String, ref: "User" },
    background_color: { type: String, default: "" },
  },
  { timestamps: true },
);

storySchema.index({ user: 1, createdAt: -1 });
storySchema.index({ createdAt: -1 });

const Story = mongoose.model("Story", storySchema);

export default Story;
