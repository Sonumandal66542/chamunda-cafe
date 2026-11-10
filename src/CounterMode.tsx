import { useCallback, useEffect, useRef, useState } from "react";
import { session, type Order } from "./store";
import { RESTAURANT } from "./data";

/* ------------------------------------------------------------------ */
/*  Install as an app (Android Chrome shows a prompt; iPhone uses Share) */
/* ------------------------------------------------------------------ */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredInstall: InstallEvent | null = null;
const installSubs = new Set<() => void>();
try {
  // must be listening from the very start: Chrome fires this once, early
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e as InstallEvent;
    installSubs.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    installSubs.forEach((f) => f());
  });
} catch {
  /* not a browser */
}

const isStandalone = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return window.matchMedia("(display-mode: standalone)").matches || !!(navigator as any).standalone;
  } catch {
    return false;
  }
};
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

function useInstall() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((x) => x + 1);
    installSubs.add(f);
    return () => {
      installSubs.delete(f);
    };
  }, []);
  const install = async () => {
    if (!deferredInstall) return;
    await deferredInstall.prompt();
    await deferredInstall.userChoice.catch(() => null);
    deferredInstall = null;
    bump((x) => x + 1);
  };
  return { canInstall: !!deferredInstall, installed: isStandalone(), ios: isIOS(), install };
}

/* ------------------------------------------------------------------ */
/*  Keep the screen awake                                              */
/* ------------------------------------------------------------------ */

type WakeState = "on" | "off" | "unsupported" | "blocked";
function useWakeLock() {
  const [want, setWant] = useState<boolean>(() => session.get("wake", true));
  const [state, setState] = useState<WakeState>("off");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lock = useRef<any>(null);

  const acquire = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wl = (navigator as any).wakeLock;
    if (!wl) return setState("unsupported");
    if (document.visibilityState !== "visible") return;
    try {
      if (lock.current && !lock.current.released) return setState("on");
      lock.current = await wl.request("screen");
      setState("on");
      lock.current.addEventListener?.("release", () => setState((s) => (s === "on" ? "off" : s)));
    } catch {
      setState("blocked");
    }
  }, []);

  useEffect(() => {
    session.set("wake", want);
    if (!want) {
      lock.current?.release?.().catch(() => {});
      lock.current = null;
      setState("off");
      return;
    }
    acquire();
    // the lock drops whenever the page is hidden; take it again when it comes back, or on the next tap
    const again = () => acquire();
    document.addEventListener("visibilitychange", again);
    window.addEventListener("pointerdown", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("pointerdown", again);
    };
  }, [want, acquire]);

  return { want, setWant, state };
}

/* ------------------------------------------------------------------ */
/*  Loud alarm that repeats until someone taps Seen                    */
/* ------------------------------------------------------------------ */

let ctx: AudioContext | null = null;
const audioSubs = new Set<() => void>();
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      ctx = new AC();
      ctx!.onstatechange = () => audioSubs.forEach((f) => f());
    }
    return ctx;
  } catch {
    return null;
  }
}
// browsers only allow sound after a tap: unlock on the first one
try {
  const unlock = () => {
    const a = audio();
    a?.resume().then(() => audioSubs.forEach((f) => f())).catch(() => {});
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
} catch {
  /* ignore */
}

function ring() {
  const a = audio();
  if (!a || a.state !== "running") return;
  const t0 = a.currentTime;
  [988, 1319, 988, 1319].forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "square";
    o.frequency.value = f;
    const at = t0 + i * 0.22;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.19);
    o.connect(g).connect(a.destination);
    o.start(at);
    o.stop(at + 0.2);
  });
  try {
    navigator.vibrate?.([400, 150, 400]);
  } catch {
    /* ignore */
  }
}

function useSoundReady() {
  const [ready, setReady] = useState(() => audio()?.state === "running");
  useEffect(() => {
    const f = () => setReady(audio()?.state === "running");
    audioSubs.add(f);
    f();
    return () => {
      audioSubs.delete(f);
    };
  }, []);
  return ready;
}

/* ------------------------------------------------------------------ */
/*  Which new orders nobody has acknowledged yet                       */
/* ------------------------------------------------------------------ */

const RECENT_MS = 3 * 3600 * 1000;

export function useUnseen(orders: Order[]) {
  const [acked, setAcked] = useState<string[]>(() => session.get<string[]>("acked", []));
  const unseen = orders.filter((o) => o.status === "new" && !acked.includes(o.id) && Date.now() - o.createdAt < RECENT_MS);
  const ack = (ids: string[]) => {
    const n = [...acked, ...ids].slice(-400);
    setAcked(n);
    session.set("acked", n);
  };
  return { unseen, ack };
}

