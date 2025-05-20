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

const generateAccessAndRefreshTokens = async(userId) =>{
    try {
       const user = await User.findById(userId);
       const accessToken = await user.generateAccessToken();
       const refreshToken = await user.generateRefreshToken();
       user.refreshToken = refreshToken;
       await user.save({validateBeforeSave : false});
       return  {accessToken,refreshToken};
    } catch (error) {
      throw new ApiError(500, "Something went wrong while generating tokens");  
    }
}

const loginUser = async(req,res) =>{
    try {
        const { username,email,password } = req.body;
        if(!(username || email)){
           throw new ApiError(400,"Username or email is required")
        }
        
        const matchedUser = await User.findOne({
            $or : [{"email":email},{"username":username}]
        });

        if(!matchedUser){
            throw new ApiError(404,"User does not exists")
        }

        const isPasswordValid = await matchedUser.isPasswordCorrect(password);

        if(!isPasswordValid){
           throw new ApiError(401,"Password Incorrect")
        }
        
        const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(matchedUser?._id);
        const loggedInUser = await User.findById(matchedUser?._id).select("-password -refreshToken");

        const options = {
            httpOnly : true,
            secure : true,
        }

        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(new ApiResponse(200,{
            user : loggedInUser,
            accessToken,
            refreshToken,
            message:"User loggedIn successfully"
        },
    ))

    } catch (error) {
        console.log(error?.message);
        
        res.status(error?.statusCode || 500).send({...error,message:error?.message || "Something went wrong at our end"})
        
    }
    
}

const logoutUser = async(req,res) =>{
try {
    const userId = req.user._id;
    await User.findByIdAndUpdate(userId,{
        $set : {
            refreshToken : undefined
        }
    },
    {
        new : true
    })

    const options = {
        httpOnly : true,
        secure : true,
    }
    return res
    .status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200,{},"User Logged out"))
} catch (error) {
    
}
}

export {registerUser,loginUser,logoutUser}