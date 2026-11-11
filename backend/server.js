import express from "express";
import cors from "cors";
import "dotenv/config";
import { createServer } from "http";

import connectDB from "./config/mongdb.js";
// clerk
import { clerkMiddleware } from "@clerk/express";
// setup the inngest
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import userRouter from "./routes/userRoutes.js";
import postRouter from "./routes/postRoutes.js";
import storyRouter from "./routes/storyRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import commentRouter from "./routes/commentRoutes.js";
import { initializeSocketServer } from "./realtime/socket.js";

const app = express();
app.use(express.json());
app.use(cors());
// clerk middleware
app.use(clerkMiddleware());

await connectDB();

app.get("/", (req, res) => {
  res.send("server  hello bol rahah ");
});

// inngest route
app.use("/api/inngest", serve({ client: inngest, functions }));

//user routes

app.use("/api/user", userRouter);

// post routes
app.use("/api/post", postRouter);

// story routes
app.use("/api/story", storyRouter);

// message routes
app.use("/api/message",messageRouter)

// comment routes
app.use("/api/comment",commentRouter)





const PORT = process.env.PORT || 3000;
const server = createServer(app);

await initializeSocketServer(server);

server.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
});
