/**
 * CSV SIMULATOR SCANNER (v6.5 - ULTRA PRECISION)
 * Reconstructs fragmented PDF text into a clean CSV-like structure.
 * Zero-AI, Zero-Quota, Maximum Reliability.
 */
export const parsePDFText = async (text, pdfBuffer = null) => {
    try {
        if (!text) return [];
        const normalizedText = text.replace(/\r/g, "");
        const rawLines = normalizedText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

        const results = [];
        let globalBrand = "TYRE";
        const brandKeywords = ["MRF", "CEAT", "APOLLO", "JK TYRE", "GOODYEAR", "DUNLOP", "BRIDGESTONE", "MICHELIN", "TVS"];

        // PASS 1: GLOBAL BRAND CONTEXT
        const fullTextText = normalizedText.toUpperCase();
        for (const b of brandKeywords) {
            if (fullTextText.includes(b)) {
                globalBrand = b;
                break;
            }
        }

        // PASS 2: EXTREME STITCHER (Excel-Style Row Reconstruction)
        const stitchedRows = [];
        let buffer = "";

        for (let line of rawLines) {
            // Price Pair Regex (MUST be at the absolute end with spaces)
            const pricePairRegex = /\s+(\d+[\d\.,]*)\s+(\d+[\d\.,]*)$/;

            if (line.match(pricePairRegex)) {
                stitchedRows.push((buffer + " " + line).trim());
                buffer = "";
            } else {
                const lower = line.toLowerCase();
                const junkKeywords = ["sr no", "srno", "s.no", "model", "tyre", "price", "mrp", "dp", "page", "date", "particulars"];
                const isJunk = junkKeywords.some(k => lower.includes(k) && line.length < 30);

                if (!isJunk) {
                    buffer += " " + line;
                }
            }
        }

        // PASS 3: PRECISION EXTRACTION
        for (let row of stitchedRows) {
            const lower = row.toLowerCase();
            const upper = row.toUpperCase();

            for (const b of brandKeywords) {
                if (upper.includes(b) && (upper.includes("PRICE") || upper.includes("LIST"))) {
                    globalBrand = b;
                }
            }

            if (row.length < 10) continue;

            const tableRegex = /\s+(\d+[\d\.,]*)\s+(\d+[\d\.,]*)$/;
            const match = row.match(tableRegex);

            if (match) {
                const rawDp = match[1].replace(/,/g, "");
                const rawMrp = match[2].replace(/,/g, "");
                const dp = parseFloat(rawDp);
                const mrp = parseFloat(rawMrp);

                if (!isNaN(dp) && !isNaN(mrp) && mrp > 10) {
                    const priceStart = row.lastIndexOf(match[1]);
                    let model = row.substring(0, priceStart).trim();

                    // SMART SERIAL STRIPPER
                    model = model.replace(/^(\d+)(?:\s+[\s\.\-\)]+)/, "").trim();
                    model = model.replace(/^(\d+)\.\s+/, "").trim();

                    if (model.length > 1) {
                        results.push({
                            brand: globalBrand,
                            model: model,
                            type: lower.includes("t/l") || lower.includes("tubeless") ? "Tubeless" : "Tube",
                            dp: dp,
                            mrp: mrp
                        });
                        continue;
                    }
                }
            }
        }

        console.log(`💎 v6.5 CSV-Sim Complete: Extracted ${results.length} items.`);
        return results;

    } catch (error) {
        console.error("❌ v6.5 Parser Error:", error);
        return [];
    }
};
