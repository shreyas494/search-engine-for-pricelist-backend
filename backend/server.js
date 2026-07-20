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
const MONGO_URI = process.env.MONGO_URI?.trim();

console.log(`🚀 Backend Starting - Version: ${VERSION}`);

// ✅ Health Check (Keep-Alive)
const healthResponse = () => ({
  status: "active",
  uptime: Math.round(process.uptime()),
  version: VERSION,
  db: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
});

app.get("/", (req, res) => {
  res.status(200).json(healthResponse());
});

app.get("/api/health", (req, res) => {
  res.status(200).json(healthResponse());
});

app.get("/healthz", (req, res) => {
  res.status(200).json(healthResponse());
});

// ✅ Middleware
const configuredFrontendUrl = process.env.FRONTEND_URL?.trim();
const allowedOrigins = new Set([
  configuredFrontendUrl,
  "http://localhost:5173",
  "http://localhost:3000",
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));
app.use(compression());
app.use(express.json());

// ✅ MongoDB Connection
if (MONGO_URI && (MONGO_URI.includes("<") || MONGO_URI.includes(">"))) {
  console.error("🚨 CONFIGURATION ERROR: Your MONGO_URI contains '<' or '>'. Did you forget to remove the '<db_password>' placeholder and type your actual password?");
}

if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    })
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => console.error("❌ DB Connection Error:", err));
} else {
  console.warn("⚠️ MONGO_URI is not set. Backend will still start, but database features will be unavailable.");
}

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

// ✅ Get unique brands with caching (supports ?refresh=true to bypass cache)
app.get("/api/brands", async (req, res) => {
  try {
    const now = Date.now();
    const forceRefresh = req.query.refresh === "true";
    if (!forceRefresh && brandCache && (now - lastCacheUpdate < CACHE_DURATION)) {
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

// Lightweight cron endpoint to keep the service awake.
// External pingers (cron, UptimeRobot) can call this URL periodically.
app.get("/cron/ping", (req, res) => {
  res.json({
    status: "ok",
    uptime_seconds: Math.round(process.uptime()),
    timestamp: Date.now()
  });
});

// ✅ Start server
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`)
);
