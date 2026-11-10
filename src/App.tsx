import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mascot, Bubble, type Mood } from "./Mascot";
import { FoodPic } from "./FoodArt";
import { AdminMenu } from "./AdminMenu";
import { DEMO_PASSWORD } from "./demo-password";
import { RESTAURANT, MENU, CATEGORIES, LINES, STATUS, BREAKING, CANCEL_REASONS, normStatus, pick, type Item, type StatusId } from "./data";
import { connectStore, session, type Store, type Order, type Cat, type MenuMeta, type TableLock } from "./store";
import { deviceIdentity, type Ident } from "./device";
import { CounterBar, AlarmOverlay, useUnseen, useAlarm } from "./CounterMode";

type TableState = "free" | "mine" | "busy";
const oneTableMsg = (held: number) =>
  `You already have an open order at Table ${held}. You can order for another table once Table ${held} is billed. Want more food? Add it to Table ${held}.`;
const numberMsg =
  "This mobile number already has an open order at another table. You can order for a new table once that one is billed, or ask the staff.";
const busyMsg = (n: number) =>
  `Table ${n} is booked by another phone. Ask that person to add your food from their phone, or pick a free table. It opens up again once their bill is paid.`;

type Screen = "home" | "who" | "menu" | "status" | "adminLogin" | "admin";
type Diner = { kind: "guest" | "customer"; name: string; phone: string; table: number };

// Which link this is: "customer" (the public ordering link), "admin" (the owner's Kitchen Boss link),
// or "both" (the Claude demo, which has everything on one page). Set on <div id="root" data-mode="...">.
const MODE: "customer" | "admin" | "both" = (() => {
  const m = document.getElementById("root")?.dataset.mode;
  return m === "customer" || m === "admin" ? m : "both";
})();

// table number from the QR code on the table: ...?t=5
const qrTable = (): number => {
  try {
    const n = Number(new URLSearchParams(location.search).get("t"));
    return Number.isInteger(n) && n >= 1 && n <= RESTAURANT.tables ? n : 0;
  } catch {
    return 0;
  }
};

const timeOf = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const dayOf = (t: number) => {
  const d = new Date(t);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() !== start.getFullYear() ? { year: "numeric" } : {}) });
};
const whenOf = (t: number) => `${dayOf(t)}, ${timeOf(t)}`;
const statusLabel = (s: StatusId) => (s === "cancelled" ? "Cancelled" : STATUS.find((x) => x.id === s)?.short || s);
const isOpen = (s: StatusId) => s !== "billed" && s !== "cancelled";
const normOrder = (o: Order): Order => ({ ...o, status: normStatus(o.status) });

const rs = (n: number) => `${RESTAURANT.currency} ${n.toLocaleString("en-IN")}`;
const ago = (t: number) => {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} hr ${m % 60} min ago`;
};
const reduced = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/* ------------------------------------------------------------------ */
/*  Small shared pieces                                                */
/* ------------------------------------------------------------------ */

function Ticker() {
  const text = BREAKING.join("   ✦   ");
  return (
    <div className="ticker" aria-label="Breaking news">
      <span className="ticker-tag">BREAKING</span>
      <div className="ticker-track">
        <span>{text}&nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;{text}</span>
      </div>
    </div>
  );
}

function Splats({ splats }: { splats: { id: number; x: number; y: number }[] }) {
  return (
    <>
      {splats.map((s) => (
        <span key={s.id} className="splat" style={{ left: s.x, top: s.y }} aria-hidden="true">
          <i /><i /><i /><i /><i />
        </span>
      ))}
    </>
  );
}

function ButterRain() {
  const cubes = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ i, l: Math.random() * 100, d: Math.random() * 0.9, r: Math.random() * 360, s: 10 + Math.random() * 14 })),
    []
  );
  if (reduced()) return null;
  return (
    <div className="rain" aria-hidden="true">
      {cubes.map((c) => (
        <span key={c.i} style={{ left: `${c.l}%`, animationDelay: `${c.d}s`, width: c.s, height: c.s * 0.75, transform: `rotate(${c.r}deg)` }} />
      ))}
    </div>
  );
}

function Spice({ n = 0 }: { n?: number }) {
  if (!n) return <span className="spice spice-0">no spice</span>;
  const label = ["", "mild", "spicy", "call fire brigade"][n];
  return (
    <span className={`spice spice-${n}`} title={label}>
      {"🌶".repeat(n)} <em>{label}</em>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Screens                                                            */
/* ------------------------------------------------------------------ */

function Home({
  say, mood, poke, bump, eat, boss, seatedAt, bossIn,
}: {
  say: string; mood: Mood; poke: () => void; bump: number; eat: () => void; boss: () => void; seatedAt: number; bossIn: boolean;
}) {
  return (
    <main className="home">
      <div className="hero">
        <div className="hero-stage">
          <Bubble text={say} side="right" />
          <Mascot mood={mood} size={230} onPoke={poke} bump={bump} />
        </div>
        <h1 className="brand">
          {RESTAURANT.name.split(" ").map((w, i) => (
            <span key={i} className={`brand-w brand-w${i}`}>{w}</span>
          ))}
        </h1>
        <p className="tagline">{RESTAURANT.tagline}</p>
      </div>

      <div className="doors">
        <button className="door door-eat" onClick={eat} id="btn-customer">
          <span className="door-kicker">Customer</span>
          <span className="door-title">I'm Hungry</span>
          <span className="door-sub">{seatedAt ? `Back to the menu for Table ${seatedAt}.` : qrTable() ? `You're at Table ${qrTable()}. Tap here and start ordering.` : "Name, number, table. Then start ordering."}</span>
        </button>
        {MODE !== "customer" && (
          <button className="door door-boss" onClick={boss} id="btn-admin">
            <span className="door-kicker">Admin</span>
            <span className="door-title">Kitchen Boss</span>
            <span className="door-sub">{bossIn ? "You're logged in. Back to the control room." : "Staff only. Uncles, please sit down."}</span>
          </button>
        )}
      </div>

      <ul className="rules">
        <li><b>Rule 1</b> No diet talk at the table.</li>
        <li><b>Rule 2</b> Extra butter is not extra. It is standard.</li>
        <li><b>Rule 3</b> If mummy asks, you ate salad.</li>
      </ul>
      <p className="hint">Psst. Tap the paratha.</p>
    </main>
  );
}

