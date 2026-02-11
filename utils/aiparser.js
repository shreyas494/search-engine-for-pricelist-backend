import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini
export const parsePDFText = async (text) => {
    try {
        const key = process.env.GEMINI_API_KEY;
        console.log(`🤖 AI Debug: Key found? ${!!key} (Length: ${key?.length || 0})`);

        if (!key) {
            throw new Error("GEMINI_API_KEY is not defined in environment variables");
        }

        const genAI = new GoogleGenerativeAI(key);
        // Use gemini-2.0-flash which is the standard in 2026
        const modelName = "gemini-2.0-flash";
        console.log(`🤖 AI Debug: Using model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });

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

        console.log("🤖 AI Debug: Generating content...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let textResponse = response.text();

        console.log("🤖 AI Debug: Raw response received:", textResponse.substring(0, 500) + (textResponse.length > 500 ? "..." : ""));

        // More robust JSON extraction
        let jsonMatch = textResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        let cleanedResponse = jsonMatch ? jsonMatch[0] : textResponse;

        // Fallback: Clean up markdown if present manually if regex didn't work perfectly
        if (!jsonMatch) {
            cleanedResponse = cleanedResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        }

        try {
            return JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error("❌ JSON Parse Error:", parseError);
            console.error("📄 Cleaned Response that failed to parse:", cleanedResponse);
            throw new Error("Failed to parse AI response as JSON");
        }
    } catch (error) {
        console.error("❌ AI Parsing Error:", error);
        // Provide more context in the error message if possible
        if (error.message.includes("SAFETY")) {
            throw new Error("AI blocked the content due to safety concerns. Try a different PDF.");
        }
        throw new Error(error.message || "Failed to parse PDF data with AI");
    }
};
