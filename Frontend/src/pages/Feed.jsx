import React, { useEffect, useState, useRef, useCallback } from 'react';
import { assets } from '../assets/assets';
import Loading from '../components/Loading';
import Storybar from '../components/Storybar';
import Postcard from '../components/Postcard';
import RecentMessages from '../components/RecentMessages';
import { useAuth } from "@clerk/clerk-react";
import api from '../api/axios.js';
import { Outlet } from 'react-router-dom'; // Add this
import { useRealtimeEvent, useRealtimeRoom } from '../realtime/RealtimeProvider.jsx';

const Feed = () => {
  const { getToken } = useAuth();
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [seenPosts, setSeenPosts] = useState([]);

  const observerRef = useRef(null);
  const isFetching = useRef(false);

  useRealtimeRoom("feed");
  useRealtimeEvent("post:created", (post) => {
    setFeeds((current) =>
      current.some((item) => item._id === post._id)
        ? current
        : [post, ...current],
    );
    setSeenPosts((current) => [...new Set([...current, post._id])]);
  });
  useRealtimeEvent("post:updated", ({ postId, ...changes }) => {
    setFeeds((current) =>
      current.map((post) =>
        post._id === postId ? { ...post, ...changes } : post,
      ),
    );
  });
  useRealtimeEvent("post:deleted", ({ postId }) => {
    setFeeds((current) => current.filter((post) => post._id !== postId));
  });

  const fetchFeed = useCallback(async () => {
    if (isFetching.current || !hasMore) return;

    isFetching.current = true;
    setLoading(true);

    try {
      const token = await getToken();
      const { data } = await api.post(
        "/api/post/feed",
        { seenPosts },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        const incomingPosts = data.posts;
        if (!incomingPosts || incomingPosts.length === 0) {
          setHasMore(false);
        } else {
          setFeeds(prevFeeds => {
            const uniqueNewPosts = incomingPosts.filter(
              newPost => !prevFeeds.some(existing => existing._id === newPost._id)
            );
            if (uniqueNewPosts.length === 0) {
              setHasMore(false);
              return prevFeeds;
            }
            setSeenPosts(prevSeen => [...new Set([...prevSeen, ...uniqueNewPosts.map(p => p._id)])]);
            return [...prevFeeds, ...uniqueNewPosts];
          });
        }
      }
    } catch (error) {
      console.error("Feed Error:", error);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [getToken, hasMore, seenPosts]);

  // FIX: Only fetch on mount if the feed is empty
  useEffect(() => {
    if (feeds.length === 0) {
      fetchFeed();
    }
  }, []); // Empty dependency ensures this runs only once on initial mount

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isFetching.current && hasMore) {
          fetchFeed();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    const currentTarget = observerRef.current;
    if (currentTarget) observer.observe(currentTarget);

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [fetchFeed, hasMore]);

  return (
    <div className='w-full h-full overflow-y-scroll no-scrollbar py-10 xl:pr-5 flex items-start justify-center xl:gap-8'>
      <div className='w-full max-w-2xl'>
        <Storybar />
        <div className='p-4 space-y-6'>
          {feeds.map((post, idx) => (
            <div key={post._id} className="animate-fadeInUp" style={{ animationDelay: `${idx * 0.05}s` }}>
              <Postcard
                post={post}
                onDelete={(postId) =>
                  setFeeds((current) =>
                    current.filter((item) => item._id !== postId),
                  )
                }
              />
            </div>
          ))}
        </div>

        <div ref={observerRef} className="flex justify-center py-5 min-h-[50px]">
          {loading && <Loading />}
          {!hasMore && feeds.length > 0 && (
            <p className="text-center text-gray-500 py-5">You've reached the end!</p>
          )}
        </div>
      </div>

      <div className='max-xl:hidden sticky top-0'>
        <div className='max-w-xs bg-white text-xs p-4 rounded-md inline-flex flex-col gap-2 shadow'>
          <h3 className='text-slate-800 font-semibold'>Sponsored</h3>
          <img src={assets.sponsored_img} alt="Sponsored" className='w-75 h-50 rounded-md' />
          <p className='text-slate-600 font-bold'>Email Marketing</p>
          <p className='text-slate-400'>Boost your reach with our premium tools.</p>
        </div>
        <RecentMessages />
      </div>

      {/* IMPORTANT: This renders the Comment Modal on top of the Feed */}
      <Outlet />
    </div>
  );
};

export default Feed;
