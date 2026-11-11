import React from "react";
import { Eye, MessageSquare, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useRealtime } from "../realtime/RealtimeProvider.jsx";

const Messages = () => {
  const { connections = [] } = useSelector((state) => state.connections);
  const navigate = useNavigate();
  const { isUserOnline } = useRealtime() || {};

  return (
    <div className="min-h-screen relative bg-slate-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Messages</h1>
          <p className="text-slate-600">Talk to your Connections</p>
        </div>

        {/* Connections */}
        {connections.length === 0 ? (
          <div className="max-w-xl bg-white shadow rounded-lg p-8 text-center space-y-4">
            <p className="text-slate-700 font-medium">No connections yet</p>
            <p className="text-sm text-slate-500">
              Discover people in your network and connect with them to start live chatting.
            </p>
            <button
              onClick={() => navigate("/discover")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition cursor-pointer"
            >
              <UserPlus className="size-4" />
              Discover People
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {connections.map((user) => {
              const online = isUserOnline ? isUserOnline(user._id) : false;

              return (
                <div
                  key={user._id}
                  className="max-w-xl flex flex-wrap items-center gap-5 p-5 bg-white shadow-sm hover:shadow transition rounded-lg border border-slate-100"
                >
                  <div className="relative shrink-0">
                    <img
                      src={user.profile_picture || "/default-avatar.png"}
                      alt=""
                      className="rounded-full size-12 object-cover"
                    />
                    {online && (
                      <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-white" />
                    )}
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/messages/${user._id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 truncate">
                        {user.full_name}
                      </p>
                      {online && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">
                          Online
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-indigo-500 font-medium">
                      @{user.username}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {user.bio || "Available on ConnectIn"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/messages/${user._id}`)}
                      className="size-10 flex items-center justify-center text-sm rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95 transition cursor-pointer"
                      title="Chat"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/profile/${user._id}`)}
                      className="size-10 flex items-center justify-center text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95 transition cursor-pointer"
                      title="View Profile"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
