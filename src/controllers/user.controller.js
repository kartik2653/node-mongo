import { response } from "express";
import {ApiError} from '../utils/apiError.js';
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import { uploadFileToCloudinary } from "../utils/cloudnary.js";

const registerUser = async(req,res) =>{
    try {
        //get user details from frontend
        const {username,fullName,email,password} = req.body;

        //validation
        if([fullName,
            username,
            email,
            password
        ].some((field)=> !field?.trim())
        ){
            throw new ApiError(400,"All fields are required")
        }

        //checking if user already extsts or not
        const existedUser = await User.findOne({
            $or : [
                    {username}, 
                    {email}
                ]
        })
        if(existedUser){
            throw new ApiError(409,'User with provided username and email already exists')
        }
        //file handing 
        const avatarLocalPath = req?.files?.avatar?.[0]?.path;
        const coverImageLocalPath = req?.files?.coverImage?.[0]?.path;

        if(!avatarLocalPath){
            throw new ApiError(400,"Avatar file is required");
        }
        
        //upload to cloudnary
        const avatar = await uploadFileToCloudinary(avatarLocalPath);
        const coverImage = await uploadFileToCloudinary(coverImageLocalPath);

        if(!avatar){
            throw new ApiError(400,"Avatar file is required in cloudnary");  
        }

        const user = await User.create({
            username : username?.toLowerCase(),
            fullName,
            email,
            avatar : avatar?.url,
            coverImage : coverImage?.url || "",
            password,
        });

        const createdUser = await User.findById(user?._id).select("-password -refreshToken");
        if(!createdUser){
            throw new Error(500, "Something went wrong while registering the user.")
        }

        return res.status(201).json(new ApiResponse(201,createdUser,"User registered successfully")) 
    } catch (error) {
        console.log(error?.message);
        
        res.status(error?.statusCode || 500).send({...error,message:error?.message || "Something went wrong at our end"})
    }

}

export {registerUser}