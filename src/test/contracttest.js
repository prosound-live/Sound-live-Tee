// test-contracts.js
import { ethers } from "ethers";
import { config } from "dotenv";
config();
// Contract Addresses
const ADDRESSES = {
  factory: "0x8D65a3b3a445BE5FA901258A0b92B91b49edc22f",
  recordNFT: "0x86B1A538F4F4725c99919647f9745b1DB8251AbA",
  rentalNFT: "0x7d3e5FcE9D84Dd1c153A4B3C6CF24D9EE63646B3",
};

// ABIs
const FACTORY_ABI = [
  "function getRecordNFTAddress() view returns (address)",
  "function getRentalNFTAddress() view returns (address)",
  "function getTreasury() view returns (address)",
  "function geturl(uint256) view returns (string)",
  "function mintRecord(string,string,uint256) returns (uint256)",
  "function moveToTreasury()",
  "function owner() view returns (address)",
  "function rentRecord(uint256,uint256,uint256,string) payable returns (uint256)",
  "function setRecordIPIDS(uint256,string,string)",
  "function setTreasury(address)",
  "function transferOwnership(address)",
  "event RecordCreated(address,uint256,uint256)",
  "event RentalCreated(address,uint256,uint256,uint256)",
  "event LicenseOfRecordIsSet(uint256,string,string)",
];

const RECORD_NFT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  "function getAssetId(uint256) view returns (string)",
  "function getMetadataURL(uint256) view returns (string)",
  "function getMonthlyPrice(uint256) view returns (uint256)",
  "function getStoryLicenseId(uint256) view returns (string)",
  "function getTokenCID(uint256) view returns (string)",
  "function mintNFT(address,string,string,uint256) returns (uint256)",
  "function setIPIDS(uint256,string,string)",
  "function owner() view returns (address)",
  "event RecordNFT__NFTMinted(address,uint256)",
  "event Transfer(address,address,uint256)",
];

const RENTAL_NFT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  "function getRecordId(uint256) view returns (uint256)",
  "function getexpiry(uint256) view returns (uint256)",
  "function isExpired(uint256) view returns (bool)",
  "function mint(address,string,uint256,uint256) returns (uint256)",
  "function extendRent(uint256,uint256)",
  "function owner() view returns (address)",
  "event RentalNFT__NFtMinted(address,uint256,uint256)",
  "event RentalNFT__ExtendRentalPeriod(address,uint256,uint256)",
  "event Transfer(address,address,uint256)",
];

// Test Configuration
const CONFIG = {
  rpcUrl: process.env.RPC_URL || "https://aeneid.storyrpc.io",
  privateKey: process.env.PRIVATE_KEY,
  testData: {
    metadataUrl: "ipfs://QmTest123456789",
    cid: "QmTest123456789",
    monthlyPriceUSD: 1000, // $10.00 in cents
    rentalMonths: 1,
    rentalUrl: "ipfs://QmRentalTest123",
  },
};

// Logger
const log = {
  title: (msg) =>
    console.log(`\n${"=".repeat(60)}\n🎵 ${msg}\n${"=".repeat(60)}`),
  step: (msg) => console.log(`\n📍 ${msg}`),
  success: (msg) => console.log(`   ✅ ${msg}`),
  info: (msg) => console.log(`   ℹ️  ${msg}`),
  error: (msg) => console.log(`   ❌ ${msg}`),
  data: (label, value) => console.log(`   📊 ${label}: ${value}`),
  divider: () => console.log(`   ${"─".repeat(50)}`),
};

