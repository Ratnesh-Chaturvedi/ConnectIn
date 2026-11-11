import React, { useCallback, useEffect, useState } from "react";
import api from "../api/axios.js";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth, useUser } from "@clerk/clerk-react";
import moment from "moment";
import { useRealtimeEvent, useRealtimeRoom } from "../realtime/RealtimeProvider.jsx";

export const CommentPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { user } = useUser(); // Get logged-in user details
  
  const [comments, setComments] = useState([]);
  const [post, setPost] = useState(null);
  const [content, setContent] = useState("");

  useRealtimeRoom(postId ? `post:${postId}` : null);

  const closeModal = () => navigate(-1);

  const fetchComments = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await api.get(`/api/comment/get/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setComments(data.allComments.comments);
      }
    } catch {
      toast.error("Failed to load comments");
    }
  }, [getToken, postId]);

  const fetchPost = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await api.get(`/api/post/single/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setPost(data.post);
    } catch {
      toast.error("Failed to load post");
    }
  }, [getToken, postId]);

  useRealtimeEvent("comment:created", (comment) => {
    setComments((current) =>
      current.some((item) => item._id === comment._id)
        ? current
        : [...current, comment],
    );
  });
  useRealtimeEvent("comment:deleted", ({ commentId }) => {
    setComments((current) =>
      current.filter((comment) => comment._id !== commentId),
    );
  });
  useRealtimeEvent("post:updated", ({ postId: updatedPostId, ...changes }) => {
    if (updatedPostId === postId) {
      setPost((current) => (current ? { ...current, ...changes } : current));
    }
  });
  useRealtimeEvent("post:deleted", ({ postId: deletedPostId }) => {
    if (deletedPostId === postId) navigate(-1);
  });
  useRealtimeEvent("connect", () => {
    fetchComments();
    fetchPost();
  });

  const addComment = async () => {
    if (!content.trim()) return;
    try {
      const token = await getToken();
      const { data } = await api.post(
        "/api/comment/add",
        { postId, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setComments((prev) => [...prev, data.commentData]);
        setContent("");
        toast.success("Comment added");
        
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteComment = async (commentId) => {
    try {
      const token = await getToken();
      const { data } = await api.delete("/api/comment/delete", {
        headers: { Authorization: `Bearer ${token}` },
        data: { commentId }, // Axios DELETE body
      });

      if (data.success) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        toast.success("Comment deleted");
     
      }
    } catch {
      toast.error("Error deleting comment");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!postId) return;
      fetchComments();
      fetchPost();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchComments, fetchPost, postId]);

  return (
    <div
      className="fixed inset-0 backdrop-blur-md bg-black/40 flex items-center justify-center z-50"
      onClick={closeModal}
    >
      <div
        className="bg-white w-[950px] h-[620px] rounded-xl overflow-hidden flex shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* LEFT - POST IMAGE/CONTENT */}
        <div className="w-1/2 bg-black flex items-center justify-center">
          {post?.image_urls?.[0] ? (
            <img
              src={post.image_urls[0]}
              alt="post"
              className="object-contain w-full h-full"
            />
          ) : (
            <p className="text-white p-6">{post?.content}</p>
          )}
        </div>

        {/* RIGHT - COMMENTS SECTION */}
        <div className="w-1/2 flex flex-col bg-white">
          <div className="p-4 border-b font-semibold text-lg flex justify-between items-center">
            Comments
            <button onClick={closeModal} className="text-gray-400 hover:text-black">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {comments.length === 0 && (
              <p className="text-gray-400 text-center mt-10 text-sm">No comments yet.</p>
            )}

            {comments.map((comment) => (
              <div key={comment._id} className="flex justify-between items-start group">
                <div className="flex flex-col">
                  <div className="flex gap-2 items-baseline">
                    <span className="font-bold text-sm text-slate-900">
                      {comment.user?.full_name}
                    </span>
                    <span className="text-slate-700 text-sm">{comment.content}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {moment(comment.createdAt).fromNow()}
                  </span>
                </div>

                {/* DELETE BUTTON - Visible on hover if it's the user's comment */}
                {comment.user?._id === user?.id && (
                  <button
                    onClick={() => deleteComment(comment._id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* INPUT AREA */}
          <div className="border-t p-4 flex gap-3 items-center">
            <input
              type="text"
              placeholder="Add a comment..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              onClick={addComment}
              disabled={!content.trim()}
              className="text-indigo-600 font-bold text-sm disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
