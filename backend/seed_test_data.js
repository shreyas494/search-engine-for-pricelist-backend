import mongoose from "mongoose";
import dotenv from "dotenv";
import Tyre from "./models/Tyre.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI?.trim();

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing in environment!");
  process.exit(1);
}

const testItems = [
  {
    brand: "TEST_BRAND_DEMO",
    model: "Demo Radial 195/65 R15",
    type: "Tubeless",
    dp: 3500,
    mrp: 4200
  },
  {
    brand: "TEST_BRAND_DEMO",
    model: "Demo EcoGrip 185/70 R14",
    type: "Tubeless",
    dp: 2800,
    mrp: 3400
  },
  {
    brand: "TEST_BRAND_DEMO",
    model: "Demo UltraSport 225/45 R17",
    type: "Performance",
    dp: 6200,
    mrp: 7500
  },
  {
    brand: "SAMPLE_TYRES_INC",
    model: "Sample CityRunner 165/80 R13",
    type: "Tube Type",
    dp: 2100,
    mrp: 2600
  },
  {
    brand: "SAMPLE_TYRES_INC",
    model: "Sample AllTerrain 235/70 R16",
    type: "Tubeless",
    dp: 5400,
    mrp: 6500
  }
];

async function seed() {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    console.log("⏳ Inserting test price list data...");
    const result = await Tyre.insertMany(testItems);
    console.log(`🎉 Successfully inserted ${result.length} test price list items!`);

    console.log("Inserted test items for brands:");
    console.log(" - TEST_BRAND_DEMO (3 items)");
    console.log(" - SAMPLE_TYRES_INC (2 items)");

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  } catch (err) {
    console.error("❌ Error seeding test data:", err);
    process.exit(1);
  }
}

seed();
