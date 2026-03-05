// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const VERSION = "6.3.0-TABLE-PRO";

console.log(`🚀 Backend Starting - Version: ${VERSION}`);

// ✅ Health Check (Keep-Alive)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "active", uptime: process.uptime() });
});

// ✅ Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*", // Allow all for now, restrict in prod
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(compression());
app.use(express.json());

// ✅ MongoDB Connection
if (process.env.MONGO_URI && (process.env.MONGO_URI.includes("<") || process.env.MONGO_URI.includes(">"))) {
  console.error("🚨 CONFIGURATION ERROR: Your MONGO_URI contains '<' or '>'. Did you forget to remove the '<db_password>' placeholder and type your actual password?");
}
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

import Tyre from "./models/Tyre.js";

// ✅ Simple Brand Cache
let brandCache = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// ✅ Get tyres with optional filters, pagination and limit
app.get("/api/tyres", async (req, res) => {
  try {
    const { search, brand, page = 1, limit = 0 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const resultLimit = parseInt(limit);

    let filter = {};
    if (brand) filter.brand = brand;
    if (search) filter.model = { $regex: search, $options: "i" };

    console.time("fetch-tyres");
    // Parallelize find and count
    const [tyres, total] = await Promise.all([
      Tyre.find(filter).sort({ _id: 1 }).skip(skip > 0 ? skip : 0).limit(resultLimit > 0 ? resultLimit : 0).exec(),
      Tyre.countDocuments(filter)
    ]);
    console.timeEnd("fetch-tyres");

    res.json({
      tyres,
      total,
      page: parseInt(page),
      pages: resultLimit > 0 ? Math.ceil(total / resultLimit) : 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get unique brands with caching
app.get("/api/brands", async (req, res) => {
  try {
    const now = Date.now();
    if (brandCache && (now - lastCacheUpdate < CACHE_DURATION)) {
      return res.json(brandCache);
    }

    const brands = await Tyre.distinct("brand");
    brandCache = brands;
    lastCacheUpdate = now;
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Start server
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