function TablePicker({ value, onPick, stateOf }: { value: number; onPick: (n: number) => void; stateOf: (n: number) => TableState }) {
  return (
    <div className="tables" role="radiogroup" aria-label="Table number">
      {Array.from({ length: RESTAURANT.tables }, (_, i) => i + 1).map((n) => {
        const st = stateOf(n);
        return (
          <button
            key={n}
            id={`table-${n}`}
            role="radio"
            aria-checked={value === n}
            aria-disabled={st === "busy"}
            className={`plate ${value === n ? "on" : ""} ${st}`}
            onClick={() => onPick(n)}
            type="button"
          >
            <span>{n}</span>
            {st !== "free" && <small>{st === "busy" ? "booked" : "yours"}</small>}
          </button>
        );
      })}
    </div>
  );
}

function WhoAreYou({
  onDone, back, setSay, stateOf, myTable,
}: {
  onDone: (d: Diner) => void; back: () => void; setSay: (s: string, m?: Mood) => void; stateOf: (n: number) => TableState; myTable: number;
}) {
  const saved = session.get<Diner | null>("lastDiner", null);
  const [name, setName] = useState(saved?.name || "");
  const [phone, setPhone] = useState(saved?.phone || "");
  const [table, setTable] = useState(myTable || qrTable());
  const [err, setErr] = useState("");


  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    // guests and customers both give a name and number
    if (name.trim().length < 2) return setErr("Name please. Even 'Hungry Bhai' works.");
    if (!/^9\d{9}$/.test(digits))
      return setErr(`Phone numbers here have 10 digits starting with 9. Yours has ${digits.length}. Suspicious.`);
    if (!table) return setErr("Which table? We can't throw parathas randomly. Pick one.");
    if (stateOf(table) === "busy") return setErr(busyMsg(table));
    if (myTable && table !== myTable) return setErr(oneTableMsg(myTable));
    const d: Diner = { kind: "customer", name: name.trim(), phone: digits, table };
    session.set("lastDiner", d);
    onDone(d);
  };

  return (
    <main className="who">
      <button className="back" onClick={back} type="button">← Back</button>
      <h2 className="screen-title">Who's eating?</h2>

      <form className="sheet-form" onSubmit={submit} noValidate>
        <p className="guest-note">Your name, your number, your table. Then parathas.</p>
        {(
          <>
            <label htmlFor="f-name">Your name</label>
            <input id="f-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sita, or Hungry Bhai" autoComplete="name" />
            <label htmlFor="f-phone">Mobile number</label>
            <input id="f-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" inputMode="numeric" autoComplete="tel" maxLength={14} />
            <p className="fine">Only for your order. No spam. No "good morning" forwards. Promise.</p>
          </>
        )}


        <label>Your table</label>
        {(() => {
          const booked = Array.from({ length: RESTAURANT.tables }, (_, i) => i + 1).filter((n) => stateOf(n) === "busy");
          return (
            <p className="booked-line" id="booked-line">
              {booked.length === 0
                ? "All tables are free right now."
                : `Booked right now: ${booked.map((n) => `Table ${n}`).join(", ")}. Pick any other table.`}
            </p>
          );
        })()}
        <TablePicker
          value={table}
          stateOf={stateOf}
          onPick={(n) => {
            if (myTable && n !== myTable && stateOf(n) !== "busy") {
              setErr(oneTableMsg(myTable));
              setSay(`One table at a time, boss! You're at Table ${myTable}.`, "wink");
              return;
            }
            if (stateOf(n) === "busy") {
              setErr(busyMsg(n));
              setSay(`Table ${n} is taken by another phone. Ask them to add your food!`, "shock");
              return;
            }
            setTable(n);
            setErr("");
            setSay(stateOf(n) === "mine" ? `Table ${n} again! Add-ons coming up.` : `Table ${n}! Good seat. Butter reaches there fastest.`, "happy");
          }}
        />
        {table > 0 && stateOf(table) === "busy" && !err && <p className="err" role="alert">{busyMsg(table)}</p>}
        {myTable > 0 && <p className="fine">You have an open order at Table {myTable}, so that's your table until it's billed.</p>}

        {err && <p className="err" role="alert">{err}</p>}
        <button className="cta" type="submit" id="btn-start">Show me the menu →</button>
      </form>
    </main>
  );
}

