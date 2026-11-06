import { useMemo } from "react";
import { wobble } from "./Mascot";
import type { Item } from "./data";

// Hand-painted cartoon dishes in the same ink-outline style as the mascot.
// If an item has a `photo` in data.ts, the real photo is shown instead.

const INK = "var(--ink)";
const SW = 3;

const Plate = () => (
  <g>
    <circle cx="50" cy="56" r="42" fill="#fff" stroke={INK} strokeWidth={SW} />
    <circle cx="50" cy="56" r="33" fill="none" stroke="#e8dfcc" strokeWidth="2" />
  </g>
);

const Steam = ({ xs = [34, 48, 62], y = 20 }: { xs?: number[]; y?: number }) => (
  <g className="steam" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.45">
    {xs.map((x, i) => (
      <path key={i} d={`M${x} ${y} q-4 -5 0 -9 q4 -4 0 -9`} style={{ animationDelay: `${i * 0.4}s` }} />
    ))}
  </g>
);

const heart = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy + s * 0.9} C${cx - s * 1.6} ${cy - s * 0.1} ${cx - s * 0.6} ${cy - s * 1.2} ${cx} ${cy - s * 0.35} C${cx + s * 0.6} ${cy - s * 1.2} ${cx + s * 1.6} ${cy - s * 0.1} ${cx} ${cy + s * 0.9}Z`;

type Side = "achar" | "dahi" | "chutney" | "ketchup";
const SIDE: Record<Side, { fill: string; bit: string }> = {
  achar: { fill: "#d9481c", bit: "#ffb347" },
  dahi: { fill: "#fffdf6", bit: "#3c9a3c" },
  chutney: { fill: "#3fa55b", bit: "#9be07a" },
  ketchup: { fill: "#c8231a", bit: "#ff6a4d" },
};
const Bowl = ({ kind, x = 78, y = 80 }: { kind: Side; x?: number; y?: number }) => {
  const s = SIDE[kind];
  return (
    <g>
      <circle cx={x} cy={y} r="12" fill="#fff" stroke={INK} strokeWidth={SW} />
      <circle cx={x} cy={y} r="8.5" fill={s.fill} stroke={INK} strokeWidth="1.5" />
      {kind === "dahi" ? (
        <path d={`M${x - 3} ${y + 1} q3 -7 7 -4 q-2 5 -7 4Z`} fill={s.bit} stroke={INK} strokeWidth="1" />
      ) : (
        <g fill={s.bit}>
          <circle cx={x - 3} cy={y - 2} r="1.6" />
          <circle cx={x + 3} cy={y + 1} r="1.4" />
          <circle cx={x - 1} cy={y + 4} r="1.2" />
        </g>
      )}
    </g>
  );
};

/* ---------- stuffed paratha with a wedge cut out ---------- */
function Paratha({
  filling, speck = "#3c9a3c", cheese, hearts, cubes, shreds, side,
}: {
  filling: string; speck?: string; cheese?: boolean; hearts?: boolean; cubes?: boolean; shreds?: boolean; side: Side;
}) {
  return (
    <>
      <Plate />
      {/* paratha, wedge removed on the right */}
      <path d="M44 54 L69.4 65.8 A28 28 0 1 1 66.9 37.9 Z" fill="var(--crust)" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M44 54 L64.8 63.7 A23 23 0 1 1 62.8 40.8 Z" fill="var(--dough)" opacity="0.7" />
      {[[30, 44, 4], [36, 68, 3.5], [50, 38, 3], [24, 58, 3], [44, 74, 2.6], [30, 33, 2.2], [56, 70, 2.2]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.7} fill="var(--char)" opacity="0.75" transform={`rotate(${i * 41} ${x} ${y})`} />
      ))}
      {/* filling spilling out of the cut */}
      <path d="M46 52 C54 41 70 42 74 50 C78 57 71 64 62 62 C55 65 47 60 46 52Z" fill={filling} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      {cubes ? (
        <g fill="#fff" stroke={INK} strokeWidth="1.5">
          <rect x="54" y="47" width="7" height="7" rx="1.5" transform="rotate(-12 57 50)" />
          <rect x="63" y="50" width="6.5" height="6.5" rx="1.5" transform="rotate(14 66 53)" />
          <rect x="57" y="55" width="6" height="6" rx="1.5" />
        </g>
      ) : shreds ? (
        <g stroke="#8a3d14" strokeWidth="2.6" strokeLinecap="round">
          <path d="M53 50 l6 -2" /><path d="M62 47 l5 3" /><path d="M56 56 l7 1" /><path d="M66 55 l4 -3" /><path d="M51 55 l3 2" />
        </g>
      ) : (
        <g fill={speck}>
          <circle cx="55" cy="50" r="1.5" /><circle cx="63" cy="48" r="1.3" /><circle cx="68" cy="54" r="1.5" />
          <circle cx="58" cy="57" r="1.3" /><circle cx="52" cy="54" r="1.1" />
        </g>
      )}
      {cheese && (
        <path
          d="M58 61 C58 67 59 72 61.5 72 C64 72 63.5 66 65 62 C66 66 66 69 68 69 C70 69 70 64 70 60 Z"
          fill="#ffd23f" stroke={INK} strokeWidth="2" strokeLinejoin="round"
        />
      )}
      {cheese && <path d="M72 49 C78 47 80 42 79 38" fill="none" stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" />}
      {/* topping */}
      {hearts ? (
        <g stroke={INK} strokeWidth="2">
          <path d={heart(31, 47, 7)} fill="var(--chilli)" />
          <path d={heart(41, 63, 4.5)} fill="#ff8fa3" />
        </g>
      ) : (
        <g transform="rotate(-14 32 48)">
          <rect x="25" y="42" width="15" height="11" rx="2" fill="var(--butter)" stroke={INK} strokeWidth="2.5" />
          <path d="M28 45 L37 45" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      <Bowl kind={side} />
      <Steam xs={[30, 42, 54]} y={22} />
    </>
  );
}

/* ---------- burgers ---------- */
function Burger({ smash }: { smash?: boolean }) {
  return (
    <>
      <ellipse cx="50" cy="86" rx="42" ry="8" fill="#c98a4b" stroke={INK} strokeWidth={SW} />
      <path d="M20 74 Q20 83 30 83 L70 83 Q80 83 80 74 Z" fill="#e0a050" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      {smash ? (
        <path
          d="M14 66 L18 61 L24 63 L30 60 L38 62 L46 59 L54 62 L62 59 L70 62 L78 60 L86 65 L82 73 L18 74 Z"
          fill="#6e3514" stroke={INK} strokeWidth={SW} strokeLinejoin="round"
        />
      ) : (
        <path d="M18 65 Q16 73 24 74 L76 74 Q84 73 82 65 Q80 60 50 60 Q20 60 18 65Z" fill="#c8742e" stroke={INK} strokeWidth={SW} />
      )}
      {smash ? (
        <g fill="#b0642b"><circle cx="30" cy="68" r="1.6" /><circle cx="48" cy="66" r="1.4" /><circle cx="66" cy="68" r="1.6" /></g>
      ) : (
        <g fill="#5cbf4a"><circle cx="30" cy="67" r="1.8" /><circle cx="44" cy="69" r="1.6" /><circle cx="58" cy="66" r="1.8" /><circle cx="70" cy="69" r="1.5" /></g>
      )}
      {smash && (
        <path
          d="M18 60 L82 60 L79 66 L73 62 L67 71 L61 62 L48 68 L42 62 L31 67 L26 61 Z"
          fill="#ffd23f" stroke={INK} strokeWidth="2.2" strokeLinejoin="round"
        />
      )}
      <path d="M22 54 L78 54 L76 60 L24 60 Z" fill="#e3361f" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14 56 q6 -7 12 0 q6 -7 12 0 q6 -7 12 0 q6 -7 12 0 q6 -7 12 0 q6 -7 12 0 L86 58 L14 58Z" fill="#5cbf4a" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M16 52 Q16 22 50 22 Q84 22 84 52 Z" fill="#e7a24a" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M26 36 Q34 27 46 26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      {[[34, 40, 20], [46, 33, -10], [58, 38, 30], [68, 44, -25], [40, 46, 10], [56, 47, 0], [28, 47, -20]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx="2.6" ry="1.4" fill="#fff8e6" stroke={INK} strokeWidth="0.8" transform={`rotate(${r} ${x} ${y})`} />
      ))}
      <path d="M50 24 L50 6" stroke={INK} strokeWidth="2" />
      <path d="M50 6 L67 9.5 L50 13 Z" fill={smash ? "var(--chilli)" : "var(--chutney)"} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
    </>
  );
}

/* ---------- aloo chop ---------- */
function AlooChop() {
  const chops: [number, number, number][] = [[32, 50, -15], [58, 42, 10], [42, 70, 5]];
  return (
    <>
      <Plate />
      {chops.map(([x, y, r], i) => (
        <g key={i} transform={`rotate(${r} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx="16" ry="12" fill="#c9782e" stroke={INK} strokeWidth={SW} />
          <ellipse cx={x - 4} cy={y - 4} rx="7" ry="3.5" fill="#e9a356" opacity="0.8" />
          <g fill="#8a4b16">
            <circle cx={x + 5} cy={y + 2} r="1.3" /><circle cx={x - 6} cy={y + 4} r="1.2" /><circle cx={x + 9} cy={y - 4} r="1" /><circle cx={x} cy={y + 6} r="1" />
          </g>
        </g>
      ))}
      {/* the cut one, showing aloo inside */}
      <g transform="rotate(-8 68 66)">
        <ellipse cx="68" cy="66" rx="15" ry="11.5" fill="#c9782e" stroke={INK} strokeWidth={SW} />
        <ellipse cx="68" cy="65" rx="10" ry="7" fill="#f4cf5a" stroke={INK} strokeWidth="2" />
        <g fill="#3c9a3c"><circle cx="65" cy="64" r="1.3" /><circle cx="71" cy="66" r="1.2" /><circle cx="68" cy="61" r="1" /></g>
      </g>
      <Bowl kind="ketchup" x={24} y={78} />
      <Steam xs={[40, 54, 68]} y={26} />
    </>
  );
}

