// The page's one bit of theatre: a bouquet whose wire stems draw themselves
// in, then the pompom blooms pop open. It plays once, and not at all for
// people who ask their device for reduced motion.

const STEMS = [
  { d: "M200 360 C 186 300, 150 250, 112 196", length: 210, delay: 0 },
  { d: "M200 360 C 200 290, 196 230, 198 150", length: 215, delay: 0.15 },
  { d: "M200 360 C 214 300, 250 252, 292 204", length: 215, delay: 0.3 },
  { d: "M200 360 C 204 310, 174 270, 152 240", length: 140, delay: 0.45 },
  { d: "M200 360 C 196 314, 230 276, 250 252", length: 140, delay: 0.6 },
];

const BLOOMS = [
  { cx: 112, cy: 190, r: 34, fill: "var(--color-bloom)", inner: "#f6d9e0", delay: 1.15 },
  { cx: 198, cy: 140, r: 40, fill: "var(--color-bloom-deep)", inner: "var(--color-bloom)", delay: 1.3 },
  { cx: 292, cy: 196, r: 32, fill: "#f6d9e0", inner: "var(--color-bloom)", delay: 1.45 },
  { cx: 150, cy: 238, r: 20, fill: "var(--color-wire)", inner: "#ead3a0", delay: 1.6 },
  { cx: 252, cy: 250, r: 20, fill: "var(--color-bloom)", inner: "#fff9fa", delay: 1.7 },
];

export function HeroBouquet() {
  return (
    <svg viewBox="0 0 400 440" role="img" aria-label="A bouquet of pink fuzzy-wire flowers tied with a gold ribbon" className="h-auto w-full max-w-[17rem] sm:max-w-sm md:max-w-md">
      <circle cx="200" cy="230" r="180" fill="var(--color-petal)" />
      {STEMS.map((stem) => (
        <path key={stem.d} d={stem.d} className="wire-draw" fill="none" stroke="var(--color-leaf)" strokeWidth="7" strokeLinecap="round"
          style={{ "--wire-length": stem.length, "--wire-delay": `${stem.delay}s` } as React.CSSProperties} />
      ))}
      {/* Fuzz: short strokes along the main stem suggest chenille texture. */}
      <path d="M192 330 l-8 -4 M206 312 l8 -3 M192 292 l-8 -2 M206 270 l8 -3 M193 248 l-8 -2" className="wire-draw"
        stroke="var(--color-leaf)" strokeWidth="3" strokeLinecap="round" style={{ "--wire-length": 60, "--wire-delay": "0.9s" } as React.CSSProperties} />
      {BLOOMS.map((bloom) => (
        <g key={`${bloom.cx}-${bloom.cy}`} className="bloom-in" style={{ "--bloom-delay": `${bloom.delay}s` } as React.CSSProperties}>
          {[0, 72, 144, 216, 288].map((angle) => (
            <circle key={angle} cx={bloom.cx + Math.cos((angle * Math.PI) / 180) * bloom.r * 0.55}
              cy={bloom.cy + Math.sin((angle * Math.PI) / 180) * bloom.r * 0.55} r={bloom.r * 0.5} fill={bloom.fill} />
          ))}
          <circle cx={bloom.cx} cy={bloom.cy} r={bloom.r * 0.35} fill={bloom.inner} />
        </g>
      ))}
      <path d="M160 362 Q200 392 240 362" className="wire-draw" fill="none" stroke="var(--color-wire)" strokeWidth="12" strokeLinecap="round"
        style={{ "--wire-length": 100, "--wire-delay": "0.8s" } as React.CSSProperties} />
      <path d="M176 368 l-18 34 M224 368 l18 34" className="wire-draw" fill="none" stroke="var(--color-wire)" strokeWidth="9" strokeLinecap="round"
        style={{ "--wire-length": 45, "--wire-delay": "1s" } as React.CSSProperties} />
    </svg>
  );
}
