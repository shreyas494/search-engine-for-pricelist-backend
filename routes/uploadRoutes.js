import express from "express";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import { parsePDFText } from "../utils/aiparser.js";
import mongoose from "mongoose";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

import Tyre from "../models/Tyre.js";

// ✅ Parse PDF and return JSON (Admin review step)
router.post("/parse-pdf", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            console.warn("⚠️ Parse Request: No file uploaded");
            return res.status(400).json({ error: "No file uploaded" });
        }

        // 1. Extract Text from PDF
        console.log("📄 Received PDF for parsing:", req.file.originalname, `(${req.file.size} bytes)`);
        const dataBuffer = req.file.buffer;

        console.log("⚙️ Starting PDF text extraction...");
        let text = "";
        try {
            const pdfData = await pdf(dataBuffer);
            text = pdfData.text;
            console.log(`✅ Text extraction complete (${text.length} characters)`);
        } catch (pdfError) {
            console.error("❌ PDF Extraction Error:", pdfError);
            return res.status(400).json({ error: "Failed to read PDF file. It may be corrupt or encrypted." });
        }

        if (!text || text.trim().length === 0) {
            console.warn("⚠️ PDF Extraction: No text found in PDF");
            return res.status(400).json({ error: "No readable text found in the PDF." });
        }

        // 2. Send to AI for extraction
        console.log("🤖 Sending text to Gemini AI...");
        const extractedData = await parsePDFText(text);
        console.log(`✅ Extraction complete: found ${extractedData?.length} items`);

        res.json({ extractedData, rawText: text });
    } catch (error) {
        console.error("❌ Parse Route Error:", error);
        res.status(500).json({ error: error.message || "An unexpected error occurred during parsing." });
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
