import Comment from "../models/comment.model.js";
import Post from "../models/post.model.js";
import { emitToPost } from "../realtime/socket.js";

const addComment = async (req, res) => {
  try {
    const { userId } = req.auth();
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not Authenticated" });
    }
    const { postId, content } = req.body;
    // check is post exist
    const post = await Post.findById(postId);
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    // create the comment
    const comment = await Comment.create({
      user: userId,
      content,
      post: postId,
    });
   
    post.comments.push(comment._id);
    await post.save();

    const commentData = await comment.populate(
      "user",
      "full_name username profile_picture ",
    );
    emitToPost(postId, "comment:created", commentData);
    return res.status(201).json({ success: true, commentData,message:"Comment added" });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// delete comment

const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.body;
    const { userId } = req.auth();
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not Authenticated" });
    }
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
      const postId = comment.post; // Get the associated post ID
      //check that the comment is from the user so that each user can only delete their comment only

    if(comment.user.toString() !== userId){
      return res.status(403).json({ success: false, message: "Unauthorized to delete this comment" });
    }
  
    await Comment.findByIdAndDelete(commentId);
    //  2. Remove the comment reference from the Post
    // $pull automatically finds the ID in the array and removes it
   await Post.findByIdAndUpdate(postId, {
      $pull: { comments: commentId }
    });

    emitToPost(postId, "comment:deleted", { commentId });
    return res.status(200).json({ success: true, message: "Comment deleted" });
  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const getComments =async (req,res)=>{
  try {
    const {userId}=req.auth();
    if(!userId){
       return res
        .status(401)
        .json({ success: false, message: "Not Authenticated" });
    }
    
    const {postId}=req.params;
   const allComments = await Post.findById(postId)
  .populate({
    path: "comments",
    options: { sort: { createdAt: -1 } },
    populate: {
      path: "user",
      select: "full_name username profile_picture"
    }
  })
    if(!allComments){
      return res.status(400).json({success:false,message:"Comments with Post id not found or it has 0 comments"})
    }

return res.status(200).json({success:true,allComments})    
    

  } catch (error) {
    console.log(error);
    res.status(400).json({ success: false, message: error.message });
  }
}




export { addComment, deleteComment,getComments };
