import { MARK_PATHS, MARK_TRANSFORM } from "@/components/logo-mark";

// The opening screen: shown by the server HTML itself, so it is on screen
// before any JavaScript or page content arrives. The tile settles, the "G" is
// drawn, the two tap waves follow, a ring ripples out, and the wordmark rises.
// It leaves once the page has fully loaded (never before the drawing is done),
// and only once per browser tab session. All state lives on <html data-splash>:
//   (none) no JavaScript: a CSS timer fades it out
//   on      showing, waiting for the page
//   leaving fading out
//   skip    already seen in this tab, or finished
const SCRIPT = `(function(){var d=document.documentElement;try{if(sessionStorage.getItem("gx-splash")){d.dataset.splash="skip";return}sessionStorage.setItem("gx-splash","1")}catch(e){}d.dataset.splash="on";var r=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches,min=r?500:1900,t0=performance.now(),done=0;function hide(){if(done)return;done=1;setTimeout(function(){d.dataset.splash="leaving";setTimeout(function(){d.dataset.splash="skip"},700)},Math.max(0,min-(performance.now()-t0)))}if(document.readyState==="complete")hide();else addEventListener("load",hide);setTimeout(hide,7000)})();`;

// Arcs of radius 62, 76 and 90 from -82deg to -8deg around (59,42): wholly
// outside the tile, thinner and fainter the further out they are.
const ECHOES = [
  { d: "M67.6 -19.4 A62 62 0 0 1 120.4 33.4", w: 6.5 },
  { d: "M69.6 -33.3 A76 76 0 0 1 134.3 31.4", w: 5.5 },
  { d: "M71.5 -47.1 A90 90 0 0 1 148.1 29.5", w: 4.5 },
];

export function Splash() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <div id="gx-splash" aria-hidden>
        <div className="gx-splash-glow" />
        <div className="gx-splash-stage">
          <div className="gx-splash-tile">
            {/* The tap waves carry on outside the tile: three wider arcs on the
                same centre (59,42) and angles as the logo's two, pulsing out. */}
            <svg viewBox="0 0 100 100" className="gx-splash-echo">
              <g transform={MARK_TRANSFORM} fill="none" stroke="currentColor" strokeLinecap="round">
                {ECHOES.map((e, i) => (
                  <path key={e.d} d={e.d} strokeWidth={e.w} className={`gx-splash-e${i}`} />
                ))}
              </g>
            </svg>
            <svg viewBox="0 0 100 100" className="gx-splash-mark">
              <g transform={MARK_TRANSFORM} fill="none" stroke="currentColor" strokeLinejoin="round">
                {MARK_PATHS.map((p, i) => (
                  <path key={p.d} d={p.d} strokeWidth={p.width} strokeLinecap={p.cap} pathLength={1} className={`gx-splash-p${i}`} />
                ))}
              </g>
            </svg>
            <span className="gx-splash-sheen" />
          </div>
          <p className="gx-splash-word">Gymix</p>
          <span className="gx-splash-bar" />
        </div>
      </div>
    </>
  );
}
