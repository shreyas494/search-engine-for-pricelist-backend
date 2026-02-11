import express from "express";
import multer from "multer";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { parsePDFText } from "../utils/aiparser.js";
import mongoose from "mongoose";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to get Tyre model
const Tyre = mongoose.model("Tyre");

// ✅ Parse PDF and return JSON (Admin review step)
router.post("/parse-pdf", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        // 1. Extract Text from PDF
        const dataBuffer = req.file.buffer;
        const pdfData = await pdf(dataBuffer);
        const text = pdfData.text;

        // 2. Send to AI for extraction
        const extractedData = await parsePDFText(text);

        res.json(extractedData);
    } catch (error) {
        console.error("Parse Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Bulk Import Data (Final save step)
router.post("/import", async (req, res) => {
    try {
        const tyres = req.body; // Expecting array of tyre objects

        if (!Array.isArray(tyres) || tyres.length === 0) {
            return res.status(400).json({ error: "Invalid data format" });
        }

        // Option 1: Insert Many (Simple)
        // await Tyre.insertMany(tyres);

        // Option 2: Bulk Write (Upsert based on Brand + Model + Type to avoid duplicates)
        // This is safer for re-running imports
        const operations = tyres.map((tyre) => ({
            updateOne: {
                filter: { brand: tyre.brand, model: tyre.model, type: tyre.type },
                update: { $set: tyre },
                upsert: true,
            },
        }));

        const result = await Tyre.bulkWrite(operations);

        res.json({ message: "Import successful", result });
    } catch (error) {
        console.error("Import Error:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
