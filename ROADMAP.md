# bbq.build — internal roadmap

Future features to build out. Not user-facing. Newest asks at the top of "Up next".

## Up next

- **Share spec with a store via password-protected URL.** Export a build to a private
  shareable link protected by a password the user sets manually. The shop opens the link,
  reviews the full spec (BOM + 3D/2D views), and can **add their quote** and **ask questions**
  right on the page (a lightweight thread). Owner sees quotes/questions back in the app.
  - Needs: a public read-only spec route (`/s/:token`), password gate, a `quotes`/`questions`
    table keyed by spec token, and a notifications surface for the owner.

## Planned

- **Free-position island & frames on the grid** — drag the island (and runs) anywhere on the
  ground, snap to grid, persist offset. (task #23)
- **Appliance-first flow** — drop an appliance on blank ground and auto-create a compatible
  frame (standard size if it fits, custom size for odd units like the Santa Maria). (task #24)
- **Corner frames as first-class, visible units** — the current auto-corner renders but is
  occluded by the wing; make corners clearly visible/selectable and optionally addable/resizable.
- **Supabase multi-user auth** — real accounts, per-user designs, shareable read-only links. (task #25)
- **Photoreal AI renders** — turn the 3D scene into photoreal images from any angle.
- **Multi-shop quote comparison** — one spec to several shops, compare quotes/lead times.
- **Accessories** — stools, pergolas, planters, lighting for the whole outdoor space.

## Shipped

- 3D PAX-style stage (orbit / x-ray / measure / open-animation)
- L / U / island layouts, customizable corners, custom frame sizes
- Gemini AI: chat builder (add_run), grounded product search, build validation
- Floating draggable assistant, editable ft/in inputs (feet default), auto-save
