import React, { useEffect, useState } from "react";
import { Search, UserRoundSearch } from "lucide-react";
import UserCard from "../components/UserCard.jsx";
import Loading from "../components/Loading.jsx";
import api from "../api/axios.js";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { useRealtimeEvent, useRealtimeRoom } from "../realtime/RealtimeProvider.jsx";

const Discover = () => {
  const { getToken } = useAuth();

  const [input, setInput] = useState("");
  const [searchUsers, setSearchUsers] = useState([]);
  const [randomUsers, setRandomUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [randomLoading, setRandomLoading] = useState(true);

  useRealtimeRoom("directory");
  useRealtimeEvent("profile:updated", (updatedUser) => {
    const updateList = (users) =>
      users.map((user) => (user._id === updatedUser._id ? updatedUser : user));
    setSearchUsers(updateList);
    setRandomUsers(updateList);
  });

  const handleInputChange = (event) => {
    const value = event.target.value;
    setInput(value);
    setSearchUsers([]);
    setSearching(Boolean(value.trim()));
  };

  useEffect(() => {
    let active = true;

    getToken()
      .then((token) =>
        api.get("/api/user/random", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
      .then(({ data }) => {
        if (!active) return;
        if (data.success) {
          setRandomUsers(data.users);
        } else {
          toast.error(data.message);
        }
      })
      .catch((error) => {
        if (active) toast.error(error.message);
      })
      .finally(() => {
        if (active) setRandomLoading(false);
      });

    return () => {
      active = false;
    };
  }, [getToken]);

  useEffect(() => {
    const query = input.trim();
    if (!query) return undefined;

    const controller = new AbortController();
    const debounceTimer = window.setTimeout(async () => {
      try {
        const token = await getToken();
        const { data } = await api.post(
          "/api/user/discover",
          { input: query },
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );

        if (data.success) {
          setSearchUsers(data.filteredUsers);
        } else {
          toast.error(data.message);
        }
      } catch (error) {
        if (error.code !== "ERR_CANCELED") {
          toast.error(error.message);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [getToken, input]);

  const isSearching = Boolean(input.trim());
  const visibleUsers = isSearching ? searchUsers : randomUsers;
  const loading = isSearching ? searching : randomLoading;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Discover People
          </h1>
          <p className="text-slate-600">
            Connect with amazing people and grow your network
          </p>
        </div>

        {/* Search Input */}
        <div className="mb-8 shadow-md rounded-md border border-slate-200/60 bg-white/80">
          <div className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search people by name, username, bio, location"
                className="w-full rounded-md border border-gray-300 py-2 pl-10 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:pl-12 max-sm:text-sm"
                onChange={handleInputChange}
                value={input}
              />
            </div>
          </div>
        </div>

        {/* Users List */}
        {loading ? (
          <Loading height="40vh" />
        ) : visibleUsers.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleUsers.map((user) => (
              <UserCard key={user._id} user={user} />
            ))}
          </div>
        ) : isSearching ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-500">
            <UserRoundSearch className="mb-3 size-10 text-slate-400" />
            <p className="font-medium text-slate-700">No users found</p>
            <p className="mt-1 text-sm">Try another name, username, or location.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Discover;
