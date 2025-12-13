import { Router } from "express";
import { generatePublickey } from "../controller/hashing.controller.js";

const route = Router();

route.route("/getpublickey").post(generatePublickey);

export default route;
