import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini
export const parsePDFText = async (text) => {
    try {
        const key = process.env.GEMINI_API_KEY;
        console.log(`🤖 AI Debug: Key found? ${!!key} (Length: ${key?.length || 0})`);
        if (key) console.log(`🤖 AI Debug: Key prefix: ${key.substring(0, 4)}...`);

        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
      You are an expert data extractor.
      Extract the tyre pricelist data from the following text into a JSON array.
      The text may contain headers, footers, and varying formats.
      Focus on extracting:
      - brand (if explicit, otherwise infer from context e.g. "MRF", "CEAT")
      - model (pattern name)
      - type (e.g., "Tubeless", "Tube Type", "Radial", "Bias")
      - dp (Dealer Price, numeric)
      - mrp (Maximum Retail Price, numeric)

      Return ONLY the JSON array. Do not include markdown formatting like \`\`\`json.
      If a field is missing, use null or a reasonable empty string.
      Ensure the output is valid JSON.

      Text Data:
      ${text.slice(0, 30000)} // Truncate to avoid token limits if necessary
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let textResponse = response.text();

        // Clean up markdown if present
        textResponse = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();

        return JSON.parse(textResponse);
    } catch (error) {
        console.error("AI Parsing Error:", error);
        throw new Error("Failed to parse PDF data with AI");
    }
};
