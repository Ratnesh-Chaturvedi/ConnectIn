import mongoose from "mongoose";

const ConnectionSchema = new mongoose.Schema(
  {
    from_user_id: {
      type: String,
      required: true,
      ref: "User",
      index: true,
    },
    to_user_id: {
      type: String,
      required: true,
      ref: "User",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

ConnectionSchema.index({ from_user_id: 1, to_user_id: 1 });
ConnectionSchema.index({ to_user_id: 1, status: 1 });
ConnectionSchema.index({ from_user_id: 1, createdAt: -1 });

const Connection = mongoose.model("Connection", ConnectionSchema);

export default Connection;
