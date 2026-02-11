import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini using direct fetch for stable v1/v1beta support
export const parsePDFText = async (text) => {
    try {
        const key = process.env.GEMINI_API_KEY;
        console.log(`🤖 AI Debug: Key found? ${!!key} (Length: ${key?.length || 0})`);

        if (!key) {
            throw new Error("GEMINI_API_KEY is not defined in environment variables");
        }

        // --- MODEL DISCOVERY (Debug Only) ---
        try {
            console.log("🔍 AI Debug: Listing available models for this key...");
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
            const listRes = await fetch(listUrl);
            const listData = await listRes.json();
            if (listData.models) {
                const modelNames = listData.models.map(m => m.name.split('/').pop());
                console.log("📋 AI Debug: Available Models:", modelNames.join(", "));
            } else {
                console.log("⚠️ AI Debug: Could not list models:", listData.error?.message || "Unknown error");
            }
        } catch (discoveryErr) {
            console.warn("⚠️ AI Debug: Model discovery failed:", discoveryErr.message);
        }
        // -------------------------------------

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
      Ensure the output is valid JSON.

      Text Data:
      ${text.slice(0, 30000)}
    `;

        // Comprehensive list for 2026 availability
        const modelsToTry = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-002",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash-8b",
            "gemini-2.0-flash-lite",
            "gemini-2.0-flash"
        ];

        let textResponse = "";
        let successfulModel = "";
        let lastError;

        // Try both v1beta and v1
        for (const apiVersion of ["v1beta", "v1"]) {
            if (textResponse) break;

            for (const modelName of modelsToTry) {
                try {
                    console.log(`🤖 AI Debug: Attempting model ${modelName} on ${apiVersion} endpoint...`);
                    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${key}`;

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
                        console.warn(`⚠️ AI Debug: Model ${modelName} on ${apiVersion} failed (${res.status}): ${errMsg}`);
                        lastError = new Error(errMsg);
                        continue;
                    }

                    textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (textResponse) {
                        successfulModel = modelName;
                        console.log(`✅ AI Debug: Success with model ${modelName} on ${apiVersion}`);
                        break;
                    }
                } catch (err) {
                    console.warn(`⚠️ AI Debug: Fetch error for ${modelName} on ${apiVersion}: ${err.message}`);
                    lastError = err;
                    continue;
                }
            }
        }

        if (!textResponse) {
            console.error("❌ AI Debug: All models and endpoints failed.");
            throw lastError || new Error("Failed to communicate with Gemini API. Check your quota or API key.");
        }

        console.log(`🤖 AI Debug: Raw response received from ${successfulModel}:`, textResponse.substring(0, 500) + (textResponse.length > 500 ? "..." : ""));

        // JSON Extraction
        let jsonMatch = textResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        let cleanedResponse = jsonMatch ? jsonMatch[0] : textResponse;
        if (!jsonMatch) cleanedResponse = cleanedResponse.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            return JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error("❌ JSON Parse Error:", parseError);
            // Fallback to basic parser if JSON is mangled
            return basicHeuristicParser(text);
        }
    } catch (error) {
        console.error("❌ AI Parsing Error:", error);
        // CRITICAL FALLBACK: If AI fails entirely, use basic heuristic parser
        console.log("🛠️ Attempting Basic Heuristic Parser Fallback...");
        return basicHeuristicParser(text);
    }
};

/**
 * Basic Heuristic Parser (Non-AI Fallback)
 * Tries to find lines that look like: Brand Model Type DP MRP
 */
export const basicHeuristicParser = (text) => {
    const lines = text.split("\n");
    const results = [];

    // Heuristic: Many pricelists have: BRAND [SPACE] MODEL [SPACE] ... [SPACE] DP [SPACE] MRP
    // We look for lines containing at least two valid numbers >= 100
    for (let line of lines) {
        line = line.trim();
        if (line.length < 10) continue;

        // Extract numbers
        const numbers = line.match(/\d+[,.]?\d*/g);
        if (!numbers || numbers.length < 2) continue;

        // Heuristic: The last two numbers are likely DP and MRP
        const mrp = parseFloat(numbers[numbers.length - 1].replace(/,/g, ""));
        const dp = parseFloat(numbers[numbers.length - 2].replace(/,/g, ""));

        if (dp < 100 || mrp < 100) continue; // Skip non-price numbers

        // Heuristic: The text before the numbers is Brand/Model/Type
        const textPart = line.replace(/\d+[,.]?\d*/g, "").trim();
        const parts = textPart.split(/\s+/);

        results.push({
            brand: parts[0] || "Unknown",
            model: parts.slice(1, -1).join(" ") || parts[1] || "Generic Model",
            type: parts[parts.length - 1] || "Tubeless",
            dp: dp,
            mrp: mrp
        });
    }

    console.log(`🛠️ Basic Heuristic Parser: Extracted ${results.length} items.`);
    return results;
};
