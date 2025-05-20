import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';




export const uploadFileToCloudinary = async(localFilePath) => {
try {
    // Configuration
    await cloudinary.config({ 
        cloud_name: process.env.CLOUDNARY_CLOUD_NAME, 
        api_key: process.env.CLOUDNARY_API_KEY, 
        api_secret: process.env.CLOUDNARY_API_SECRET
    });
    if(!localFilePath) return null;
    const uploadResult = await cloudinary.uploader
       .upload(
           localFilePath, {
              resource_type :  'auto'
           }
       );
    return uploadResult

} catch (error) {
   console.log(error);
     
}finally{
    fs.unlinkSync(localFilePath) 
}
}