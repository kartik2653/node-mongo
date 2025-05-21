import { response } from "express";
import {ApiError} from '../utils/apiError.js';
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import { uploadFileToCloudinary } from "../utils/cloudnary.js";
import jwt from 'jsonwebtoken';
import mongoose from "mongoose";

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

const refreshAccessToken = async(req,res) => {
try {
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken; 
   if(!incomingRefreshToken){
    throw new ApiError(401,"Unauthorized request")
   }

   const decodedToken = await jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
   const user = await User.findById(decodedToken?._id);
   if(!user){
    throw new ApiError(401,'Invalid refresh token')
   }

   if(incomingRefreshToken !== user?.refreshToken){
    throw new ApiError(401,'Refresh token is expired')
   }

   const {refreshToken,accessToken} = await generateAccessAndRefreshTokens(user?._id);
   const options = {
    httpOnly : true,
    secure : true,
   }
   return res
   .status(200)
   .cookie('accessToken',accessToken,options)
   .cookie('refreshToken',refreshToken,options)
   .json(new ApiResponse(200,{
     accessToken,
     refreshToken
   },
    "Access token refreshed"))


} catch (error) {
    console.log(error?.message);
    
    res.status(error?.statusCode || 500).send({...error,message:error?.message || "Something went wrong at our end"})
}
}


const changeCurrentPassword = async(req,res) =>{
    try {
        const {email,username,oldPassword,newPassword} = req.body;
        if(!(email || username)){
            throw new ApiError(400,"email or username is required");
        }
        if(!password){
            throw new ApiError(400,"Password is required");
        }

        const user = await User.findOne({
            $or : [{email},{password}]
        })

        if(!user){
            throw new ApiError(400,"User not found"); 
        }

        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
        if(!isPasswordCorrect){
            throw new ApiError(400, "Wrong password")
        }

        user.password = newPassword;
        await user.save({validateBeforeSave : false});

        return res
        .status(200)
        .json(new ApiResponse(200,{},"Password reset successfull"));


    } catch (error) {
        console.log(error?.message);
        
        res.status(error?.statusCode || 500).send({...error,message:error?.message || "Something went wrong at our end"}) 
    }
}

const getCurrentUser = async(req,res) =>{
    try {
        return res
        .status(200)
        .json(new ApiResponse(200,req?.user,"User Fetched Successfully"))
    } catch (error) {
        console.log(error?.message);
        
        res.status(error?.statusCode || 500).send({...error,message:error?.message || "Something went wrong at our end"})  
    }
}


const updateAccountDetails = async(req,res) =>{
    try {
        const {fullName, email} = req.body;

        if(!(fullName && email)){
            throw new ApiError(400,"All fileds are required")
        }
        const _id = req?.user?._id;
        const user  = await User.findByIdAndUpdate(_id,
             {$set :{
                fullName,
                email
             }},
             {new : true}).select("-refreshToken -password");

        return res.status(200).json(new ApiResponse(200,user,"Account details updated successfully"))
    } catch (error) {
        console.log(error?.message);
        res.status(error?.statusCode || 500).send({...error,message:error?.message || "Something went wrong at our end"})    
    }

}

const updateUserAvatar = async(req,res)=>{
    try {
        const avatarLocalPath = req?.file?.path;
        if(!avatarLocalPath){
            throw new ApiError(400,"Avatar file is missing")
        }
        const avatar = await uploadFileToCloudinary(avatarLocalPath);
        if(!avatar?.url){
            new ApiError(400,"Error while uploading the file to cloudnary")
        }
        
        const user = await User.findByIdAndUpdate(req?.user?._id,
            {
                $set :{
                    avatar : avatar?.url
                }
            },
            {new : true}
        ).select("-password");

        return res.send(200).json(new ApiResponse(200,
            user,
            "Avatar updated successfully"
        ))
    } catch (error) {
        console.log(error?.message);
        res.status(error?.statusCode || 500).send({...error,message:error?.message || "Something went wrong at our end"});  
    }
}


const updateUserCoverImage = async(req,res)=>{
    try {
        const coverImageLocalPath = req?.file?.path;
        if(!coverImageLocalPath){
            throw new ApiError(400,"Cover image file is missing")
        }
        const coverImage = await uploadFileToCloudinary(coverImageLocalPath);
        if(!coverImage?.url){
            new ApiError(400,"Error while uploading the file to cloudnary")
        }
        
        const user = await User.findByIdAndUpdate(req?.user?._id,
            {
                $set :{
                    coverImage : coverImage?.url
                }
            },
            {new : true}
        ).select("-password");

        return res.send(200).json(new ApiResponse(200,
            user,
            "Cover Image updated successfully"
        ))
    } catch (error) {
        console.log(error?.message);
        res.status(error?.statusCode || 500).send({...error,message:error?.message || "Something went wrong at our end"});  
    }
}

const getUserChannelProfile = async(req,res) =>{
    try {
        const {username} = req.params;
        
        if(!username?.trim()){
            throw new ApiError(400,"Username is missing");
        }

        const channel = await User.aggregate([
            {
                $match : {
                username : username?.trim()?.toLowerCase()
            }},
            {
                $lookup : {
                from :"subscriptions",
                localField:"_id",
                foreignField : "channel",
                as : "subscribers",
            }},
            {
                $lookup : {
                from :"subscriptions",
                localField:"_id",
                foreignField : "subscriber",
                as : "subscribedTo",
            }},
            {
                $addFields :{
                    subscribersCount:{
                        $size: "$subscribers",
                    },
                    channelSubscribedToCount:{
                        $size: "$subscribedTo",
                    },
                    isSubscribed : {
                        $condition :{
                            if: {
                                $in:[req?.user?._id,"$subscribers.subscriber"] 
                            },
                            then : true,
                            else : false,
                        }
                    }
                }
            },
            {
                $project:{
                    fullName : 1,
                    username : 1,
                    subscribersCount : 1,
                    channelSubscribedToCount : 1,
                    isSubscribed : 1,
                    avatar : 1,
                    coverInage : 1,
                    email : 1,
                }
            }
        
        ])

        if(!channel?.length){
            throw new ApiError(400,"Channel does not exists")
        }
        return res.status(200).json(new ApiResponse(200,channel[0],"User channel fetched successfully !"))
        
    } catch (error) {
        console.log(error?.message);
        res.status(error?.statusCode || 500).send({...error,message:error?.message || "Something went wrong at our end"});  
    }

}


const getWatchHistory = async(req,res) =>{
    try {
        const user = await User.aggregate([
            {
                $match : {
                    _id : new mongoose.Types.ObjectId(req?.user?._id)
                }
            },
            {
                $lookup :{
                    from : "videos",
                    localField:"watchHistory",
                    foreignField : "_id",
                    as : "watchHistory",
                    pipeline:[
                        {
                            $lookup : {
                                from : "users",
                                localField:"owner",
                                foreignField : "_id",
                                as : "owner",
                                pipeline:[
                                    {
                                        $project :{
                                            fullName : 1,
                                            username :1,
                                            avatar : 1,
                                        }
                                    }
                                ]   
                            }
                        },
                        {
                            $addFields :{
                                owner:{
                                    $first : "$owner"
                                }
                            }
                        }
                    ]
                }
            }
        ]);

        return res.status(200).json(new ApiResponse(200,user[0]?.watchHistory,"Data retreived"))
    } catch (error) {
        
    }

}
export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}