import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { useAuth, useUser } from "@clerk/clerk-react";
import api from "../api/axios.js";
import { useRealtime, useRealtimeEvent } from "../realtime/RealtimeProvider.jsx";

const RecentMessages = () => {
  const [messages, setMessages] = useState([]);
  const { getToken } = useAuth();
  const { user } = useUser();
  const { isUserOnline } = useRealtime() || {};

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getToken();
      const { data } = await api.get("/api/user/recent-messages", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        const groupedMessages = data.messages.reduce((acc, message) => {
          const fromId = message.from_user_id?._id || message.from_user_id;
          const otherUser =
            fromId === user.id ? message.to_user_id : message.from_user_id;

          if (!otherUser) return acc;

          const conversationId = otherUser._id || otherUser;

          if (
            !acc[conversationId] ||
            new Date(message.createdAt) > new Date(acc[conversationId].createdAt)
          ) {
            acc[conversationId] = {
              ...message,
              displayUser: otherUser,
            };
          }
          return acc;
        }, {});

        const sortedMessages = Object.values(groupedMessages).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );

        setMessages(sortedMessages);
      }
    } catch (error) {
      console.error("Message Fetch Error:", error);
    }
  }, [getToken, user]);

  useRealtimeEvent("conversation:updated", fetchMessages);
  useRealtimeEvent("message:seen", fetchMessages);

  useEffect(() => {
    const timer = window.setTimeout(fetchMessages, 0);
    return () => window.clearTimeout(timer);
  }, [fetchMessages]);

  if (messages.length === 0) return null;

  return (
    <div className="bg-white w-full max-w-xs mt-4 p-4 rounded-md shadow text-xs">
      <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2">
        Recent Messages
      </h3>
      <div className="flex flex-col max-h-64 overflow-y-auto no-scrollbar space-y-1">
        {messages.map((message) => {
          const fromId = message.from_user_id?._id || message.from_user_id;
          const isMine = fromId === user?.id;
          const otherUserId = message.displayUser?._id || message.displayUser;
          const online = isUserOnline ? isUserOnline(otherUserId) : false;

          return (
            <Link
              to={`/messages/${otherUserId}`}
              key={message._id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="relative shrink-0">
                <img
                  src={
                    message.displayUser.profile_picture || "/default-avatar.png"
                  }
                  alt="profile"
                  className="w-9 h-9 rounded-full object-cover border border-slate-100"
                />
                {online && (
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <p className="font-semibold text-slate-900 truncate">
                    {message.displayUser.full_name}
                  </p>
                  <p className="text-[9px] text-slate-400 whitespace-nowrap ml-2">
                    {moment(message.createdAt).fromNow(true)}
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-slate-500 truncate pr-2">
                    {isMine ? "You: " : ""}
                    {message.text ? message.text : "Sent an attachment"}
                  </p>
                  {!message.seen && !isMine && (
                    <span className="bg-indigo-500 w-2 h-2 rounded-full flex-shrink-0" />
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default RecentMessages;