// Main Test Class
class MusicProtocolTester {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);

    this.factory = new ethers.Contract(
      ADDRESSES.factory,
      FACTORY_ABI,
      this.wallet
    );
    this.recordNFT = new ethers.Contract(
      ADDRESSES.recordNFT,
      RECORD_NFT_ABI,
      this.wallet
    );
    this.rentalNFT = new ethers.Contract(
      ADDRESSES.rentalNFT,
      RENTAL_NFT_ABI,
      this.wallet
    );

    this.testResults = {
      passed: 0,
      failed: 0,
      tests: [],
    };
  }

  async runTest(name, testFn) {
    try {
      log.step(name);
      const result = await testFn();
      log.success(`PASSED`);
      this.testResults.passed++;
      this.testResults.tests.push({ name, status: "PASSED", result });
      return result;
    } catch (error) {
      log.error(`FAILED: ${error.message}`);
      this.testResults.failed++;
      this.testResults.tests.push({
        name,
        status: "FAILED",
        error: error.message,
      });
      return null;
    }
  }

  // ==================== STORY TEST ====================
  async runStoryTest() {
    log.title("MUSIC PROTOCOL - STORY TEST");
    log.info(`Tester Wallet: ${this.wallet.address}`);
    log.info(`Network: Story Aeneid Testnet (Chain ID: 1315)`);

    const balance = await this.provider.getBalance(this.wallet.address);
    log.info(`Wallet Balance: ${ethers.formatEther(balance)} IP`);

    // ========== CHAPTER 1: Setup Verification ==========
    log.title("CHAPTER 1: Setup Verification");

    await this.runTest("1.1 Verify Factory Contract", async () => {
      const owner = await this.factory.owner();
      log.data("Factory Owner", owner);
      return owner;
    });

    await this.runTest("1.2 Verify RecordNFT Address in Factory", async () => {
      const recordAddr = await this.factory.getRecordNFTAddress();
      log.data("RecordNFT Address", recordAddr);
      if (recordAddr.toLowerCase() !== ADDRESSES.recordNFT.toLowerCase()) {
        throw new Error("RecordNFT address mismatch");
      }
      return recordAddr;
    });

    await this.runTest("1.3 Verify RentalNFT Address in Factory", async () => {
      const rentalAddr = await this.factory.getRentalNFTAddress();
      log.data("RentalNFT Address", rentalAddr);
      if (rentalAddr.toLowerCase() !== ADDRESSES.rentalNFT.toLowerCase()) {
        throw new Error("RentalNFT address mismatch");
      }
      return rentalAddr;
    });

    await this.runTest("1.4 Get RecordNFT Info", async () => {
      const name = await this.recordNFT.name();
      const symbol = await this.recordNFT.symbol();
      log.data("Name", name);
      log.data("Symbol", symbol);
      return { name, symbol };
    });

    await this.runTest("1.5 Get RentalNFT Info", async () => {
      const name = await this.rentalNFT.name();
      const symbol = await this.rentalNFT.symbol();
      log.data("Name", name);
      log.data("Symbol", symbol);
      return { name, symbol };
    });

    // ========== CHAPTER 2: Treasury Setup ==========
    log.title("CHAPTER 2: Treasury Setup");

    const currentTreasury = await this.runTest(
      "2.1 Check Current Treasury",
      async () => {
        const treasury = await this.factory.getTreasury();
        log.data("Current Treasury", treasury);
        return treasury;
      }
    );

    if (currentTreasury === ethers.ZeroAddress) {
      await this.runTest("2.2 Set Treasury Address", async () => {
        const tx = await this.factory.setTreasury(this.wallet.address);
        log.data("TX Hash", tx.hash);
        await tx.wait();
        const newTreasury = await this.factory.getTreasury();
        log.data("New Treasury", newTreasury);
        return newTreasury;
      });
    } else {
      log.info("Treasury already set, skipping...");
    }

    // ========== CHAPTER 3: Create Music Record ==========
    log.title("CHAPTER 3: Create Music Record (Mint RecordNFT)");

    let recordId;
    await this.runTest("3.1 Mint New Record NFT", async () => {
      const { metadataUrl, cid, monthlyPriceUSD } = CONFIG.testData;

      log.info(`Metadata URL: ${metadataUrl}`);
      log.info(`CID: ${cid}`);
      log.info(`Monthly Price: $${monthlyPriceUSD / 100}`);

      const tx = await this.factory.mintRecord(
        metadataUrl,
        cid,
        monthlyPriceUSD
      );
      log.data("TX Hash", tx.hash);

      const receipt = await tx.wait();
      log.data("Block Number", receipt.blockNumber);

      // Parse RecordCreated event
      const event = receipt.logs.find((l) => {
        try {
          return this.factory.interface.parseLog(l)?.name === "RecordCreated";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.factory.interface.parseLog(event);
        recordId = parsed.args[1];
        log.data("Record ID", recordId.toString());
      }

      return recordId;
    });

    if (recordId) {
      await this.runTest("3.2 Verify Record NFT Owner", async () => {
        const owner = await this.recordNFT.ownerOf(recordId);
        log.data("Record Owner", owner);
        if (owner.toLowerCase() !== this.wallet.address.toLowerCase()) {
          throw new Error("Owner mismatch");
        }
        return owner;
      });

      await this.runTest("3.3 Get Record Metadata", async () => {
        const metadataUrl = await this.recordNFT.getMetadataURL(recordId);
        const cid = await this.recordNFT.getTokenCID(recordId);
        const monthlyPrice = await this.recordNFT.getMonthlyPrice(recordId);

        log.data("Metadata URL", metadataUrl);
        log.data("CID", cid);
        log.data("Monthly Price", monthlyPrice.toString());

        return { metadataUrl, cid, monthlyPrice };
      });

      await this.runTest("3.4 Get Record Balance", async () => {
        const balance = await this.recordNFT.balanceOf(this.wallet.address);
        log.data("Record NFT Balance", balance.toString());
        return balance;
      });
    }

    // ========== CHAPTER 4: Set IP License ==========
    log.title("CHAPTER 4: Set Story Protocol IP License");

    if (recordId) {
      await this.runTest("4.1 Set Record IP IDs", async () => {
        const assetId = "asset_" + Date.now();
        const licenseId = "license_" + Date.now();

        log.info(`Asset ID: ${assetId}`);
        log.info(`License ID: ${licenseId}`);

        const tx = await this.factory.setRecordIPIDS(
          recordId,
          assetId,
          licenseId
        );
        log.data("TX Hash", tx.hash);
        await tx.wait();

        return { assetId, licenseId };
      });

      await this.runTest("4.2 Verify IP IDs", async () => {
        const assetId = await this.recordNFT.getAssetId(recordId);
        const licenseId = await this.recordNFT.getStoryLicenseId(recordId);

        log.data("Asset ID", assetId);
        log.data("License ID", licenseId);

        return { assetId, licenseId };
      });
    }

    // ========== CHAPTER 5: Rent Music Record ==========
    log.title("CHAPTER 5: Rent Music Record");

    let rentalId;
    if (recordId) {
      await this.runTest("5.1 Calculate Rental Cost", async () => {
        const monthlyPrice = await this.recordNFT.getMonthlyPrice(recordId);
        const months = CONFIG.testData.rentalMonths;
        const totalUSD = monthlyPrice * BigInt(months);

        log.data("Monthly Price (USD cents)", monthlyPrice.toString());
        log.data("Months", months);
        log.data("Total USD (cents)", totalUSD.toString());

        // Simulate IP price ($2.00)
        const ipPrice = 2.0;
        const totalUSDDollars = Number(totalUSD) / 100;
        const ipAmount = totalUSDDollars / ipPrice;

        log.data("IP Price (USD)", ipPrice);
        log.data("Required IP", ipAmount.toFixed(4));

        return { totalUSD, ipAmount };
      });

      await this.runTest("5.2 Rent Record (Create Rental NFT)", async () => {
        const { rentalMonths, rentalUrl } = CONFIG.testData;

        // Calculate payment (assuming $2 per IP)
        const monthlyPrice = await this.recordNFT.getMonthlyPrice(recordId);
        const totalUSD = (Number(monthlyPrice) * rentalMonths) / 100; // Convert cents to dollars
        const ipPrice = 2.0;
        const ipAmount = totalUSD / ipPrice;
        const paymentWei = ethers.parseEther(ipAmount.toFixed(18));

        // Add 5% buffer
        const paymentWithBuffer = (paymentWei * 105n) / 100n;

        log.info(`Rental URL: ${rentalUrl}`);
        log.info(`Payment: ${ethers.formatEther(paymentWithBuffer)} IP`);

        const tx = await this.factory.rentRecord(
          recordId,
          0, // New rental (rentalId = 0)
          rentalMonths,
          rentalUrl,
          { value: paymentWithBuffer }
        );
        log.data("TX Hash", tx.hash);

        const receipt = await tx.wait();
        log.data("Block Number", receipt.blockNumber);

        // Parse RentalCreated event
        const event = receipt.logs.find((l) => {
          try {
            return this.factory.interface.parseLog(l)?.name === "RentalCreated";
          } catch {
            return false;
          }
        });

        if (event) {
          const parsed = this.factory.interface.parseLog(event);
          rentalId = parsed.args[1];
          const expiresAt = parsed.args[3];
          log.data("Rental ID", rentalId.toString());
          log.data(
            "Expires At",
            new Date(Number(expiresAt) * 1000).toISOString()
          );
        }

        return rentalId;
      });
    }

    // ========== CHAPTER 6: Verify Rental ==========
    log.title("CHAPTER 6: Verify Rental NFT");

    if (rentalId) {
      await this.runTest("6.1 Verify Rental NFT Owner", async () => {
        const owner = await this.rentalNFT.ownerOf(rentalId);
        log.data("Rental Owner", owner);
        return owner;
      });

      await this.runTest("6.2 Get Rental Details", async () => {
        const linkedRecordId = await this.rentalNFT.getRecordId(rentalId);
        const expiry = await this.rentalNFT.getexpiry(rentalId);
        const isExpired = await this.rentalNFT.isExpired(rentalId);

        log.data("Linked Record ID", linkedRecordId.toString());
        log.data("Expiry Timestamp", expiry.toString());
        log.data("Expiry Date", new Date(Number(expiry) * 1000).toISOString());
        log.data("Is Expired", isExpired);

        return { linkedRecordId, expiry, isExpired };
      });

      await this.runTest("6.3 Get Rental Balance", async () => {
        const balance = await this.rentalNFT.balanceOf(this.wallet.address);
        log.data("Rental NFT Balance", balance.toString());
        return balance;
      });

      await this.runTest("6.4 Get Rental Token URI", async () => {
        const uri = await this.rentalNFT.tokenURI(rentalId);
        log.data("Token URI", uri);
        return uri;
      });
    }

    // ========== CHAPTER 7: Extend Rental ==========
    log.title("CHAPTER 7: Extend Rental Period");

    if (rentalId && recordId) {
      await this.runTest("7.1 Extend Rental by 1 Month", async () => {
        const additionalMonths = 1;
        const { rentalUrl } = CONFIG.testData;

        // Calculate payment
        const monthlyPrice = await this.recordNFT.getMonthlyPrice(recordId);
        const totalUSD = (Number(monthlyPrice) * additionalMonths) / 100;
        const ipPrice = 2.0;
        const ipAmount = totalUSD / ipPrice;
        const paymentWei = ethers.parseEther(ipAmount.toFixed(18));
        const paymentWithBuffer = (paymentWei * 105n) / 100n;

        log.info(`Extending by ${additionalMonths} month(s)`);
        log.info(`Payment: ${ethers.formatEther(paymentWithBuffer)} IP`);

        const tx = await this.factory.rentRecord(
          recordId,
          rentalId, // Existing rental ID
          additionalMonths,
          rentalUrl,
          { value: paymentWithBuffer }
        );
        log.data("TX Hash", tx.hash);
        await tx.wait();

        // Check new expiry
        const newExpiry = await this.rentalNFT.getexpiry(rentalId);
        log.data(
          "New Expiry",
          new Date(Number(newExpiry) * 1000).toISOString()
        );

        return newExpiry;
      });
    }

    // ========== CHAPTER 8: Treasury Operations ==========
    log.title("CHAPTER 8: Treasury Operations");

    await this.runTest("8.1 Check Contract Balance", async () => {
      const balance = await this.provider.getBalance(ADDRESSES.factory);
      log.data("Factory Balance", ethers.formatEther(balance) + " IP");
      return balance;
    });

    await this.runTest("8.2 Move Funds to Treasury", async () => {
      const balanceBefore = await this.provider.getBalance(ADDRESSES.factory);

      if (balanceBefore > 0n) {
        const tx = await this.factory.moveToTreasury();
        log.data("TX Hash", tx.hash);
        await tx.wait();

        const balanceAfter = await this.provider.getBalance(ADDRESSES.factory);
        log.data("Balance Before", ethers.formatEther(balanceBefore) + " IP");
        log.data("Balance After", ethers.formatEther(balanceAfter) + " IP");

        return { balanceBefore, balanceAfter };
      } else {
        log.info("No balance to move");
        return { balanceBefore: 0n, balanceAfter: 0n };
      }
    });

    // ========== FINAL REPORT ==========
    this.printReport();
  }

  printReport() {
    log.title("TEST REPORT");

    console.log(
      `\n   Total Tests: ${this.testResults.passed + this.testResults.failed}`
    );
    console.log(`   ✅ Passed: ${this.testResults.passed}`);
    console.log(`   ❌ Failed: ${this.testResults.failed}`);

    log.divider();

    console.log("\n   Test Details:");
    this.testResults.tests.forEach((test, i) => {
      const icon = test.status === "PASSED" ? "✅" : "❌";
      console.log(`   ${i + 1}. ${icon} ${test.name}`);
      if (test.error) {
        console.log(`      Error: ${test.error}`);
      }
    });

    log.divider();

    const passRate = (
      (this.testResults.passed /
        (this.testResults.passed + this.testResults.failed)) *
      100
    ).toFixed(1);
    console.log(`\n   Pass Rate: ${passRate}%`);
    console.log(`\n${"=".repeat(60)}\n`);
  }
}

// Run Tests
async function main() {
  if (!CONFIG.privateKey) {
    console.error("❌ PRIVATE_KEY not set in environment");
    process.exit(1);
  }

  const tester = new MusicProtocolTester();

  try {
    await tester.runStoryTest();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
