/**
 * TABLE-AWARE REGEX SCANNER (v6.3 - IRONCLAD)
 * Zero-AI, Zero-Limits. Acts like an Excel converter for PDF text.
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
        for (const line of rawLines.slice(0, 100)) {
            const up = line.toUpperCase();
            for (const b of brandKeywords) {
                if (up.includes(b)) {
                    globalBrand = b;
                    break;
                }
            }
            if (globalBrand !== "TYRE") break;
        }

        // PASS 2: GRID STITCHING (Heals fragmented rows)
        const gridRows = [];
        for (let i = 0; i < rawLines.length; i++) {
            let current = rawLines[i];
            let next = rawLines[i + 1] || "";

            // If current line looks like a model and NEXT line is JUST two prices, merge them.
            // Price block regex: ([\d\.,]+)
            const priceBlockRegex = /^([\d\.,]+)\s+([\d\.,]+)$/;
            if (next.match(priceBlockRegex)) {
                gridRows.push(current + " " + next);
                i++; // Skip next
            } else {
                gridRows.push(current);
            }
        }

        // PASS 3: PRECISION EXTRACTION
        for (let line of gridRows) {
            const lower = line.toLowerCase();
            const upper = line.toUpperCase();

            // Detect Brand Shift
            for (const b of brandKeywords) {
                if (upper.includes(b) && (upper.includes("PRICE") || upper.includes("LIST"))) {
                    globalBrand = b;
                }
            }

            // FILTER JUNK (Headers/Footers)
            const junkKeywords = ["sr no", "srno", "s.no", "model", "tyre", "price", "mrp", "dp", "effective", "particulars", "pattern", "consumer", "retail", "page", "date", "---", "==="];
            const junkCount = junkKeywords.filter(k => lower.includes(k)).length;
            if (junkCount >= 3 || lower.startsWith("sr no") || lower.startsWith("s.no")) continue;

            // Master "Table" Regex: Targets exactly TWO numbers at the absolute end of the line.
            // This is the "Ironclad Anchor" that ignores Rim Sizes (17, 18, 19) in the middle.
            const tableRegex = /\s+(\d+[\d\.,]*)\s+(\d+[\d\.,]*)$/;
            const match = line.match(tableRegex);

            if (match) {
                const rawDp = match[1];
                const rawMrp = match[2];
                const dpValue = parseFloat(rawDp.replace(/,/g, ""));
                const mrpValue = parseFloat(rawMrp.replace(/,/g, ""));

                // Validate (MRP must be > 10 to avoid page numbers/noise)
                if (!isNaN(dpValue) && !isNaN(mrpValue) && mrpValue > 10) {
                    const pricePartStart = line.lastIndexOf(rawDp);
                    let modelPart = line.substring(0, pricePartStart).trim();

                    // Strip leading Serial Numbers: "1 ", "12.", "3-"
                    modelPart = modelPart.replace(/^\d+[\.\s\-\)]+/, "").trim();

                    if (modelPart.length > 2) {
                        results.push({
                            brand: globalBrand,
                            model: modelPart,
                            type: lower.includes("t/l") || lower.includes("tubeless") ? "Tubeless" : "Tube",
                            dp: dpValue,
                            mrp: mrpValue
                        });
                        continue;
                    }
                }
            }

            // FALLBACK: Preserve the line even if data extraction was uncertain
            if (line.length > 15 && junkCount < 2 && !lower.includes("page")) {
                results.push({
                    brand: globalBrand,
                    model: line.replace(/^\d+[\.\s\-\)]+/, "").trim(),
                    type: "Validate",
                    dp: 0,
                    mrp: 0
                });
            }
        }

        console.log(`📡 v6.3 Table-Aware Scan: Found ${results.length} items. (AI-FREE)`);
        return results;

    } catch (error) {
        console.error("❌ v6.3 Parser Error:", error);
        return [];
    }
};
