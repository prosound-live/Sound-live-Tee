import { AsyncHandler } from "../utils/AsyncHandler.utils.js";
import pinata from "../DB/pinata.js";
import { ApiResponse } from "../utils/ApiResponse.utils.js";
import { decryptFile } from "../utils/decryption.utils.js";

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

    // Convert encrypted buffer to base64 for Pinata upload
    const base64File = encryptedFile.buffer.toString("base64");

    // console.log(parsedEncryptedKey);

    // Upload encrypted file to Pinata using base64

    const result = await pinata.upload.public.base64(base64File).keyvalues({
      ...parsedEncryptedKey,
      fileIv: iv,
    });

    console.log(result);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          ipfsHash: result.cid,
          pinSize: result.size,
          timestamp: result.created_at,
          fileData: {
            fileName,
            fileType,
            iv,
            encryptedKey: parsedEncryptedKey,
          },
        },
        "File uploaded to Pinata successfully"
      )
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, error.message || "Failed to upload file")
      );
  }
});

const getAndDecryptFile = AsyncHandler(async (req, res) => {
  try {
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
    // const userId = req.params.id;
    const cid = req.query.cid;
    console.log(cid);
    if (!cid) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "CID is required"));
    }

    // Get file metadata from Pinata
    const fileList = await pinata.files.public.list().cid(cid);
    if (!fileList.files || fileList.files.length === 0) {
      return res.status(404).json(new ApiResponse(404, null, "File not found"));
    }

    const fileInfo = fileList.files[0];
    const { iv, ephemPublicKey, ciphertext, mac, fileIv, fileType, fileName } =
      fileInfo.keyvalues || {};

    if (!iv || !ephemPublicKey || !ciphertext || !mac || !fileIv) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Missing required encryption metadata in file keyvalues"
          )
        );
    }

    const encryptedKey = { iv, ephemPublicKey, ciphertext, mac };

    // Get signed URL from Pinata SDK for private gateway access
    const signedUrl = await pinata.gateways.private.createAccessLink({
      cid: cid,
      expires: 3600,
    });

    console.log(signedUrl);

    // Fetch encrypted file from Pinata
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file from Pinata: ${response.statusText}`
      );
    }
    console.log("response getted");
    // Get encrypted file as binary data (not base64 - it's already binary)
    // The response body is a ReadableStream, so we need to read it properly
    if (!response.body) {
      throw new Error("Response body is not available");
    }

    // Collect chunks from the stream
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

    // Combine all chunks into a single buffer
    const encryptedBuffer = Buffer.concat(encryptedChunks);

    // Decrypt the file using the decryption utility
    const metadata = {
      iv: fileIv,
      encryptedKey: encryptedKey,
    };
    console.log(metadata);
    const decryptedBuffer = await decryptFile(
      encryptedBuffer,
      metadata,
      privateKey
    );
    console.log("file is decrypted");
    // Get file name and type from metadata or use defaults
    const finalFileName = fileName || `decrypted-${cid}`;
    const finalFileType = fileType || "application/octet-stream";

    // Set appropriate headers for streaming
    res.setHeader("Content-Type", finalFileType);
    res.setHeader("Content-Disposition", `inline; filename="${finalFileName}"`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-cache");

    // Stream decrypted file in chunks for better memory efficiency
    const chunkSize = 64 * 1024; // 64KB chunks
    const totalSize = decryptedBuffer.length;
    let offset = 0;
    console.log("sending chunks");
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
