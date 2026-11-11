import React from "react";
import { MapPin, MessageCircle, Plus, UserPlus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {useAuth} from "@clerk/clerk-react"
import api from "../api/axios.js";
import toast from "react-hot-toast"
import { fetchUser } from "../features/users/userSlice.js";
import {useNavigate} from "react-router-dom"


const UserCard = ({ user }) => {

  const currentUser = useSelector((state)=>state.user.value);
  const dispatch=useDispatch()
  const {getToken}=useAuth()
  const navigate=useNavigate()

  
  const handleFollow = async () => {
    try {
      const {data}=await api.post("/api/user/follow",{id:user._id},{headers:{
        Authorization:`Bearer ${await getToken()}`
      }})
      if(data.success){
        toast.success(data.message)
        dispatch(fetchUser(await getToken()))
      }
    } catch (error) {
      toast.error(error.message)
    }
  };



  const handleConnectionRequest = async () => {
    if (currentUser?.connections?.includes(user._id)) {
    return navigate('/messages/'+ user._id);
   }

    try {
      const token=await getToken()
      const {data}=await api.post("/api/user/connect",{id:user._id},{headers:{
        Authorization:`Bearer ${token}`
      }})
      console.log("data",data);
      if(data.success){
        toast.success(data.message)
      }else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error( error.response?.data?.message || error.message)
    }

  };

  return (
    <div
      key={user._id}
      className="flex w-full min-w-0 flex-col justify-between rounded-md border border-gray-200 bg-white p-4 pt-6 shadow"
      
    >
      <div className="text-center" onClick={()=>navigate(`/profile/${user._id}`)}>
        <img
          src={user.profile_picture}
          alt=""
          className=" h-16 rounded-full  w-16  shadow-md  mx-auto object-cover"
        />
        <p className="mt-4 font-semibold">{user.full_name}</p>
        {user.username && (
          <p className="text-indigo-500 font-light">@{user.username}</p>
        )}
        {user.bio && (
          <p className="text-gray-600 mt-2 text-center text-sm px-4">
            {user.bio}{" "}
          </p>
        )}
      </div>

      <div className=" flex items-center justify-center gap-2 mt-4 text-sm text-gray-600">
        <div className="flex items-center gap-1 border border-gray-300 rounded-full px-3 py-1">
          <MapPin className="w-4 h-4" />
          {user.location}
        </div>
        <div className="flex items-center gap-1 border border-gray-300 rounded-full px-3 py-1 ">
          <span>{user.followers.length}</span>Followers
        </div>
      </div>

      {/* buttons */}
      <div className="flex mt-4 gap-2">
        {/* follow btn */}
        <button
          disabled={currentUser?.following?.includes(user._id)}
          onClick={handleFollow}
          className="w-full py-2  rounded-md flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600  active:scale-95 transition text-white cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          {currentUser.following.includes(user._id) ? "Following" : "Follow"}
        </button>
        {/* connection/message button */}
    <button onClick={handleConnectionRequest} className="w-16  group rounded-md  border  flex items-center justify-center gap-2   active:scale-95 transition text-slate-500 cursor-pointer"> 
        {currentUser?.connections.includes(user._id)?
        <MessageCircle className="w-5 h-5 group-hover:scale-105 transition"/>:
        <Plus  className="w-5 h-5 group-hover:scale-105 transition"/>    
    }
    </button>
      </div>
    </div>
  );
};

export default UserCard;
