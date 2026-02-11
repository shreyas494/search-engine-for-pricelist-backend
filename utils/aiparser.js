import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini using direct fetch for stable v1/v1beta support
export const parsePDFText = async (text, pdfBuffer = null) => {
    try {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error("GEMINI_API_KEY is missing");

        const prompt = `
            Extract ALL pricelist items from the provided data.
            Required fields: brand, model, type, dp (numeric), mrp (numeric).
            If a value is missing, infer it from context or leave as null.
            Return ONLY a valid JSON array of objects.
        `;

        const modelsToTry = [
            "gemini-1.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash-8b",
            "gemini-1.5-pro"
        ];

        let textResponse = "";
        let successfulModel = "";

        // Attempt OCR with buffer if available, otherwise fallback to text
        for (const modelName of modelsToTry) {
            try {
                const apiVersion = modelName.includes("2.0") ? "v1beta" : "v1";
                const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${key}`;

                const payload = {
                    contents: [{
                        parts: [
                            { text: prompt },
                            pdfBuffer
                                ? { inline_data: { mime_type: "application/pdf", data: pdfBuffer.toString("base64") } }
                                : { text: `Data: ${text.slice(0, 30000)}` }
                        ]
                    }]
                };

                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (res.ok) {
                    textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (textResponse) {
                        successfulModel = modelName;
                        break;
                    }
                } else {
                    console.warn(`⚠️ Gemini ${modelName} fail:`, data.error?.message);
                }
            } catch (err) {
                console.warn(`⚠️ AI Fetch error:`, err.message);
            }
        }

        if (!textResponse) {
            console.log("🛠️ AI Failed. Triggering Heuristic Fallback.");
            return basicHeuristicParser(text || "");
        }

        const jsonMatch = textResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : textResponse);

    } catch (error) {
        console.error("❌ AI Parsing Error:", error.message);
        return basicHeuristicParser(text || "");
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