/* ---------- paneer pakoda ---------- */
function Pakoda() {
  const bits = useMemo(
    () => [
      { x: 32, y: 46, r: 13, s: 1.1 }, { x: 56, y: 40, r: 12, s: 2.3 }, { x: 46, y: 64, r: 14, s: 3.7 },
      { x: 70, y: 58, r: 11, s: 5.2 }, { x: 28, y: 68, r: 10, s: 6.9 },
    ].map((b) => ({ ...b, d: wobble(b.x, b.y, b.r, b.s, 2.6) })),
    []
  );
  return (
    <>
      <Plate />
      {bits.map((b, i) => (
        <g key={i}>
          <path d={b.d} fill="#e08a2c" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <g fill="#a85b17">
            <circle cx={b.x - 4} cy={b.y - 2} r="1.3" /><circle cx={b.x + 4} cy={b.y + 3} r="1.2" /><circle cx={b.x + 2} cy={b.y - 5} r="1" />
          </g>
          <circle cx={b.x - 3} cy={b.y + 4} r="1" fill="#3c9a3c" />
        </g>
      ))}
      {/* bitten piece showing paneer */}
      <rect x="40" y="58" width="11" height="10" rx="2" fill="#fffaf0" stroke={INK} strokeWidth="2" transform="rotate(-10 45 63)" />
      <Bowl kind="chutney" x={78} y={80} />
      <Steam xs={[38, 52, 66]} y={24} />
    </>
  );
}

