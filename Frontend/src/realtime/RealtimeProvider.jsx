/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useDispatch } from "react-redux";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import Notification from "../components/Notification.jsx";
import { fetchConnections } from "../features/connections/connectionSlice.js";
import {
  addMessages,
  fetchMessages,
  markMessagesAsSeen,
  removeMessage,
} from "../features/messages/messageSlice.js";
import { fetchUser } from "../features/users/userSlice.js";

const RealtimeContext = createContext(null);

export const RealtimeProvider = ({ children }) => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const socketRef = useRef(null);
  const pathnameRef = useRef(pathname);
  const roomsRef = useRef(new Set());
  const listenersRef = useRef(new Map());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!user?.id) return undefined;

    let hasConnected = false;
    const client = io(import.meta.env.VITE_BACKEND_URL, {
      auth: async (callback) => {
        try {
          callback({ token: await getToken() });
        } catch {
          callback({});
        }
      },
      transports: ["websocket", "polling"],
      reconnectionDelayMax: 30_000,
    });
    socketRef.current = client;

    const refreshAfterReconnect = async () => {
      roomsRef.current.forEach((room) => client.emit("room:join", room));
      if (!hasConnected) {
        hasConnected = true;
        return;
      }

      try {
        const token = await getToken();
        dispatch(fetchUser(token));
        dispatch(fetchConnections(token));

        const chatMatch = pathnameRef.current.match(/^\/messages\/([^/]+)$/);
        if (chatMatch) {
          const partnerId = decodeURIComponent(chatMatch[1]);
          dispatch(
            fetchMessages({
              token,
              userId: partnerId,
            }),
          );
          client.emit("message:seen", { from_user_id: partnerId });
        }
      } catch (error) {
        console.error("Unable to refresh data after reconnect:", error);
      }
    };

    const refreshSocialData = async (payload) => {
      const affectedUserIds = payload?.userIds || [payload?._id];
      if (!affectedUserIds.includes(user.id)) return;

      try {
        const token = await getToken();
        dispatch(fetchUser(token));
        dispatch(fetchConnections(token));
      } catch (error) {
        console.error("Unable to refresh social data:", error);
      }
    };

    client.on("connect", refreshAfterReconnect);
    client.on("social:updated", refreshSocialData);
    client.on("profile:updated", refreshSocialData);

    client.on("users:online", (userIds) => {
      if (Array.isArray(userIds)) {
        setOnlineUsers(new Set(userIds));
      }
    });

    client.on("user:status", ({ userId, status }) => {
      if (!userId) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === "online") next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    client.on("message:deleted", ({ messageId }) => {
      dispatch(removeMessage(messageId));
    });

    client.on("message:seen", ({ by_user_id }) => {
      dispatch(markMessagesAsSeen({ userId: by_user_id }));
    });

    client.on("message:new", (message) => {
      const senderId = message.from_user_id?._id ?? message.from_user_id;
      const recipientId = message.to_user_id?._id ?? message.to_user_id;
      const isFromMe = senderId === user.id;
      const activePartner = isFromMe ? recipientId : senderId;

      if (pathnameRef.current === `/messages/${activePartner}`) {
        dispatch(addMessages(message));
        if (!isFromMe) {
          client.emit("message:seen", { from_user_id: senderId });
        }
        return;
      }

      if (!isFromMe) {
        toast.custom(
          (toastInstance) => (
            <Notification t={toastInstance} message={message} />
          ),
          { position: "bottom-right" },
        );
      }
    });

    client.on("connect_error", (error) => {
      console.error("Socket.IO connection failed:", error.message);
    });

    listenersRef.current.forEach((listeners, event) => {
      listeners.forEach((listener) => client.on(event, listener));
    });

    return () => {
      client.disconnect();
      socketRef.current = null;
    };
  }, [dispatch, getToken, user?.id]);

  const joinRoom = useCallback((room) => {
    if (!room) return;
    roomsRef.current.add(room);
    if (socketRef.current?.connected) {
      socketRef.current.emit("room:join", room);
    }
  }, []);

  const leaveRoom = useCallback((room) => {
    if (!room) return;
    roomsRef.current.delete(room);
    if (socketRef.current?.connected) {
      socketRef.current.emit("room:leave", room);
    }
  }, []);

  const emit = useCallback((event, payload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, payload);
    }
  }, []);

  const subscribe = useCallback((event, listener) => {
    const listeners = listenersRef.current.get(event) || new Set();
    listeners.add(listener);
    listenersRef.current.set(event, listeners);
    socketRef.current?.on(event, listener);

    return () => {
      listeners.delete(listener);
      if (!listeners.size) listenersRef.current.delete(event);
      socketRef.current?.off(event, listener);
    };
  }, []);

  const isUserOnline = useCallback(
    (targetUserId) => (targetUserId ? onlineUsers.has(targetUserId.toString()) : false),
    [onlineUsers],
  );

  const value = useMemo(
    () => ({
      joinRoom,
      leaveRoom,
      subscribe,
      emit,
      onlineUsers,
      isUserOnline,
    }),
    [joinRoom, leaveRoom, subscribe, emit, onlineUsers, isUserOnline],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  return useContext(RealtimeContext);
};

export const useRealtimeEvent = (event, handler) => {
  const context = useContext(RealtimeContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!context || !event) return undefined;
    const listener = (...args) => handlerRef.current(...args);
    return context.subscribe(event, listener);
  }, [context, event]);
};

export const useRealtimeRoom = (room) => {
  const context = useContext(RealtimeContext);

  useEffect(() => {
    if (!context || !room) return undefined;
    context.joinRoom(room);
    return () => context.leaveRoom(room);
  }, [context, room]);
};
