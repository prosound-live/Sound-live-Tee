import { Router } from "express";
import multer from "multer";
import {
  uploadFile,
  getAndDecryptFile,
} from "../controller/pinata.controller.js";

const route = Router();

// Configure multer to use memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

route.route("/upload").post(upload.single("encryptedFile"), uploadFile);
route.route("/decrypt").post(getAndDecryptFile);

export default route;
