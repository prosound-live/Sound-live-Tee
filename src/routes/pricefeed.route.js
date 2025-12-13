import { Router } from "express";
import { getIPforUSD } from "../controller/pricefeed.controller.js";

const route = Router();

route.route("/convert").post(getIPforUSD);

export default route;
