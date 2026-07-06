import { PRESETS } from '../catalog/presets'
import { DesignThumb } from './DesignThumb'

/** Public marketing cover page. PLG: try the builder as a guest, sign up to save. */
export function Landing({ onTry, onSignIn }: { onTry: () => void; onSignIn: () => void }) {
  const showcase = PRESETS.slice(0, 3)
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="logo">
          <img src="/flame.svg" alt="" width={24} height={24} />
          <span>
            bbq<em>.build</em>
          </span>
        </div>
        <nav className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <button className="btn btn-ghost" onClick={onSignIn}>
            Sign in
          </button>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow">🔥 The outdoor kitchen designer</div>
          <h1>
            Design your dream <span className="accent">outdoor kitchen</span> in 3D.
          </h1>
          <p>
            Drag in grills, smokers, pizza ovens and bars. Snap together frames, wrap corners, add an island — then
            walk around it in full 3D. When it's perfect, send the spec to a shop for a quote.
          </p>
          <div className="landing-cta-row">
            <button className="btn btn-primary landing-cta" onClick={onTry}>
              Start designing — free, no signup
            </button>
            <button className="btn btn-ghost" onClick={onSignIn}>
              I have an account
            </button>
          </div>
          <div className="landing-trust">Try the full builder instantly · Sign up only to save your work</div>
        </div>
        <div className="landing-hero-art">
          <DesignThumb design={PRESETS[3]?.design ?? PRESETS[0].design} width={520} height={330} />
        </div>
      </section>

      <section className="landing-strip">
        <div>
          <strong>15+</strong>
          <span>appliances & bar units</span>
        </div>
        <div>
          <strong>Straight · L · U</strong>
          <span>+ freestanding island</span>
        </div>
        <div>
          <strong>Full 3D</strong>
          <span>orbit, x-ray, measure</span>
        </div>
        <div>
          <strong>AI assistant</strong>
          <span>build it by chatting</span>
        </div>
      </section>

      <section className="landing-features" id="features">
        <h2>Everything you need to plan it right</h2>
        <div className="landing-feature-grid">
          <Feature icon="🧱" title="Snap-together frames">
            Modular 40–90 cm cabinets (or any custom size) with drop-in grills, sinks, fridges, kegerators and
            drawers. Compatibility rules keep your build safe.
          </Feature>
          <Feature icon="🍖" title="Real appliances">
            Santa Maria grills, Big Green Egg & Primo kamados on lowered smoker tables, pizza ovens — plus live search
            for real products from actual brands.
          </Feature>
          <Feature icon="🕹️" title="True 3D walkthrough">
            Orbit 360°, zoom and pan like a pro tool. X-ray anything in the way, measure any distance, and open every
            door and hood.
          </Feature>
          <Feature icon="✨" title="AI that builds for you">
            “L-shaped kitchen with a Santa Maria and a bar island for five” — and it appears on the canvas. Powered by
            Gemini.
          </Feature>
          <Feature icon="📐" title="Spec & pricing">
            A live bill of materials and estimate as you design, in feet or centimeters. Export the spec when you're
            ready.
          </Feature>
          <Feature icon="🏪" title="Quote from local shops">
            Share a protected link with a shop — they add their quote and answer your questions. (Coming soon.)
          </Feature>
        </div>
      </section>

      <section className="landing-showcase">
        <h2>Start from a proven layout</h2>
        <div className="landing-showcase-grid">
          {showcase.map((p) => (
            <button key={p.id} className="landing-showcase-card" onClick={onTry}>
              <DesignThumb design={p.design} width={320} height={180} />
              <div className="landing-showcase-info">
                <strong>{p.name}</strong>
                <span>{p.tagline}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="landing-how" id="how">
        <h2>Three steps to your build</h2>
        <div className="landing-steps">
          <Step n={1} title="Design it">Drag frames and appliances onto the canvas, or just tell the AI what you want.</Step>
          <Step n={2} title="Perfect it in 3D">Walk around it, tweak sizes and finishes, and see the price update live.</Step>
          <Step n={3} title="Get it built">Save to your account and send the spec to a shop for a real quote.</Step>
        </div>
      </section>

      <section className="landing-final">
        <h2>Your backyard is waiting.</h2>
        <button className="btn btn-primary landing-cta" onClick={onTry}>
          Start designing — it's free
        </button>
      </section>

      <footer className="landing-footer">
        <span>
          bbq<em className="accent">.build</em>
        </span>
        <span>Design · Price · Build</span>
      </footer>
    </div>
  )
}

function Feature({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="landing-feature">
      <div className="landing-feature-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="landing-step">
      <div className="landing-step-n">{n}</div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  )
}
