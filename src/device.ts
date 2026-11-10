import { session } from "./store";

// Each phone gets a random secret key that never leaves the phone except inside its own orders.
// Tables are locked to sha256(key) (uppercase hex), which the database rules can check,
// so another phone can't pretend to be the one that ordered first.
export type Ident = { key: string; id: string };

let cached: Promise<Ident> | null = null;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function deviceIdentity(): Promise<Ident> {
  if (cached) return cached;
  cached = (async () => {
    let key = session.get<string>("dkey", "");
    if (!key || key.length < 20) {
      const raw = new Uint8Array(24);
      crypto.getRandomValues(raw);
      key = b64url(raw);
      session.set("dkey", key);
    }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
    const id = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    return { key, id };
  })();
  return cached;
}
