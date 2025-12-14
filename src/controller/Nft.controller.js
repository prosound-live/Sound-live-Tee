// controllers/nftMetadata.controller.js
import fs from "fs/promises";
import path from "path";
import { AsyncHandler } from "../utils/AsyncHandler.utils.js";
import { ApiResponse } from "../utils/ApiResponse.utils.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NFT_METADATA_DIR = path.join(__dirname, "../../public/metadata");
const BUYED_SONGS_FILE = path.join(NFT_METADATA_DIR, "buyedsongs.json");

// Ensure directory exists
const ensureDir = async () => {
  try {
    await fs.access(NFT_METADATA_DIR);
  } catch {
    await fs.mkdir(NFT_METADATA_DIR, { recursive: true });
  }
};

// Read buyed songs file
const readBuyedSongs = async () => {
  try {
    await fs.access(BUYED_SONGS_FILE);
    const content = await fs.readFile(BUYED_SONGS_FILE, "utf8");
    return JSON.parse(content);
  } catch {
    return { songs: [] };
  }
};

// Write buyed songs file
const writeBuyedSongs = async (data) => {
  await fs.writeFile(BUYED_SONGS_FILE, JSON.stringify(data, null, 2), "utf8");
};

/**
 * Store NFT Metadata
 * POST /api/nft/metadata
 */
const storeMetadata = AsyncHandler(async (req, res) => {
  try {
    await ensureDir();
    const { userAddress, encryptedCid, metadata } = req.body;

    if (!userAddress) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "userAddress is required"));
    }

    if (!encryptedCid) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "encryptedCid is required"));
    }

    if (!metadata) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "metadata is required"));
    }

    const {
      title,
      artist,
      genre,
      description,
      pricePerMonth,
      image,
      encryptedMusicCid,
      createdAt,
      nftTokenId,
    } = metadata;

    const nftMetadata = {
      name: title || "Untitled Track",
      nfttokenId: nftTokenId,
      description: description || "",
      image: image || "",
      animation_url: encryptedMusicCid || "",
      attributes: [
        { trait_type: "Artist", value: artist || "Unknown" },
        { trait_type: "Genre", value: genre || "Unknown" },
        { trait_type: "Price Per Month", value: pricePerMonth || "0" },
      ],
      properties: {
        userAddress,
        encryptedCid,
        encryptedMusicCid: encryptedMusicCid || "",
        artist: artist || "",
        genre: genre || "",
        pricePerMonth: pricePerMonth || "0",
      },
      created_at: createdAt || new Date().toISOString(),
    };

    const tokenId = encryptedCid.replace(/[^a-zA-Z0-9]/g, "_");
    const filePath = path.join(NFT_METADATA_DIR, `${tokenId}.json`);

    await fs.writeFile(filePath, JSON.stringify(nftMetadata, null, 2), "utf8");

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          tokenId,
          userAddress,
          encryptedCid,
          metadataUrl: `/api/nft/metadata/${tokenId}`,
          metadata: nftMetadata,
        },
        "Metadata stored successfully"
      )
    );
  } catch (error) {
    console.error("Error storing metadata:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, error.message || "Failed to store metadata")
      );
  }
});

/**
 * List All NFT Metadata (Latest First)
 * GET /api/nft/metadata
 */
const listMetadata = AsyncHandler(async (req, res) => {
  try {
    try {
      await fs.access(NFT_METADATA_DIR);
    } catch {
      await fs.mkdir(NFT_METADATA_DIR, { recursive: true });
      return res
        .status(200)
        .json(
          new ApiResponse(200, { count: 0, items: [] }, "No metadata found")
        );
    }

    const files = await fs.readdir(NFT_METADATA_DIR);
    const jsonFiles = files.filter(
      (file) => file.endsWith(".json") && file !== "buyedsongs.json"
    );

    const metadataList = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(NFT_METADATA_DIR, file);
        const content = await fs.readFile(filePath, "utf8");
        const metadata = JSON.parse(content);
        return {
          tokenId: file.replace(".json", ""),
          ...metadata,
        };
      })
    );

    metadataList.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=60");

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { count: metadataList.length, items: metadataList },
          "Success"
        )
      );
  } catch (error) {
    console.error("Error listing metadata:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, error.message || "Failed to list metadata")
      );
  }
});

/**
 * Get Single NFT Metadata
 * GET /api/nft/metadata/:tokenId
 */
const getMetadata = AsyncHandler(async (req, res) => {
  try {
    const { tokenId } = req.params;

    if (!tokenId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "tokenId is required"));
    }

    const filePath = path.join(NFT_METADATA_DIR, `${tokenId}.json`);

    try {
      await fs.access(filePath);
    } catch {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Metadata not found"));
    }

    const content = await fs.readFile(filePath, "utf8");
    const metadata = JSON.parse(content);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=3600");

    return res.status(200).json(metadata);
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, error.message || "Failed to fetch metadata")
      );
  }
});

