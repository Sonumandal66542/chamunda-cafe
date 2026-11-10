import type { StatusId, Item } from "./data";
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
  cancelReason?: string;
  cancelledAt?: number;
  device?: string; // which phone placed it (sha256 of the phone's secret key)
  key?: string; // the phone's secret key, so the database can check the claim
};
// A table belongs to the phone that ordered first until the owner serves or cancels its last order.
export type TableLock = { holder: string; since: number; lastOrder: string };
export type Kitchen = { soldOut: string[] };
export type Cat = { id: string; label: string };
// seeded=false means the admin hasn't edited the menu yet: the built-in menu in data.ts is shown
export type MenuMeta = { seeded: boolean; cats: Cat[] };

// databases refuse `undefined` values: drop them before saving
export function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

export type Store = {
  mode: "live" | "local";
  onOrders(cb: (o: Order[]) => void): () => void;
  onOrder(id: string, cb: (o: Order | null) => void): () => void;
  addOrder(o: Omit<Order, "id">): Promise<string>;
  setStatus(id: string, s: StatusId): Promise<void>;
  onTables(cb: (locks: Record<string, TableLock>) => void): () => void;
  freeTable(table: number): Promise<void>;
  cancelOrder(id: string, reason: string): Promise<void>;
  removeOrder(id: string): Promise<void>;
  onKitchen(cb: (k: Kitchen) => void): () => void;
  setSoldOut(ids: string[]): Promise<void>;
  onMenu(cb: (items: Item[]) => void): () => void;
  onMenuMeta(cb: (m: MenuMeta | null) => void): () => void;
  saveItem(it: Item): Promise<void>;
  deleteItem(id: string): Promise<void>;
  setMenuMeta(m: MenuMeta): Promise<void>;
  // present only when a real login system (Firebase) guards the admin screen
  adminAuth?: {
    signIn(email: string, pw: string): Promise<void>;
    signOut(): Promise<void>;
    onUser(cb: (signedIn: boolean) => void): () => void;
    uid(): string | null;
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
      if (o.device) await db.doc(`tables/${o.table}`).set({ holder: o.device, since: Date.now(), lastOrder: ref.id });
      return ref.id;
    },
    onTables(cb) {
      return db.collection("tables").onSnapshot(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (snap: any) => cb(Object.fromEntries(snap.docs.map((d: any) => [d.id, d.data() as TableLock]))),
        () => {}
      );
    },
    async freeTable(t) {
      await db.doc(`tables/${t}`).set({ holder: "", since: Date.now(), lastOrder: "" });
    },
    async setStatus(id, s) {
      await orders.doc(id).update({ status: s });
    },
    async cancelOrder(id, reason) {
      await orders.doc(id).update({ status: "cancelled", cancelReason: reason, cancelledAt: Date.now() });
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
    onMenu(cb) {
      return db.collection("menu").onSnapshot(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (snap: any) => cb(snap.docs.map((d: any) => ({ ...(d.data() as Item), id: d.id }))),
        () => {}
      );
    },
    onMenuMeta(cb) {
      return db.doc("kitchen/menuMeta").onSnapshot(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d: any) => cb(d.exists ? (d.data() as MenuMeta) : null),
        () => {}
      );
    },
    async saveItem(it) {
      const { id, ...rest } = it;
      await db.collection("menu").doc(id).set(clean(rest));
    },
    async deleteItem(id) {
      await db.collection("menu").doc(id).delete();
    },
    async setMenuMeta(m) {
      await db.doc("kitchen/menuMeta").set(m);
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
  let locks: Record<string, TableLock> = safeGet<Record<string, TableLock>>("pp-tables", {});
  const tSubs = new Set<(l: Record<string, TableLock>) => void>();
  const emitT = () => {
    safeSet("pp-tables", locks);
    tSubs.forEach((f) => f(locks));
  };
  let menu: Item[] = safeGet<Item[]>("pp-menu", []);
  let meta: MenuMeta | null = safeGet<MenuMeta | null>("pp-menumeta", null);
  const mSubs = new Set<(m: Item[]) => void>();
  const metaSubs = new Set<(m: MenuMeta | null) => void>();
  const emitM = () => {
    safeSet("pp-menu", menu);
    mSubs.forEach((f) => f(menu));
  };
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
      locks = safeGet<Record<string, TableLock>>("pp-tables", locks);
      emitO();
      emitK();
      emitT();
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
      const cur = locks[String(o.table)];
      if (o.device && cur && cur.holder && cur.holder !== o.device) throw Object.assign(new Error("table busy"), { code: "permission-denied" });
      const id = Math.random().toString(36).slice(2, 10);
      orders = [...orders, { ...o, id }];
      if (o.device) locks = { ...locks, [String(o.table)]: { holder: o.device, since: Date.now(), lastOrder: id } };
      emitO();
      emitT();
      return id;
    },
    onTables(cb) {
      tSubs.add(cb);
      cb(locks);
      return () => tSubs.delete(cb);
    },
    async freeTable(t) {
      locks = { ...locks, [String(t)]: { holder: "", since: Date.now(), lastOrder: "" } };
      emitT();
    },
    async setStatus(id, s) {
      orders = orders.map((o) => (o.id === id ? { ...o, status: s } : o));
      emitO();
    },
    async cancelOrder(id, reason) {
      orders = orders.map((o) => (o.id === id ? { ...o, status: "cancelled", cancelReason: reason, cancelledAt: Date.now() } : o));
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
    onMenu(cb) {
      mSubs.add(cb);
      cb(menu);
      return () => mSubs.delete(cb);
    },
    onMenuMeta(cb) {
      metaSubs.add(cb);
      cb(meta);
      return () => metaSubs.delete(cb);
    },
    async saveItem(it) {
      menu = [...menu.filter((m) => m.id !== it.id), clean(it)];
      emitM();
    },
    async deleteItem(id) {
      menu = menu.filter((m) => m.id !== id);
      emitM();
    },
    async setMenuMeta(m) {
      meta = m;
      safeSet("pp-menumeta", meta);
      metaSubs.forEach((f) => f(meta));
    },
  };
}

export async function connectStore(): Promise<Store> {
  if (firebaseConfig) {
    try {
      const { firebaseStore } = await import("./firebaseStore");
      return firebaseStore(firebaseConfig);
    } catch {
      /* fall back below */
    }
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
