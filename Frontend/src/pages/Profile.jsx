import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Loading from "../components/Loading";
import UserProgfileInfo from "../components/UserProgfileInfo";
import Postcard from "../components/Postcard";
import moment from "moment";
import ProfileModal from "../components/ProfileModal";
import { useSelector } from "react-redux";
import  {useAuth} from "@clerk/clerk-react"
import toast from "react-hot-toast";
import api from "../api/axios.js"
import { useRealtimeEvent, useRealtimeRoom } from "../realtime/RealtimeProvider.jsx";

const Profile = () => {


  const currentUser=useSelector((state)=>state.user.value)
  const {getToken}=useAuth()
  const { profileId } = useParams();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [activeTab, setActiveTab] = useState("posts");
  const [edit, setEdit] = useState(false);
  const targetProfileId = profileId || currentUser?._id;



  const fetchUser = useCallback(async (id) => {
    if (!id) return;
    const token=await getToken()
    try {
      const {data}=await api.post("/api/user/profile",{profileId:id},{headers:{Authorization:`Bearer ${token}`}})
      // console.log("data:",data)
      if(data.success){
        // toast.success(data.message)
        setUser(data.profile);
        setPosts(data.posts);
      }else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }, [getToken]);

  useRealtimeRoom(targetProfileId ? `profile:${targetProfileId}` : null);
  useRealtimeEvent("profile:updated", (updatedUser) => {
    if (updatedUser._id === targetProfileId) setUser(updatedUser);
  });
  useRealtimeEvent("social:updated", ({ userIds }) => {
    if (userIds.includes(targetProfileId)) fetchUser(targetProfileId);
  });
  useRealtimeEvent("post:created", (post) => {
    const authorId = post.user?._id || post.user;
    if (authorId === targetProfileId) {
      setPosts((current) =>
        current.some((item) => item._id === post._id)
          ? current
          : [post, ...current],
      );
    }
  });
  useRealtimeEvent("post:updated", ({ postId, ...changes }) => {
    setPosts((current) =>
      current.map((post) =>
        post._id === postId ? { ...post, ...changes } : post,
      ),
    );
  });
  useRealtimeEvent("post:deleted", ({ postId }) => {
    setPosts((current) => current.filter((post) => post._id !== postId));
  });
  useRealtimeEvent("connect", () => fetchUser(targetProfileId));
  useEffect(() => {
    const timer = window.setTimeout(() => fetchUser(targetProfileId), 0);
    return () => window.clearTimeout(timer);
  }, [fetchUser, targetProfileId] );

  return user ? (
    <div className="relative h-full  overflow-y-scroll bg-gray-50 p-6">
      <div className="max-w-3xl  mx-auto">
        {/* Profile card*/}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          {/* coverphoto */}
          <div className="h-40 md:h-56 bg-gradient-to-r  from-indigo-200 via-purple-200 to-pink-200">
            {user.cover_photo && (
              <img
                src={user.cover_photo}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
          </div>
          {/* userinfo */}
          <UserProgfileInfo
            user={user}
            posts={posts}
            profileId={profileId}
            setEdit={setEdit}
          />
        </div>
            
        {/* tabs */}
        <div className="mt-6">
          <div className="bg-white rounded-xl shadow p-1  flex  max-w-md mx-auto">
            {["posts", "media", "likes"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg  transition-colors cursor-pointer ${activeTab === tab ? "bg-indigo-600 text-white " : "text-gray-600 hover:text-gray-900"}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* posts */}
           {activeTab==="posts" && (
            <div className="mt-6 flex  flex-col items-center gap-6">
              {posts.map((post)=><Postcard key={post._id} post={post} onDelete={(postId) => setPosts((current) => current.filter((item) => item._id !== postId))}/>)}
            </div>
           )}

              {/*media  */}
              {activeTab==="media" && (
                <div className="flex flex-wrap mt-6 max-w-6xl">
                    {
                      posts.filter((post)=>post.image_urls.length>0).map((post)=>(
                        <>
                        {post.image_urls.map((image,idx)=>(
                          <Link target="_blank" to={image} key={idx} className="relative group">
                          <img src={image} key={idx} alt="" className="w-64 aspect-video object-cover" />
                          <p className="absolute bottom-0 right-0 text-xs p-1 px-3 backdrop-blur-xl  text-white opacity-0 group-hover:opacity-100 transition duration-300">Posted {moment(post.createdAt).fromNow()}</p>
                          </Link>
                        ))}
                        </>
                      ))
                    }
                </div>
              )}

        </div>
      </div>
      {/* Edit profile */}
      {edit && <ProfileModal setEdit={setEdit}/>}
    </div>
  ) : (
    <Loading />
  );
};

export default Profile;