/**
 * Store Buyed Song
 * POST /api/nft/buyedsong
 * Body: {
 *   userAddress: string,
 *   encryptedCid: string,
 *   metadata: {
 *     title: string,
 *     artist: string,
 *     genre: string,
 *     description: string,
 *     pricePerMonth: string,
 *     image: string,
 *     encryptedMusicCid: string,
 *     createdAt: string
 *   }
 * }
 */
const storeBuyedSong = AsyncHandler(async (req, res) => {
  try {
    await ensureDir();

    const { userAddress, encryptedCid, metadata } = req.body;

    if (!userAddress) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "userAddress is required"));
    }

    if (!encryptedCid) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "encryptedCid is required"));
    }

    if (!metadata) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "metadata is required"));
    }

    const {
      title,
      artist,
      genre,
      description,
      pricePerMonth,
      image,
      encryptedMusicCid,
      createdAt,
    } = metadata;

    const songData = {
      songId: `buyed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userAddress,
      encryptedCid,
      name: title || "Untitled Track",
      description: description || "",
      image: image || "",
      animation_url: encryptedMusicCid || "",
      attributes: [
        { trait_type: "Artist", value: artist || "Unknown" },
        { trait_type: "Genre", value: genre || "Unknown" },
        { trait_type: "Price Per Month", value: pricePerMonth || "0" },
      ],
      properties: {
        userAddress,
        encryptedCid,
        encryptedMusicCid: encryptedMusicCid || "",
        artist: artist || "",
        genre: genre || "",
        pricePerMonth: pricePerMonth || "0",
      },
      buyed_at: new Date().toISOString(),
      created_at: createdAt || new Date().toISOString(),
    };

    // Read existing buyed songs
    const buyedData = await readBuyedSongs();

    // Check if already buyed by same user
    const existingIndex = buyedData.songs.findIndex(
      (s) =>
        s.encryptedCid === encryptedCid &&
        s.userAddress.toLowerCase() === userAddress.toLowerCase()
    );

    if (existingIndex !== -1) {
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, "Song already purchased by this user")
        );
    }

    // Add new buyed song
    buyedData.songs.push(songData);
    buyedData.updated_at = new Date().toISOString();

    // Write back to file
    await writeBuyedSongs(buyedData);

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          songId: songData.songId,
          userAddress,
          encryptedCid,
          song: songData,
        },
        "Song purchased successfully"
      )
    );
  } catch (error) {
    console.error("Error storing buyed song:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          null,
          error.message || "Failed to store buyed song"
        )
      );
  }
});

/**
 * List All Buyed Songs (Latest First)
 * GET /api/nft/buyedsong
 */
const listBuyedSongs = AsyncHandler(async (req, res) => {
  try {
    await ensureDir();

    const buyedData = await readBuyedSongs();

    // Sort by buyed_at (latest first)
    const sortedSongs = buyedData.songs.sort((a, b) => {
      const dateA = new Date(a.buyed_at || 0);
      const dateB = new Date(b.buyed_at || 0);
      return dateB - dateA;
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=60");

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { count: sortedSongs.length, songs: sortedSongs },
          "Success"
        )
      );
  } catch (error) {
    console.error("Error listing buyed songs:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          null,
          error.message || "Failed to list buyed songs"
        )
      );
  }
});

/**
 * List Buyed Songs by User Address (Latest First)
 * GET /api/nft/buyedsong/user/:address
 */
const listBuyedSongsByAddress = AsyncHandler(async (req, res) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "address is required"));
    }

    // Ensure directory exists
    try {
      await fs.access(NFT_METADATA_DIR);
    } catch {
      await fs.mkdir(NFT_METADATA_DIR, { recursive: true });
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { address, count: 0, items: [] },
            "No metadata found"
          )
        );
    }

    // Read all files in directory
    const files = await fs.readdir(NFT_METADATA_DIR);
    const jsonFiles = files.filter(
      (file) => file.endsWith(".json") && file !== "buyedsongs.json"
    );

    // Read and parse each metadata file
    const allMetadata = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(NFT_METADATA_DIR, file);
        const content = await fs.readFile(filePath, "utf8");
        const metadata = JSON.parse(content);
        return {
          tokenId: file.replace(".json", ""),
          ...metadata,
        };
      })
    );

    // Filter by user address (case-insensitive)
    const userMetadata = allMetadata.filter((item) => {
      const itemAddress = item.properties?.userAddress || "";
      return itemAddress.toLowerCase() === address.toLowerCase();
    });

    // Sort by created_at (latest first)
    userMetadata.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=60");

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          address,
          count: userMetadata.length,
          items: userMetadata,
        },
        "Success"
      )
    );
  } catch (error) {
    console.error("Error listing metadata by address:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, error.message || "Failed to list metadata")
      );
  }
});

export {
  storeMetadata,
  listMetadata,
  getMetadata,
  storeBuyedSong,
  listBuyedSongs,
  listBuyedSongsByAddress,
};
