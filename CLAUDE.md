# website — bbq.build product (landing + web app)

This project is the whole product surface: the marketing **landing page** and the
**web app** builder, in one repo, deployed together.

Shared business context is inherited from `../CLAUDE.md`; product/stack detail is in
`../shared/product.md`; infra facts and the security note are in `../shared/facts.md`.

## Where things are
- `web/` — React + TS + Vite frontend (zustand). 2D canvas engine (`web/src/canvas/`) +
  THREE.js 3D stage (`web/src/canvas3d/`). Landing page: `web/src/ui/Landing.tsx`.
- `server/` — Express; SQLite local / Postgres prod; Supabase auth; Gemini `/api/ai/*`.
- `scripts/` — ~90 Playwright driver/QA scripts (many one-off). `shoot.mjs` is the
  documented screenshot harness. They read `BBQ_USER_PASSWORD` from the env.
- Run: `npm install && npm run build && npm start` (127.0.0.1:8000). Dev: `npm run dev`.

## Deploy
- Push to `master` → **Render auto-deploys** (GitHub App installed on the `bbqbuild` org).
- Render serves the built `web/dist`. `index.html` is `no-cache`; hashed assets are
  immutable/1y — so deploys show up immediately.
- Manual deploy if needed: Render API with `RENDER_API_KEY` from `.env`.

## Gotchas worth remembering
- **Secrets:** only in `.env` (gitignored). Never add a credential default in code — the
  v1 password leaked in public history once already. See `../shared/facts.md`.
- **v2 designer layout (Figma-style docks):** the builder is left rail (Ground / Presets /
  Frames / Appliances → options panel) → canvas → right rail (Edit / Spec / Get Quotes /
  DIY / Quality Check → results panel). Selecting anything on canvas auto-opens the Edit
  panel. DIY is always reachable from the right dock ("DIY the whole kitchen" groups all
  frames and starts a project); per-section DIY still works via shift-click → group.
- **Automation/WebGL:** the 3D stage needs a real WebGL context; headless Chrome without
  GPU crashes into the error boundary. Drive UI tests in 2D view (`localStorage bbq_view=2d`)
  or launch Chrome with SwiftShader.
