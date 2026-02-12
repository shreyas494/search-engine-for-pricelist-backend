import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini using direct fetch for stable v1/v1beta support
export const parsePDFText = async (text, pdfBuffer = null) => {
    try {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error("GEMINI_API_KEY is missing");

        const prompt = `
            STRICT EXTRACTION TASK: Convert the provided PDF pricelist into a JSON array.
            
            1. BRAND: Identify the main brand from the top headers (e.g. MRF, CEAT, APOLLO). Apply this brand to every JSON object as the "brand" field.
            2. DYNAMIC HEADERS: Use the table column names you see (Model, Pattern, DP, MRP, etc) as keys. 
            3. IGNORE HEADERS: Do NOT include the header row itself as data. Ignore "Sr No".
            4. ACCURACY: If a row is clearly a table data row, extract it. If it is just noise or footer text, ignore it.
            
            Format: Return a raw JSON array only. No markdown.
            Example: [{"brand": "MRF", "Pattern": "ZVTS", "MRP": 4500}]
        `;

        const modelsToTry = [
            "gemini-2.0-flash",
            "gemini-1.5-flash",
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

        // Clean any markdown if AI ignores the "raw JSON only" rule
        const cleanedText = textResponse.replace(/```json|```/g, "").trim();
        const jsonMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : cleanedText);

    } catch (error) {
        console.error("❌ AI Parsing Error:", error.message);
        return basicHeuristicParser(text || "");
    }
};

/**
 * Basic Heuristic Parser (Improved for Header Skipping)
 */
export const basicHeuristicParser = (text) => {
    const lines = text.split("\n");
    const results = [];
    let discoveredBrand = "NEW";

    // Pass 1: Look for Brand Keyword in first 15 lines
    for (const l of lines.slice(0, 15)) {
        const match = l.match(/(MRF|CEAT|APOLLO|JK TYRE|GOODYEAR|DUNLOP|BRIDGESTONE|MICHELIN|TVS)/i);
        if (match) {
            discoveredBrand = match[0].toUpperCase();
            break;
        }
    }

    for (let line of lines) {
        line = line.trim();
        if (line.length < 5) continue;

        // SKIP lines that look like headers
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes("sr no") || lowerLine.includes("model") || lowerLine.includes("mrp") || lowerLine.includes("price list")) {
            continue;
        }

        const numbers = line.match(/\d+[,.]?\d*/g);

        // If we find numbers, try to extract them as prices
        if (numbers && numbers.length >= 2) {
            const mrp = parseFloat(numbers[numbers.length - 1].replace(/,/g, ""));
            const dp = parseFloat(numbers[numbers.length - 2].replace(/,/g, ""));

            if (dp > 100 && mrp > 100) {
                const textPart = line.replace(/\d+[,.]?\d*/g, "").trim();
                results.push({
                    brand: discoveredBrand,
                    model: textPart || "Product",
                    type: "Tubeless",
                    dp: dp,
                    mrp: mrp
                });
                continue;
            }
        }

        // Only add as draft if it's long and doesn't look like a header
        if (line.length > 20 && !lowerLine.includes("effective") && !lowerLine.includes("page") && !line.includes("---")) {
            results.push({
                brand: discoveredBrand,
                model: line.slice(0, 100),
                type: "",
                dp: 0,
                mrp: 0
            });
        }
    }

    console.log(`🛠️ Improved Heuristic Parser: Extracted ${results.length} items.`);
    return results;
};
