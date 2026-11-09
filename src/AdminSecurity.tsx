import { useState } from "react";
import { RESTAURANT } from "./data";
import { session } from "./store";

// Database rules locked to one owner login. Customers can only place sensible new orders
// and read their own order by its secret id; everything else needs the owner.
export const ownerRules = (uid: string) => `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Only the cafe owner's login can see all orders, change them or edit the menu.
    function isOwner() {
      return request.auth != null && request.auth.uid == "${uid}";
    }

    function validNewOrder() {
      let d = request.resource.data;
      return d.keys().hasOnly(['table', 'kind', 'name', 'phone', 'items', 'note', 'total', 'status', 'createdAt'])
        && d.status == 'new'
        && d.table is int && d.table >= 1 && d.table <= ${RESTAURANT.tables}
        && d.kind in ['guest', 'customer']
        && d.name is string && d.name.size() <= 60
        && d.phone is string && d.phone.size() <= 15
        && d.note is string && d.note.size() <= 200
        && d.items is list && d.items.size() > 0 && d.items.size() <= 30
        && d.total is number && d.total > 0 && d.total <= 100000
        && d.createdAt is number
        && d.createdAt > request.time.toMillis() - 86400000
        && d.createdAt < request.time.toMillis() + 86400000;
    }

    match /orders/{orderId} {
      allow get: if true;
      allow create: if validNewOrder();
      allow list, update, delete: if isOwner();
    }

    match /menu/{itemId} {
      allow read: if true;
      allow write: if isOwner();
    }

    match /kitchen/{docId} {
      allow read: if true;
      allow write: if isOwner();
    }
  }
}
`;

export const securityDone = () => !!session.get("sec-signup", false) && !!session.get("sec-rules", false);

export function AdminSecurity({ uid, onChange }: { uid: string | null; onChange: () => void }) {
  const [signup, setSignup] = useState<boolean>(() => session.get("sec-signup", false));
  const [rulesDone, setRulesDone] = useState<boolean>(() => session.get("sec-rules", false));
  const [copied, setCopied] = useState("");
  const [showRules, setShowRules] = useState(false);

  if (!uid) {
    return (
      <div className="sec">
        <p className="fine">This demo has no real owner login. On your live website, log in as Kitchen Boss and open this tab to lock everything to your account.</p>
      </div>
    );
  }
  const rules = ownerRules(uid);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(""), 2500);
    } catch {
      setShowRules(true);
      setCopied("select");
    }
  };
  const mark = (key: "sec-signup" | "sec-rules", v: boolean) => {
    session.set(key, v);
    if (key === "sec-signup") setSignup(v);
    else setRulesDone(v);
    onChange();
  };

  return (
    <div className="sec">
      <p className="fine">Two quick steps in Firebase so only you can see customers' details and change orders or the menu. Do them once, on any device.</p>

      <section className={`sec-step ${signup ? "done" : ""}`}>
        <h4><span>1</span> Stop strangers creating accounts</h4>
        <p>Firebase lets anyone sign up by default. Turn that off:</p>
        <ol>
          <li>Open <b>console.firebase.google.com</b> → <b>chamunda-cafe</b> → <b>Authentication</b>.</li>
          <li>Open the <b>Settings</b> tab → <b>User actions</b>.</li>
          <li>Untick <b>Enable create (sign-up)</b> and <b>Enable deletion</b>, then tap <b>Save</b>.</li>
        </ol>
        <label className="sec-check" htmlFor="sec-1">
          <input id="sec-1" type="checkbox" checked={signup} onChange={(e) => mark("sec-signup", e.target.checked)} />
          I've done this
        </label>
      </section>

      <section className={`sec-step ${rulesDone ? "done" : ""}`}>
        <h4><span>2</span> Lock the database to your login</h4>
        <p>These rules already contain your owner ID, so there's nothing to type:</p>
        <p className="mono sec-uid">Owner ID: {uid}</p>
        <button className="cta small" type="button" onClick={() => copy(rules, "rules")} id="btn-copy-rules">
          {copied === "rules" ? "Copied! Now paste it in Firebase" : "Copy my locked rules"}
        </button>
        <ol>
          <li>In Firebase open <b>Firestore Database</b> → <b>Rules</b>.</li>
          <li>Delete everything there, paste, and tap <b>Publish</b>.</li>
          <li>Come back here and reload: orders should still show. If they don't, paste the rules again.</li>
        </ol>
        {copied === "select" && <p className="err">Copying isn't allowed on this phone. Select all the text below and copy it.</p>}
        <button className="ghost small" type="button" onClick={() => setShowRules((v) => !v)}>{showRules ? "Hide rules" : "Show rules"}</button>
        {showRules && <textarea className="sec-rules" readOnly value={rules} rows={12} onFocus={(e) => e.currentTarget.select()} aria-label="Locked database rules" />}
        <label className="sec-check" htmlFor="sec-2">
          <input id="sec-2" type="checkbox" checked={rulesDone} onChange={(e) => mark("sec-rules", e.target.checked)} />
          I've published these rules
        </label>
      </section>

      <section className="sec-step tips">
        <h4>Good habits</h4>
        <ul>
          <li>Keep the owner password private and log out on phones other people use.</li>
          <li>If a bill shows <b>"Check the bill"</b>, the order's prices don't match your menu. Charge the menu price.</li>
          <li>Adding a staff login later? Ask for the rules to be updated, or it won't get in.</li>
        </ul>
      </section>
    </div>
  );
}
