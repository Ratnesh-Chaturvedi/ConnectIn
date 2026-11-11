import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import {Outlet} from "react-router-dom"
import { Menu, X } from 'lucide-react';
import Loading from '../components/Loading';
import { useSelector } from 'react-redux';


const Layout = () => {
  const userData=useSelector((state)=>state.user.value)
  const [sidebarOpen,setSidebarOpen]=useState(true);
  return userData?(
    <div className='flex h-screen w-full overflow-hidden'>

      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className='min-w-0 flex-1 overflow-y-auto bg-slate-200'>
      <Outlet/>
      </main>
      {
        sidebarOpen?
        <X className='fixed top-3 right-3 p-2 z-100 bg-white  rounded-md shadow w-10 h-10 text-gray-600 sm:hidden' onClick={()=>setSidebarOpen(false)} />:<Menu  className='fixed top-3 right-3 p-2 z-100 bg-white  rounded-md shadow w-10 h-10 text-gray-600 sm:hidden'  onClick={()=>setSidebarOpen(true)}/>
      }
    </div>
  ):( <Loading/>)
}

export default Layout