/* ---------- drinks ---------- */
function Chiya() {
  return (
    <>
      <ellipse cx="50" cy="80" rx="40" ry="11" fill="#fff" stroke={INK} strokeWidth={SW} />
      <ellipse cx="50" cy="79" rx="26" ry="6" fill="none" stroke="#e8dfcc" strokeWidth="2" />
      <circle cx="18" cy="74" r="9" fill="#e9b45f" stroke={INK} strokeWidth="2.5" />
      <g fill="#a86a22"><circle cx="15" cy="72" r="1" /><circle cx="20" cy="71" r="1" /><circle cx="18" cy="76" r="1" /><circle cx="22" cy="75" r="1" /></g>
      <path d="M72 50 q14 2 10 14 q-3 7 -12 5" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M72 50 q14 2 10 14 q-3 7 -12 5" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M26 44 L74 44 L70 74 Q50 82 30 74 Z" fill="#fff" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M27.4 54 L72.6 54 L71.6 61 L28.4 61 Z" fill="var(--chilli)" />
      <ellipse cx="50" cy="44" rx="24" ry="6" fill="#b9824f" stroke={INK} strokeWidth={SW} />
      <ellipse cx="44" cy="43" rx="7" ry="1.8" fill="#d8a676" />
      <Steam xs={[38, 50, 62]} y={34} />
    </>
  );
}

function LemonMint() {
  return (
    <>
      <ellipse cx="50" cy="90" rx="22" ry="5" fill="rgba(42,20,6,0.15)" />
      <path d="M44 3 L50 62" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <path d="M44 3 L50 62" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M44 3 L50 62" stroke="var(--chilli)" strokeWidth="3.6" strokeDasharray="4 4" />
      <path d="M28 18 L72 18 L65 88 L35 88 Z" fill="#eef9ff" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M29.4 30 L70.6 30 L65 86 L35 86 Z" fill="#d8ee7a" opacity="0.95" />
      {[[40, 42, 12], [56, 50, -18], [44, 62, 30]].map(([x, y, r], i) => (
        <rect key={i} x={x - 6} y={y - 6} width="12" height="12" rx="2.5" fill="#fff" opacity="0.8" stroke="#8ccbe8" strokeWidth="1.5" transform={`rotate(${r} ${x} ${y})`} />
      ))}
      <g fill="#3c9a3c" stroke={INK} strokeWidth="1.5">
        <path d="M34 30 q-6 -10 4 -14 q4 8 -4 14Z" />
        <path d="M40 30 q2 -12 12 -10 q-2 9 -12 10Z" />
      </g>
      <g>
        <circle cx="70" cy="22" r="11" fill="#ffe14d" stroke={INK} strokeWidth={SW} />
        <circle cx="70" cy="22" r="7.5" fill="#fff3a6" />
        <g stroke="#e8c22c" strokeWidth="1.4">
          <path d="M70 15 L70 29" /><path d="M63 22 L77 22" /><path d="M65 17 L75 27" /><path d="M75 17 L65 27" />
        </g>
      </g>
      <path d="M33 34 L36 80" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </>
  );
}

