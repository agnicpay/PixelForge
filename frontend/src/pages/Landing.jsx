import { Link } from 'react-router-dom';
import { SparkleIcon, ImageIcon, WalletIcon } from '../components/Icons.jsx';

const SAMPLES = [
  { title: 'Aurora canyon',     hue: 280 },
  { title: 'Neon koi',          hue: 200 },
  { title: 'Brutalist garden',  hue: 140 },
  { title: 'Velvet desert',     hue: 25  },
  { title: 'Glass cathedral',   hue: 320 },
  { title: 'Liquid chrome',     hue: 220 },
  { title: 'Synth orchard',     hue: 165 },
  { title: 'Paper origami',     hue: 50  },
];

function gradient(hue) {
  return `conic-gradient(from 210deg at 60% 40%,
    hsl(${hue} 90% 60%),
    hsl(${(hue + 60) % 360} 90% 50%),
    hsl(${(hue + 180) % 360} 80% 55%),
    hsl(${hue} 90% 60%))`;
}

export default function Landing({ connected, onConnect }) {
  return (
    <div className="landing">
      <section className="hero">
        <div>
          <span className="hero-eyebrow">
            <span className="dot"><SparkleIcon width="12" height="12" /></span>
            Multi-model image studio · powered by Agnic
          </span>

          <h1>
            One prompt.
            <br />
            <span className="grad-text">Every model.</span>
          </h1>

          <p className="lead">
            PixelForge brings every image model on the Agnic AI Gateway into a single,
            clean studio. Pick a model, write a prompt, ship pixels. Billing is
            handled end-to-end by Agnic — we never see your card.
          </p>

          <div className="hero-cta">
            {connected ? (
              <Link to="/studio" className="btn btn-primary btn-lg">
                <SparkleIcon className="ico" />
                Open Studio
              </Link>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={onConnect}>
                <SparkleIcon className="ico" />
                Connect with Agnic
              </button>
            )}
            <Link to="/studio" className="btn btn-soft btn-lg">Try the Studio</Link>
          </div>

          <div className="hero-trust">
            <div><span className="tick">✓</span> Pay-as-you-go via Agnic</div>
            <div><span className="tick">✓</span> Live model catalog</div>
            <div><span className="tick">✓</span> Download originals</div>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-grid">
            <div className="hero-art-tile" style={{ background: gradient(280) }} />
            <div className="hero-art-tile" style={{ background: gradient(180) }} />
            <div className="hero-art-tile" style={{ background: gradient(40) }} />
          </div>
        </div>
      </section>

      <section className="gallery">
        <h2>Imagined with PixelForge</h2>
        <p className="gallery-sub">A taste of what the studio can render — pick a model, write a prompt, hit Generate.</p>
        <div className="gallery-grid">
          {SAMPLES.map((s) => (
            <figure
              key={s.title}
              className="sample"
              style={{ background: gradient(s.hue) }}
            >
              <figcaption>{s.title}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
