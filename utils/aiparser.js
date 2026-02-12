/**
 * PURE REGEX SCANNER (v5.0 - ZERO AI)
 * Uses strict "End-of-Line" isolation to separate Product vs Price.
 */
export const parsePDFText = async (text, pdfBuffer = null) => {
    try {
        const lines = text.split("\n");
        const results = [];
        let discoveredBrand = "TYRE";

        // Pass 1: Global Brand Detection (Scan top & bottom)
        const brands = ["MRF", "CEAT", "APOLLO", "JK TYRE", "GOODYEAR", "DUNLOP", "BRIDGESTONE", "MICHELIN", "TVS"];
        for (const l of lines) {
            const line = l.trim().toUpperCase();
            for (const b of brands) {
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

            // 1. FILTER HEADERS & JUNK (Aggressive)
            const junkKeywords = ["sr no", "srno", "s.no", "model", "tyre", "price", "mrp", "dp", "effective", "particulars", "pattern", "consumer", "retail", "page", "date", "---", "==="];
            const junkCount = junkKeywords.filter(k => lower.includes(k)).length;
            if (junkCount >= 2 || lower.startsWith("sr no") || lower.startsWith("s.no")) continue;

            // 2. END-OF-LINE PRICE ISOLATION
            // Matches: [Space] [Number1] [Space] [Number2] at the absolute end of the line.
            // Number regex handles commas and decimals: (\d+[,\d]*(\.\d+)?)
            const priceRegex = /\s+(\d+[,\d]*(\.\d+)?)\s+(\d+[,\d]*(\.\d+)?)$/;
            const match = line.match(priceRegex);

            if (match) {
                const rawDp = match[1];
                const rawMrp = match[3];

                const dp = parseFloat(rawDp.replace(/,/g, ""));
                const mrp = parseFloat(rawMrp.replace(/,/g, ""));

                if (!isNaN(dp) && !isNaN(mrp)) {
                    // Everything before the DP is the product name (after stripping Sr No)
                    const fullLineBeforePrice = line.substring(0, line.lastIndexOf(rawDp)).trim();
                    // Strip Leading Serial Numbers: "1 ", "12.", "3-"
                    const modelPart = fullLineBeforePrice.replace(/^\d+[\.\s\-\)]+/, "").trim();

                    results.push({
                        brand: discoveredBrand,
                        model: modelPart || "Unknown Product",
                        type: lower.includes("t/l") || lower.includes("tubeless") ? "Tubeless" : "Tube",
                        dp: dp,
                        mrp: mrp
                    });
                    continue;
                }
            }

            // 3. DRAFT ROW (Fallback if no prices found but line is clean)
            if (line.length > 20 && junkCount < 1 && !lower.includes("page")) {
                const cleanedLine = line.replace(/^\d+[\.\s\-\)]+/, "").trim();
                results.push({
                    brand: discoveredBrand,
                    model: cleanedLine,
                    type: "",
                    dp: 0,
                    mrp: 0
                });
            }
        }

        console.log(`✅ v5.0 Pure Regex Scan: Found ${results.length} items locally.`);
        return results;

    } catch (error) {
        console.error("❌ v5.0 Parser Error:", error);
        return [];
    }
};
