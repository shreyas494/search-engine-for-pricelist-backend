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
 * PRODUCTION-GRADE HEURISTIC PARSER
 * Works without AI. Skips headers, strips Sr No, detects brand.
 */
export const basicHeuristicParser = (text) => {
    const lines = text.split("\n");
    const results = [];
    let discoveredBrand = "NEW";

    // Pass 1: Global Brand Detection (Top of page)
    const brandRegex = /(MRF|CEAT|APOLLO|JK TYRE|GOODYEAR|DUNLOP|BRIDGESTONE|MICHELIN|TVS|METZELER|PIRELLI|CONTINENTAL)/i;
    for (const l of lines.slice(0, 20)) {
        const match = l.match(brandRegex);
        if (match) {
            discoveredBrand = match[0].toUpperCase();
            break;
        }
    }

    // Pass 2: Data Extraction
    for (let line of lines) {
        line = line.trim();
        if (line.length < 5) continue;

        const lower = line.toLowerCase();

        // 1. SMART HEADER FILTER (Prevents "SR NOTYRE MODEL" rows)
        // Detect lines containing multiple header-like keywords or concatenated versions
        const headerKeywords = ["sr no", "srno", "model", "tyre", "price", "mrp", "dp", "effective", "particulars", "pattern"];
        const matchCount = headerKeywords.filter(k => lower.includes(k)).length;
        if (matchCount >= 2 || lower.includes("srno") || lower.includes("sr.no")) continue;

        // 2. STRIP SR NO (Digits at start followed by dot, space, or hyphen)
        // Example: "1. 3.25-19" -> "3.25-19"
        line = line.replace(/^\d+[\.\s\-]+/, "").trim();

        // 3. PRICE EXTRACTION (Finds all numbers/decimals)
        const numbers = line.match(/\d+[,.]?\d*/g);

        if (numbers && numbers.length >= 2) {
            // Take the last two significant numbers as DP and MRP
            const lastNum = parseFloat(numbers[numbers.length - 1].replace(/,/g, ""));
            const prevNum = parseFloat(numbers[numbers.length - 2].replace(/,/g, ""));

            // Threshold: Tyre prices are usually > 100. If lower, they might be quantities/sizes.
            if (lastNum > 100 && prevNum > 100) {
                // Remove numbers from line to get the text part (Brand + Model)
                const textPart = line.replace(/\d+[,.]?\d*/g, "").trim();

                results.push({
                    brand: discoveredBrand,
                    model: textPart || "Product",
                    type: "Tubeless", // Default
                    dp: prevNum,
                    mrp: lastNum
                });
                continue;
            }
        }

        // 4. DRAFT ROW (If no prices found, but line is substantial and NOT a header)
        if (line.length > 20 && !lower.includes("page") && !lower.includes("date") && !line.includes("---")) {
            results.push({
                brand: discoveredBrand,
                model: line,
                type: "",
                dp: 0,
                mrp: 0
            });
        }
    }

    console.log(`🛠️ Heuristic Pro: Extracted ${results.length} items (Brand: ${discoveredBrand})`);
    return results;
};
