class ApiError {
    constructor(statusCode, message, error) {
        this.statusCode = statusCode;
        this.message = message;
        this.error = error;
    }
}
export { ApiError };