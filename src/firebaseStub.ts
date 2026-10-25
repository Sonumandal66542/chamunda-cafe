import type { Store } from "./store";
// Used only for the Claude artifact build, which never talks to Firebase.
export function firebaseStore(_config: Record<string, string>): Store {
  throw new Error("Firebase is not part of this build");
}
