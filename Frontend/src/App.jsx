import React from "react";
import { Routes, Route } from "react-router-dom";
import Connection from "./pages/Connection";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Feed from "./pages/Feed";
import Messages from "./pages/Messages";
import CreatePost from "./pages/CreatePost";
import Discover from "./pages/Discover";
import ChatBox from "./pages/ChatBox";
import { useUser, useAuth } from "@clerk/clerk-react";
import Layout from "./pages/Layout";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { fetchUser } from "./features/users/userSlice.js";
import { fetchConnections } from "./features/connections/connectionSlice.js";
import ProfileOther from "./pages/ProfileOther.jsx";
import { CommentPage } from "./pages/CommentPage.jsx";

const App = () => {
  const { user } = useUser();
  // printing the token of user
  const { getToken } = useAuth();

  const dispatch = useDispatch();

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        const token = await getToken();
        // console.log(token)
        dispatch(fetchUser(token));
        dispatch(fetchConnections(token));
      }
    };
    fetchData();
  }, [user, getToken, dispatch]);

  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/" element={!user ? <Login /> : <Layout />}>
          <Route path="/" element={<Feed />}>
             <Route path="post/:postId/comments" element={<CommentPage />} />
          </Route>
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:userId" element={<ChatBox />} />
          <Route path="connections" element={<Connection />} />
          <Route path="profile" element={<Profile />} />
          <Route path="discover" element={<Discover />} />
          <Route path="profile/:profileId" element={<ProfileOther />} />
          <Route path="create-post" element={<CreatePost />} />
        <Route path="/post/:postId/comments" element={<CommentPage />} />


        </Route>
      </Routes>
    </>
  );
};

export default App;