function SoftDrinks() {
  const cans: [number, string, number][] = [[12, "#b3121c", -7], [39, "#1f9e4a", 0], [66, "#f28a1a", 7]];
  return (
    <>
      <ellipse cx="50" cy="88" rx="44" ry="6" fill="rgba(42,20,6,0.15)" />
      {cans.map(([x, c, r], i) => (
        <g key={i} transform={`rotate(${r} ${x + 11} 84)`}>
          <rect x={x} y="28" width="22" height="56" rx="5" fill={c} stroke={INK} strokeWidth={SW} />
          <path d={`M${x} 52 q5.5 -6 11 0 q5.5 6 11 0 L${x + 22} 60 q-5.5 6 -11 0 q-5.5 -6 -11 0Z`} fill="#fff" opacity="0.9" />
          <ellipse cx={x + 11} cy="28" rx="11" ry="3.5" fill="#d9d9d9" stroke={INK} strokeWidth="2.5" />
          <rect x={x + 7} y="25.5" width="8" height="3" rx="1.5" fill="#a9a9a9" stroke={INK} strokeWidth="1" />
          <path d={`M${x + 4} 36 L${x + 4} 76`} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
        </g>
      ))}
      <g fill="#fff" stroke={INK} strokeWidth="1.2">
        <circle cx="30" cy="16" r="3" /><circle cx="52" cy="10" r="2.2" /><circle cx="72" cy="16" r="2.6" />
      </g>
    </>
  );
}

/* ---------- covered dish, for sections without their own drawing ---------- */
function Cloche() {
  return (
    <>
      <Plate />
      <path d="M18 62 Q18 30 50 30 Q82 30 82 62 Z" fill="#d9dde3" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M28 52 Q30 38 44 35" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
      <rect x="14" y="60" width="72" height="6" rx="3" fill="#bfc5cd" stroke={INK} strokeWidth={SW} />
      <circle cx="50" cy="27" r="5" fill="#bfc5cd" stroke={INK} strokeWidth={SW} />
      <path d="M50 80 C42 74 44 68 50 72 C56 68 58 74 50 80Z" fill="var(--chilli)" stroke={INK} strokeWidth="1.8" />
      <Steam xs={[30, 70]} y={30} />
    </>
  );
}

const ART: Record<string, () => React.ReactElement> = {
  aloo: () => <Paratha filling="#f2c14e" side="achar" />,
  "aloo-cheese": () => <Paratha filling="#f2c14e" cheese side="dahi" />,
  "aloo-pyar": () => <Paratha filling="#f2c14e" hearts side="achar" />,
  paneer: () => <Paratha filling="#fff4dc" cubes side="dahi" />,
  chicken: () => <Paratha filling="#c8662d" shreds side="chutney" />,
  "chicken-cheese": () => <Paratha filling="#c8662d" shreds cheese side="achar" />,
  "veg-burger": () => <Burger />,
  "chicken-smash": () => <Burger smash />,
  "aloo-chop": () => <AlooChop />,
  "paneer-pakoda": () => <Pakoda />,
  chiya: () => <Chiya />,
  "lemon-mint": () => <LemonMint />,
  "soft-drink": () => <SoftDrinks />,
};

// New items without their own drawing get one that fits their section.
const FALLBACK: Record<string, () => React.ReactElement> = {
  paratha: () => <Paratha filling="#f2c14e" side="achar" />,
  burger: () => <Burger />,
  snacks: () => <Pakoda />,
  drinks: () => <Chiya />,
};

export function FoodPic({ item, className = "" }: { item: Item; className?: string }) {
  const draw = ART[item.id] || FALLBACK[item.cat] || Cloche;
  return (
    <div className={`food-pic cat-${item.cat} ${className}`}>
      {item.photo ? (
        <img src={item.photo} alt={item.name} loading="lazy" />
      ) : (
        <svg viewBox="0 0 100 100" role="img" aria-label={item.name}>
          {draw()}
        </svg>
      )}
    </div>
  );
}
