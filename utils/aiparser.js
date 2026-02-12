/**
 * PRECISION RIGHT-TO-LEFT SCANNER (v6.1 - CHATGPT QUALITY)
 * Extracts prices from the end of the line regardless of model complexity.
 */
export const parsePDFText = async (text, pdfBuffer = null) => {
    try {
        if (!text) return [];
        // Normalize newlines and split
        const normalizedText = text.replace(/\r/g, "");
        const rawLines = normalizedText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        const results = [];

        // --- PASS 1: GLOBAL BRAND CONTEXT ---
        let currentBrand = "TYRE";
        const brandKeywords = ["MRF", "CEAT", "APOLLO", "JK", "GOODYEAR", "DUNLOP", "BRIDGESTONE", "MICHELIN", "TVS"];

        // Initial scan for brand (if MRF PRICE LIST is at the top)
        for (const line of rawLines.slice(0, 50)) {
            const upper = line.toUpperCase();
            for (const b of brandKeywords) {
                if (upper.includes(b)) {
                    currentBrand = b === "JK" ? "JK TYRE" : b;
                    break;
                }
            }
            if (currentBrand !== "TYRE") break;
        }

        // --- PASS 2: EXTRACTION ---
        for (let line of rawLines) {
            const lower = line.toLowerCase();
            const upper = line.toUpperCase();

            // 1. Update Brand if header appears
            for (const b of brandKeywords) {
                if (upper.includes(b) && (upper.includes("PRICE") || upper.includes("LIST"))) {
                    currentBrand = b === "JK" ? "JK TYRE" : b;
                }
            }

            // 2. Junk Filter
            const junkKeywords = ["sr no", "srno", "s.no", "model", "tyre", "price", "mrp", "dp", "effective", "particulars", "pattern", "consumer", "retail", "page", "date", "---", "==="];
            const junkCount = junkKeywords.filter(k => lower.includes(k)).length;
            if (junkCount >= 3 || lower.startsWith("sr no") || lower.startsWith("s.no")) continue;

            // 3. RIGHT-TO-LEFT PRICE EXTRACTION
            // We look for all number-like blocks in the line
            // regex: (\d+[\d\.,]*)
            const numBlocks = line.match(/\d+[\d\.,]*/g);

            if (numBlocks && numBlocks.length >= 2) {
                // Potential DP and MRP are the last two blocks
                const rawMrp = numBlocks[numBlocks.length - 1];
                const rawDp = numBlocks[numBlocks.length - 2];

                const mrpValue = parseFloat(rawMrp.replace(/,/g, ""));
                const dpValue = parseFloat(rawDp.replace(/,/g, ""));

                // Validate (MRP should be > 10 to avoid noise like "Page 1")
                if (!isNaN(mrpValue) && !isNaN(dpValue) && mrpValue > 10) {
                    // Isolation: Everything before the DP block
                    // We split by DP and take the first part. To be safe, we split from the right.
                    const dpIndex = line.lastIndexOf(rawDp);
                    let modelPart = line.substring(0, dpIndex).trim();

                    // Strip leading serial numbers: "1 ", "12.", "3-"
                    modelPart = modelPart.replace(/^\d+[\.\s\-\)]+/, "").trim();

                    // If modelPart is empty or too short, it might be a split line.
                    if (modelPart.length > 2) {
                        results.push({
                            brand: currentBrand,
                            model: modelPart,
                            type: lower.includes("t/l") || lower.includes("tubeless") || lower.includes("/l") ? "Tubeless" : "Tube",
                            dp: dpValue,
                            mrp: mrpValue
                        });
                        continue;
                    }
                }
            }

            // 4. FALLBACK: RAW DATA preservation
            // If line is long enough and not junk, keep it as an unparsed item
            if (line.length > 20 && junkCount < 2 && !lower.includes("page")) {
                results.push({
                    brand: currentBrand,
                    model: line.replace(/^\d+[\.\s\-\)]+/, "").trim(),
                    type: "Check PDF",
                    dp: 0,
                    mrp: 0
                });
            }
        }

        console.log(`📡 v6.1 Extraction Complete: ${results.length} items parsed locally.`);
        return results;

    } catch (error) {
        console.error("❌ v6.1 Parser Error:", error);
        return [];
    }
};
