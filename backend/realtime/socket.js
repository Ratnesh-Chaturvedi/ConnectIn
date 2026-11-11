import { verifyToken } from "@clerk/backend";
import { createAdapter } from "@socket.io/mongo-adapter";
import mongoose from "mongoose";
import { Server } from "socket.io";
import Message from "../models/message.model.js";

let socketServer;
const onlineUsers = new Map(); // userId (string) -> Set of socket.id

const userRoom = (userId) => `user:${userId}`;
const profileRoom = (userId) => `profile:${userId}`;
const postRoom = (postId) => `post:${postId}`;
const allowedRoom = /^(feed|directory|profile:[A-Za-z0-9_-]+|post:[a-fA-F0-9]{24})$/;

export const emitToUser = (userId, event, payload) => {
  if (userId) socketServer?.to(userRoom(userId.toString())).emit(event, payload);
};

export const emitToUsers = (userIds, event, payload) => {
  const rooms = [...new Set(userIds.filter(Boolean).map((id) => userRoom(id.toString())))];
  if (rooms.length) socketServer?.to(rooms).emit(event, payload);
};

export const emitToRoom = (room, event, payload) => {
  socketServer?.to(room).emit(event, payload);
};

export const emitToRooms = (rooms, event, payload) => {
  const uniqueRooms = [...new Set(rooms.filter(Boolean))];
  if (uniqueRooms.length) socketServer?.to(uniqueRooms).emit(event, payload);
};

export const emitToSocialRooms = (userIds, event, payload) => {
  const ids = [...new Set(userIds.filter(Boolean).map((id) => id.toString()))];
  emitToRooms(
    ids.flatMap((id) => [userRoom(id), profileRoom(id)]),
    event,
    payload,
  );
};

export const emitToProfile = (userId, event, payload) => {
  if (userId) emitToRoom(profileRoom(userId.toString()), event, payload);
};

export const emitToPost = (postId, event, payload) => {
  if (postId) emitToRoom(postRoom(postId.toString()), event, payload);
};

export const getOnlineUsers = () => Array.from(onlineUsers.keys());
export const isUserOnline = (userId) => (userId ? onlineUsers.has(userId.toString()) : false);

export const initializeSocketServer = async (server) => {
  socketServer = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  // Safe MongoDB adapter initialization with fallback to default in-memory adapter
  try {
    const adapterCollection = mongoose.connection.db.collection(
      "socket.io-adapter-events",
    );
    await adapterCollection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 3600, background: true },
    );
    socketServer.adapter(
      createAdapter(adapterCollection, { addCreatedAtField: true }),
    );
    console.log("Socket.IO MongoDB adapter configured successfully");
  } catch (adapterError) {
    console.warn(
      "Socket.IO MongoDB adapter initialization bypassed (using in-memory adapter):",
      adapterError.message,
    );
  }

  // Clerk authentication middleware for Socket.io
  socketServer.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        next(new Error("Authentication required"));
        return;
      }

      const session = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      if (!session.sub) {
        next(new Error("Invalid session"));
        return;
      }

      socket.data.userId = session.sub;
      next();
    } catch (error) {
      console.error("Socket.IO authentication failed:", error.message);
      next(new Error("Authentication failed"));
    }
  });

  socketServer.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.join(userRoom(userId));

    // Track online user presence
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      socketServer.emit("user:status", { userId, status: "online" });
    }
    onlineUsers.get(userId).add(socket.id);

    // Send currently online users to the newly connected client
    socket.emit("users:online", Array.from(onlineUsers.keys()));

    // Typing indicators
    socket.on("typing:start", ({ to_user_id }) => {
      if (to_user_id) {
        emitToUser(to_user_id, "typing:start", { from_user_id: userId });
      }
    });

    socket.on("typing:stop", ({ to_user_id }) => {
      if (to_user_id) {
        emitToUser(to_user_id, "typing:stop", { from_user_id: userId });
      }
    });

    // Real-time message seen receipt
    socket.on("message:seen", async ({ from_user_id }) => {
      if (!from_user_id) return;
      try {
        await Message.updateMany(
          { from_user_id, to_user_id: userId, seen: false },
          { seen: true },
        );
        emitToUser(from_user_id, "message:seen", { by_user_id: userId });
        emitToUsers([userId, from_user_id], "conversation:updated", {
          userIds: [userId, from_user_id],
        });
      } catch (err) {
        console.error("Error in message:seen handler:", err.message);
      }
    });

    // Room join/leave for feeds, posts, and profiles
    socket.on("room:join", (room, acknowledge) => {
      if (typeof room !== "string" || !allowedRoom.test(room)) {
        acknowledge?.({ success: false });
        return;
      }
      socket.join(room);
      acknowledge?.({ success: true });
    });

    socket.on("room:leave", (room) => {
      if (typeof room === "string" && allowedRoom.test(room)) {
        socket.leave(room);
      }
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          socketServer.emit("user:status", { userId, status: "offline" });
        }
      }
    });
  });

  return socketServer;
};
