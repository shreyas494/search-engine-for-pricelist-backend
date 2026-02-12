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
    for (let line of lines) {
        line = line.trim();
        if (line.length < 5) continue; // Skip very short lines

        const numbers = line.match(/\d+[,.]?\d*/g);

        // If we find numbers, try to extract them as prices
        if (numbers && numbers.length >= 2) {
            const mrp = parseFloat(numbers[numbers.length - 1].replace(/,/g, ""));
            const dp = parseFloat(numbers[numbers.length - 2].replace(/,/g, ""));

            if (dp > 10 && mrp > 10) {
                const textPart = line.replace(/\d+[,.]?\d*/g, "").trim();
                const parts = textPart.split(/\s+/);

                results.push({
                    brand: parts[0] || "Unknown",
                    model: parts.slice(1).join(" ") || "Product Details",
                    type: "Tubeless",
                    dp: dp,
                    mrp: mrp
                });
                continue;
            }
        }

        // FALLBACK: If no clear prices, just add the line as a "Draft" row for the user to edit
        if (line.length > 10) {
            results.push({
                brand: "NEW",
                model: line,
                type: "",
                dp: 0,
                mrp: 0
            });
        }
    }

    console.log(`🛠️ Basic Heuristic Parser: Extracted ${results.length} items (including drafts).`);
    return results;
};
