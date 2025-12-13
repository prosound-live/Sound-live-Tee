class ApiResponse {
    constructor(status, payload, message) {
        this.status = status;
        this.payload = payload;
        this.message = message;
        this.success = status < 400;
    }
};

export { ApiResponse };