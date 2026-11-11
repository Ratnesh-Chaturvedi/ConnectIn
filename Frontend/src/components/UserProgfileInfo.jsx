import {
  Calendar,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  MessageCircle,
  PenBox,
  UserMinus,
  UserPlus,
  UserRoundX,
  Verified,
} from "lucide-react";
import React, { useState } from "react";
import moment from "moment";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useDispatch } from "react-redux";
import api from "../api/axios.js";
import { fetchConnections } from "../features/connections/connectionSlice.js";
import { fetchUser } from "../features/users/userSlice.js";

const UserProgfileInfo = ({
  user,
  posts,
  profileId,
  setEdit,
  currentUser,
  initialConnectionStatus = "none",
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { getToken } = useAuth();

  const [connectionStatus, setConnectionStatus] = useState(
    initialConnectionStatus,
  );
  const [isFollowing, setIsFollowing] = useState(
    user.followers?.includes(currentUser?._id) || false,
  );
  const [activeAction, setActiveAction] = useState(null);

  const showError = (error) => {
    toast.error(error.response?.data?.message || error.message);
  };

  const handleConnectionRequest = async () => {
    try {
      setActiveAction("connect");
      const token = await getToken();
      const { data } = await api.post(
        "/api/user/connect",
        { id: profileId },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      setConnectionStatus("outgoing_pending");
      toast.success("Connection request sent");
    } catch (error) {
      showError(error);
    } finally {
      setActiveAction(null);
    }
  };

  const acceptConnectionRequest = async () => {
    try {
      setActiveAction("accept");
      const token = await getToken();
      const { data } = await api.post(
        "/api/user/accept",
        { id: profileId },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      setConnectionStatus("connected");
      dispatch(fetchConnections(token));
      toast.success(data.message);
    } catch (error) {
      showError(error);
    } finally {
      setActiveAction(null);
    }
  };

  const disconnect = async () => {
    try {
      setActiveAction("disconnect");
      const token = await getToken();
      const { data } = await api.patch(
        `/api/user/disconnect/${profileId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      setConnectionStatus("none");
      dispatch(fetchConnections(token));
      toast.success(data.message);
    } catch (error) {
      showError(error);
    } finally {
      setActiveAction(null);
    }
  };

  const toggleFollow = async () => {
    try {
      setActiveAction("follow");
      const token = await getToken();
      const { data } = await api.patch(
        `/api/user/togglefollow/${profileId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      setIsFollowing((value) => !value);
      dispatch(fetchUser(token));
      toast.success(data.message);
    } catch (error) {
      showError(error);
    } finally {
      setActiveAction(null);
    }
  };

  const ActionIcon = ({ action, children }) =>
    activeAction === action ? (
      <LoaderCircle className="size-4 animate-spin" />
    ) : (
      children
    );

  return (
    <div className="relative bg-white px-5 py-5 sm:px-8">
      <div className="flex flex-col items-start gap-6 md:flex-row">
        <div className="absolute -top-16 size-32 rounded-full border-4 border-white shadow-lg">
          <img
            src={user.profile_picture}
            alt={`${user.full_name}'s profile`}
            className="size-full rounded-full object-cover"
          />
        </div>

        <div className="w-full pt-14 md:pl-36 md:pt-0">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="break-words text-2xl font-bold text-gray-900">
                  {user.full_name}
                </h1>
                <Verified className="size-5 shrink-0 text-indigo-600" />
              </div>
              <p className="text-gray-500">
                {user.username ? `@${user.username}` : "Add a username"}
              </p>
            </div>

            {!profileId ? (
              <button
                type="button"
                onClick={() => setEdit(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <PenBox className="size-4" />
                Edit
              </button>
            ) : (
              <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
                {connectionStatus === "connected" && (
                  <button
                    type="button"
                    onClick={() => navigate(`/messages/${profileId}`)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    <MessageCircle className="size-4" />
                    Message
                  </button>
                )}

                {connectionStatus === "incoming_pending" && (
                  <button
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={acceptConnectionRequest}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ActionIcon action="accept">
                      <Check className="size-4" />
                    </ActionIcon>
                    Accept
                  </button>
                )}

                {connectionStatus === "outgoing_pending" && (
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-700"
                  >
                    <Clock3 className="size-4" />
                    Pending
                  </button>
                )}

                {connectionStatus === "none" && (
                  <button
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={handleConnectionRequest}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ActionIcon action="connect">
                      <UserPlus className="size-4" />
                    </ActionIcon>
                    Connect
                  </button>
                )}

                <button
                  type="button"
                  disabled={Boolean(activeAction)}
                  onClick={toggleFollow}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isFollowing
                      ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  <ActionIcon action="follow">
                    {isFollowing ? (
                      <UserMinus className="size-4" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                  </ActionIcon>
                  {isFollowing ? "Following" : "Follow"}
                </button>

                {connectionStatus === "connected" && (
                  <button
                    type="button"
                    title="Disconnect"
                    disabled={Boolean(activeAction)}
                    onClick={disconnect}
                    className="inline-flex size-10 items-center justify-center rounded-md border border-red-200 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ActionIcon action="disconnect">
                      <UserRoundX className="size-4" />
                    </ActionIcon>
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="mt-4 max-w-md text-sm text-gray-700">{user.bio}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              {user.location || "Add Location"}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="size-4" />
              Joined <span className="font-medium">{moment(user.createdAt).fromNow()}</span>
            </span>
          </div>

          <div className="mt-6 flex items-center gap-6 border-t border-gray-200 pt-4">
            <div>
              <span className="font-bold text-gray-900 sm:text-xl">{posts.length}</span>
              <span className="ml-1.5 text-xs text-gray-500 sm:text-sm">Posts</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 sm:text-xl">{user.followers.length}</span>
              <span className="ml-1.5 text-xs text-gray-500 sm:text-sm">Followers</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 sm:text-xl">{user.following.length}</span>
              <span className="ml-1.5 text-xs text-gray-500 sm:text-sm">Following</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProgfileInfo;
