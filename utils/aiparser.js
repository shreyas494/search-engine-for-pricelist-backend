import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini using direct fetch for stable v1/v1beta support
export const parsePDFText = async (text, pdfBuffer = null) => {
    try {
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error("GEMINI_API_KEY is missing");

        const prompt = `
            STRICT EXTRACTION: Convert the PDF pricelist into a JSON array.
            1. BRAND: Identify the brand (MRF, CEAT, etc) and apply to every row.
            2. HEADERS: Use table columns as JSON keys. IGNORE the header row itself.
            3. IGNORE Sr No: Do not include serial numbers.
            Return ONLY a raw JSON array.
        `;

        const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];
        let textResponse = "";

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
                    if (textResponse) break;
                }
            } catch (err) {
                console.warn(`AI fail: ${modelName}`);
            }
        }

        if (!textResponse) return basicHeuristicParser(text || "");

        const cleanedText = textResponse.replace(/```json|```/g, "").trim();
        const jsonMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : cleanedText);
    } catch (error) {
        return basicHeuristicParser(text || "");
    }
};

/**
 * PERFECT HEURISTIC PARSER (v3.0)
 * Aggressive filtering to ensure zero garbage.
 */
export const basicHeuristicParser = (text) => {
    const lines = text.split("\n");
    const results = [];
    let discoveredBrand = "TYRE";

    // Pass 1: Global Brand Detection
    for (const l of lines.slice(0, 25)) {
        const line = l.trim().toUpperCase();
        const brands = ["MRF", "CEAT", "APOLLO", "JK TYRE", "GOODYEAR", "DUNLOP", "BRIDGESTONE", "MICHELIN", "TVS"];
        for (const b of brands) {
            if (line.includes(b) && (line.includes("PRICE") || line.includes("LIST") || line.includes("PRODUCT"))) {
                discoveredBrand = b;
                break;
            }
        }
        if (discoveredBrand !== "TYRE") break;
    }

    // Pass 2: Data Extraction
    for (let line of lines) {
        line = line.trim();
        if (line.length < 5) continue;

        const lower = line.toLowerCase();

        // 1. EXTREME HEADER/JUNK FILTER
        const junkKeywords = ["sr no", "srno", "s.no", "model", "tyre", "price", "mrp", "dp", "effective", "particulars", "pattern", "consumer", "retail", "page", "date", "---", "==="];
        // If line contains 2 or more junk words, it's definitely a header
        const junkCount = junkKeywords.filter(k => lower.includes(k)).length;
        if (junkCount >= 2) continue;
        if (lower.startsWith("sr no") || lower.startsWith("s.no") || lower.startsWith("srno")) continue;

        // 2. STRIP SERIAL NUMBER (Start of line)
        // Match: "1. ", "5 ", "10-", "1)"
        line = line.replace(/^\d+[\.\s\-\)]+/, "").trim();

        // 3. ADAPTIVE PRICE DETECTION
        const allNums = line.match(/\d+[\d\.,]*/g);
        if (allNums && allNums.length >= 2) {
            // Check the last two numbers. In a pricelist, they are usually at the end.
            const rawMrp = allNums[allNums.length - 1];
            const rawDp = allNums[allNums.length - 2];

            const mrp = parseFloat(rawMrp.replace(/,/g, ""));
            const dp = parseFloat(rawDp.replace(/,/g, ""));

            // If we found valid-looking prices (not just '1' or '0')
            if (!isNaN(mrp) && !isNaN(dp) && mrp > 0) {
                // The "Model/Pattern" is everything BEFORE the prices
                const textPortion = line.split(rawDp)[0].trim();

                results.push({
                    brand: discoveredBrand,
                    model: textPortion || "Unknown Item",
                    type: lower.includes("t/l") || lower.includes("tubeless") ? "Tubeless" : "Tube",
                    dp: dp,
                    mrp: mrp
                });
                continue;
            }
        }

        // 4. CLEAN DRAFT (Only if substantial and passed junk filter)
        if (line.length > 15 && junkCount < 1) {
            results.push({
                brand: discoveredBrand,
                model: line,
                type: "",
                dp: 0,
                mrp: 0
            });
        }
    }

    console.log(`🚀 Perfect-Heuristics v3.0: Extracted ${results.length} items.`);
    return results;
};
