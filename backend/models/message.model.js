import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    from_user_id: {
      type: String,
      ref: "User",
      required: true,
      index: true,
    },
    to_user_id: {
      type: String,
      ref: "User",
      required: true,
      index: true,
    },
    text: { type: String, trim: true, default: "" },
    message_type: { type: String, enum: ["text", "media"], default: "text" },
    media_url: { type: String, default: "" },
    seen: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, minimize: false },
);

messageSchema.index({ from_user_id: 1, to_user_id: 1, createdAt: -1 });
messageSchema.index({ to_user_id: 1, from_user_id: 1, createdAt: -1 });
messageSchema.index({ to_user_id: 1, createdAt: -1 });
messageSchema.index({ from_user_id: 1, createdAt: -1 });
messageSchema.index({ to_user_id: 1, seen: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
