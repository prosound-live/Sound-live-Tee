import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(
  cors({
    origin: "https://www.prosound.live",
    optionsSuccessStatus: 200,
  })
);
app.set("trust proxy", 1);
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 8, // 8 requests per IP per minute
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "You have exceeded your 8 requests per minute limit.",
  },
  standardHeaders: true, // recommended
  legacyHeaders: false,
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.use(express.json());

app.use(express.urlencoded());

// Serve static files from public directory
app.use("/files", express.static(join(__dirname, "../public/files")));

import hashroute from "./routes/Hashing.route.js";
import pinataroute from "./routes/Pinata.route.js";
import priceroute from "./routes/pricefeed.route.js";
import NFTroute from "./routes/NFT.route.js";

app.use("/api/v1/NFT", NFTroute);
app.use("/api/v1/hash", hashroute);
app.use("/api/v1/pinata", pinataroute);
app.use("/api/v1/price", priceroute);

export default app;
