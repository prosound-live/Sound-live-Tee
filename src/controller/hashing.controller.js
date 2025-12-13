import { toBytes, toHex } from "viem";
import { getPublicKey } from "@noble/secp256k1";
import { AsyncHandler } from "../utils/AsyncHandler.utils.js";
import { ApiResponse } from "../utils/ApiResponse.utils.js";
import { ApiError } from "../utils/ApiError.utils.js";
// import EthCrypto, { Encrypted } from "eth-crypto";

const generatePublickey = AsyncHandler(async (req, res) => {
  try {
    const PRIVATE_KEY = process.env.PRIVATE_KEY;

    if (!PRIVATE_KEY) {
      throw ApiError(500, "Internal Server Error");
    }

    const privateKeyHex = PRIVATE_KEY.startsWith("0x")
      ? PRIVATE_KEY
      : `0x${PRIVATE_KEY}`;

    const privateKeyBytes = toBytes(privateKeyHex);
    const publicKeyBytes = getPublicKey(privateKeyBytes, false);
    const publicKey = toHex(publicKeyBytes).slice(2);
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          publicKey: publicKey,
        },
        "publickey generated"
      )
    );
  } catch (error) {
    console.log("Error in generating public key", error);
    return res
      .status(error.statusCode ?? 500)
      .json(
        new ApiResponse(error.statusCode ?? 500, error.error, error.message)
      );
  }
});




export { generatePublickey };
