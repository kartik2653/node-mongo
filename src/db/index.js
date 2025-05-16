import mongoose from "mongoose";

const connectDB = async() =>{
try {
    const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}`)
    console.log(`MONDO DB Connected !! DB HOST ${connectionInstance.connection.host}`);
 }catch (error) {
   console.log('MONGO_DB connection FAILED',error);
   process.exit(1);
}
}
export default connectDB