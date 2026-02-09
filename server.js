// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*", // Allow all for now, restrict in prod
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(compression());
app.use(express.json());

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

// ✅ Tyre Schema
const TyreSchema = new mongoose.Schema(
  {
    brand: { type: String, index: true },
    model: { type: String, index: true }, // Simple index for better performance
    type: String,
    dp: Number,
    mrp: Number,
  },
  { collection: "tyres" }
);

// Compound index for searching by brand + model
TyreSchema.index({ brand: 1, model: 1 });

const Tyre = mongoose.model("Tyre", TyreSchema);

// ✅ Get tyres with optional filters
app.get("/api/tyres", async (req, res) => {
  try {
    const { search, brand } = req.query;

    let filter = {};
    if (brand) filter.brand = brand;
    if (search) filter.model = { $regex: search, $options: "i" };

    const tyres = await Tyre.find(filter);
    res.json(tyres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get unique brands
app.get("/api/brands", async (req, res) => {
  try {
    const brands = await Tyre.distinct("brand");
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Root Endpoint
app.get("/", (req, res) => {
  res.send("API is running...");
});

// ✅ Start server
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
