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

        // Try multiple models in case of 404 or Quota issues
        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro", "gemini-2.0-flash"];
        let response;
        let lastError;
        let successfulModel = "";

        for (const modelName of modelsToTry) {
            try {
                console.log(`🤖 AI Debug: Attempting to generate content with model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                response = await result.response;
                successfulModel = modelName;
                console.log(`✅ AI Debug: Success with model ${modelName}`);
                break; // Found one that works!
            } catch (err) {
                console.warn(`⚠️ AI Debug: Model ${modelName} failed: ${err.message}`);
                lastError = err;
                // Continue to next model if it's a 404 or 429
                if (err.message.includes("404") || err.message.includes("429")) {
                    continue;
                } else {
                    // For other errors, we might still want to try another model
                    continue;
                }
            }
        }

        if (!response) {
            console.error("❌ AI Debug: All fallback models failed.");
            throw lastError || new Error("All Gemini models failed due to quota or availability.");
        }

        let textResponse = response.text();
        console.log(`🤖 AI Debug: Raw response received from ${successfulModel}:`, textResponse.substring(0, 500) + (textResponse.length > 500 ? "..." : ""));

        // More robust JSON extraction
        let jsonMatch = textResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        let cleanedResponse = jsonMatch ? jsonMatch[0] : textResponse;

        // Fallback: Clean up markdown if present manually
        if (!jsonMatch) {
            cleanedResponse = cleanedResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        }

        try {
            return JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error("❌ JSON Parse Error:", parseError);
            console.error("📄 Cleaned Response that failed to parse:", cleanedResponse);
            throw new Error(`Failed to parse AI response as JSON from model ${successfulModel}`);
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
