import React from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";

const Notification = ({ t, message }) => {
  const navigate = useNavigate();

  const sender = message?.from_user_id;
  const senderId = sender?._id || sender;
  const senderName = sender?.full_name || "New Message";
  const avatar = sender?.profile_picture || "/default-avatar.png";
  const previewText = message?.text
    ? message.text.slice(0, 50)
    : message?.media_url
    ? "Sent an attachment"
    : "Sent a message";

  return (
    <div className="max-w-md w-full bg-white shadow-lg rounded-lg flex border border-gray-300 hover:scale-105 transition">
      <div className="flex-1 p-4">
        <div className="flex items-center">
          <img
            src={avatar}
            alt=""
            className="h-10 w-10 rounded-full flex shrink-0 mt-0.5 object-cover"
          />
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {senderName}
            </p>
            <p className="text-sm text-gray-500 truncate">{previewText}</p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-gray-200">
        <button
          onClick={() => {
            if (senderId) navigate(`/messages/${senderId}`);
            toast.dismiss(t.id);
          }}
          className="p-4 text-indigo-600 font-semibold hover:bg-slate-50 transition cursor-pointer"
        >
          Reply
        </button>
      </div>
    </div>
  );
};

export default Notification;
