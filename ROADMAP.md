# bbq.build — internal roadmap

Future features to build out. Not user-facing. Newest asks at the top of "Up next".

## Up next

- **Share spec with a store (password-protected URL).** Export a build to a private
  shareable link protected by a password the user sets. The shop opens the link,
  reviews the full spec (BOM + 3D/2D views), and can **add their quote** and **ask
  questions** on the page. Owner sees quotes/questions back in the app.
  - Needs: public read-only spec route (`/s/:token`), password gate, `quotes`/`questions`
    table keyed by token, owner notifications.

- **Finish Google + Apple OAuth.** UI buttons exist and degrade gracefully. To enable:
  - Google: create an OAuth client in Google Cloud Console (consent screen + Web client),
    redirect URI `https://twakzbszusbinfewvzqr.supabase.co/auth/v1/callback`; then PATCH
    Supabase auth config `external_google_enabled/client_id/secret` via the Management API.
    (Blocked earlier on a Google account password re-challenge in the VNC browser.)
  - Apple: requires a paid Apple Developer account (Service ID + key).

## Planned

- **Corner appliances/storage** — the diagonal corner is now a visible pentagon cabinet;
  next let it hold a corner sink or carousel storage.
- **Photoreal AI renders** — turn the 3D scene into photoreal images from any angle.
- **Multi-shop quote comparison** — one spec to several shops, compare quotes/lead times.
- **Accessories** — stools on islands, pergolas, planters, lighting.
- **Free-position any run / rotate the island.**

## Shipped

- 3D PAX-style stage (orbit / x-ray / measure / open-animation)
- L/U/island layouts; **visible diagonal corner cabinets**; custom frame sizes
- **Drag the island** anywhere on the grid; **appliance-first** drop → auto-frame
- Gemini AI: chat builder (add_run), grounded product search, build validation
- Floating assistant, ft/in inputs (feet default), auto-save, home dashboard
- **Marketing landing page + PLG guest mode** (try free, sign up to save; guest design
  carries into the account)
- **Supabase auth** (email/password live; Google/Apple UI ready)
