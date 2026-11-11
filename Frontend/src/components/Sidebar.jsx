import React from 'react'
import { assets } from '../assets/assets'
import { Link, useNavigate } from 'react-router'
import Menuitems from './Menuitems';
import { CirclePlus, LogOut } from 'lucide-react';
import {UserButton,useClerk} from "@clerk/clerk-react"
import { useSelector } from 'react-redux';


const Sidebar = ({sidebarOpen,setSidebarOpen}) => {

    const navigate=useNavigate();
    const {signOut}=useClerk()
    const userData=useSelector((state)=>state.user.value)
  return (
    <aside className={`sticky top-0 z-20 flex h-screen w-60 shrink-0 flex-col items-center overflow-hidden border-r border-gray-200 bg-white xl:w-72 max-sm:fixed max-sm:inset-y-0 max-sm:left-0
    ${sidebarOpen?'translate-x-0':'max-sm:-translate-x-full '} transition-all duration-300 ease-in-out`}>
     <div className='w-full min-h-0 flex-1 overflow-y-auto no-scrollbar'>
        <img src={assets.logo} alt="" className='w-27 ml-7  my-2  cursor-pointer' onClick={()=>navigate("/")} />
        <hr  className='border-gray-300 mb-8'/>
        <Menuitems setSidebarOpen={setSidebarOpen}/>
        <Link to="/create-post"  className='flex items-center justify-center gap-2 py-2.5 mt-6 mx-6 rounded-lg bg-gradient-to-r from-blue-600 to-purple-500  hover:from-purple-500  hover:to-blue-500 active:scale-95 transition-all duration-150 ease-in-out  text-white cursor-pointer'><CirclePlus className='w-5 h-5'/> Create Post</Link>
     </div>
     <div className='w-full shrink-0 border-t border-gray-300 p-4 px-7 flex items-center justify-between'>
      <div className='flex gap-2  items-center  cursor-pointer'>
        <UserButton/>
        <div>
            <h1 className=' text-sm font-medium'>{userData.full_name}</h1>
            <p className='text-xs  text-gray-500'>@{userData.username}</p>
        </div>
      </div>
      <LogOut className='w-4.5  text-gray-400 hover:text-gray-700 transition cursor-pointer' onClick={signOut} />
     </div>
    </aside>
  )
}

export default Sidebar
