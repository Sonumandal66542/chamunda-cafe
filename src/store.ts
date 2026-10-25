import type { StatusId } from "./data";
import { firebaseConfig } from "./firebase-config";

export type OrderLine = { id: string; name: string; qty: number; price: number };
export type Order = {
  id: string;
  table: number;
  kind: "guest" | "customer";
  name: string;
  phone: string;
  items: OrderLine[];
  note: string;
  total: number;
  status: StatusId;
  createdAt: number;
};
export type Kitchen = { soldOut: string[] };

export type Store = {
  mode: "live" | "local";
  onOrders(cb: (o: Order[]) => void): () => void;
  onOrder(id: string, cb: (o: Order | null) => void): () => void;
  addOrder(o: Omit<Order, "id">): Promise<string>;
  setStatus(id: string, s: StatusId): Promise<void>;
  removeOrder(id: string): Promise<void>;
  onKitchen(cb: (k: Kitchen) => void): () => void;
  setSoldOut(ids: string[]): Promise<void>;
  // present only when a real login system (Firebase) guards the admin screen
  adminAuth?: {
    signIn(email: string, pw: string): Promise<void>;
    signOut(): Promise<void>;
    onUser(cb: (signedIn: boolean) => void): () => void;
  };
};

// ---------- live store (shared across phones) ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function liveStore(db: any): Store {
  const orders = db.collection("orders");
  return {
    mode: "live",
    onOrders(cb) {
      return orders.orderBy("createdAt", "desc").limit(300).onSnapshot(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (snap: any) => cb(snap.docs.map((d: any) => ({ ...(d.data() as Order), id: d.id }))),
        () => {}
      );
    },
    onOrder(id, cb) {
      return orders.doc(id).onSnapshot(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d: any) => cb(d.exists ? ({ ...(d.data() as Order), id: d.id }) : null),
        () => {}
      );
    },
    async addOrder(o) {
      const ref = orders.doc();
      await ref.set(o);
      return ref.id;
    },
    async setStatus(id, s) {
      await orders.doc(id).update({ status: s });
    },
    async removeOrder(id) {
      await orders.doc(id).delete();
    },
    onKitchen(cb) {
      return db.doc("kitchen/state").onSnapshot(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d: any) => cb({ soldOut: (d.exists && (d.data().soldOut as string[])) || [] }),
        () => {}
      );
    },
    async setSoldOut(ids) {
      await db.doc("kitchen/state").set({ soldOut: ids });
    },
  };
}

// ---------- local fallback (this phone only) ----------
function safeGet<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
}
function safeSet(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage blocked: keep in memory */
  }
}

function localStore(): Store {
  let orders: Order[] = safeGet<Order[]>("pp-orders", []);
  let kitchen: Kitchen = safeGet<Kitchen>("pp-kitchen", { soldOut: [] });
  const oSubs = new Set<(o: Order[]) => void>();
  const kSubs = new Set<(k: Kitchen) => void>();
  const emitO = () => {
    safeSet("pp-orders", orders);
    const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt);
    oSubs.forEach((f) => f(sorted));
  };
  const emitK = () => {
    safeSet("pp-kitchen", kitchen);
    kSubs.forEach((f) => f(kitchen));
  };
  try {
    window.addEventListener("storage", () => {
      orders = safeGet<Order[]>("pp-orders", orders);
      kitchen = safeGet<Kitchen>("pp-kitchen", kitchen);
      emitO();
      emitK();
    });
  } catch {
    /* ignore */
  }
  return {
    mode: "local",
    onOrders(cb) {
      oSubs.add(cb);
      cb([...orders].sort((a, b) => b.createdAt - a.createdAt));
      return () => oSubs.delete(cb);
    },
    onOrder(id, cb) {
      const f = (all: Order[]) => cb(all.find((o) => o.id === id) || null);
      oSubs.add(f);
      f(orders);
      return () => oSubs.delete(f);
    },
    async addOrder(o) {
      const id = Math.random().toString(36).slice(2, 10);
      orders = [...orders, { ...o, id }];
      emitO();
      return id;
    },
    async setStatus(id, s) {
      orders = orders.map((o) => (o.id === id ? { ...o, status: s } : o));
      emitO();
    },
    async removeOrder(id) {
      orders = orders.filter((o) => o.id !== id);
      emitO();
    },
    onKitchen(cb) {
      kSubs.add(cb);
      cb(kitchen);
      return () => kSubs.delete(cb);
    },
    async setSoldOut(ids) {
      kitchen = { soldOut: ids };
      emitK();
    },
  };
}

export async function connectStore(): Promise<Store> {
  if (firebaseConfig) {
    const { firebaseStore } = await import("./firebaseStore");
    return firebaseStore(firebaseConfig);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (window as any).claude;
    if (c && typeof c.use === "function") {
      const db = await c.use("db");
      if (db) return liveStore(db);
    }
  } catch {
    /* fall through */
  }
  return localStore();
}

// per-phone memory of who is sitting where
export const session = {
  get<T>(k: string, d: T): T {
    return safeGet<T>("pp-s-" + k, d);
  },
  set(k: string, v: unknown) {
    safeSet("pp-s-" + k, v);
  },
  clear(k: string) {
    try {
      localStorage.removeItem("pp-s-" + k);
    } catch {
      /* ignore */
    }
  },
};
