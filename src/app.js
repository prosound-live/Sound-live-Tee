import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(cors({ origin: "*" }));
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
