import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ImageIcon,
  Loader2,
  SendHorizonal,
  Trash2,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import moment from "moment";
import {
  addMessages,
  fetchMessages,
  removeMessage,
  resetMessages,
} from "../features/messages/messageSlice.js";
import api from "../api/axios.js";
import { useRealtime, useRealtimeEvent } from "../realtime/RealtimeProvider.jsx";

const ChatBox = () => {
  const { messages } = useSelector((state) => state.messages);
  const connections = useSelector((state) => state.connections?.connections || []);
  const { user: currentUser } = useUser();
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const messageEndRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef(null);

  const { userId } = useParams();
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isUserOnline, emit } = useRealtime() || {};

  const isOnline = isUserOnline ? isUserOnline(userId) : false;

  // Group messages by date
  const groupMessagesByDate = (msgs) => {
    const groups = {};
    const sorted = [...msgs].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    );

    sorted.forEach((msg) => {
      const date = moment(msg.createdAt).format("YYYY-MM-DD");
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const fetchUserMessages = async () => {
    try {
      const token = await getToken();
      dispatch(fetchMessages({ token, userId }));
    } catch {
      toast.error("Error loading chat history");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) return;

    try {
      const token = await getToken();
      const { data } = await api.delete("/api/message/delete", {
        headers: { Authorization: `Bearer ${token}` },
        data: { messageId },
      });

      if (data.success) {
        toast.success("Deleted");
        dispatch(removeMessage(messageId));
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (!isTypingRef.current && emit) {
      isTypingRef.current = true;
      emit("typing:start", { to_user_id: userId });
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      if (emit) emit("typing:stop", { to_user_id: userId });
    }, 2000);
  };

  const sendMessages = async () => {
    if ((!text.trim() && !image) || sending) return;
    setSending(true);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    isTypingRef.current = false;
    if (emit) emit("typing:stop", { to_user_id: userId });

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("text", text.trim());
      formData.append("to_user_id", userId);
      if (image) formData.append("media", image);

      const { data } = await api.post("/api/message/send", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setImage(null);
        setText("");
        dispatch(addMessages(data.message));
      }
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Realtime typing listeners
  useRealtimeEvent("typing:start", ({ from_user_id }) => {
    if (from_user_id === userId) setPartnerTyping(true);
  });

  useRealtimeEvent("typing:stop", ({ from_user_id }) => {
    if (from_user_id === userId) setPartnerTyping(false);
  });

  // Mark incoming messages as seen when chat is active
  useEffect(() => {
    if (emit && userId) {
      emit("message:seen", { from_user_id: userId });
    }
  }, [userId, messages.length, emit]);

  useEffect(() => {
    fetchUserMessages();
    return () => {
      dispatch(resetMessages());
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTypingRef.current && emit) {
        emit("typing:stop", { to_user_id: userId });
      }
    };
  }, [userId]);

  // Robust user resolution: check connections first, then fallback to API
  useEffect(() => {
    let isMounted = true;

    const resolveUser = async () => {
      // 1. Try finding in loaded connections
      if (connections && connections.length > 0) {
        const found = connections.find((c) => c._id === userId);
        if (found) {
          if (isMounted) {
            setUser(found);
            setLoadingUser(false);
          }
          return;
        }
      }

      // 2. Fallback: Fetch profile directly
      try {
        const token = await getToken();
        const { data } = await api.post(
          "/api/user/profile",
          { profileId: userId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (isMounted && data.success && data.profile) {
          setUser(data.profile);
        }
      } catch (err) {
        console.error("Error resolving chat user:", err);
      } finally {
        if (isMounted) setLoadingUser(false);
      }
    };

    resolveUser();

    return () => {
      isMounted = false;
    };
  }, [connections, userId, getToken]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  const groupedMessages = groupMessagesByDate(messages);

  if (loadingUser) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center">
        <Loader2 className="size-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 mt-2">Opening conversation...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center p-6 text-center">
        <p className="text-slate-700 font-semibold mb-2">User not found</p>
        <p className="text-xs text-slate-500 mb-4">
          This user profile could not be loaded.
        </p>
        <button
          onClick={() => navigate("/messages")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          Back to Messages
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* HEADER */}
      <div className="flex items-center justify-between p-3 md:px-10 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/messages")}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="Back to messages"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="relative">
            <img
              src={user.profile_picture || "/default-avatar.png"}
              alt=""
              className="size-10 rounded-full border border-gray-100 object-cover"
            />
            <span
              className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white ${
                isOnline ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
          </div>
          <div className="flex flex-col">
            <p className="font-semibold text-slate-800 leading-tight">
              {user.full_name}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">@{user.username}</span>
              <span className="text-slate-300">•</span>
              <span
                className={`text-[11px] font-medium ${
                  isOnline ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {isOnline ? "Active Now" : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MESSAGES LIST */}
      <div className="flex-1 overflow-y-scroll no-scrollbar bg-[#f8fafc] px-4 md:px-10 py-4">
        <div className="max-w-4xl mx-auto">
          {Object.keys(groupedMessages).map((date) => (
            <div key={date}>
              {/* Center Date Header */}
              <div className="flex justify-center my-6">
                <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-widest shadow-sm">
                  {moment(date).calendar(null, {
                    lastDay: "[Yesterday]",
                    sameDay: "[Today]",
                    lastWeek: "dddd",
                    sameElse: "MMMM D, YYYY",
                  })}
                </span>
              </div>

              <div className="space-y-4">
                {groupedMessages[date].map((msg) => {
                  const isMine =
                    msg.from_user_id === currentUser?.id ||
                    msg.from_user_id?._id === currentUser?.id;
                  return (
                    <div
                      key={msg._id}
                      className={`flex ${!isMine ? "justify-start" : "justify-end"} group relative`}
                    >
                      <div
                        className={`relative px-4 py-2.5 max-w-[85%] md:max-w-md shadow-sm transition-all ${
                          !isMine
                            ? "bg-white text-slate-800 rounded-2xl rounded-tl-none border border-slate-100"
                            : "bg-indigo-600 text-white rounded-2xl rounded-tr-none"
                        }`}
                      >
                        {isMine && (
                          <button
                            onClick={() => handleDeleteMessage(msg._id)}
                            className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all p-2 text-red-400 hover:text-red-600 cursor-pointer"
                            title="Delete message"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}

                        {msg.message_type === "media" && msg.media_url && (
                          <img
                            src={msg.media_url}
                            className="w-full rounded-xl mb-2 object-cover max-h-72"
                            alt="media attachment"
                          />
                        )}

                        {msg.text && (
                          <p className="text-[14px] leading-relaxed break-words">
                            {msg.text}
                          </p>
                        )}

                        {/* Timestamp & Seen Receipts */}
                        <div
                          className={`text-[9px] flex items-center justify-end gap-1 mt-1.5 font-semibold opacity-75 ${
                            isMine ? "text-indigo-100" : "text-slate-500"
                          }`}
                        >
                          <span>{moment(msg.createdAt).format("h:mm A")}</span>
                          {isMine && (
                            <span>
                              {msg.seen ? (
                                <CheckCheck className="size-3 text-indigo-100" />
                              ) : (
                                <Check className="size-3 text-indigo-200/70" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {partnerTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-500 italic py-2">
              <span className="size-2 bg-indigo-500 rounded-full animate-bounce" />
              <span>{user.full_name} is typing...</span>
            </div>
          )}

          <div ref={messageEndRef} />
        </div>
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 w-full max-w-3xl mx-auto rounded-3xl border border-slate-200 focus-within:bg-white focus-within:border-indigo-300 transition-all">
          <input
            type="text"
            className="flex-1 bg-transparent outline-none text-slate-700 py-1 text-sm"
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessages()}
            onChange={handleInputChange}
            value={text}
          />
          <label
            htmlFor="images"
            className="cursor-pointer p-2 hover:bg-slate-200 rounded-full transition-colors relative"
          >
            {image ? (
              <div className="relative">
                <img
                  src={URL.createObjectURL(image)}
                  className="size-6 object-cover rounded-md"
                  alt=""
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setImage(null);
                  }}
                  className="absolute -top-1 -right-1 size-3 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ) : (
              <ImageIcon className="size-5 text-slate-500" />
            )}
            <input
              type="file"
              id="images"
              accept="image/*"
              hidden
              onChange={(e) => setImage(e.target.files[0])}
            />
          </label>
          <button
            disabled={sending || (!text.trim() && !image)}
            onClick={sendMessages}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2.5 rounded-full shadow-lg transition-all active:scale-90 cursor-pointer"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizonal size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
