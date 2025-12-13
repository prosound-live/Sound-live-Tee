import { AsyncHandler } from "../utils/AsyncHandler.utils.js";
import pinata from "../DB/pinata.js";
import { ApiResponse } from "../utils/ApiResponse.utils.js";
import {
  decryptFile,
  saveEncryptedFile,
  saveDecryptedFile,
} from "../utils/decryption.utils.js";
import { config } from "dotenv";

config();

const uploadFile = AsyncHandler(async (req, res) => {
  try {
    // Extract form fields
    const { iv, encryptedKey, fileName, fileType } = req.body;

    // Get the uploaded file from multer
    const encryptedFile = req.file;

    if (!encryptedFile) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "encryptedFile is required"));
    }

    if (!iv || !encryptedKey || !fileName || !fileType) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Missing required fields: iv, encryptedKey, fileName, or fileType"
          )
        );
    }

    // Get private key from environment variables
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return res
        .status(500)
        .json(
          new ApiResponse(
            500,
            null,
            "PRIVATE_KEY not configured in environment variables"
          )
        );
    }

    // Parse encryptedKey if it's a string
    let parsedEncryptedKey;
    try {
      parsedEncryptedKey =
        typeof encryptedKey === "string"
          ? JSON.parse(encryptedKey)
          : encryptedKey;
    } catch (error) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid encryptedKey format"));
    }

    // Generate timestamp once to pair encrypted and decrypted files
    const fileTimestamp = Date.now();

    // Save encrypted file to public directory (before decryption)
    const encryptedFilePath = await saveEncryptedFile(
      encryptedFile.buffer,
      fileName,
      fileTimestamp
    );

    // Decrypt the file
    const metadata = {
      iv,
      encryptedKey: parsedEncryptedKey,
    };

    const decryptedBuffer = await decryptFile(
      encryptedFile.buffer,
      metadata,
      privateKey
    );

    // Save decrypted file to public directory (after decryption)
    const decryptedFilePath = await saveDecryptedFile(
      decryptedBuffer,
      fileName,
      fileType,
      fileTimestamp
    );

    // Convert encrypted buffer to base64 for Pinata upload
    const base64File = encryptedFile.buffer.toString("base64");

    // Upload encrypted file to Pinata using base64
    const result = await pinata.upload.public.base64(base64File, {
      pinataMetadata: {
        name: fileName,
        keyvalues: {
          fileType: fileType,
          iv: iv,
          encryptedKey: JSON.stringify(parsedEncryptedKey),
        },
      },
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          ipfsHash: result.IpfsHash,
          pinSize: result.PinSize,
          timestamp: result.Timestamp,
          encryptedFileUrl: encryptedFilePath,
          decryptedFileUrl: decryptedFilePath,
          fileData: {
            fileName,
            fileType,
            iv,
            encryptedKey: parsedEncryptedKey,
          },
        },
        "File uploaded and decrypted successfully"
      )
    );
  } catch (error) {
    console.error("Error processing file:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, error.message || "Failed to process file")
      );
  }
});

const getAndDecryptFile = AsyncHandler(async (req, res) => {
  try {
    const { cid, iv, encryptedKey, fileName, fileType } = req.query;

    if (!cid) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "CID is required"));
    }

    if (!iv || !encryptedKey) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Missing required fields: iv and encryptedKey"
          )
        );
    }

    // Get private key from environment variables
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return res
        .status(500)
        .json(
          new ApiResponse(
            500,
            null,
            "PRIVATE_KEY not configured in environment variables"
          )
        );
    }

    // Parse encryptedKey if it's a string
    let parsedEncryptedKey;
    try {
      parsedEncryptedKey =
        typeof encryptedKey === "string"
          ? JSON.parse(encryptedKey)
          : encryptedKey;
    } catch (error) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid encryptedKey format"));
    }

    // Fetch file from Pinata IPFS using gateway
    let gatewayUrl = process.env.GATEWAY_URL || "https://gateway.pinata.cloud";

    // Ensure gateway URL has protocol prefix
    if (
      !gatewayUrl.startsWith("http://") &&
      !gatewayUrl.startsWith("https://")
    ) {
      gatewayUrl = `https://${gatewayUrl}`;
    }

    const ipfsUrl = `${gatewayUrl}/ipfs/${cid}`;

    // Fetch file from IPFS with streaming support
    const response = await fetch(ipfsUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from IPFS: ${response.statusText}`);
    }

    // Check if response body is available for streaming
    if (!response.body) {
      throw new Error("Response body is not available for streaming");
    }

    // Collect encrypted chunks from IPFS
    const encryptedChunks = [];
    const reader = response.body.getReader();
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        encryptedChunks.push(Buffer.from(value));
      }
    }

    // Combine all encrypted chunks
    const encryptedBuffer = Buffer.concat(encryptedChunks);

    // Decrypt the file
    const metadata = {
      iv,
      encryptedKey: parsedEncryptedKey,
    };

    const decryptedBuffer = await decryptFile(
      encryptedBuffer,
      metadata,
      privateKey
    );

    // Set appropriate headers for streaming
    const finalFileName = fileName || `decrypted-${cid}`;
    const finalFileType = fileType || "application/octet-stream";

    res.setHeader("Content-Type", finalFileType);
    res.setHeader("Content-Disposition", `inline; filename="${finalFileName}"`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-cache");

    // Stream decrypted file in chunks for better memory efficiency
    const chunkSize = 64 * 1024; // 64KB chunks
    const totalSize = decryptedBuffer.length;
    let offset = 0;

    // Handle client disconnect
    req.on("close", () => {
      if (!res.headersSent) {
        res.end();
      }
    });

    const streamChunks = () => {
      // Check if client disconnected
      if (req.destroyed || res.destroyed) {
        return;
      }

      if (offset >= totalSize) {
        res.end();
        return;
      }

      const chunk = decryptedBuffer.slice(
        offset,
        Math.min(offset + chunkSize, totalSize)
      );
      offset += chunkSize;

      try {
        if (res.write(chunk)) {
          // If write was successful, continue streaming
          setImmediate(streamChunks);
        } else {
          // Wait for drain event before continuing
          res.once("drain", streamChunks);
        }
      } catch (error) {
        console.error("Error streaming chunk:", error);
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.end();
        }
      }
    };

    // Start streaming
    streamChunks();
  } catch (error) {
    console.error("Error fetching and decrypting file:", error);
    if (!res.headersSent) {
      return res
        .status(500)
        .json(
          new ApiResponse(
            500,
            null,
            error.message || "Failed to fetch and decrypt file"
          )
        );
    }
    // If headers are already sent, just end the response
    res.end();
  }
});

export { uploadFile, getAndDecryptFile };
