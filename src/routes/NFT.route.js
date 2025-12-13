import { Router } from "express";
import {
  storeMetadata,
  listMetadata,
  getMetadata,
  storeBuyedSong,
  listBuyedSongs,
  listBuyedSongsByAddress,
} from "../controller/Nft.controller.js";

const route = Router();

route.route("/uploaddata").post(storeMetadata);
route.route("/getdata").post(listMetadata);
route.route("/getMetadata").post(getMetadata);
route.route("/storeBuyedSong").post(storeBuyedSong);
route.route("/listBuyedSongs").post(listBuyedSongs);
route.route("/listBuyedSongsByAddress/:address").post(listBuyedSongsByAddress);

export default route;
