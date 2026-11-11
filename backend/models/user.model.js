import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    full_name: { type: String, required: true, index: true },
    username: { type: String, unique: true, sparse: true, index: true },
    bio: { type: String, default: "Hello i am using ConnectIn. Let's Connect " },
    cover_photo: { type: String, default: "" },
    profile_picture: { type: String, default: "" },
    location: { type: String, default: "" },
    followers: [
      {
        type: String,
        ref: "User",
      },
    ],
    connections: [{ type: String, ref: "User" }],
    following: [{ type: String, ref: "User" }],
  },
  { timestamps: true },
);

userSchema.index({ connections: 1 });
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });

const User = mongoose.model("User", userSchema);
export default User;
