import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import jwt from 'jsonwebtoken';

export const verifyJWT = async(req,_,next) => {
    try {
        const accessToken = req?.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","");
        if(!accessToken){
            throw new ApiError(401,"Unauthorized user")
        }
        
        const decodedToken = await jwt.verify(accessToken,process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
        if(!user){
            throw new ApiError(401,"Invalid access token")
        }
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401,"Invalid access token")
    }
}