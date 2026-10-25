import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mascot, Bubble, type Mood } from "./Mascot";
import { RESTAURANT, MENU, CATEGORIES, LINES, STATUS, BREAKING, pick, type Item, type StatusId } from "./data";
import { connectStore, session, type Store, type Order } from "./store";

type Screen = "home" | "who" | "menu" | "status" | "adminLogin" | "admin";
type Diner = { kind: "guest" | "customer"; name: string; phone: string; table: number };

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

function Home({ go, say, mood, poke, bump }: { go: (s: Screen) => void; say: string; mood: Mood; poke: () => void; bump: number }) {
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
        <button className="door door-eat" onClick={() => go("who")} id="btn-customer">
          <span className="door-kicker">Customer</span>
          <span className="door-title">I'm Hungry</span>
          <span className="door-sub">Guest or regular. Pick a table, start ordering.</span>
        </button>
        <button className="door door-boss" onClick={() => go("adminLogin")} id="btn-admin">
          <span className="door-kicker">Admin</span>
          <span className="door-title">Kitchen Boss</span>
          <span className="door-sub">Staff only. Uncles, please sit down.</span>
        </button>
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

function TablePicker({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  return (
    <div className="tables" role="radiogroup" aria-label="Table number">
      {Array.from({ length: RESTAURANT.tables }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          id={`table-${n}`}
          role="radio"
          aria-checked={value === n}
          className={`plate ${value === n ? "on" : ""}`}
          onClick={() => onPick(n)}
          type="button"
        >
          <span>{n}</span>
        </button>
      ))}
    </div>
  );
}

function WhoAreYou({ onDone, back, setSay }: { onDone: (d: Diner) => void; back: () => void; setSay: (s: string, m?: Mood) => void }) {
  const saved = session.get<Diner | null>("lastDiner", null);
  const [kind, setKind] = useState<"guest" | "customer">(saved?.kind || "customer");
  const [name, setName] = useState(saved?.name || "");
  const [phone, setPhone] = useState(saved?.phone || "");
  const [table, setTable] = useState(0);
  const [err, setErr] = useState("");

  const switchKind = (k: "guest" | "customer") => {
    setKind(k);
    setErr("");
    setSay(pick(k === "guest" ? LINES.guest : LINES.customer), k === "guest" ? "wink" : "happy");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (kind === "customer") {
      if (name.trim().length < 2) return setErr("Name please. Even 'Hungry Bhai' works.");
      if (!/^9\d{9}$/.test(digits))
        return setErr(`Phone numbers here have 10 digits starting with 9. Yours has ${digits.length}. Suspicious.`);
    }
    if (!table) return setErr("Which table? We can't throw parathas randomly. Pick one.");
    const d: Diner = { kind, name: kind === "guest" ? "" : name.trim(), phone: kind === "guest" ? "" : digits, table };
    session.set("lastDiner", d);
    onDone(d);
  };

  return (
    <main className="who">
      <button className="back" onClick={back} type="button">← Back</button>
      <h2 className="screen-title">Who's eating?</h2>

      <div className="seg" role="tablist">
        <button role="tab" aria-selected={kind === "customer"} className={kind === "customer" ? "on" : ""} onClick={() => switchKind("customer")} type="button">
          Customer
          <small>name + number</small>
        </button>
        <button role="tab" aria-selected={kind === "guest"} className={kind === "guest" ? "on" : ""} onClick={() => switchKind("guest")} type="button">
          Guest
          <small>just a table</small>
        </button>
      </div>

      <form className="sheet-form" onSubmit={submit} noValidate>
        {kind === "customer" && (
          <>
            <label htmlFor="f-name">Your name</label>
            <input id="f-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sita, or Hungry Bhai" autoComplete="name" />
            <label htmlFor="f-phone">Mobile number</label>
            <input id="f-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" inputMode="numeric" autoComplete="tel" maxLength={14} />
            <p className="fine">Only for your order. No spam. No "good morning" forwards. Promise.</p>
          </>
        )}
        {kind === "guest" && (
          <p className="guest-note">No name, no number. Just vibes and parathas. Pick where you're sitting.</p>
        )}

        <label>Your table</label>
        <TablePicker value={table} onPick={(n) => { setTable(n); setErr(""); setSay(`Table ${n}! Good seat. Butter reaches there fastest.`, "happy"); }} />

        {err && <p className="err" role="alert">{err}</p>}
        <button className="cta" type="submit" id="btn-start">Show me the menu →</button>
      </form>
    </main>
  );
}

function MenuScreen({
  diner, store, soldOut, onOrdered, onSay, addFx,
}: {
  diner: Diner;
  store: Store;
  soldOut: string[];
  onOrdered: (id: string) => void;
  onSay: (s: string, m?: Mood) => void;
  addFx: (x: number, y: number) => void;
}) {
  const [cart, setCart] = useState<Record<string, number>>(() => session.get("cart", {}));
  const [cat, setCat] = useState(CATEGORIES[0].id);
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
    .map(([id, qty]) => ({ item: MENU.find((m) => m.id === id)!, qty }))
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

  const jump = (id: string) => {
    setCat(id);
    secRefs.current[id]?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  };

  const send = async () => {
    if (!lines.length) return;
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
      });
      setCart({});
      setNote("");
      setOpen(false);
      onOrdered(id);
    } catch {
      setSendErr("The order didn't reach the kitchen. Check your internet and tap Send again, or wave at the staff.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="menu">
      <nav className="cats" aria-label="Menu sections">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={cat === c.id ? "on" : ""} onClick={() => jump(c.id)} type="button">
            {c.label}
          </button>
        ))}
      </nav>

      <div className="menu-card">
        {CATEGORIES.map((c) => (
          <section key={c.id} ref={(el) => { secRefs.current[c.id] = el; }} className="menu-sec" id={`sec-${c.id}`}>
            <h3>{c.label}</h3>
            {MENU.filter((m) => m.cat === c.id).map((it) => {
              const out = soldOut.includes(it.id);
              const q = cart[it.id] || 0;
              return (
                <article key={it.id} className={`dish ${out ? "out" : ""} ${it.special ? "special" : ""}`}>
                  <div className="dish-main">
                    <div className="dish-head">
                      {it.veg !== undefined && <span className={`vegdot ${it.veg ? "veg" : "nonveg"}`} title={it.veg ? "Veg" : "Non-veg"} />}
                      <h4>{it.name}</h4>
                      {it.special && <span className="stamp">MUMMY<br />APPROVED</span>}
                    </div>
                    <p>{it.desc}</p>
                    <div className="dish-meta">
                      <span className="price">{rs(it.price)}</span>
                      <Spice n={it.spice} />
                    </div>
                  </div>
                  <div className="dish-act">
                    {out ? (
                      <span className="soldout">Khatam!<small>sold out</small></span>
                    ) : q ? (
                      <div className="qty">
                        <button onClick={() => dec(it.id)} aria-label={`Remove one ${it.name}`} type="button">−</button>
                        <b>{q}</b>
                        <button onClick={(e) => add(it, e)} aria-label={`Add one more ${it.name}`} type="button">+</button>
                      </div>
                    ) : (
                      <button className="add" onClick={(e) => add(it, e)} type="button" id={`add-${it.id}`}>ADD</button>
                    )}
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

function StatusScreen({ store, ids, more, justSent }: { store: Store; ids: string[]; more: () => void; justSent: boolean }) {
  const [orders, setOrders] = useState<Record<string, Order | null>>({});
  useEffect(() => {
    const unsubs = ids.map((id) => store.onOrder(id, (o) => setOrders((p) => ({ ...p, [id]: o }))));
    return () => unsubs.forEach((u) => u());
  }, [store, ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = ids.map((id) => orders[id]).filter(Boolean) as Order[];
  const latest = list[list.length - 1];
  const idx = latest ? STATUS.findIndex((s) => s.id === latest.status) : 0;

  return (
    <main className="status">
      {justSent && <ButterRain />}
      {justSent && <h2 className="shout">ORDER SENT<br />TO TAWA!</h2>}
      <div className="status-mascot">
        <Mascot mood={idx >= 3 ? "love" : idx >= 2 ? "shock" : "happy"} size={150} />
        <Bubble text={latest ? STATUS[idx].line : "Finding your order…"} side="right" />
      </div>

      {list.length === 0 && <p className="fine center">Loading your order… if this takes long, ask the staff. They're nice. Mostly.</p>}

      {list.slice().reverse().map((o, n) => {
        const i = STATUS.findIndex((s) => s.id === o.status);
        return (
          <section key={o.id} className="track">
            <header>
              <b>{n === 0 ? "Latest order" : "Earlier order"}</b>
              <span>Table {o.table} · {ago(o.createdAt)}</span>
            </header>
            <ol className="steps">
              {STATUS.map((s, k) => (
                <li key={s.id} className={k < i ? "done" : k === i ? "now" : ""}>
                  <span className="dot" />
                  {s.label}
                </li>
              ))}
            </ol>
            <ul className="mini">
              {o.items.map((l) => (
                <li key={l.id}><span>{l.qty}× {l.name}</span><span>{rs(l.qty * l.price)}</span></li>
              ))}
              <li className="mini-total"><span>Total</span><span>{rs(o.total)}</span></li>
            </ul>
          </section>
        );
      })}
      <button className="cta" onClick={more} id="btn-more" type="button">Order more (you know you want to)</button>
    </main>
  );
}

function AdminLogin({ back, ok, onSay, store }: { back: () => void; ok: () => void; onSay: (s: string, m?: Mood) => void; store: Store | null }) {
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
    if (norm(pw) === norm(RESTAURANT.adminPassword)) {
      session.set("admin", true);
      ok();
    } else fail(pick(LINES.wrongPass));
  };
  return (
    <main className="who">
      <button className="back" onClick={back} type="button">← Back</button>
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

function Admin({ store, soldOut, logout }: { store: Store; soldOut: string[]; logout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"orders" | "tables" | "menu">("orders");
  const [filter, setFilter] = useState<StatusId | "active" | "all">("active");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [, tick] = useState(0);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);

  useEffect(() => store.onOrders(setOrders), [store]);
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
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
          const ac = new AC();
          [880, 1320].forEach((f, i) => {
            const o = ac.createOscillator();
            const g = ac.createGain();
            o.frequency.value = f;
            g.gain.setValueAtTime(0.15, ac.currentTime + i * 0.15);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.15 + 0.3);
            o.connect(g).connect(ac.destination);
            o.start(ac.currentTime + i * 0.15);
            o.stop(ac.currentTime + i * 0.15 + 0.3);
          });
        } catch {
          /* no sound, fine */
        }
        setTimeout(() => setFresh([]), 4000);
      }
    }
    seen.current = ids;
  }, [orders]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todays = orders.filter((o) => o.createdAt >= today.getTime());
  const active = orders.filter((o) => o.status !== "served");
  const sales = todays.reduce((s, o) => s + o.total, 0);

  const shown = orders
    .filter((o) => (filter === "all" ? true : filter === "active" ? o.status !== "served" : o.status === filter))
    .sort((a, b) => (filter === "active" || filter === "new" || filter === "cooking" || filter === "ready" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));

  const next = (o: Order) => {
    const i = STATUS.findIndex((s) => s.id === o.status);
    if (i < STATUS.length - 1) store.setStatus(o.id, STATUS[i + 1].id).catch(() => {});
  };
  const nextLabel: Record<string, string> = { new: "Start cooking", cooking: "Mark ready", ready: "Mark served" };

  const toggleSold = (id: string) => {
    const n = soldOut.includes(id) ? soldOut.filter((x) => x !== id) : [...soldOut, id];
    store.setSoldOut(n).catch(() => {});
  };

  const clearServed = async () => {
    for (const o of orders.filter((o) => o.status === "served")) {
      await store.removeOrder(o.id).catch(() => {});
    }
    setConfirm(null);
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

      <div className="stats">
        <div><b>{active.filter((o) => o.status === "new").length}</b><span>new</span></div>
        <div><b>{active.length}</b><span>in progress</span></div>
        <div><b>{todays.length}</b><span>orders today</span></div>
        <div><b>{rs(sales)}</b><span>sales today</span></div>
      </div>

      <div className="seg seg-3" role="tablist">
        {(["orders", "tables", "menu"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)} type="button">
            {t === "orders" ? "Orders" : t === "tables" ? "Tables" : "Menu stock"}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <>
          <div className="chips">
            {([["active", "Active"], ["new", "New"], ["cooking", "Cooking"], ["ready", "Ready"], ["served", "Served"], ["all", "All"]] as const).map(([k, l]) => (
              <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)} type="button">
                {l}
                <small>{k === "all" ? orders.length : k === "active" ? active.length : orders.filter((o) => o.status === k).length}</small>
              </button>
            ))}
          </div>

          {shown.length === 0 && (
            <div className="empty-admin">
              <Mascot mood="sad" size={110} />
              <p>{filter === "active" ? "No active orders. The tawa is lonely. When a customer orders, it pops up here with a ding." : "Nothing here yet."}</p>
            </div>
          )}

          <div className="tickets">
            {shown.map((o) => (
              <article key={o.id} className={`ticket st-${o.status} ${fresh.includes(o.id) ? "fresh" : ""}`}>
                <div className="ticket-top">
                  <span className="tno">T{o.table}</span>
                  <div className="who-line">
                    <b>{o.kind === "guest" ? "Guest" : o.name}</b>
                    {o.phone && <span className="mono">{o.phone}</span>}
                    <span className="time">{ago(o.createdAt)}</span>
                  </div>
                  <span className={`pill p-${o.status}`}>{STATUS.find((s) => s.id === o.status)?.short}</span>
                </div>
                <ul className="mini">
                  {o.items.map((l) => (
                    <li key={l.id}><span><b>{l.qty}×</b> {l.name}</span><span>{rs(l.qty * l.price)}</span></li>
                  ))}
                  <li className="mini-total"><span>Total</span><span>{rs(o.total)}</span></li>
                </ul>
                {o.note && <p className="chef-note">Note: {o.note}</p>}
                <div className="ticket-act">
                  {o.status !== "served" && (
                    <button className="cta small" onClick={() => next(o)} type="button">{nextLabel[o.status]}</button>
                  )}
                  {confirm === o.id ? (
                    <button className="ghost small danger" onClick={() => { store.removeOrder(o.id).catch(() => {}); setConfirm(null); }} type="button">Tap again to delete</button>
                  ) : (
                    <button className="ghost small" onClick={() => setConfirm(o.id)} type="button">Delete</button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {orders.some((o) => o.status === "served") && (
            confirm === "__served" ? (
              <button className="ghost danger wide" onClick={clearServed} type="button">Tap again: delete all served orders</button>
            ) : (
              <button className="ghost wide" onClick={() => setConfirm("__served")} type="button">Clear served orders</button>
            )
          )}
        </>
      )}

      {tab === "tables" && (
        <div className="table-grid">
          {Array.from({ length: RESTAURANT.tables }, (_, i) => i + 1).map((t) => {
            const at = active.filter((o) => o.table === t);
            const bill = orders.filter((o) => o.table === t && o.createdAt >= today.getTime()).reduce((s, o) => s + o.total, 0);
            const worst = at.find((o) => o.status === "new") ? "new" : at.find((o) => o.status === "cooking") ? "cooking" : at.length ? "ready" : "free";
            return (
              <button key={t} className={`tbl tbl-${worst}`} onClick={() => { setTab("orders"); setFilter("all"); }} type="button">
                <span className="tbl-n">{t}</span>
                <span className="tbl-s">{worst === "free" ? "Free" : `${at.length} active`}</span>
                <span className="tbl-b">{bill ? rs(bill) : "—"}</span>
              </button>
            );
          })}
          <p className="fine span-all">Amount = everything that table ordered today. Collect it at the counter.</p>
        </div>
      )}

      {tab === "menu" && (
        <div className="stock">
          <p className="fine">Ran out of something? Switch it off and customers see "Khatam!" instantly.</p>
          {CATEGORIES.map((c) => (
            <section key={c.id}>
              <h4>{c.label}</h4>
              {MENU.filter((m) => m.cat === c.id).map((m) => {
                const on = !soldOut.includes(m.id);
                return (
                  <label key={m.id} className="stock-row" htmlFor={`stock-${m.id}`}>
                    <span>{m.name}<small>{rs(m.price)}</small></span>
                    <input id={`stock-${m.id}`} type="checkbox" className="switch" checked={on} onChange={() => toggleSold(m.id)} />
                    <em className={on ? "yes" : "no"}>{on ? "Available" : "Sold out"}</em>
                  </label>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  App shell                                                          */
/* ------------------------------------------------------------------ */

export default function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [screen, setScreen] = useState<Screen>(() => (session.get("admin", false) ? "admin" : session.get<Diner | null>("diner", null) ? "menu" : "home"));
  const [diner, setDiner] = useState<Diner | null>(() => session.get<Diner | null>("diner", null));
  const [myOrders, setMyOrders] = useState<string[]>(() => session.get<string[]>("orders", []));
  const [justSent, setJustSent] = useState(false);
  const [soldOut, setSoldOut] = useState<string[]>([]);
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
  useEffect(() => (store ? store.onKitchen((k) => setSoldOut(k.soldOut)) : undefined), [store]);
  // with a real login, the admin screen follows the signed-in state
  const [adminOk, setAdminOk] = useState<boolean | null>(null);
  useEffect(() => (store?.adminAuth ? store.adminAuth.onUser(setAdminOk) : undefined), [store]);
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
    session.clear("orders");
    session.clear("cart");
    session.clear("admin");
    setDiner(null);
    setMyOrders([]);
    setExitAsk(false);
    go("home");
  };

  const showMini = screen === "menu" || screen === "who" || screen === "adminLogin";

  return (
    <div className="app">
      <Ticker />
      <header className="topbar">
        <button className="logo" onClick={() => (screen === "admin" ? null : screen === "menu" || screen === "status" ? null : go("home"))} type="button" aria-label="Home">
          <Mascot mood="wink" size={34} />
          <span>{RESTAURANT.name}</span>
        </button>
        {diner && (screen === "menu" || screen === "status") && (
          <div className="who-chip">
            <span>T{diner.table} · {diner.kind === "guest" ? "Guest" : diner.name.split(" ")[0]}</span>
            {exitAsk ? (
              <button onClick={leave} className="danger" type="button">Sure? Leave</button>
            ) : (
              <button onClick={() => setExitAsk(true)} type="button">Exit</button>
            )}
          </div>
        )}
        {diner && screen === "menu" && myOrders.length > 0 && (
          <button className="track-btn" onClick={() => setScreen("status")} type="button">My orders</button>
        )}
      </header>

      {store?.mode === "local" && (screen === "admin" || screen === "status") && (
        <p className="demo-note">Demo mode: orders are saved on this phone only. Open the published link to share orders between phones.</p>
      )}

      {screen === "home" && (
        <Home go={go} say={say} mood={mood} bump={bump} poke={() => speak(pick(LINES.poke), Math.random() > 0.5 ? "shock" : "wink")} />
      )}
      {screen === "who" && (
        <WhoAreYou
          back={() => go("home")}
          setSay={speak}
          onDone={(d) => {
            setDiner(d);
            session.set("diner", d);
            setScreen("menu");
            speak(d.kind === "guest" ? `Welcome, mystery guest of Table ${d.table}!` : `Namaste ${d.name.split(" ")[0]}! Table ${d.table} is ready to eat.`, "love");
          }}
        />
      )}
      {screen === "menu" && diner && store && (
        <MenuScreen
          diner={diner}
          store={store}
          soldOut={soldOut}
          onSay={speak}
          addFx={addFx}
          onOrdered={(id) => {
            const n = [...myOrders, id];
            setMyOrders(n);
            session.set("orders", n);
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
      {screen === "menu" && !store && <p className="fine center">Heating the tawa…</p>}
      {screen === "status" && store && (
        <StatusScreen store={store} ids={myOrders} justSent={justSent} more={() => { setJustSent(false); setScreen("menu"); speak("Round two! Respect.", "love"); }} />
      )}
      {screen === "adminLogin" && <AdminLogin store={store} back={() => go("home")} ok={() => setScreen("admin")} onSay={speak} />}
      {screen === "admin" && store && (!store.adminAuth || adminOk) && (
        <Admin store={store} soldOut={soldOut} logout={() => { store.adminAuth?.signOut().catch(() => {}); session.clear("admin"); go("home"); }} />
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
