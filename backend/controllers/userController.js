import fs from "fs";
import User from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";

import imagekit from "../config/imageKit.js";
import Connection from "../models/connection.model.js";
import Post from "../models/post.model.js";
import { inngest } from "../inngest/index.js";
import { emitToRooms, emitToSocialRooms } from "../realtime/socket.js";

const emitSocialChange = (userIds) => {
  const ids = [...new Set(userIds.filter(Boolean).map((id) => id.toString()))];
  const payload = { userIds: ids };
  emitToSocialRooms(ids, "social:updated", payload);
};


// controller to get the userData using userID
const getUserData = async (req, res) => {
  try {
    const { userId } = req.auth();

    if (!userId) {
      throw new ApiError(401, "Unauthorized: No userId found");
    }
    const userData = await User.findById(userId);
    if (!userData) {
      throw new ApiError(400, "Error User not found");
    }
    return res.status(200).json({ success: true, user: userData });
  } catch (error) {
    console.log(error);
    res.status(200).json({ success: false, message: error.message });
  }
};

const updateUserData = async (req, res) => {
  try {
    const { userId } = req.auth();
    let { username, bio, full_name, location } = req.body;

    const tempUser = await User.findById(userId);
    if (!tempUser) {
      throw new ApiError(400, "user not found");
    }

    // Fix username fallback
    if (!username) {
      username = tempUser.username;
    }

    if (tempUser.username !== username) {
      const tempUser2 = await User.findOne({ username });
      if (tempUser2) {
        username = tempUser.username;
      }
    }

    const updatedData = {
      username,
      bio,
      location,
      full_name,
    };

    // Safe file access
    const profile = req.files?.profile?.[0];
    const cover = req.files?.cover?.[0];

    console.log("Profile:", profile, "Cover:", cover);

    if (profile) {
      const buffer = fs.readFileSync(profile.path);

      const response = await imagekit.files.upload({
        file: buffer.toString("base64"),
        fileName: profile.originalname,
        folder: `/users/${userId}/profile`,
      });

      console.log("profile response:", response);

      if (!response?.url) {
        throw new Error("Profile upload failed");
      }

      updatedData.profile_picture = response.url;
    }

    if (cover) {
      const buffer = fs.readFileSync(cover.path);

      const response = await imagekit.files.upload({
        file: buffer.toString("base64"),
        fileName: cover.originalname,
        folder: `/users/${userId}/cover`,
      });

      console.log("cover response:", response);

      if (!response?.url) {
        throw new Error("Cover upload failed");
      }

      // 🔥 FIX: Use response.url directly
      updatedData.cover_photo = response.url;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
      new: true,
    });

    emitToRooms(
      [`user:${userId}`, `profile:${userId}`, "directory"],
      "profile:updated",
      updatedUser,
    );

    return res.status(200).json({
      success: true,
      user: updatedUser,
      message: "Data updated Successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// find user using username ,email,location,name

const discoverUser = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { input } = req.body;
    const searchTerm = input?.trim();

    if (!searchTerm) {
      return res.status(200).json({
        success: true,
        message: "No search term provided",
        filteredUsers: [],
      });
    }

    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchPattern = new RegExp(escapedSearchTerm, "i");

    const filteredUsers = await User.find({
      _id: { $ne: userId },
      $or: [
        { username: searchPattern },
        { email: searchPattern },
        { location: searchPattern },
        { full_name: searchPattern },
        { bio: searchPattern },
      ],
    })
      .select("-__v")
      .limit(30)
      .lean();

    return res
      .status(200)
      .json({ success: true, message: "Users fetched", filteredUsers });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// follow user

const followUser = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.body; // id of the user we want to follow
    // here we should add the user in following list  and in that user followers list

    const  currentUser = await User.findById(userId);

    //check that the user already followed it or not
    if (currentUser.following.includes(id)) {
      return res.status(200).json({
        success: true,
        message: "You are already following this user ",
      });
    }

    currentUser.following.push(id);
    await currentUser.save();

    const  followedUser = await User.findById(id);
    followedUser.followers.push(userId);
    await followedUser.save();

    emitSocialChange([userId, id]);

    return res.status(200).json({
      success: true,
      message: "Now you are following this user",
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// unfollow the user

const UnfollowUser = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.body; // id of the user we want to unfollow
    // here we should add the user in following list  and in that user followers list

    let currentUser = await User.findById(userId);
    // remove the id of the followed used
    currentUser.following = currentUser.following.filter(uid=> uid!== id);
    await currentUser.save();

    //remove from the followers list of the followed user
    let followedUser = await User.findById(id);
    followedUser.followers = followedUser.followers.filter(uid =>uid !== userId);
    await followedUser.save();

    emitSocialChange([userId, id]);

    return res.status(200).json({
      success: true,
      message: "Unfollwed successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

//send Connection request
const sendConnectionRequest = async (req, res) => {
  try {
    // we also send a email to the user that we send a connection request

    const { userId } = req.auth();
    const { id } = req.body;
    if(!id){
      return res.status(404).json({success:false,message:"Pass the ID "})
    }
    // check if the user send more than 20 connection request in the last 24 hour
    const last24hour = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cnnectionRequests = await Connection.find({
      from_user_id: userId,
      createdAt: { $gt: last24hour },
    });
    if (cnnectionRequests.length > 20) {
     return res.status(404).json({success:false,message:"You can't send more than 20 request in 24 hours"})
    }
    // check if user is already connected
    const isConnected = await Connection.findOne({
      $or: [
        { from_user_id: userId, to_user_id: id },
        { from_user_id: id, to_user_id: userId },
      ],
    });
    if (!isConnected) {
      const newConnection = await Connection.create({
        from_user_id: userId,
        to_user_id: id,
      });

      //send the email when the connection request is send and send again after 24 hours
      await inngest.send({
        name: "app/connection-request",
        data: { connectionId: newConnection._id },
      });

      return res
        .status(200)
        .json({
            success:true,
            newConnection,
            message:"Connection request send Successfully",
    });
    } else if (isConnected && isConnected.status === "accepted") {
      return res.status(400).json({success:false,message:"User is already  connected"});
    }

    return res.status(200).json({
      success: false,
      message: "Connection request is pending",
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({success:false,message:"Error in connection"})
  }
};

// get all the user connection

const getAllConnections = async (req, res) => {
  try {
    const { userId } = req.auth();
    const user = await User.findById(userId).populate(
      "connections followers following",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const connections = user.connections;
    const followers = user.followers;
    const following = user.following;

    const pendingConnection = (
      await Connection.find({ to_user_id: userId, status: "pending" }).populate(
        "from_user_id",
      )
    ).map((connection) => connection.from_user_id);

    return res.json({
      success: true,
      connections,
      followers,
      following,
      pendingConnection,
      message:"Connection is Pending"
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

//accept the connection request
const acceptConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.body;

    const connection = await Connection.findOne({
      from_user_id: id,
      to_user_id: userId,
      status: "pending",
    });

    if (!connection) {
      return res.status(400).json({success:false,message:"Connection not found"})
    }
    await Promise.all([
      User.findByIdAndUpdate(userId, { $addToSet: { connections: id } }),
      User.findByIdAndUpdate(id, { $addToSet: { connections: userId } }),
    ]);

    connection.status = "accepted";
    await connection.save();

    emitSocialChange([userId, id]);

    return res.json({
      success: true,
      message: "Connection accepted successfully",
    });
  } catch (error) {
    console.log(error);
    throw new ApiError(400, error.message);
  }
};

// get the profile details and the post uploaded by the other user when we click on his profile

const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { profileId } = req.body;

    const profile = await User.findById(profileId);
    if (!profile) {
      return res
        .status(400)
        .json({ success: false, message: "USer profile not found" });
    }
    const posts = await Post.find({ user: profileId }).populate("user");
    const connection = await Connection.findOne({
      $or: [
        { from_user_id: userId, to_user_id: profileId },
        { from_user_id: profileId, to_user_id: userId },
      ],
    }).select("from_user_id status");

    let connectionStatus = "none";
    if (
      profile.connections.includes(userId) ||
      connection?.status === "accepted"
    ) {
      connectionStatus = "connected";
    } else if (connection?.status === "pending") {
      connectionStatus =
        connection.from_user_id === userId
          ? "outgoing_pending"
          : "incoming_pending";
    }

    return res.status(200).json({
      success: true,
      message: "Profile and posts fetched",
      profile,
      posts,
      connectionStatus,
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// remove the connection between 2 user
const removeConnection = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { profileId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not Authenticated",
      });
    }

    const toUser = await User.findById(profileId);
    if (!toUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

   
    user.connections = user.connections.filter(
      (id) => id.toString() !== profileId
    );

    toUser.connections = toUser.connections.filter(
      (id) => id.toString() !== userId
    );

    await user.save();
    await toUser.save();

    // ✅ remove from connection collection
    await Connection.findOneAndDelete({
      $or: [
        { from_user_id: userId, to_user_id: profileId },
        { from_user_id: profileId, to_user_id: userId },
      ],
    });

    emitSocialChange([userId, profileId]);

    return res.status(200).json({
      success: true,
      message: "Connection removed",
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
// show random users in the discover page without searching 
const showRandomUsers=async (req,res)=>{
  try {
    const {userId}=req.auth();
    if(!userId){
      return res.status(401).json({message:"Not Authenticated"})
    }
    const user=await User.findById(userId);
    // the ids of user which are  in the connection or following list
    const excludeIds=[userId,...user.connections,user.following]
    // finding random 10 users
    const randomUsers = await User.aggregate([
      { $match: { _id: { $nin: excludeIds } } }, // exclude users
      { $sample: { size: 10 } }                  // randomly pick 10
    ]);

    return res.status(200).json({success:true,users:randomUsers})
  } catch (error) {
     console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
}


// toggle the follow and unfollow

const toggleFollow = async (req, res) => {
  try {
    const { userId } = req.auth(); // current logged-in user
    const { profileId } = req.params; // user to follow/unfollow

    if (userId === profileId) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot follow yourself" });
    }

    const user = await User.findById(userId);
    const profileUser = await User.findById(profileId);

    if (!user || !profileUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if already following
    if (user.following.includes(profileId)) {
      // Remove profile from following list
      user.following = user.following.filter((id) => id !== profileId);

      // Remove current user from profile's followers
      profileUser.followers = profileUser.followers.filter((id) => id !== userId);
    } else {
      // Add profile to following list
      user.following.push(profileId);

      // Add current user to profile's followers
      profileUser.followers.push(userId);
    }

    // Save both users
    await user.save();
    await profileUser.save();

    emitSocialChange([userId, profileId]);

    return res.status(200).json({ success: true, message: "Success" });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export {
  getUserData,
  updateUserData,
  followUser,
  UnfollowUser,
  discoverUser,
  sendConnectionRequest,
  acceptConnectionRequest,
  getAllConnections,
  getUserProfile,
  removeConnection,
  showRandomUsers,
  toggleFollow
};
