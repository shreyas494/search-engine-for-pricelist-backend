---
name: add-pricelist
description: Convert a new price-list PDF into a JSON file in the same format as that brand's previous JSON in backend/, then upload it to MongoDB. Use when the user gives a price-list PDF or says "add/upload this price list".
argument-hint: "<path to PDF>"
---

# Add a new price list

The user gives a price-list PDF (path in the arguments or in chat). Turn it into a new JSON file that copies the previous file for that brand, then upload it. Do the steps in order.

## 1. Find the previous JSON for this brand

- List the JSON files in `backend/` (skip `package.json` and `package-lock.json`).
- Match the PDF's file name to one of them by its name part, ignoring the date, case, spaces and punctuation. For example, `Leo silver DT-15-10-26.pdf` matches `LEOSILVER DT-7-9-26.json`.
- If no file matches, or more than one could, ask the user which one to follow. If it's a brand-new list with no previous file, ask the user for the name to use and which existing file's format is closest.

## 2. Work out the new name

- **Name part:** take it from the previous file, exactly as written, without its date (`LEOSILVER DT-`). Don't take it from the PDF.
- **Date:** take it from the PDF's file name, written the same way it appears there (`15-10-26`).
- New name = name part + new date, e.g. `LEOSILVER DT-15-10-26`.
- If the PDF's file name has no date, ask the user for it. Don't use the date printed inside the PDF without asking.
- The new file is `backend/<new name>.json`. If that file already exists, stop and ask.

## 3. Copy the previous file's format exactly

Read the previous JSON file in full and copy it:
- The same fields, in the same order, with the same names (`dp` vs `dealerPrice`, `warranty` vs `warranty_years`, and so on). Don't add or drop fields.
- The same value style: numbers stay numbers (no ₹ or commas); text like `"24 months"` vs `"48M"` follows the old file.
- The same layout: one item per line, written the same way (`{"brand":"...","model":...}` with or without spaces after colons, as in the old file).
- `"brand"` in every item = the new name from step 2.
- `"model"` must be filled in on every item, because search only looks at `model`.

## 4. Read the PDF and fill in the data

- Read every page of the PDF and include every product row. Don't skip, merge or invent rows. Keep the PDF's order.
- Put each value under the field the previous file used for it. If the PDF has a column the old file doesn't, or is missing one the old file has, tell the user and ask before changing the format.
- Write the new file. Keep the old file as it is.

## 5. Check it with the user before uploading

- Run a dry run from `backend/`:
  `node upload_pricelist.js "<new name>.json" --dry-run`
- Show the user: the new file name, the number of items (versus the old file's count), a few sample rows, any rows whose price changed a lot or looks wrong, and the dry run output.
- Ask two things:
  1. Upload it?
  2. Delete the old list (the previous file's brand name) from the database after uploading? Old JSON files are always kept.

## 6. Upload

Only after the user says yes, run from `backend/`:
- Keep the old list: `node upload_pricelist.js "<new name>.json"`
- Replace the old list: `node upload_pricelist.js "<new name>.json" --replace "<old brand name>"`

The script inserts the items, deletes the old list if asked, and refreshes the website's brand list. Report what it printed. If it says the brand is already uploaded, stop and ask; don't use `--force` unless the user says so.
