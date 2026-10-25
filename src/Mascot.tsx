import { useEffect, useMemo, useRef, useState } from "react";

export type Mood = "happy" | "shock" | "wink" | "love" | "sad";

// wobbly hand-rolled circle, so it looks like real dough
function wobble(cx: number, cy: number, r: number, seed: number, amp: number) {
  const pts: string[] = [];
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r + Math.sin(i * 2.7 + seed) * amp + Math.cos(i * 1.3 + seed * 2) * amp * 0.6;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return "M" + pts.join("L") + "Z";
}

const SPOTS = [
  [62, 70, 7], [140, 64, 5], [150, 128, 8], [56, 140, 6], [100, 160, 5],
  [80, 52, 3], [166, 96, 4], [38, 104, 4], [124, 150, 3], [116, 42, 4],
];

export function Mascot({
  mood = "happy",
  size = 200,
  onPoke,
  bump = 0,
}: {
  mood?: Mood;
  size?: number;
  onPoke?: () => void;
  bump?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [eye, setEye] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const outer = useMemo(() => wobble(100, 100, 86, 1.7, 3.2), []);
  const inner = useMemo(() => wobble(100, 100, 72, 4.1, 2.4), []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const b = el.getBoundingClientRect();
      const dx = e.clientX - (b.left + b.width / 2);
      const dy = e.clientY - (b.top + b.height * 0.42);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 160);
      setEye({ x: (dx / d) * 6 * k, y: (dy / d) * 6 * k });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    const t = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3800);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      clearInterval(t);
    };
  }, []);

  const eyeR = mood === "shock" ? 17 : 14;
  const pupil = mood === "shock" ? 5 : 7;

  const Eye = ({ cx, side }: { cx: number; side: "l" | "r" }) => {
    if (mood === "wink" && side === "r")
      return <path d={`M${cx - 11} 84 Q${cx} 76 ${cx + 11} 84`} stroke="var(--ink)" strokeWidth="5" fill="none" strokeLinecap="round" />;
    if (mood === "love")
      return (
        <path
          d={`M${cx} 94 C${cx - 18} 80 ${cx - 10} 66 ${cx} 76 C${cx + 10} 66 ${cx + 18} 80 ${cx} 94Z`}
          fill="var(--chilli)"
          stroke="var(--ink)"
          strokeWidth="3"
        />
      );
    return (
      <g>
        <ellipse cx={cx} cy={82} rx={eyeR} ry={blink ? 2 : eyeR + 1} fill="#fff" stroke="var(--ink)" strokeWidth="3.5" />
        {!blink && (
          <g className="pupil">
            <circle cx={cx + eye.x} cy={82 + eye.y} r={pupil} fill="var(--ink)" />
            <circle cx={cx + eye.x + 2.5} cy={82 + eye.y - 2.5} r={2} fill="#fff" />
          </g>
        )}
      </g>
    );
  };

  const mouth = {
    happy: <path d="M76 122 Q100 150 124 122 Q100 134 76 122Z" fill="var(--ink)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />,
    wink: <path d="M78 124 Q100 146 122 124" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />,
    love: <path d="M76 122 Q100 152 124 122 Q100 134 76 122Z" fill="var(--ink)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />,
    shock: <ellipse cx="100" cy="132" rx="13" ry="17" fill="var(--ink)" />,
    sad: <path d="M80 136 Q100 118 120 136" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />,
  }[mood];

  return (
    <svg
      ref={ref}
      key={bump}
      className={`mascot ${bump ? "mascot-bump" : ""}`}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label="Talking paratha mascot"
      onClick={onPoke}
      style={{ cursor: onPoke ? "pointer" : "default", maxWidth: "100%" }}
    >
      <path d={outer} fill="var(--crust)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />
      <path d={inner} fill="var(--dough)" opacity="0.85" />
      {SPOTS.map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.7} fill="var(--char)" opacity="0.75" transform={`rotate(${i * 37} ${x} ${y})`} />
      ))}
      {/* butter pat on head */}
      <g className="butter">
        <path d="M78 22 L122 20 L126 38 L82 42 Z" fill="var(--butter)" stroke="var(--ink)" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M84 26 L118 24" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        <path d="M120 38 Q123 48 119 52" stroke="var(--butter)" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
      {/* blush */}
      <ellipse cx="56" cy="110" rx="11" ry="6" fill="var(--chilli)" opacity="0.35" />
      <ellipse cx="144" cy="110" rx="11" ry="6" fill="var(--chilli)" opacity="0.35" />
      <Eye cx={76} side="l" />
      <Eye cx={124} side="r" />
      {mood === "shock" && (
        <g stroke="var(--ink)" strokeWidth="4" strokeLinecap="round">
          <path d="M60 58 L70 62" />
          <path d="M140 58 L130 62" />
        </g>
      )}
      {mood === "sad" && <path d="M146 92 Q150 104 146 108 Q142 104 146 92Z" fill="#7cc8ff" stroke="var(--ink)" strokeWidth="2" />}
      {mouth}
      {(mood === "happy" || mood === "love") && <path d="M92 134 Q100 142 108 134 Q100 138 92 134Z" fill="var(--chilli)" />}
    </svg>
  );
}

export function Bubble({ text, side = "left" }: { text: string; side?: "left" | "right" }) {
  return (
    <div className={`bubble bubble-${side}`} key={text} aria-live="polite">
      {text}
    </div>
  );
}
