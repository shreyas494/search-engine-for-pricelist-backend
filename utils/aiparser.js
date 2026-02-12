import dotenv from "dotenv";

dotenv.config();

/**
 * PURE HEURISTIC SCANNER (v4.0 - NO AI)
 * Uses Local Regex & Rule-based extraction only.
 * 0 Cost, 0 Latency, 0 Quota Issues.
 */
export const parsePDFText = async (text, pdfBuffer = null) => {
    try {
        // We no longer use Gemini or pdfBuffer for OCR here. 
        // We rely on the text extracted by pdf-parse in the route.
        const lines = text.split("\n");
        const results = [];
        let discoveredBrand = "TYRE";

        // Pass 1: Global Brand & Metadata Detection
        // Common Brands to look for in headers
        const brands = ["MRF", "CEAT", "APOLLO", "JK TYRE", "GOODYEAR", "DUNLOP", "BRIDGESTONE", "MICHELIN", "TVS", "METZELER", "PIRELLI", "CONTINENTAL"];

        for (const l of lines.slice(0, 30)) {
            const line = l.trim().toUpperCase();
            for (const b of brands) {
                // If line contains brand name AND context words like Price List or Date
                if (line.includes(b)) {
                    discoveredBrand = b;
                    break;
                }
            }
            if (discoveredBrand !== "TYRE") break;
        }

        // Pass 2: Line-by-Line Extraction
        for (let line of lines) {
            line = line.trim();
            if (line.length < 5) continue;

            const lower = line.toLowerCase();

            // 1. FILTER JUNK / HEADERS
            // Kill lines that look like table headers or noise
            const junkKeywords = ["sr no", "srno", "s.no", "model", "tyre", "price", "mrp", "dp", "effective", "particulars", "pattern", "consumer", "retail", "page", "date", "---", "==="];
            const junkCount = junkKeywords.filter(k => lower.includes(k)).length;

            // Merged Header Detection: e.g. "SRNOTYREMODEL" 
            if (junkCount >= 2 || lower.includes("srno") || lower.includes("sr.no")) continue;

            // 2. STRIP SR NO & LEAD-IN NOISE
            // Regex matches digits at start followed by dots, spaces, or brackets
            // e.g. "1. ", "5  ", "10-", "1)" -> wiped
            line = line.replace(/^\d+[\.\s\-\)]+/, "").trim();

            // 3. PRICE EXTRACTION (Adaptive Regex)
            // Look for numbers at the end of the line. 
            // In tire pricelists, they are usually: [TEXT] [DP/NET] [MRP/MRP+TAX]
            const allNums = line.match(/\d+[\d\.,]*/g);
            if (allNums && allNums.length >= 2) {
                const rawMrp = allNums[allNums.length - 1];
                const rawDp = allNums[allNums.length - 2];

                const mrp = parseFloat(rawMrp.replace(/,/g, ""));
                const dp = parseFloat(rawDp.replace(/,/g, ""));

                // Threshold-Free matching: if both are numbers and MRP > 0
                if (!isNaN(mrp) && !isNaN(dp) && mrp > 0) {
                    // Extract the Model/Pattern part (Everything before the first number we identified)
                    const textSegments = line.split(rawDp);
                    const modelPart = textSegments[0].trim();

                    results.push({
                        brand: discoveredBrand,
                        model: modelPart || "Unknown Item",
                        type: lower.includes("t/l") || lower.includes("tubeless") ? "Tubeless" : "Tube",
                        dp: dp,
                        mrp: mrp
                    });
                    continue;
                }
            }

            // 4. CLEAN DRAFT (As fallback)
            if (line.length > 15 && junkCount < 1) {
                results.push({
                    brand: discoveredBrand,
                    model: line.slice(0, 100),
                    type: "",
                    dp: 0,
                    mrp: 0
                });
            }
        }

        console.log(`📡 Local Scan Complete (v4.0): ${results.length} items extracted locally.`);
        return results;

    } catch (error) {
        console.error("❌ Local Parser Error:", error);
        return [];
    }
};
