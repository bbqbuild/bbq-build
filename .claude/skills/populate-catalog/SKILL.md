---
name: populate-catalog
description: Extract real outdoor-kitchen appliances from top vendors (grounded Gemini search) into a categorized, approvable list, and optionally submit them to the bbq.build shared catalog for admin vetting. Use to populate or periodically refresh the appliance catalog with real products, specs, prices and source links.
---

# Populate / repopulate the bbq.build appliance catalog

Pulls **real, currently-sold** outdoor-kitchen products from the top vendors
(Napoleon, Blaze, Weber, Coyote, Bull, Lion, RCS, Alfresco, Summerset, VEVOR,
Sunstone, Lynx, Gozney, Big Green Egg, Primo, Tagwood, …) across every catalog
category, with full specs + price + source link. It reuses the app's own
grounded-Gemini search (`server/ai.js` → `searchAppliances`), so results match
what the in-app "Real products" search returns.

## Run it

```bash
cd /home/sagi/workspace/SagiWorkspace/bbqBuild
set -a; source .env; set +a          # GEMINI_API_KEY must be set

# 1) Extract → categorized report for approval (no DB writes)
node scripts/extract-appliances.mjs

# focus on specific categories
node scripts/extract-appliances.mjs --only trash,doors,drawers

# 2) After the human approves the report, submit them to the catalog as PENDING
#    (they then show in the admin panel → Appliances → Pending for approve/reject)
node scripts/extract-appliances.mjs --push
```

Full runs hit the Gemini API a lot (≈3 grounded queries × 15 categories) and take
~15–20 minutes — run in the background and poll the output.

## Output

- `catalog-extract/report.md` — categorized, human-readable list for approval
  (brand, model, size, price, source link, blurb per product).
- `catalog-extract/appliances.json` — the same data as structured JSON.

## Categories & targets

Targets **10 products per category**: grill, santamaria, kamado, griddle,
burner, pizza, sink, fridge, kegerator, icemaker, icebin, trash, doors, drawers,
woodstore. Category query lists live in `PLAN` inside
`scripts/extract-appliances.mjs` — add vendors/terms there to widen coverage or
lift a thin category to 10.

## The approval flow (matches the app's model)

1. Run without `--push` → review `catalog-extract/report.md` with the user.
2. On approval, either:
   - `--push` to insert everything as **pending** → the user approves/rejects in
     the **admin panel → Appliances → Pending** (each becomes vetted + visible to
     all users), or
   - hand-pick URLs and scan them one-by-one from the admin panel's Scan box
     (admin scans are auto-vetted).
3. Every product keeps its **source URL**, so prices can be re-scraped later —
   re-running this skill refreshes the list.

## Notes

- Some source URLs come back as `vertexaisearch.cloud.google.com/...redirect`
  links (Gemini grounding) — they still resolve to the real product page.
- Dedupe is by `brand-model` slug; the same product across queries collapses.
- The importer maps each category to a built-in `paintAs` so products render with
  the right 3D/2D art; oversize units get a custom-width frame automatically.
