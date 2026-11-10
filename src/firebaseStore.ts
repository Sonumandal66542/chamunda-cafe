import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, updateDoc, deleteDoc, setDoc, writeBatch,
  onSnapshot, query, orderBy, limit,
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { clean, type Store, type Order, type MenuMeta, type TableLock } from "./store";
import type { Item } from "./data";

export function firebaseStore(config: Record<string, string>): Store {
  const app = initializeApp(config);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const orders = collection(db, "orders");

  return {
    mode: "live",
    onOrders(cb) {
      return onSnapshot(
        query(orders, orderBy("createdAt", "desc"), limit(300)),
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Order), id: d.id }))),
        () => {}
      );
    },
    onOrder(id, cb) {
      return onSnapshot(
        doc(orders, id),
        (d) => cb(d.exists() ? ({ ...(d.data() as Order), id: d.id }) : null),
        () => {}
      );
    },
    async addOrder(o) {
      // the order and the table claim are saved together, so the database rules can check both at once
      const ref = doc(orders);
      const batch = writeBatch(db);
      batch.set(ref, o);
      if (o.device) {
        const since = Date.now();
        batch.set(doc(db, "tables", String(o.table)), { holder: o.device, since, lastOrder: ref.id });
        // one table at a time: for this phone, and for this mobile number
        batch.set(doc(db, "devices", o.device), { table: o.table, since, lastOrder: ref.id });
        batch.set(doc(db, "phones", o.phone), { table: o.table, device: o.device, since, lastOrder: ref.id });
      }
      await batch.commit();
      return ref.id;
    },
    onTables(cb) {
      return onSnapshot(
        collection(db, "tables"),
        (snap) => cb(Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as TableLock]))),
        () => {}
      );
    },
    async freeTable(t) {
      await setDoc(doc(db, "tables", String(t)), { holder: "", since: Date.now(), lastOrder: "" });
    },
    async setStatus(id, s) {
      await updateDoc(doc(orders, id), { status: s });
    },
    async cancelOrder(id, reason) {
      await updateDoc(doc(orders, id), { status: "cancelled", cancelReason: reason, cancelledAt: Date.now() });
    },
    async removeOrder(id) {
      await deleteDoc(doc(orders, id));
    },
    onKitchen(cb) {
      return onSnapshot(
        doc(db, "kitchen", "state"),
        (d) => cb({ soldOut: (d.exists() && (d.data().soldOut as string[])) || [] }),
        () => {}
      );
    },
    async setSoldOut(ids) {
      await setDoc(doc(db, "kitchen", "state"), { soldOut: ids });
    },
    onMenu(cb) {
      return onSnapshot(
        collection(db, "menu"),
        (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Item), id: d.id }))),
        () => {}
      );
    },
    onMenuMeta(cb) {
      return onSnapshot(
        doc(db, "kitchen", "menuMeta"),
        (d) => cb(d.exists() ? (d.data() as MenuMeta) : null),
        () => {}
      );
    },
    async saveItem(it) {
      const { id, ...rest } = it;
      await setDoc(doc(db, "menu", id), clean(rest));
    },
    async deleteItem(id) {
      await deleteDoc(doc(db, "menu", id));
    },
    async setMenuMeta(m) {
      await setDoc(doc(db, "kitchen", "menuMeta"), m);
    },
    adminAuth: {
      async signIn(email, pw) {
        await signInWithEmailAndPassword(auth, email.trim(), pw);
      },
      async signOut() {
        await signOut(auth);
      },
      uid() {
        return auth.currentUser?.uid ?? null;
      },
      onUser(cb) {
        return onAuthStateChanged(auth, (u) => cb(!!u));
      },
    },
  };
}