function MenuScreen({
  diner, store, soldOut, onOrdered, onSay, addFx, items, cats, ident, tableBusy, myTable, changeTable,
}: {
  ident: Ident | null;
  tableBusy: boolean;
  myTable: number;
  changeTable: () => void;
  diner: Diner;
  store: Store;
  soldOut: string[];
  items: Item[];
  cats: Cat[];
  onOrdered: (id: string) => void;
  onSay: (s: string, m?: Mood) => void;
  addFx: (x: number, y: number) => void;
}) {
  const [cart, setCart] = useState<Record<string, number>>(() => session.get("cart", {}));
  // only sections that have food; food whose section was removed goes under "Other"
  const known = new Set(cats.map((c) => c.id));
  const shown: Cat[] = cats.filter((c) => items.some((m) => m.cat === c.id));
  if (items.some((m) => !known.has(m.cat))) shown.push({ id: "__other", label: "Other" });
  const inCat = (id: string) => items.filter((m) => (id === "__other" ? !known.has(m.cat) : m.cat === id));
  const [cat, setCat] = useState(shown[0]?.id || "");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [wiggle, setWiggle] = useState(0);
  const [sendErr, setSendErr] = useState("");
  const secRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => session.set("cart", cart), [cart]);

  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const lines = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({ item: items.find((m) => m.id === id)!, qty }))
    .filter((l) => l.item);
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);

  const add = (it: Item, e?: React.MouseEvent) => {
    setCart((c) => ({ ...c, [it.id]: (c[it.id] || 0) + 1 }));
    setWiggle((w) => w + 1);
    if (e) addFx(e.clientX, e.clientY);
    onSay(pick(it.special ? LINES.special : LINES.add), it.special ? "love" : "happy");
  };
  const dec = (id: string) =>
    setCart((c) => {
      const n = { ...c, [id]: Math.max(0, (c[id] || 0) - 1) };
      if (!n[id]) delete n[id];
      return n;
    });

  const act = (it: Item, idp = "") => {
    const q = cart[it.id] || 0;
    if (soldOut.includes(it.id)) return <span className="soldout">Khatam!<small>sold out</small></span>;
    if (q)
      return (
        <div className="qty">
          <button onClick={() => dec(it.id)} aria-label={`Remove one ${it.name}`} type="button">−</button>
          <b>{q}</b>
          <button onClick={(e) => add(it, e)} aria-label={`Add one more ${it.name}`} type="button">+</button>
        </div>
      );
    return <button className="add" onClick={(e) => add(it, e)} type="button" id={`add${idp}-${it.id}`}>ADD</button>;
  };
  const specials = items.filter((m) => m.special);

  const jump = (id: string) => {
    setCat(id);
    secRefs.current[id]?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  };

  const send = async () => {
    if (!lines.length) return;
    if (tableBusy) return setSendErr(busyMsg(diner.table));
    if (myTable && myTable !== diner.table) return setSendErr(oneTableMsg(myTable));
    if (!ident) return setSendErr("This browser can't place orders. Open the link in Chrome or Safari and try again.");
    // ask now (while the tap counts) so we can alert them if the cafe cancels or the food is ready
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    } catch {
      /* not supported here */
    }
    setSending(true);
    setSendErr("");
    try {
      const id = await store.addOrder({
        table: diner.table,
        kind: diner.kind,
        name: diner.name,
        phone: diner.phone,
        items: lines.map((l) => ({ id: l.item.id, name: l.item.name, qty: l.qty, price: l.item.price })),
        note: note.trim().slice(0, 200),
        total,
        status: "new",
        createdAt: Date.now(),
        device: ident!.id,
        key: ident!.key,
      });
      // save the empty cart right away: this screen closes before its save-on-change effect would run
      session.set("cart", {});
      setCart({});
      setNote("");
      setOpen(false);
      onOrdered(id);
    } catch (er) {
      const code = String((er as { code?: string })?.code || "");
      setSendErr(
        !code.includes("permission")
          ? "The order didn't reach the kitchen. Check your internet and tap Send again, or wave at the staff."
          : tableBusy
            ? busyMsg(diner.table)
            : myTable && myTable !== diner.table
              ? oneTableMsg(myTable)
              : numberMsg
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="menu">
      <nav className="cats" aria-label="Menu sections">
        {shown.map((c) => (
          <button key={c.id} className={cat === c.id ? "on" : ""} onClick={() => jump(c.id)} type="button">
            {c.label}
          </button>
        ))}
      </nav>

      {tableBusy && (
        <div className="busy-banner" role="alert">
          <b>Table {diner.table} is booked by another phone</b>
          <span>{busyMsg(diner.table)}</span>
          <button type="button" className="ghost small" onClick={changeTable}>Change my table</button>
        </div>
      )}

      {specials.length > 0 && (
        <section className="specials" aria-label="Today's specials">
          <h3>Today's specials <span>Mummy approved</span></h3>
          <div className="spec-row">
            {specials.map((it) => (
              <article key={it.id} className={`spec ${soldOut.includes(it.id) ? "out" : ""}`}>
                <FoodPic item={it} className="big" />
                <h4>{it.name}</h4>
                <div className="spec-foot">
                  <span className="price">{rs(it.price)}</span>
                  {act(it, "-sp")}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="menu-card">
        {shown.length === 0 && <p className="menu-end">The menu is empty right now. Ask the staff, they'll sort you out.</p>}
        {shown.map((c) => (
          <section key={c.id} ref={(el) => { secRefs.current[c.id] = el; }} className="menu-sec" id={`sec-${c.id}`}>
            <h3>{c.label}</h3>
            {inCat(c.id).map((it) => {
              const out = soldOut.includes(it.id);
              return (
                <article key={it.id} className={`dish ${out ? "out" : ""} ${it.special ? "special" : ""}`}>
                  <FoodPic item={it} />
                  <div className="dish-main">
                    <div className="dish-head">
                      {it.veg !== undefined && <span className={`vegdot ${it.veg ? "veg" : "nonveg"}`} title={it.veg ? "Veg" : "Non-veg"} />}
                      <h4>{it.name}</h4>
                    </div>
                    {it.special && <span className="stamp">MUMMY APPROVED</span>}
                    <p>{it.desc}</p>
                    <div className="dish-foot">
                      <div className="dish-meta">
                        <span className="price">{rs(it.price)}</span>
                        <Spice n={it.spice} />
                      </div>
                      <div className="dish-act">{act(it)}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ))}
        <p className="menu-end">That's the whole menu. Scroll up and order more. We'll wait.</p>
      </div>

      {count > 0 && (
        <button className="cartbar" key={wiggle} onClick={() => setOpen(true)} id="btn-cart" type="button">
          <span className="cartbar-n">{count}</span>
          <span className="cartbar-t">
            {count === 1 ? "1 item" : `${count} items`} · {rs(total)}
            <small>Table {diner.table}</small>
          </span>
          <span className="cartbar-go">View plate →</span>
        </button>
      )}

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-label="Your plate" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <h3>Your plate · Table {diner.table}</h3>
            {lines.length === 0 ? (
              <p className="empty">{LINES.empty[0]}</p>
            ) : (
              <ul className="plate-list">
                {lines.map((l) => (
                  <li key={l.item.id}>
                    <FoodPic item={l.item} className="tiny" />
                    <span className="pl-name">{l.item.name}</span>
                    <div className="qty small">
                      <button onClick={() => dec(l.item.id)} aria-label={`Remove one ${l.item.name}`} type="button">−</button>
                      <b>{l.qty}</b>
                      <button onClick={() => add(l.item)} aria-label={`Add one ${l.item.name}`} type="button">+</button>
                    </div>
                    <span className="pl-price">{rs(l.item.price * l.qty)}</span>
                  </li>
                ))}
              </ul>
            )}
            <label htmlFor="f-note">Note for the chef</label>
            <input id="f-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Less spicy, extra crispy, more butter (obviously)" maxLength={200} />
            <div className="sheet-total">
              <span>Total</span>
              <b>{rs(total)}</b>
            </div>
            <p className="fine">Pay at the counter after eating. Washing dishes is not an accepted payment method.</p>
            {sendErr && <p className="err" role="alert">{sendErr}</p>}
            <button className="cta" disabled={!lines.length || sending} onClick={send} id="btn-send" type="button">
              {sending ? "Sending to tawa…" : "Send order to kitchen 🔥"}
            </button>
            <button className="ghost" onClick={() => setOpen(false)} type="button">Keep browsing</button>
          </div>
        </div>
      )}
    </main>
  );
}

// Order prices come from the customer's phone, so compare them with the menu.
// Returns what looks wrong (and the menu total), or null when the bill is fine.
function billCheck(o: Order, menu: Item[]): { why: string; menuTotal: number } | null {
  let menuTotal = 0;
  let sum = 0;
  let priceOdd = false;
  let qtyOdd = false;
  for (const l of o.items) {
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 50) qtyOdd = true;
    const m = menu.find((x) => x.id === l.id);
    if (m && m.price !== l.price) priceOdd = true;
    sum += l.qty * l.price;
    menuTotal += l.qty * (m ? m.price : l.price);
  }
  if (sum !== o.total) priceOdd = true;
  if (priceOdd) return { why: "this order's prices don't match your menu", menuTotal };
  if (qtyOdd) return { why: "this order has an unusually large quantity", menuTotal };
  return null;
}

function Steps({ status }: { status: StatusId }) {
  const i = STATUS.findIndex((x) => x.id === status);
  return (
    <ol className="steps">
      {STATUS.map((x, k) => (
        <li key={x.id} className={k < i ? "done" : k === i ? "now" : ""}>
          <span className="dot" />
          {x.label}
        </li>
      ))}
    </ol>
  );
}

function OrderCard({ o, big }: { o: Order; big?: boolean }) {
  return (
    <section className={`track ${o.status === "cancelled" ? "is-cancelled" : ""} ${!big && !isOpen(o.status) ? "is-done" : ""}`}>
      <header>
        <div className="track-when">
          <b>{timeOf(o.createdAt)}</b>
          <span>{dayOf(o.createdAt)} · Table {o.table}</span>
        </div>
        <span className={`pill p-${o.status}`}>{statusLabel(o.status)}</span>
      </header>
      {o.status === "cancelled" ? (
        <div className="cancel-box" role="status">
          <b>Cancelled by the cafe{o.cancelledAt ? ` at ${timeOf(o.cancelledAt)}` : ""}</b>
          {o.cancelReason && <span>Reason: {o.cancelReason}</span>}
          <span>You won't be charged for this order. Questions? Wave at the staff.</span>
        </div>
      ) : (
        isOpen(o.status) && <Steps status={o.status} />
      )}
      <ul className="mini">
        {o.items.map((l) => (
          <li key={l.id}><span>{l.qty}× {l.name}</span><span>{rs(l.qty * l.price)}</span></li>
        ))}
        <li className="mini-total"><span>Total</span><span>{rs(o.total)}</span></li>
      </ul>
    </section>
  );
}

function MyOrders({
  ids, mine, more, justSent, canOrder,
}: {
  ids: string[];
  mine: Record<string, Order | null>;
  more: () => void;
  justSent: boolean;
  canOrder: boolean;
}) {
  const list = ids.map((id) => mine[id]).filter(Boolean) as Order[];
  list.sort((a, b) => b.createdAt - a.createdAt);
  const loading = ids.some((id) => mine[id] === undefined);
  const latest = list[0];
  const open = list.filter((o) => isOpen(o.status));
  const idx = latest ? STATUS.findIndex((x) => x.id === latest.status) : 0;
  const line = !latest
    ? "Finding your orders…"
    : latest.status === "cancelled"
      ? "Oh no. Your latest order was cancelled. The staff can sort it out."
      : STATUS[Math.max(0, idx)].line;

  // group finished orders by day
  const past = list.filter((o) => !isOpen(o.status));
  const days: { day: string; orders: Order[] }[] = [];
  for (const o of past) {
    const d = dayOf(o.createdAt);
    const g = days.find((x) => x.day === d);
    if (g) g.orders.push(o);
    else days.push({ day: d, orders: [o] });
  }

  return (
    <main className="status">
      {justSent && <ButterRain />}
      {justSent && <h2 className="shout">ORDER SENT<br />TO TAWA!</h2>}
      <div className="status-mascot">
        <Mascot mood={latest?.status === "cancelled" ? "sad" : idx >= 3 ? "love" : idx >= 2 ? "shock" : "happy"} size={130} />
        <Bubble text={line} side="right" />
      </div>

      <h2 className="screen-title tight">My orders <small>{list.length}</small></h2>
      {list.length === 0 && (
        <p className="fine center">{loading ? "Loading your orders…" : "No orders on this phone yet. Your orders will show up here with date and time."}</p>
      )}

      {open.length > 0 && (
        <>
          <h3 className="day">In the kitchen now</h3>
          {open.map((o) => <OrderCard key={o.id} o={o} big />)}
        </>
      )}
      {days.map((g) => (
        <div key={g.day} className="day-group">
          <h3 className="day">{g.day}</h3>
          {g.orders.map((o) => <OrderCard key={o.id} o={o} />)}
        </div>
      ))}

      <button className="cta" onClick={more} id="btn-more" type="button">
        {canOrder ? "Order more (you know you want to)" : "Start a new order"}
      </button>
    </main>
  );
}

function AlertBar({ alerts, close, see }: { alerts: Alert[]; close: (k: number) => void; see: () => void }) {
  if (!alerts.length) return null;
  return (
    <div className="alerts" aria-live="assertive">
      {alerts.map((a) => (
        <div key={a.key} className={`alert alert-${a.kind}`} role="alert">
          <b>{a.kind === "cancelled" ? "Order cancelled" : a.kind === "accepted" ? "Order accepted!" : "Table billed. Thank you!"}</b>
          <span>{a.text}</span>
          <div className="alert-act">
            <button type="button" onClick={() => { see(); close(a.key); }}>See my orders</button>
            <button type="button" onClick={() => close(a.key)} aria-label="Dismiss">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

type Alert = { key: number; id: string; kind: "cancelled" | "accepted" | "billed"; text: string };

function AdminLogin({ back, ok, onSay, store }: { back?: () => void; ok: () => void; onSay: (s: string, m?: Mood) => void; store: Store | null }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [shake, setShake] = useState(0);
  const real = !!store?.adminAuth;
  const fail = (l: string) => {
    setErr(l);
    setShake((s) => s + 1);
    onSay(l, "shock");
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (real) {
      setBusy(true);
      setErr("");
      try {
        await store!.adminAuth!.signIn(email, pw);
        session.set("admin", true);
        ok();
      } catch (er) {
        const code = String((er as { code?: string })?.code || "");
        if (code.includes("network")) fail("No internet. The tawa can't hear you. Check the connection and try again.");
        else if (code.includes("too-many")) fail("Too many wrong tries. Wait a few minutes, then try again.");
        else fail(pick(LINES.wrongPass));
      } finally {
        setBusy(false);
      }
      return;
    }
    const norm = (x: string) => x.replace(/\s+/g, "").toLowerCase();
    if (DEMO_PASSWORD && norm(pw) === norm(DEMO_PASSWORD)) {
      session.set("admin", true);
      ok();
    } else fail(pick(LINES.wrongPass));
  };
  return (
    <main className="who">
      {back && <button className="back" onClick={back} type="button">← Back</button>}
      <h2 className="screen-title">Kitchen Boss</h2>
      <p className="guest-note">{LINES.admin[0]}</p>
      <form className={`sheet-form ${shake ? "shake" : ""}`} key={shake} onSubmit={submit}>
        {real && (
          <>
            <label htmlFor="f-email">Email</label>
            <input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="owner@example.com" />
          </>
        )}
        <label htmlFor="f-pw">Password</label>
        <div className="pw-row">
          <input id="f-pw" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="••••••••" />
          <button type="button" className="ghost small" onClick={() => setShow((v) => !v)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="cta boss" type="submit" id="btn-login" disabled={busy}>{busy ? "Checking…" : "Enter the kitchen"}</button>
      </form>
    </main>
  );
}

function Admin({
  store, soldOut, logout, items, cats, onSave, onDelete, locks,
}: {
  locks: Record<string, TableLock>;
  store: Store;
  soldOut: string[];
  logout: () => void;
  items: Item[];
  cats: Cat[];
  onSave: (it: Item, newCat?: Cat) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"orders" | "tables" | "menu">("orders");
  const [filter, setFilter] = useState<StatusId | "active" | "all">("active");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<{ id: string; reason: string; other: string } | null>(null);
  const [actErr, setActErr] = useState("");
  const [, tick] = useState(0);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);

  useEffect(() => store.onOrders((list) => setOrders(list.map(normOrder))), [store]);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // ding when a new order arrives
  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));
    if (seen.current) {
      const nu = orders.filter((o) => !seen.current!.has(o.id)).map((o) => o.id);
      if (nu.length) {
        setFresh(nu);
        setTimeout(() => setFresh([]), 4000);
      }
    }
    seen.current = ids;
  }, [orders]);

  // counter mode: ring until someone taps Seen
  const { unseen, ack } = useUnseen(orders);
  useAlarm(unseen);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todays = orders.filter((o) => o.createdAt >= today.getTime() && o.status !== "cancelled");
  const active = orders.filter((o) => isOpen(o.status));
  const sales = todays.reduce((s, o) => s + o.total, 0);

  const shown = orders
    .filter((o) => (filter === "all" ? true : filter === "active" ? isOpen(o.status) : o.status === filter))
    .sort((a, b) => (filter === "active" || filter === "new" || filter === "accepted" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));

  const setTo = (o: Order, to: StatusId) =>
    store
      .setStatus(o.id, to)
      .then(() => (to === "billed" ? releaseIfDone(o.table, o.id) : undefined))
      .catch(() => setActErr("Couldn't update. Check the internet and try again."));
  // bill everything accepted at one table, then the table opens for other people
  const billTable = async (t: number) => {
    const list = orders.filter((x) => x.table === t && x.status === "accepted");
    try {
      for (const x of list) await store.setStatus(x.id, "billed");
      const stillOpen = orders.some((x) => x.table === t && x.status === "new");
      if (!stillOpen && locks[String(t)]?.holder) await store.freeTable(t);
    } catch {
      setActErr("Couldn't bill the table. Check the internet and try again.");
    }
  };
  // the phone that ordered first keeps the table until its last open order is served or cancelled
  const releaseIfDone = async (table: number, closedId: string) => {
    const stillOpen = orders.some((x) => x.table === table && x.id !== closedId && isOpen(x.status));
    if (!stillOpen && locks[String(table)]?.holder) await store.freeTable(table).catch(() => {});
  };
  const [freeAsk, setFreeAsk] = useState(0);
  const doCancel = async () => {
    if (!cancelling) return;
    const reason = (cancelling.reason === "Other" ? cancelling.other.trim() : cancelling.reason).slice(0, 80);
    try {
      await store.cancelOrder(cancelling.id, reason);
      const co = orders.find((x) => x.id === cancelling.id);
      if (co) await releaseIfDone(co.table, co.id);
      setCancelling(null);
      setActErr("");
    } catch {
      setActErr("Couldn't cancel. Check the internet and try again.");
    }
  };

  const toggleSold = (id: string) => {
    const n = soldOut.includes(id) ? soldOut.filter((x) => x !== id) : [...soldOut, id];
    store.setSoldOut(n).catch(() => {});
  };

  return (
    <main className="admin">
      <header className="admin-head">
        <div>
          <span className="eyebrow">Kitchen Boss</span>
          <h2>Control room</h2>
        </div>
        <button className="ghost small" onClick={logout} type="button">Log out</button>
      </header>
      <CounterBar />
      {unseen.length > 0 && (
        <AlarmOverlay
          orders={unseen}
          onSeen={() => {
            ack(unseen.map((o) => o.id));
            setTab("orders");
            setFilter("new");
            try {
              window.scrollTo({ top: 0 });
            } catch {
              /* ignore */
            }
          }}
        />
      )}

      <div className="stats">
        <div><b>{active.filter((o) => o.status === "new").length}</b><span>new</span></div>
        <div><b>{active.length}</b><span>in progress</span></div>
        <div><b>{todays.length}</b><span>orders today</span></div>
        <div><b>{rs(sales)}</b><span>sales today</span></div>
      </div>

      <div className="seg seg-3" role="tablist">
        {(["orders", "tables", "menu"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)} type="button" id={`tab-${t}`}>
            {t === "orders" ? "Orders" : t === "tables" ? "Tables" : "Menu"}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <>
          <div className="chips">
            {([["active", "Active"], ["new", "New"], ["accepted", "Accepted"], ["billed", "Billed"], ["cancelled", "Cancelled"], ["all", "All"]] as const).map(([k, l]) => (
              <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)} type="button">
                {l}
                <small>{k === "all" ? orders.length : k === "active" ? active.length : orders.filter((o) => o.status === k).length}</small>
              </button>
            ))}
          </div>

          {shown.length === 0 && (
            <div className="empty-admin">
              <Mascot mood="sad" size={110} />
              <p>{filter === "active" ? "No active orders. The tawa is lonely. When a customer orders, it pops up here with a ding." : filter === "cancelled" ? "No cancelled orders. Cancelled orders stay here as a record." : "Nothing here yet."}</p>
            </div>
          )}

          {actErr && <p className="err" role="alert">{actErr}</p>}
          <div className="tickets">
            {shown.map((o) => (
              <article key={o.id} className={`ticket st-${o.status} ${fresh.includes(o.id) ? "fresh" : ""}`}>
                <div className="ticket-top">
                  <span className="tno">T{o.table}</span>
                  <div className="who-line">
                    <b>{o.name || "Guest"}{o.kind === "guest" && <small className="guest-tag">guest</small>}</b>
                    {o.phone && <span className="mono">{o.phone}</span>}
                    <span className="time">{whenOf(o.createdAt)} · {ago(o.createdAt)}</span>
                  </div>
                  <span className={`pill p-${o.status}`}>{statusLabel(o.status)}</span>
                </div>
                <ul className="mini">
                  {o.items.map((l) => (
                    <li key={l.id}><span><b>{l.qty}×</b> {l.name}</span><span>{rs(l.qty * l.price)}</span></li>
                  ))}
                  <li className="mini-total"><span>Total</span><span>{rs(o.total)}</span></li>
                </ul>
                {o.note && <p className="chef-note">Note: {o.note}</p>}
                {(() => {
                  const chk = billCheck(o, items);
                  return chk === null ? null : (
                    <p className="price-warn" role="alert">
                      ⚠ Check the bill: {chk.why}. Menu total is <b>{rs(chk.menuTotal)}</b>.
                    </p>
                  );
                })()}
                {o.status === "cancelled" && (
                  <p className="cancel-note">
                    Cancelled{o.cancelledAt ? ` ${whenOf(o.cancelledAt)}` : ""}{o.cancelReason ? ` · ${o.cancelReason}` : ""}
                  </p>
                )}
                {cancelling?.id === o.id ? (
                  <div className="cancel-panel">
                    <b>Why cancel? The customer will see this.</b>
                    <div className="chips wrap">
                      {[...CANCEL_REASONS, "Other"].map((r) => (
                        <button key={r} type="button" className={cancelling.reason === r ? "on" : ""} onClick={() => setCancelling({ ...cancelling, reason: r })}>{r}</button>
                      ))}
                    </div>
                    {cancelling.reason === "Other" && (
                      <input id={`f-cancel-${o.id}`} value={cancelling.other} onChange={(e) => setCancelling({ ...cancelling, other: e.target.value })} maxLength={80} placeholder="Type the reason" aria-label="Cancel reason" />
                    )}
                    <div className="ticket-act">
                      <button className="ghost small" type="button" onClick={() => setCancelling(null)}>Keep order</button>
                      <button className="ghost small danger" type="button" onClick={doCancel} id={`confirm-cancel-${o.id}`}>Cancel this order</button>
                    </div>
                  </div>
                ) : (
                  <div className="ticket-act">
                    {o.status === "cancelled" ? (
                      <>
                        <button className="ghost small" onClick={() => store.setStatus(o.id, "new").catch(() => setActErr("Couldn't restore. Try again."))} type="button">Restore order</button>
                        {confirm === o.id ? (
                          <button className="ghost small danger" onClick={() => { store.removeOrder(o.id).catch(() => {}); setConfirm(null); }} type="button">Tap again: delete forever</button>
                        ) : (
                          <button className="ghost small" onClick={() => setConfirm(o.id)} type="button">Delete forever</button>
                        )}
                      </>
                    ) : (
                      <>
                        {o.status === "new" && (
                          <>
                            <button className="ghost small danger-outline" onClick={() => setCancelling({ id: o.id, reason: CANCEL_REASONS[0], other: "" })} type="button" id={`cancel-${o.id}`}>Cancel</button>
                            <button className="cta small" onClick={() => setTo(o, "accepted")} type="button" id={`accept-${o.id}`}>Accept</button>
                          </>
                        )}
                        {o.status === "accepted" && (
                          <button className="cta small bill" onClick={() => setTo(o, "billed")} type="button" id={`bill-${o.id}`}>Billed · {rs(o.total)}</button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>

        </>
      )}

      {tab === "tables" && (
        <div className="table-grid">
          {Array.from({ length: RESTAURANT.tables }, (_, i) => i + 1).map((t) => {
            const at = active.filter((o) => o.table === t);
            const bill = orders.filter((o) => o.table === t && o.createdAt >= today.getTime() && o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
            const worst = at.find((o) => o.status === "new") ? "new" : at.length ? "cooking" : "free";
            const toBill = at.filter((o) => o.status === "accepted");
            const toBillSum = toBill.reduce((n, o) => n + o.total, 0);
            const lock = locks[String(t)];
            const held = !!lock?.holder;
            return (
              <div key={t} className={`tbl tbl-${worst} ${held ? "held" : ""}`}>
                <button type="button" className="tbl-main" onClick={() => { setTab("orders"); setFilter("all"); }}>
                  <span className="tbl-n">{t}</span>
                  <span className="tbl-s">{worst === "free" ? "Free" : `${at.length} active`}</span>
                  <span className="tbl-b">{bill ? rs(bill) : "—"}</span>
                </button>
                {toBill.length > 0 && (
                  <button type="button" className="tbl-bill" onClick={() => billTable(t)} id={`billtable-${t}`}>
                    Bill table · {rs(toBillSum)}
                  </button>
                )}
                {held && (
                  <>
                    <span className="tbl-lock">🔒 1 phone · {timeOf(lock.since)}</span>
                    <button
                      type="button"
                      className={`tbl-free ${freeAsk === t ? "danger" : ""}`}
                      onClick={() => {
                        if (freeAsk !== t) return setFreeAsk(t);
                        store.freeTable(t).catch(() => setActErr("Couldn't free the table. Try again."));
                        setFreeAsk(0);
                      }}
                      id={`free-${t}`}
                    >
                      {freeAsk === t ? "Tap again" : "Free table"}
                    </button>
                  </>
                )}
              </div>
            );
          })}
          <p className="fine span-all">
            Amount = everything that table ordered today. Collect it at the counter. 🔒 means only the phone that ordered first can order for that table.
            It frees up by itself when its last order is billed or cancelled. Use <b>Free table</b> if those guests have left.
          </p>
        </div>
      )}

      {tab === "menu" && (
        <AdminMenu items={items} cats={cats} soldOut={soldOut} onToggleSold={toggleSold} onSave={onSave} onDelete={onDelete} />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  App shell                                                          */
/* ------------------------------------------------------------------ */

export default function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [screen, setScreen] = useState<Screen>(() => {
    if (MODE === "admin") return session.get("admin", false) ? "admin" : "adminLogin";
    if (MODE === "both" && session.get("admin", false)) return "admin";
    return session.get<Diner | null>("diner", null) ? "menu" : "home";
  });
  const [diner, setDiner] = useState<Diner | null>(() => {
    const d = session.get<Diner | null>("diner", null);
    const t = qrTable();
    if (d && t && d.table !== t) {
      const moved = { ...d, table: t };
      session.set("diner", moved);
      return moved;
    }
    return d;
  });
  // every order placed on this phone (kept after Exit, so My orders shows the full history)
  const [myOrders, setMyOrders] = useState<string[]>(() => session.get<string[]>("history", session.get<string[]>("orders", [])));
  const [mine, setMine] = useState<Record<string, Order | null>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [justSent, setJustSent] = useState(false);
  const [soldOut, setSoldOut] = useState<string[]>([]);
  const [locks, setLocks] = useState<Record<string, TableLock> | null>(null); // null until first loaded
  const [ident, setIdent] = useState<Ident | null>(null);
  useEffect(() => {
    if (MODE === "admin") return;
    deviceIdentity().then(setIdent).catch(() => setIdent(null));
  }, []);
  // the one table this phone currently holds (0 = none)
  const myTable = (() => {
    if (!locks || !ident) return 0;
    const mine = Object.entries(locks).filter(([, l]) => l.holder === ident.id).map(([t]) => Number(t));
    return mine.length ? (diner && mine.includes(diner.table) ? diner.table : mine[0]) : 0;
  })();
  const stateOf = (n: number): TableState => {
    const h = locks?.[String(n)]?.holder;
    if (!h || !ident) return "free"; // until this phone's key has loaded, don't show anything as taken
    return ident && h === ident.id ? "mine" : "busy";
  };
  const [say, setSayText] = useState("Namaste! I'm a paratha. I can talk. Don't make it weird.");
  const [mood, setMood] = useState<Mood>("shock");
  const [bump, setBump] = useState(0);
  const [splats, setSplats] = useState<{ id: number; x: number; y: number }[]>([]);
  const [exitAsk, setExitAsk] = useState(false);
  const [bubbleOn, setBubbleOn] = useState(true);
  const bubbleTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    connectStore().then(setStore);
  }, []);
  useEffect(() => {
    if (MODE !== "admin") return;
    try {
      navigator.serviceWorker
        ?.register(`${import.meta.env.BASE_URL}kitchen-boss/sw.js`, { scope: `${import.meta.env.BASE_URL}kitchen-boss/` })
        .catch(() => {});
    } catch {
      /* not supported */
    }
  }, []);
  useEffect(() => (store ? store.onKitchen((k) => setSoldOut(k.soldOut)) : undefined), [store]);
  useEffect(() => (store ? store.onTables(setLocks) : undefined), [store]);

  // follow my orders live
  useEffect(() => {
    if (!store) return;
    const offs = myOrders.map((id) => store.onOrder(id, (o) => setMine((p) => ({ ...p, [id]: o ? normOrder(o) : o }))));
    return () => offs.forEach((f) => f());
  }, [store, myOrders.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // alert when the cafe cancels an order or the food is ready (also after reopening the site)
  useEffect(() => {
    const seen = session.get<Record<string, string>>("seen", {});
    let changed = false;
    const fresh: Alert[] = [];
    for (const o of Object.values(mine)) {
      if (!o || seen[o.id] === o.status) continue;
      const before = seen[o.id];
      seen[o.id] = o.status;
      changed = true;
      // only alert on a change this phone saw happen (no alerts for old orders on first load)
      if (before !== undefined && (o.status === "cancelled" || o.status === "accepted")) {
        fresh.push({
          key: Date.now() + Math.random(),
          id: o.id,
          kind: o.status,
          text:
            o.status === "cancelled"
              ? `Your ${timeOf(o.createdAt)} order (Table ${o.table}, ${rs(o.total)}) was cancelled${o.cancelReason ? `: ${o.cancelReason}` : ""}. You won't be charged.`
              : `Your ${timeOf(o.createdAt)} order for Table ${o.table} was accepted. It's being made now!`,
        });
      }
    }
    if (changed) session.set("seen", seen);
    if (!fresh.length) return;
    setAlerts((a) => [...a, ...fresh]);
    const cancelled = fresh.some((f) => f.kind === "cancelled");
    speak(cancelled ? "Oh no! An order was cancelled. Check My orders." : "Accepted! Your food is being made.", cancelled ? "sad" : "love");
    try {
      navigator.vibrate?.(cancelled ? [300, 120, 300] : [120, 80, 120]);
    } catch {
      /* ignore */
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ac = new AC();
      (cancelled ? [660, 440] : [880, 1320]).forEach((f, i) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.15, ac.currentTime + i * 0.2);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.2 + 0.35);
        o.connect(g).connect(ac.destination);
        o.start(ac.currentTime + i * 0.2);
        o.stop(ac.currentTime + i * 0.2 + 0.35);
      });
    } catch {
      /* no sound */
    }
    try {
      if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
        for (const f of fresh) new Notification(f.kind === "cancelled" ? `${RESTAURANT.name}: order cancelled` : `${RESTAURANT.name}: order accepted`, { body: f.text, tag: f.id });
      }
    } catch {
      /* phone doesn't allow it */
    }
  }, [mine]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the owner bills a table (or frees it), the phone seated there is logged out of that table.
  useEffect(() => {
    if (MODE === "admin" || !locks || !ident) return;
    const held = session.get<number[]>("held", []);
    const stillMine = held.filter((t) => locks[String(t)]?.holder === ident.id);
    if (stillMine.length === held.length) return;
    session.set("held", stillMine);
    if (diner && held.includes(diner.table) && !stillMine.includes(diner.table)) {
      const t = diner.table;
      session.clear("diner");
      session.clear("cart");
      setDiner(null);
      setExitAsk(false);
      setScreen("home");
      setAlerts((a) => [
        ...a,
        { key: Date.now(), id: `billed-${t}`, kind: "billed", text: `Table ${t} has been billed and you're logged out of it. Thanks for eating at ${RESTAURANT.name}! Your orders stay in My orders.` },
      ]);
      speak(`Bye bye Table ${t}! Come back hungry.`, "love");
    }
  }, [locks, ident]); // eslint-disable-line react-hooks/exhaustive-deps

  // the menu: built-in from data.ts until the admin edits it, then the saved one
  const [menuDocs, setMenuDocs] = useState<Item[]>([]);
  const [meta, setMeta] = useState<MenuMeta | null | undefined>(undefined);
  useEffect(() => (store ? store.onMenu(setMenuDocs) : undefined), [store]);
  useEffect(() => {
    if (!store) return;
    const t = window.setTimeout(() => setMeta((m) => (m === undefined ? null : m)), 4000);
    const off = store.onMenuMeta(setMeta);
    return () => { window.clearTimeout(t); off(); };
  }, [store]);
  const seeded = !!meta?.seeded;
  const items = useMemo<Item[]>(
    () => (seeded ? [...menuDocs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : MENU.map((m, i) => ({ ...m, order: i * 10 }))),
    [seeded, menuDocs]
  );
  const cats: Cat[] = seeded && meta?.cats?.length ? meta.cats : CATEGORIES;

  // first edit copies the built-in menu into the database, so every phone sees the same menu after
  const ensureSeeded = async (skip?: string) => {
    if (!store || seeded) return;
    for (const it of items) if (it.id !== skip) await store.saveItem(it);
    await store.setMenuMeta({ seeded: true, cats: [...cats] });
  };
  const saveFood = async (it: Item, newCat?: Cat) => {
    if (!store) return;
    await ensureSeeded();
    await store.saveItem(it);
    if (newCat) await store.setMenuMeta({ seeded: true, cats: [...cats, newCat] });
  };
  const deleteFood = async (id: string) => {
    if (!store) return;
    if (!seeded) await ensureSeeded(id);
    else await store.deleteItem(id);
    if (soldOut.includes(id)) await store.setSoldOut(soldOut.filter((x) => x !== id));
  };
  // with a real login, the admin screen follows the signed-in state
  const [adminOk, setAdminOk] = useState<boolean | null>(null);
  useEffect(() => (store?.adminAuth ? store.adminAuth.onUser(setAdminOk) : undefined), [store]);
  const bossIn = session.get("admin", false) && (!store?.adminAuth || adminOk === true);
  useEffect(() => {
    if (store?.adminAuth && adminOk === false && screen === "admin") {
      session.clear("admin");
      setScreen("adminLogin");
    }
  }, [store, adminOk, screen]);

  useEffect(() => {
    const t = setTimeout(() => setMood("happy"), 1800);
    return () => clearTimeout(t);
  }, []);

  const speak = useCallback((s: string, m: Mood = "happy") => {
    setSayText(s);
    setMood(m);
    setBump((b) => b + 1);
    setBubbleOn(true);
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubbleOn(false), 4200);
  }, []);

  const go = (s: Screen) => {
    setScreen(s);
    setJustSent(false);
    if (s === "who") speak(pick(LINES.customer));
    if (s === "adminLogin") speak(LINES.admin[0], "wink");
    if (s === "home") speak(pick(LINES.idle));
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* ignore */
    }
  };

  const addFx = (x: number, y: number) => {
    if (reduced()) return;
    const id = Date.now() + Math.random();
    setSplats((s) => [...s, { id, x, y }]);
    setTimeout(() => setSplats((s) => s.filter((p) => p.id !== id)), 700);
    try {
      navigator.vibrate?.(20);
    } catch {
      /* ignore */
    }
  };

  const leave = () => {
    session.clear("diner");
    session.clear("cart");
    session.clear("admin");
    setDiner(null);
    setExitAsk(false);
    go("home");
  };

  const showMini = screen === "menu" || screen === "who" || screen === "adminLogin";

  return (
    <div className="app">
      <Ticker />
      <header className="topbar">
        <button
          className="logo"
          onClick={() => {
            setExitAsk(false);
            if (MODE === "admin") setScreen(bossIn ? "admin" : "adminLogin");
            else go("home");
          }}
          type="button"
          aria-label="Go to home page"
          id="btn-logo"
        >
          <Mascot mood="wink" size={34} />
          <span>{RESTAURANT.name}</span>
        </button>
        {diner && (screen === "menu" || screen === "status" || screen === "home") && (
          <div className="who-chip">
            <span>T{diner.table} · {(diner.name || "Guest").split(" ")[0]}</span>
            {exitAsk ? (
              <button onClick={leave} className="danger" type="button">Sure? Leave</button>
            ) : (
              <button onClick={() => setExitAsk(true)} type="button">Exit</button>
            )}
          </div>
        )}
        {myOrders.length > 0 && (screen === "menu" || screen === "home") && (
          <button className="track-btn" onClick={() => { setJustSent(false); setScreen("status"); }} type="button" id="btn-my-orders">My orders</button>
        )}
        {screen === "status" && diner && (
          <button className="track-btn" onClick={() => setScreen("menu")} type="button">Menu</button>
        )}
      </header>

      {screen !== "admin" && screen !== "adminLogin" && (
        <AlertBar alerts={alerts} close={(k) => setAlerts((a) => a.filter((x) => x.key !== k))} see={() => { setAlerts([]); setJustSent(false); setScreen("status"); }} />
      )}
      {store?.mode === "local" && (screen === "admin" || screen === "status") && (
        <p className="demo-note">Demo mode: orders are saved on this phone only. Open the published link to share orders between phones.</p>
      )}

      {screen === "home" && (
        <Home
          say={say}
          mood={mood}
          bump={bump}
          poke={() => speak(pick(LINES.poke), Math.random() > 0.5 ? "shock" : "wink")}
          seatedAt={diner?.table || 0}
          bossIn={bossIn}
          eat={() => (diner ? setScreen("menu") : go("who"))}
          boss={() => (bossIn ? setScreen("admin") : go("adminLogin"))}
        />
      )}
      {screen === "who" && (
        <WhoAreYou
          stateOf={stateOf}
          myTable={myTable}
          back={() => go("home")}
          setSay={speak}
          onDone={(d) => {
            setDiner(d);
            session.set("diner", d);
            setScreen("menu");
            speak(`Namaste ${(d.name || "friend").split(" ")[0]}! Table ${d.table} is ready to eat.`, "love");
          }}
        />
      )}
      {screen === "menu" && diner && store && meta !== undefined && (
        <MenuScreen
          ident={ident}
          tableBusy={!!diner && stateOf(diner.table) === "busy"}
          myTable={myTable}
          changeTable={() => go("who")}
          items={items}
          cats={cats}
          diner={diner}
          store={store}
          soldOut={soldOut}
          onSay={speak}
          addFx={addFx}
          onOrdered={(id) => {
            const n = [...myOrders, id].slice(-40);
            setMyOrders(n);
            session.set("history", n);
            if (diner) session.set("held", Array.from(new Set([...session.get<number[]>("held", []), diner.table])));
            setJustSent(true);
            setScreen("status");
            try {
              window.scrollTo({ top: 0 });
            } catch {
              /* ignore */
            }
          }}
        />
      )}
      {screen === "menu" && (!store || meta === undefined) && <p className="fine center">Heating the tawa…</p>}
      {screen === "status" && store && (
        <MyOrders
          ids={myOrders}
          mine={mine}
          justSent={justSent}
          canOrder={!!diner}
          more={() => {
            setJustSent(false);
            if (diner) {
              setScreen("menu");
              speak("Round two! Respect.", "love");
            } else go("who");
          }}
        />
      )}
      {screen === "adminLogin" && MODE !== "customer" && (
        <AdminLogin store={store} back={MODE === "admin" ? undefined : () => go("home")} ok={() => setScreen("admin")} onSay={speak} />
      )}
      {screen === "admin" && MODE !== "customer" && store && (!store.adminAuth || adminOk) && (
        <Admin store={store} soldOut={soldOut} locks={locks || {}} items={items} cats={cats} onSave={saveFood} onDelete={deleteFood} logout={() => { store.adminAuth?.signOut().catch(() => {}); session.clear("admin"); if (MODE === "admin") setScreen("adminLogin"); else go("home"); }} />
      )}

      {showMini && (
        <div className={`mini-mascot ${screen === "menu" ? "raised" : ""}`}>
          {bubbleOn && <Bubble text={say} side="left" />}
          <Mascot mood={mood} size={72} bump={bump} onPoke={() => speak(pick(LINES.poke), "shock")} />
        </div>
      )}
      <Splats splats={splats} />
    </div>
  );
}
