try {
  const { cid, iv, encryptedKey, fileName, fileType } = req.query;

  if (!cid) {
    return res.status(400).json(new ApiResponse(400, null, "CID is required"));
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

  // Fetch file from Pinata IPFS using SDK gateway configuration
  // Prioritize SDK config over environment variable
  let gatewayUrl =
    pinata.config?.pinataGateway ||
    process.env.GATEWAY_URL ||
    "https://gateway.pinata.cloud";

  // Ensure gateway URL has protocol prefix
  if (!gatewayUrl.startsWith("http://") && !gatewayUrl.startsWith("https://")) {
    gatewayUrl = `https://${gatewayUrl}`;
  }

  // Construct IPFS URL using Pinata gateway
  const ipfsUrl = `${gatewayUrl}/ipfs/${cid}`;

  // Use Pinata SDK gateway convert method to get proper URL (if needed)
  // For private gateways, we can use the SDK's convert method
  let finalUrl = ipfsUrl;
  try {
    // Try to convert URL using SDK if gateway is configured
    if (pinata.config?.pinataGateway) {
      finalUrl = await pinata.gateways.public.convert(ipfsUrl);
    }
  } catch (error) {
    // If conversion fails, use original URL
    console.warn(
      "Gateway URL conversion failed, using original URL:",
      error.message
    );
  }

  // Fetch file from IPFS using the gateway URL
  // Note: Pinata SDK doesn't have a direct streaming method, so we use fetch
  // but construct the URL using SDK's gateway configuration
  const response = await fetch(finalUrl);
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
  const { decryptFile } = await import("../utils/decryption.utils.js");
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
