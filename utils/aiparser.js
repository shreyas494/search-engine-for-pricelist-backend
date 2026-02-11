import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini
// Initialize Gemini using direct fetch for stable v1 support
export const parsePDFText = async (text) => {
    try {
        const key = process.env.GEMINI_API_KEY;
        console.log(`🤖 AI Debug: Key found? ${!!key} (Length: ${key?.length || 0})`);

        if (!key) {
            throw new Error("GEMINI_API_KEY is not defined in environment variables");
        }

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
      ${text.slice(0, 30000)}
    `;

        // Try stable v1 endpoint instead of v1beta
        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro", "gemini-2.0-flash"];
        let textResponse = "";
        let successfulModel = "";
        let lastError;

        for (const modelName of modelsToTry) {
            try {
                console.log(`🤖 AI Debug: Attempting model ${modelName} on v1 endpoint...`);
                // Using built-in fetch (available in Node 22+)
                const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${key}`;

                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    const errMsg = data.error?.message || res.statusText;
                    console.warn(`⚠️ AI Debug: Model ${modelName} failed (${res.status}): ${errMsg}`);
                    lastError = new Error(errMsg);
                    continue;
                }

                textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!textResponse) {
                    console.warn(`⚠️ AI Debug: Model ${modelName} returned empty response`);
                    continue;
                }

                successfulModel = modelName;
                console.log(`✅ AI Debug: Success with model ${modelName} on v1`);
                break;
            } catch (err) {
                console.warn(`⚠️ AI Debug: Network/Fetch error for ${modelName}: ${err.message}`);
                lastError = err;
                continue;
            }
        }

        if (!textResponse) {
            console.error("❌ AI Debug: All models failed on v1 endpoint.");
            throw lastError || new Error("Failed to communicate with Gemini API.");
        }

        console.log(`🤖 AI Debug: Raw response received from ${successfulModel}:`, textResponse.substring(0, 500) + (textResponse.length > 500 ? "..." : ""));

        // More robust JSON extraction
        let jsonMatch = textResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        let cleanedResponse = jsonMatch ? jsonMatch[0] : textResponse;

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
        if (error.message.includes("SAFETY")) {
            throw new Error("AI blocked the content due to safety concerns.");
        }
        throw new Error(error.message || "Failed to parse PDF data with AI");
    }
};
