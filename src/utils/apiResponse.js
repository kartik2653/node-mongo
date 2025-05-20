class ApiResponse{
    constructor(statusCode,data,message = "Success"){
        this.statusCode = statusCode;
        this.data = data;
        this.success = true;
        this.message = message
    }
}
export {ApiResponse}