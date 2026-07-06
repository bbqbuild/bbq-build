# bbq.build 🔥

Design your dream outdoor kitchen — a PAX-style builder for BBQ islands.

**v1**:

- **3D view (default)** — orbit 360°, zoom, pan (PAX-style), x-ray transparency when something covers your selection, click-click measure tool, real-time shadows. Press `V` for the 2D blueprint (oblique) view.
- **Layouts**: straight, L (left/right), U — wings joined by corner units — plus a freestanding island in front
- Pick a **ground** (hardwood deck, polished concrete, porcelain pavers, natural stone), width and depth
- Add **frames** (40 / 60 / 80 / 90 cm modules + lowered smoker tables) — click to append or drag onto any run; drag frames between runs to reorder
- Kit frames out with **appliances**: drop-ins (grills, Santa Maria, griddle, side burner, sink, ice bin), on-counter (pizza oven), kamados on lowered tables (Big Green Egg XL, Primo XL) and under-counter units (fridge, kegerator, drawers, doors, trash pull-out, ice maker, firewood store)
- **Placement rules**: width fit + stacking compatibility (no fridge under a grill, no firewood under fire, sinks need open plumbing bases) — invalid targets grey out with the reason
- **AI (Gemini)**: chat assistant that edits the canvas from natural language; Google-grounded **real product search** that adds actual models (Blaze, Napoleon, …) to your catalog; **AI build check** — feasibility report covering ventilation, clearances and utilities
- 4 frame **finishes**, 6 **presets**, cm ↔ ft/in toggle, live **price estimate** + spec sheet with JSON export
- Undo/redo, blueprint dimensions, grid, save/load designs
- Single-user login (Supabase multi-user auth arrives in v2)

**Roadmap**: v2 — photoreal AI renders from the spec, Supabase logins. v3 — send your spec to local shops for quotes.

## Stack

- `web/` — React + TypeScript + Vite, zustand; custom 2D canvas engine + THREE.js 3D stage (cabinet fronts are canvas-painted textures shared with the 2D art)
- `server/` — Express; SQLite locally, Postgres on Render; HMAC-token auth; Gemini endpoints (`/api/ai/*`, key via `.env` `GEMINI_API_KEY`)
- Deploy: Render blueprint (`render.yaml`) — web service + free Postgres

## Run locally

```bash
npm install
npm run build
npm start          # http://127.0.0.1:8000  (PORT=3000 to override)
```

Dev mode with HMR: `npm run dev` (Vite on 5173, proxies /api to 8000).

Login: `sagirodin@gmail.com` / `Ember&Oak-2417` (override with `BBQ_USER_EMAIL` / `BBQ_USER_PASSWORD`).

## Screenshot harness

```bash
node scripts/shoot.mjs   # drives the app, saves screenshots/*.png
```
