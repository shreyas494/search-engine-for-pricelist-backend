/**
 * IRONCLAD REGEX SCANNER (v6.2 - MAXIMUM ACCURACY)
 * Uses absolute anchors to isolate prices and prevents rim-size misidentification.
 */
export const parsePDFText = async (text, pdfBuffer = null) => {
    try {
        if (!text) return [];
        const normalizedText = text.replace(/\r/g, "");
        const rawLines = normalizedText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

        const results = [];
        let globalBrand = "TYRE";
        const brandKeywords = ["MRF", "CEAT", "APOLLO", "JK TYRE", "GOODYEAR", "DUNLOP", "BRIDGESTONE", "MICHELIN", "TVS"];

        // PASS 1: AGGRESSIVE BRAND DISCOVERY
        for (const line of rawLines) {
            const up = line.toUpperCase();
            for (const b of brandKeywords) {
                if (up.includes(b)) {
                    globalBrand = b;
                    break;
                }
            }
            if (globalBrand !== "TYRE") break;
        }

        // PASS 2: SMART LINE HEALING
        const healedLines = [];
        for (let i = 0; i < rawLines.length; i++) {
            let current = rawLines[i];
            let next = rawLines[i + 1] || "";

            // If current line ends in a price-like pattern, keep it.
            // If it doesn't, but NEXT line is ONLY two numbers (prices), merge them.
            const priceOnlyRegex = /^(\d+[,\d]*(\.\d+)?)\s+(\d+[,\d]*(\.\d+)?)$/;
            if (next.match(priceOnlyRegex)) {
                healedLines.push(current + " " + next);
                i++;
            } else {
                healedLines.push(current);
            }
        }

        // PASS 3: PRECISION EXTRACTION
        for (let line of healedLines) {
            const lower = line.toLowerCase();
            const upper = line.toUpperCase();

            // 1. Update brand if context changes
            for (const b of brandKeywords) {
                if (upper.includes(b) && (upper.includes("PRICE") || upper.includes("LIST"))) {
                    globalBrand = b;
                }
            }

            // 2. Aggressive Junk Filter
            const junkKeywords = ["sr no", "srno", "s.no", "model", "tyre", "price", "mrp", "dp", "effective", "particulars", "pattern", "consumer", "retail", "page", "date", "---", "==="];
            const junkCount = junkKeywords.filter(k => lower.includes(k)).length;
            if (junkCount >= 3 || lower.startsWith("sr no") || lower.startsWith("s.no")) continue;

            // 3. IRONCLAD PRICE REGEX (Mandatory End-of-Line Anchor)
            // Matches two space-separated numbers at the EXACT END of the line.
            // This prevents rim sizes (in the middle) from being picked up.
            const ironcladRegex = /\s+(\d+[\d\.,]*)\s+(\d+[\d\.,]*)$/;
            const match = line.match(ironcladRegex);

            if (match) {
                const rawDp = match[1];
                const rawMrp = match[2];
                const dp = parseFloat(rawDp.replace(/,/g, ""));
                const mrp = parseFloat(rawMrp.replace(/,/g, ""));

                if (!isNaN(dp) && !isNaN(mrp) && mrp > 10) {
                    const priceStartIndex = line.lastIndexOf(rawDp);
                    const modelPart = line.substring(0, priceStartIndex).trim().replace(/^\d+[\.\s\-\)]+/, "").trim();

                    if (modelPart.length > 2) {
                        results.push({
                            brand: globalBrand,
                            model: modelPart,
                            type: lower.includes("t/l") || lower.includes("tubeless") ? "Tubeless" : "Tube",
                            dp: dp,
                            mrp: mrp
                        });
                        continue;
                    }
                }
            }

            // 4. FALLBACK (Raw Row if at least it looks like a model)
            if (line.length > 20 && junkCount < 2 && !lower.includes("page")) {
                results.push({
                    brand: globalBrand,
                    model: line.replace(/^\d+[\.\s\-\)]+/, "").trim(),
                    type: "Verify",
                    dp: 0,
                    mrp: 0
                });
            }
        }

        console.log(`✅ v6.2 Ironclad Scan: Found ${results.length} items with precision anchors.`);
        return results;

    } catch (error) {
        console.error("❌ v6.2 Parser Error:", error);
        return [];
    }
};
