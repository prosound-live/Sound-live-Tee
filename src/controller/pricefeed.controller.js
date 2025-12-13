import { AsyncHandler } from "../utils/AsyncHandler.utils.js";

let cachedPrice = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000;

async function getIPPrice() {
  const now = Date.now();

  if (cachedPrice && now - cacheTimestamp < CACHE_DURATION) {
    return cachedPrice;
  }

  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=story-2&vs_currencies=usd"
  );

  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);

  const data = await res.json();
  const price = data["story-2"]?.usd;

  if (!price) throw new Error("Price not found");

  cachedPrice = price;
  cacheTimestamp = now;
  return price;
}

const toWei = (amount) => BigInt(Math.floor(amount * 1e18)).toString();

const getIPforUSD = AsyncHandler(async (req, res) => {
  try {
    const usdAmount = parseFloat(req.query.usd);

    if (!usdAmount || usdAmount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid usd" });
    }

    const ipPrice = await getIPPrice();
    const ipAmount = usdAmount / ipPrice;

    res.json({
      success: true,
      usdAmount,
      ipPrice,
      ipAmount,
      ipAmountWei: toWei(ipAmount),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export { getIPforUSD };

// app.get("/api/price/convert");
