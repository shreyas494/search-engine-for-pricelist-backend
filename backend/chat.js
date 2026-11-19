// chat.js
// "Ask the price list" chatbot: answers product questions with Claude, using the
// full price list from MongoDB as its only source of truth.
import Anthropic from "@anthropic-ai/sdk";
import Tyre from "./models/Tyre.js";

const MODEL = "claude-opus-5-5";
const CATALOG_TTL = 10 * 60 * 1000; // rebuild the catalog text at most every 10 minutes
const MAX_TURNS = 20; // messages kept from the conversation
const MAX_CHARS = 1000; // per message

const SKIP_FIELDS = new Set(["_id", "__v", "brand", "createdAt", "updatedAt"]);

const INSTRUCTIONS = `You are the price-list assistant for a tyre, battery, inverter and stabilizer shop in India.
The complete current price list is below. It is your only source of product facts.

Rules:
- Answer only from the price list. Never invent a product, size, price, warranty or spec. Copy prices exactly as listed.
- Price columns: dp = dealer price, mrp = MRP. Show other price columns (cp, rp, dealerPrice, ...) under their own names in capitals (CP, RP). Show prices in rupees, e.g. ₹1,737.
- Always name the price list (brand and its date) each product comes from.
- If the exact product isn't in the list, say so plainly, then show the closest matches.
- If several products match, list them all (up to about 15); if more, show the closest and say how many more there are.
- People type or speak sizes loosely: "2.75 rib", "275-18", "90 100 10" (= 90/100-10), Marathi/Hindi numbers like "navvad shambhar daha" (= 90/100-10), "paune teen athra" (= 2.75-18), "sava teen" (= 3.25), "saade teen" (= 3.50), "adich" (= 2.50). Separators (/, -, x) don't matter.
- Reply in the language the user writes in. Keep replies short and easy to read on a phone.
- Format: plain text, no markdown tables, no ** or #. One product per line, like:
  • MRF 2.75-18 42P RIB N4 TT SET (mrf 29-10-26) — DP ₹1,737 · CP ₹1,757 · MRP ₹1,837
- If asked about anything other than these products and prices, say briefly that you can only help with the price list.`;

let client = null;
const getClient = () => {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
};

// ✅ Price list as compact text, one table per brand list
let catalog = { text: "", builtAt: 0 };

export function invalidateCatalog() {
  catalog.builtAt = 0;
}

export async function getCatalogText() {
  if (catalog.text && Date.now() - catalog.builtAt < CATALOG_TTL) return catalog.text;

  // lean() returns every stored column (cp, warranty, ah, ...), not just the schema fields
  const items = await Tyre.find({}).sort({ brand: 1, _id: 1 }).lean();
  const byBrand = new Map();
  for (const item of items) {
    if (!item.brand) continue;
    if (!byBrand.has(item.brand)) byBrand.set(item.brand, []);
    byBrand.get(item.brand).push(item);
  }

  const sections = [];
  for (const [brand, rows] of byBrand) {
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !SKIP_FIELDS.has(k));
    const lines = rows.map((r) => cols.map((c) => String(r[c] ?? "").replace(/\s+/g, " ").trim()).join(" | "));
    sections.push(`## ${brand} (${rows.length} items)\n${cols.join(" | ")}\n${lines.join("\n")}`);
  }

  catalog = { text: `# PRICE LIST\n\n${sections.join("\n\n")}`, builtAt: Date.now() };
  return catalog.text;
}

// ✅ Simple per-IP rate limit so the public endpoint can't run up the bill
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  const lastMinute = recent.filter((t) => now - t < 60 * 1000).length;
  if (lastMinute >= 10 || recent.length >= 100) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS).trim() }))
    .filter((m) => m.content)
    .slice(-MAX_TURNS);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

// POST /api/chat  { messages: [{ role: "user" | "assistant", content: string }] }
// Streams the answer back as plain text.
export async function chatHandler(req, res) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return res.status(503).json({ error: "Chatbot is not set up yet (ANTHROPIC_API_KEY missing on the server)." });
  }
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "Too many questions. Please wait a minute and try again." });
  }
  const messages = cleanMessages(req.body?.messages);
  if (!messages) return res.status(400).json({ error: "Send a question." });

  let catalogText;
  try {
    catalogText = await getCatalogText();
  } catch (err) {
    console.error("Catalog error:", err);
    return res.status(503).json({ error: "Price list database is not available right now." });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no"); // stream through proxies without buffering

  try {
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" }, // simple lookups: fastest replies
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: INSTRUCTIONS },
        // The price list is the same for every question, so it is cached (cheaper, faster)
        { type: "text", text: catalogText, cache_control: { type: "ephemeral" } },
      ],
      messages,
    });

    stream.on("text", (delta) => res.write(delta));
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") res.write("\n\nSorry, I can't help with that.");
    else if (final.stop_reason === "max_tokens") res.write("\n\n(Answer cut short. Ask a narrower question.)");
    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    let msg = "Sorry, something went wrong. Please try again.";
    if (err instanceof Anthropic.AuthenticationError) msg = "Chatbot API key is invalid. Please check ANTHROPIC_API_KEY on the server.";
    else if (err instanceof Anthropic.RateLimitError) msg = "The chatbot is busy right now. Please try again in a minute.";
    if (!res.headersSent) res.status(502).json({ error: msg });
    else res.end(`\n\n${msg}`);
  }
}
