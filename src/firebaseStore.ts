import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, limit,
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { clean, type Store, type Order, type MenuMeta } from "./store";
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
      const ref = await addDoc(orders, o);
      return ref.id;
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
      onUser(cb) {
        return onAuthStateChanged(auth, (u) => cb(!!u));
      },
    },
  };
}
