import React, { useState } from 'react'
import { BadgeCheck, Heart, MessageCircle, Share2, Trash } from "lucide-react"
import moment from "moment"


import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios.js'
import toast from "react-hot-toast"
import { useRealtimeEvent } from '../realtime/RealtimeProvider.jsx'


const Postcard = ({post, onDelete}) => {
    const {getToken}=useAuth()
    const navigate =useNavigate()
  
    const postWithHashtag=(post.content || "").replace(/(#\w+)/g, '<span class="text-indigo-500">$1</span>')
    
 const [likes,setLikes]=useState(post.likes_count)
 const currentUser=useSelector((state)=>state.user.value)
 const isOwner = currentUser?._id === (post.user?._id || post.user);

 useRealtimeEvent("post:updated", ({ postId, likes_count }) => {
   if (postId === post._id && likes_count) setLikes(likes_count);
 });


const toggleLike = async(post)=>{
   try {
    const token=await getToken()
    const {data}=await api.patch("/api/post/togglelike",{postId:post._id},{headers:{Authorization:`Bearer ${token}`}})
    if(data.success){
        toast.success(data.message)
        setLikes(data.likes_count || [])
    }
    else {
        toast.error(data.message)
    }
   } catch (error) {
    console.log(error)
   }
}
const handleShare = () => {
  const postLink = `${window.location.origin}/post/${post._id}/comments`; // link to comment page
  navigator.clipboard.writeText(postLink) // copy to clipboard
    .then(() => {
      toast.success(" Link copied!");
    })
    .catch((err) => {
      toast.error("Failed to copy link");
      console.error(err);
    });
};


const deletePost =async (postId)=>{
  if (!window.confirm("Are you sure you want to delete this post?")) return;
  try {
    const token=await getToken()
    const { data } = await api.delete("/api/post/delete", {
      headers: { 
        Authorization: `Bearer ${token}` 
      },
      data: { postId }
    });
    if(data.success){
      toast.success(data.message)
      onDelete?.(postId)
    }
    else {
      toast.error(data.message)
    }
  } catch (error) {
    toast.error("Failed to Delete Post");
      console.error(error);
  }
}



    return (


    <div className= ' relative bg-white rounded-xl shadow p-4 space-y-4 w-full max-w-2xl'>
      {/* DELETE BUTTON: Only visible if the logged-in user is the creator */}
            {isOwner && (
                <button 
                    onClick={()=>deletePost(post._id)}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    title="Delete Post"
                >
                    <Trash className="w-5 h-5" />
                </button>
            )}
 {/* user info */}
     <div onClick={()=>navigate(`${post.user._id===currentUser._id?"/profile":`/profile/${post.user._id}`}`)} className='inline-flex items-center gap-3 cursor-pointer'>
       <img
  src={post.user?.profile_picture || "/default-avatar.png"}
  alt=""
  className="w-10 h-10 rounded-full shadow object-cover"
/>
        <div>
            <div className='flex items-center space-x-1'>
            <span>{post.user.full_name ||  "Billu"}</span>
            <BadgeCheck  className='w-4 h-4 text-blue-500'/>
            </div>
            <div className='text-gray-500 text-sm'>
                @{post.user.username || "billu16"} • {moment(post.createdAt).fromNow() }
            </div>

        </div>
     </div>


{/* post content */}
{post.content && <div className='text-gray-800 text-sm  whitespace-pre-line '
dangerouslySetInnerHTML={{__html:postWithHashtag}}
/>}
{/* post images */}
<div className='grid grid-cols-2 gap-2'>

{post.image_urls.map((img,idx)=>(
    <img src={img}  key={idx} alt="" className={`w-full  h-48 object-cover rounded-lg  ${post.image_urls.length===1 && 'col-span-2 h-auto '}`} />
))}

</div>

{/* actions-like/share/comments */}

<div className='flex items-center gap-4 text-gray-600 text-sm  pt-2  border-t border-gray-300'>
  <div className='flex items-center gap-1'>
    <Heart  
      className={`w-4 h-4 cursor-pointer ${likes.includes(currentUser?._id) &&"text-red-500 fill-red-500"}`}
      onClick={()=>toggleLike(post)}
    /> 
    <span>{likes.length}</span>
  </div>
  <div className='flex items-center gap-1 cursor-pointer'>
    <MessageCircle className='w-4 h-4' onClick={()=>navigate(`/post/${post._id}/comments`)}/> 
  
  </div>
  <div className='flex items-center gap-1 cursor-pointer' onClick={handleShare}>
    <Share2 className='w-4 h-4' /> 
    <span>Share</span>
  </div>
</div>
    </div>
  )
}

export default Postcard
