/**
 * SMART-STITCHING REGEX SCANNER (v5.1 - ZERO AI)
 * Heals fragmented lines and extracts data with maximum fidelity.
 */
export const parsePDFText = async (text, pdfBuffer = null) => {
    try {
        if (!text) return [];
        const rawLines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        const processedLines = [];

        // Pass 1: Smart-Stitching
        // If a line ends in text/size and the next line is ONLY prices, join them.
        for (let i = 0; i < rawLines.length; i++) {
            let current = rawLines[i];
            let next = rawLines[i + 1] || "";

            const priceOnlyRegex = /^(\d+[,\d]*(\.\d+)?)\s+(\d+[,\d]*(\.\d+)?)$/;

            // If next line is ONLY 2 numbers (likely split prices)
            if (next.match(priceOnlyRegex)) {
                current = current + " " + next;
                i++; // Skip next line as we've merged it
            }
            processedLines.push(current);
        }

        const results = [];
        let currentBrand = "TYRE";

        // Pass 2: Global Brand Search
        const brandKeywords = ["MRF", "CEAT", "APOLLO", "JK TYRE", "GOODYEAR", "DUNLOP", "BRIDGESTONE", "MICHELIN", "TVS"];

        // Pass 3: Extraction
        for (let line of processedLines) {
            const upper = line.toUpperCase();
            const lower = line.toLowerCase();

            // Detect Brand Update (MRF PRICE LIST, etc)
            for (const b of brandKeywords) {
                if (upper.includes(b) && (upper.includes("PRICE") || upper.includes("LIST"))) {
                    currentBrand = b;
                }
            }

            // FILTER JUNK
            const junkKeywords = ["sr no", "srno", "s.no", "model", "tyre", "price", "mrp", "dp", "effective", "particulars", "pattern", "consumer", "retail", "page", "date", "---", "==="];
            const junkCount = junkKeywords.filter(k => lower.includes(k)).length;
            if (junkCount >= 2 || lower.startsWith("sr no") || lower.startsWith("s.no")) continue;

            // PRICE EXTRACTION (End-of-Line)
            const priceRegex = /\s+(\d+[,\d]*(\.\d+)?)\s+(\d+[,\d]*(\.\d+)?)$/;
            const match = line.match(priceRegex);

            if (match) {
                const rawDp = match[1];
                const rawMrp = match[3];
                const dp = parseFloat(rawDp.replace(/,/g, ""));
                const mrp = parseFloat(rawMrp.replace(/,/g, ""));

                if (!isNaN(dp) && !isNaN(mrp)) {
                    const priceIndex = line.lastIndexOf(rawDp);
                    const modelPart = line.substring(0, priceIndex).trim().replace(/^\d+[\.\s\-\)]+/, "").trim();

                    results.push({
                        brand: currentBrand,
                        model: modelPart || "Product",
                        type: lower.includes("t/l") || lower.includes("tubeless") ? "Tubeless" : "Tube",
                        dp: dp,
                        mrp: mrp
                    });
                    continue;
                }
            }

            // RAW LINE FALLBACK (Keep the data even if parsing is partial)
            if (line.length > 10 && junkCount < 1 && !lower.includes("page")) {
                results.push({
                    brand: currentBrand,
                    model: line.replace(/^\d+[\.\s\-\)]+/, "").trim(),
                    type: "",
                    dp: 0,
                    mrp: 0
                });
            }
        }

        console.log(`🎯 Smart-Stitch v5.1: Found ${results.length} items from ${rawLines.length} raw lines.`);
        return results;

    } catch (error) {
        console.error("❌ Parser Error:", error);
        return [];
    }
};
