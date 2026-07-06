# bbq.build 🔥

Design your dream outdoor kitchen — a PAX-style builder for BBQ islands.

**v1** — 2D elevation builder on HTML canvas:

- Pick a **ground** (hardwood deck, polished concrete, porcelain pavers, natural stone) and its width
- Add **frames** (40 / 60 / 80 / 90 cm modules) — click to append or drag onto the canvas to position; drag frames to reorder
- Kit frames out with **appliances**: counter-level drop-ins (grills, griddle, side burner, sink, ice bin), on-counter (pizza oven) and under-counter units (fridge, kegerator, drawers, doors, trash pull-out, ice maker, firewood store)
- Appliances know which frame widths they fit — invalid targets grey out while dragging
- 4 frame **finishes** (graphite, stainless, teak, basalt), 5 **presets**, live **price estimate** + spec sheet with JSON export
- Undo/redo, zoom/pan, blueprint dimensions, grid, save/load designs
- Single-user login (Supabase multi-user auth arrives in v2)

**Roadmap**: v2 — AI assistant ("add a pizza oven next to the grill"), photoreal renders from the 2D spec, Supabase logins. v3 — send your spec to local shops for quotes.

## Stack

- `web/` — React + TypeScript + Vite, zustand, custom canvas engine (no canvas libs)
- `server/` — Express; SQLite locally, Postgres on Render; HMAC-token auth
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
