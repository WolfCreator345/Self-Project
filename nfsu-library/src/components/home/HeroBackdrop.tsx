/**
 * Isometric grid of rounded tiles + ONE glowing navy tile.
 * Pure SVG + CSS (no 3D libraries, no video). Decorative only.
 */
const W = 96; // 2:1 isometric tile
const H = 48;
const S = 0.82; // tile size vs. cell → leaves the gaps between tiles
const R = 7; // corner radius

/** Rhombus centred at (cx, cy) with rounded corners. */
function roundedRhombus(cx: number, cy: number, w = W * S, h = H * S, r = R) {
  const pts = [
    [cx, cy - h / 2],
    [cx + w / 2, cy],
    [cx, cy + h / 2],
    [cx - w / 2, cy],
  ];
  const lerp = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const edge = Math.hypot(w / 2, h / 2);
  const t = r / edge;
  let d = "";
  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4];
    const cur = pts[i];
    const next = pts[(i + 1) % 4];
    const a = lerp(cur, prev, t);
    const b = lerp(cur, next, t);
    d += `${i === 0 ? "M" : "L"}${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${cur[0]} ${cur[1]} ${b[0].toFixed(1)} ${b[1].toFixed(1)} `;
  }
  return d + "Z";
}

function Tile({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <path d={roundedRhombus(cx, cy + 4)} fill="#DEE0EA" />
      <path d={roundedRhombus(cx, cy)} fill="#FFFFFF" stroke="#332B66" strokeOpacity={0.07} />
    </>
  );
}

export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* soft colour washes (gradients, not blur filters — cheap to paint) */}
      <div className="absolute inset-0 bg-[radial-gradient(40rem_30rem_at_0%_0%,rgb(220_217_238/0.8),transparent_70%),radial-gradient(36rem_28rem_at_100%_15%,rgb(236_220_184/0.55),transparent_70%)]" />

      <svg className="absolute inset-0 size-full [mask-image:radial-gradient(ellipse_60%_75%_at_78%_45%,#000_15%,transparent_75%)] max-md:[mask-image:radial-gradient(ellipse_90%_45%_at_80%_100%,#000_10%,transparent_80%)]">
        <defs>
          <pattern id="iso-tiles" width={W} height={H} patternUnits="userSpaceOnUse" x="-24" y="-12">
            <Tile cx={W / 2} cy={H / 2} />
            <Tile cx={0} cy={0} />
            <Tile cx={W} cy={0} />
            <Tile cx={0} cy={H} />
            <Tile cx={W} cy={H} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#iso-tiles)" opacity={0.9} />
      </svg>

      {/* frosted veil fading into the page */}
      <div className="absolute inset-0 bg-gradient-to-b from-page/25 via-transparent to-page" />

      {/* the one glowing tile — placed clear of text at every breakpoint */}
      <div className="absolute right-4 bottom-16 w-24 sm:right-8 sm:w-32 md:right-[6%] md:bottom-auto md:top-[38%] md:w-36 lg:right-[16%] lg:top-[34%] lg:w-48">
        <div className="absolute -inset-[45%] animate-glow rounded-full bg-[radial-gradient(closest-side,rgb(91_79_168/0.55),rgb(51_43_102/0.18)_55%,transparent)] will-change-transform" />
        <svg viewBox="-60 -40 120 84" className="relative w-full">
          <path d={roundedRhombus(0, 10, 96, 48, 8)} fill="#1F1946" />
          <path d={roundedRhombus(0, 4, 96, 48, 8)} fill="#2A2356" />
          <path d={roundedRhombus(0, 0, 96, 48, 8)} fill="#332B66" />
          <path d={roundedRhombus(0, 0, 96, 48, 8)} fill="none" stroke="#CFAE6B" strokeOpacity={0.7} strokeWidth={1.2} />
          <path d={roundedRhombus(0, 0, 58, 29, 6)} fill="#5B4FA8" fillOpacity={0.35} />
        </svg>
      </div>
    </div>
  );
}
