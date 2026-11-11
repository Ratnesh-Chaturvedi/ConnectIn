import express , {Router } from "express"
import {upload} from "../middlewares/multer.js"
import {getUserData, updateUserData,followUser,UnfollowUser,discoverUser,sendConnectionRequest,acceptConnectionRequest,getAllConnections, getUserProfile, removeConnection,showRandomUsers, toggleFollow } from "../controllers/userController.js"

import { protect } from "../middlewares/auth.js"
import { getUserRecentMessages } from "../controllers/messageController.js"



const userRouter =express.Router()


userRouter.get("/data",protect,getUserData)
userRouter.patch("/update",upload.fields([{name:"profile",maxCount:1},{name:"cover",maxCount:1}]),protect,updateUserData)



userRouter.post("/discover",protect,discoverUser)
userRouter.post("/follow",protect,followUser)
userRouter.post("/unfollow",protect,UnfollowUser)
userRouter.post("/connect",protect,sendConnectionRequest)
userRouter.post("/accept",protect,acceptConnectionRequest)
userRouter.get("/connections",protect,getAllConnections)
userRouter.post("/profile",protect,getUserProfile)
userRouter.patch("/disconnect/:profileId",protect,removeConnection)
userRouter.get("/random",protect,showRandomUsers)
userRouter.patch("/togglefollow/:profileId",protect,toggleFollow)


// this is the message controller function  that we are written in this for recent message 
userRouter.get("/recent-messages",protect,getUserRecentMessages)


export default userRouter
