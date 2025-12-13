import EthCrypto from "eth-crypto";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { webcrypto } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use Node.js Web Crypto API
const crypto = webcrypto;

// ============== HELPERS ==============

function bufferToHex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ============== DECRYPTION ==============

/**
 * Decrypts an encrypted file using the provided metadata and private key
 * @param {Buffer} encryptedBuffer - The encrypted file buffer
 * @param {Object} metadata - Contains iv and encryptedKey
 * @param {string} privateKey - The private key to decrypt the AES key
 * @returns {Promise<Buffer>} - The decrypted file buffer
 */
export async function decryptFile(encryptedBuffer, metadata, privateKey) {
  try {
    // 1. Decrypt the AES key using receiver's private key
    const decryptedKeyHex = await EthCrypto.decryptWithPrivateKey(
      privateKey,
      metadata.encryptedKey
    );

    // 2. Import the AES key
    const keyBuffer = hexToBuffer(decryptedKeyHex);
    const aesKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // 3. Convert IV from hex to Uint8Array
    const iv = hexToBuffer(metadata.iv);

    // 4. Ensure encryptedBuffer is a Uint8Array (Buffer extends Uint8Array)
    const encryptedUint8Array = encryptedBuffer instanceof Uint8Array
      ? encryptedBuffer
      : new Uint8Array(encryptedBuffer);

    // 5. Decrypt with AES-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encryptedUint8Array
    );

    return Buffer.from(decryptedBuffer);
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Saves encrypted file to public directory
 * @param {Buffer} encryptedBuffer - The encrypted file buffer
 * @param {string} fileName - Original file name
 * @param {number} timestamp - Optional timestamp to use for filename (defaults to current time)
 * @returns {Promise<string>} - Public URL path to the file
 */
export async function saveEncryptedFile(encryptedBuffer, fileName, timestamp = null) {
  try {
    // Create public directory if it doesn't exist
    const publicDir = join(__dirname, "../../public/files");
    await mkdir(publicDir, { recursive: true });

    // Generate unique filename to avoid conflicts
    const fileTimestamp = timestamp || Date.now();
    const uniqueFileName = `${fileTimestamp}-encrypted-${fileName}`;
    const filePath = join(publicDir, uniqueFileName);

    // Write file to disk
    await writeFile(filePath, encryptedBuffer);

    // Return public URL path
    return `/files/${uniqueFileName}`;
  } catch (error) {
    throw new Error(`Failed to save encrypted file: ${error.message}`);
  }
}

/**
 * Saves decrypted file to public directory
 * @param {Buffer} decryptedBuffer - The decrypted file buffer
 * @param {string} fileName - Original file name
 * @param {string} fileType - Original file type
 * @param {number} timestamp - Optional timestamp to use for filename (defaults to current time)
 * @returns {Promise<string>} - Public URL path to the file
 */
export async function saveDecryptedFile(decryptedBuffer, fileName, fileType, timestamp = null) {
  try {
    // Create public directory if it doesn't exist
    const publicDir = join(__dirname, "../../public/files");
    await mkdir(publicDir, { recursive: true });

    // Generate unique filename to avoid conflicts
    const fileTimestamp = timestamp || Date.now();
    const uniqueFileName = `${fileTimestamp}-decrypted-${fileName}`;
    const filePath = join(publicDir, uniqueFileName);

    // Write file to disk
    await writeFile(filePath, decryptedBuffer);

    // Return public URL path
    return `/files/${uniqueFileName}`;
  } catch (error) {
    throw new Error(`Failed to save decrypted file: ${error.message}`);
  }
}

