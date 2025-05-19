import { response } from "express"

const registerUser = async(req,res) =>{
    try {
        res.status(200).json({message : 'OK FROM CHAI AND CODE'}) 
    } catch (error) {
        res.status(500).json({message:error.message})
    }

}

export {registerUser}