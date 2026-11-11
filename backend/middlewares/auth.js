import { err } from "inngest/types";



export const protect =async (req,res,next)=>{

    try {
        const {userId}=await req.auth()
        if(!userId){
          return res.status(400).json({success:false,message:"Not authenticated"})
        }
        next();
    } catch (error) {
       console.log(error)
       res.status(400).json({success:false,message:error.message})
    }
}
