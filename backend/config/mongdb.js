import mongoose from "mongoose";
import dotenv, { configDotenv } from "dotenv"
import dns from "node:dns";
 dotenv.config()

if (process.platform === "win32") {
    dns.setServers(["1.1.1.1", "8.8.8.8"])
}

const DB_NAME="ConnectIn"

const connectDB =async ()=>{

    try {
        
         const connectionInstance=await mongoose.connect(`${process.env.MONGODB_URL}`)
        console.log("host name:",connectionInstance.connection.host)

        console.log("DB Connected")
    } catch (error) {
        console.log("Error while connecting to the DB:",error.message)

        process.exit(1);
    }
}

export default connectDB;
