// upload_pricelist.js
// Uploads one price-list JSON file into the MongoDB "tyres" collection.
//
// Usage (run from the backend folder):
//   node upload_pricelist.js "<file.json>" --dry-run
//   node upload_pricelist.js "<file.json>"
//   node upload_pricelist.js "<file.json>" --replace "<old brand name>"
//
// --dry-run   Validate the file and check the database, but write nothing.
// --replace   After the new list is inserted, delete the old list with that brand name.
// --force     Upload even if this brand name already exists in the database.
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const BACKEND_URL =
  process.env.BACKEND_URL?.trim() ||
  "https://search-engine-for-pricelist-backend-8s8x.onrender.com";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--replace");
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const replaceIdx = args.indexOf("--replace");
const oldBrand = replaceIdx !== -1 ? args[replaceIdx + 1] : null;

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!file) fail('Give the JSON file, e.g. node upload_pricelist.js "LEOSILVER DT-7-9-26.json"');
if (replaceIdx !== -1 && !oldBrand) fail("--replace needs the old brand name after it");

// ✅ Read and validate the file
const filePath = path.resolve(file);
if (!fs.existsSync(filePath)) fail(`File not found: ${filePath}`);

let items;
try {
  items = JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch (err) {
  fail(`File is not valid JSON: ${err.message}`);
}
if (!Array.isArray(items) || items.length === 0) fail("File must be a non-empty JSON array");

const brand = items[0]?.brand;
const fileStem = path.basename(filePath, ".json");
const problems = [];
const warnings = [];

items.forEach((item, i) => {
  const row = `item ${i + 1}`;
  if (!item || typeof item !== "object" || Array.isArray(item)) return problems.push(`${row}: not an object`);
  if (item.brand !== brand) problems.push(`${row}: brand "${item.brand}" differs from "${brand}"`);
  if (!item.model || typeof item.model !== "string") warnings.push(`${row}: no "model" (it won't show up in search)`);
  for (const key of ["dp", "cp", "mrp"]) {
    if (key in item && item[key] !== null && typeof item[key] !== "number") {
      problems.push(`${row}: "${key}" should be a number, got ${JSON.stringify(item[key])}`);
    }
  }
});

if (!brand) problems.push('First item has no "brand"');
else if (brand !== fileStem) warnings.push(`brand "${brand}" doesn't match the file name "${fileStem}"`);
if (oldBrand && oldBrand === brand) problems.push("--replace brand is the same as the new brand");

const fields = [...new Set(items.flatMap((o) => Object.keys(o)))];
console.log(`📄 ${path.basename(filePath)}`);
console.log(`   brand:  ${brand}`);
console.log(`   items:  ${items.length}`);
console.log(`   fields: ${fields.join(", ")}`);
warnings.forEach((w) => console.warn(`⚠️  ${w}`));
if (problems.length) {
  problems.forEach((p) => console.error(`❌ ${p}`));
  fail(`${problems.length} problem(s) found, nothing uploaded`);
}

// ✅ Connect and upload
const MONGO_URI = process.env.MONGO_URI?.trim();
if (!MONGO_URI) fail("MONGO_URI is missing from backend/.env");

try {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  // Use the raw collection so every column (cp, warranty, ah, ...) is kept,
  // same as importing the file in MongoDB Compass.
  const tyres = mongoose.connection.collection("tyres");

  const existing = await tyres.countDocuments({ brand });
  const oldCount = oldBrand ? await tyres.countDocuments({ brand: oldBrand }) : 0;

  if (existing > 0) console.warn(`⚠️  "${brand}" already has ${existing} items in the database`);
  if (oldBrand) console.log(`🗂️  Old list "${oldBrand}" has ${oldCount} items in the database`);
  if (oldBrand && oldCount === 0) console.warn(`⚠️  Nothing found for "${oldBrand}", nothing will be deleted`);

  if (existing > 0 && !force && !dryRun) {
    throw new Error("Brand already uploaded. Use --force to upload anyway (it will create duplicates).");
  }

  if (dryRun) {
    console.log("🧪 Dry run finished, nothing was written");
  } else {
    const result = await tyres.insertMany(items.map((item) => ({ ...item })));
    console.log(`✅ Uploaded ${result.insertedCount} items for "${brand}"`);

    if (oldBrand && oldCount > 0) {
      const del = await tyres.deleteMany({ brand: oldBrand });
      console.log(`🗑️  Deleted ${del.deletedCount} items of old list "${oldBrand}"`);
    }

    // Refresh the live site's brand dropdown cache
    try {
      const res = await fetch(`${BACKEND_URL}/api/brands?refresh=true`, { signal: AbortSignal.timeout(60000) });
      const list = await res.json();
      const shown = Array.isArray(list) && list.includes(brand);
      console.log(shown ? "🔄 Website brand list refreshed" : "⚠️  Brand list refreshed, but the new brand isn't in it yet");
    } catch {
      console.warn("⚠️  Couldn't refresh the website brand list; press refresh on the site (it also refreshes itself within 10 minutes)");
    }
  }
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