const NOTIFY_ICON = `${import.meta.env.BASE_URL}kitchen-boss/icon-192.png`;
async function systemNotify(title: string, body: string, tag: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) await reg.showNotification(title, { body, tag, icon: NOTIFY_ICON, requireInteraction: true } as NotificationOptions);
    else new Notification(title, { body, tag, icon: NOTIFY_ICON });
  } catch {
    /* not allowed on this phone */
  }
}

/** Rings while there are unseen orders; also shows a phone notification for each new one. */
export function useAlarm(unseen: Order[]) {
  const announced = useRef<Set<string>>(new Set());
  const on = unseen.length > 0;
  useEffect(() => {
    for (const o of unseen) {
      if (announced.current.has(o.id)) continue;
      announced.current.add(o.id);
      const what = o.items.map((l) => `${l.qty}× ${l.name}`).join(", ");
      systemNotify(`New order · Table ${o.table}`, `${what} · ${RESTAURANT.currency} ${o.total}`, o.id);
    }
  }, [unseen]);
  useEffect(() => {
    if (!on) return;
    const title = document.title;
    let flip = false;
    ring();
    const t = window.setInterval(() => {
      ring();
      flip = !flip;
      document.title = flip ? "🔔 NEW ORDER!" : title;
    }, 2200);
    return () => {
      window.clearInterval(t);
      document.title = title;
    };
  }, [on]);
}

/* ------------------------------------------------------------------ */
/*  UI                                                                 */
/* ------------------------------------------------------------------ */

export function AlarmOverlay({ orders, onSeen }: { orders: Order[]; onSeen: () => void }) {
  return (
    <div className="alarm" role="alertdialog" aria-label="New order">
      <div className="alarm-box">
        <p className="alarm-bell" aria-hidden="true">🔔</p>
        <h2>{orders.length === 1 ? "NEW ORDER!" : `${orders.length} NEW ORDERS!`}</h2>
        <ul>
          {orders.slice(0, 6).map((o) => (
            <li key={o.id}>
              <b>Table {o.table}</b>
              <span>{o.kind === "guest" ? "Guest" : o.name}</span>
              <span className="alarm-items">{o.items.map((l) => `${l.qty}× ${l.name}`).join(", ")}</span>
              {o.note && <span className="alarm-note">Note: {o.note}</span>}
            </li>
          ))}
        </ul>
        <button type="button" className="alarm-seen" onClick={onSeen} id="btn-seen" autoFocus>
          SEEN
        </button>
        <p className="alarm-hint">Keeps ringing until someone taps Seen.</p>
      </div>
    </div>
  );
}

export function CounterBar() {
  const sound = useSoundReady();
  const wake = useWakeLock();
  const inst = useInstall();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [perm, setPerm] = useState<string>(() => ("Notification" in window ? Notification.permission : "unsupported"));

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const askNotify = async () => {
    try {
      setPerm(await Notification.requestPermission());
    } catch {
      setPerm("denied");
    }
  };

  return (
    <>
      {!online && (
        <p className="offline" role="alert">
          <b>No internet.</b> New orders can't reach this phone. Check the Wi-Fi.
        </p>
      )}
      {!sound && (
        <button type="button" className="sound-off" onClick={() => audio()?.resume()} id="btn-sound">
          🔇 Sound is off. <b>Tap here once</b> so new orders can ring.
        </button>
      )}
      <div className="counter" aria-label="Counter phone settings">
        {sound && (
          <button type="button" className="cchip on" onClick={ring} id="btn-test-sound">
            🔔 Sound on · <u>Test</u>
          </button>
        )}
        {wake.state === "unsupported" ? (
          <span className="cchip">☀️ Set screen timeout to the longest in phone settings</span>
        ) : (
          <button type="button" className={`cchip ${wake.want && wake.state === "on" ? "on" : ""}`} onClick={() => wake.setWant(!wake.want)} id="btn-wake" aria-pressed={wake.want}>
            ☀️ {wake.want ? (wake.state === "on" ? "Screen stays on" : "Screen stays on (tap to retry)") : "Screen can sleep"}
          </button>
        )}
        {perm === "default" && (
          <button type="button" className="cchip" onClick={askNotify} id="btn-notify">
            📣 Allow notifications
          </button>
        )}
        {!inst.installed && inst.canInstall && (
          <button type="button" className="cchip install" onClick={inst.install} id="btn-install">
            ⬇ Install Kitchen app
          </button>
        )}
        {!inst.installed && !inst.canInstall && inst.ios && (
          <span className="cchip">⬇ To install: Share → Add to Home Screen</span>
        )}
      </div>
    </>
  );
}
