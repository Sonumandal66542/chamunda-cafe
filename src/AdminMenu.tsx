import { useState } from "react";
import { FoodPic } from "./FoodArt";
import { RESTAURANT, type Item } from "./data";
import type { Cat } from "./store";

const rs = (n: number) => `${RESTAURANT.currency} ${n.toLocaleString("en-IN")}`;
const NEW_CAT = "__new";
const SPICE = ["No spice", "Mild", "Spicy", "Fire brigade"];

export const slug = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "item";

// Crop to a square and shrink so each photo stays well under the database's per-item size limit.
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("unreadable"));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    let size = 520;
    let q = 0.8;
    for (let tries = 0; tries < 6; tries++) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      const data = c.toDataURL("image/jpeg", q);
      if (data.length < 150_000) return data;
      q = Math.max(0.5, q - 0.1);
      size = Math.round(size * 0.85);
    }
    throw new Error("too big");
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Draft = {
  id: string;
  isNew: boolean;
  name: string;
  desc: string;
  price: string;
  cat: string;
  newCat: string;
  veg: boolean;
  spice: 0 | 1 | 2 | 3;
  special: boolean;
  photo?: string;
  order?: number;
};

const toDraft = (it: Item): Draft => ({
  id: it.id, isNew: false, name: it.name, desc: it.desc, price: String(it.price), cat: it.cat, newCat: "",
  veg: it.veg !== false, spice: it.spice ?? 0, special: !!it.special, photo: it.photo, order: it.order,
});

export function AdminMenu({
  items, cats, soldOut, onToggleSold, onSave, onDelete,
}: {
  items: Item[];
  cats: Cat[];
  soldOut: string[];
  onToggleSold: (id: string) => void;
  onSave: (it: Item, newCat?: Cat) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [toast, setToast] = useState("");

  const flash = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 2600);
  };
  const open = (d: Draft) => {
    setDraft(d);
    setErr("");
    setConfirmDel(false);
  };
  const openNew = () =>
    open({ id: "", isNew: true, name: "", desc: "", price: "", cat: cats[0]?.id || NEW_CAT, newCat: "", veg: true, spice: 0, special: false });
  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const pickPhoto = async (f?: File | null) => {
    if (!f) return;
    setPhotoBusy(true);
    setErr("");
    try {
      set({ photo: await shrinkPhoto(f) });
    } catch {
      setErr("Couldn't use that photo. Try a different picture, a JPG or PNG works best.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const price = Number(draft.price);
    if (name.length < 2) return setErr("Give the food a name, at least 2 letters.");
    if (!draft.price.trim() || !Number.isFinite(price) || price <= 0) return setErr("Enter a price in rupees, like 150.");
    if (price > 100000) return setErr("That price looks too high. Check for an extra zero.");
    let newCat: Cat | undefined;
    let cat = draft.cat;
    if (cat === NEW_CAT) {
      const label = draft.newCat.trim();
      if (label.length < 2) return setErr("Type a name for the new section, like Momo or Sweets.");
      const existing = cats.find((c) => c.label.toLowerCase() === label.toLowerCase());
      if (existing) cat = existing.id;
      else {
        newCat = { id: slug(label), label };
        cat = newCat.id;
      }
    }
    const id = draft.isNew ? `${slug(name)}-${Math.random().toString(36).slice(2, 6)}` : draft.id;
    const order = draft.order ?? Math.max(0, ...items.map((m) => m.order ?? 0)) + 10;
    const item: Item = {
      id, name: name.slice(0, 40), desc: draft.desc.trim().slice(0, 160), price: Math.round(price), cat,
      veg: draft.veg, spice: draft.spice, special: draft.special || undefined, photo: draft.photo || undefined, order,
    };
    setBusy(true);
    setErr("");
    try {
      await onSave(item, newCat);
      setDraft(null);
      flash(draft.isNew ? `${item.name} added to the menu` : `${item.name} saved`);
    } catch {
      setErr("Couldn't save. Check the internet connection and tap Save again.");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!draft || draft.isNew) return;
    if (!confirmDel) return setConfirmDel(true);
    setBusy(true);
    try {
      await onDelete(draft.id);
      flash(`${draft.name} deleted from the menu`);
      setDraft(null);
    } catch {
      setErr("Couldn't delete. Check the internet connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // sections in order, plus any item whose section no longer exists
  const known = new Set(cats.map((c) => c.id));
  const groups: { cat: Cat; list: Item[] }[] = cats.map((c) => ({ cat: c, list: items.filter((m) => m.cat === c.id) }));
  const orphans = items.filter((m) => !known.has(m.cat));
  if (orphans.length) groups.push({ cat: { id: "__other", label: "Other" }, list: orphans });

  const previewItem: Item | null = draft
    ? { id: draft.id || "preview", name: draft.name || "New food", desc: "", price: 0, cat: draft.cat === NEW_CAT ? "__new" : draft.cat, photo: draft.photo }
    : null;

  return (
    <div className="stock">
      <button className="cta" onClick={openNew} type="button" id="btn-add-food">+ Add new food</button>
      <p className="fine">Tap Edit to change a dish or delete it. The switch marks it sold out. Customers see every change instantly.</p>
      {toast && <p className="toast" role="status">{toast}</p>}

      {groups.map(({ cat, list }) => (
        <section key={cat.id}>
          <h4>{cat.label} <small>{list.length} {list.length === 1 ? "item" : "items"}</small></h4>
          {list.length === 0 && <p className="fine">Empty section. Customers won't see it until you add food here.</p>}
          {list.map((m) => {
            const on = !soldOut.includes(m.id);
            return (
              <div key={m.id} className="stock-row edit-row">
                <FoodPic item={m} className="tiny" />
                <span>{m.name}<small>{rs(m.price)}{m.special ? " · special" : ""}</small></span>
                <label className="sw" htmlFor={`stock-${m.id}`}>
                  <input id={`stock-${m.id}`} type="checkbox" className="switch" checked={on} onChange={() => onToggleSold(m.id)} aria-label={`${m.name} available`} />
                  <em className={on ? "yes" : "no"}>{on ? "On" : "Sold out"}</em>
                </label>
                <button className="ghost small" onClick={() => open(toDraft(m))} type="button" id={`edit-${m.id}`}>Edit</button>
              </div>
            );
          })}
        </section>
      ))}

      {draft && previewItem && (
        <div className="overlay" onClick={() => !busy && setDraft(null)}>
          <div className="sheet food-form" role="dialog" aria-label={draft.isNew ? "Add new food" : `Edit ${draft.name}`} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <h3>{draft.isNew ? "Add new food" : `Edit ${draft.name}`}</h3>

            <div className="photo-pick">
              <FoodPic item={previewItem} />
              <div className="photo-btns">
                <label className="ghost small photo-up" htmlFor="f-photo">
                  {photoBusy ? "Loading…" : draft.photo ? "Change photo" : "Upload photo"}
                </label>
                <input id="f-photo" type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                {draft.photo && <button className="ghost small" type="button" onClick={() => set({ photo: undefined })}>Remove photo</button>}
                <p className="fine">{draft.photo ? "Real photo. Customers love these." : "No photo yet, so customers see a drawing. Take one from above in good light."}</p>
              </div>
            </div>

            <label htmlFor="f-fname">Food name</label>
            <input id="f-fname" value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} placeholder="e.g. Buff Momo" />

            <label htmlFor="f-fprice">Price ({RESTAURANT.currency})</label>
            <input id="f-fprice" value={draft.price} onChange={(e) => set({ price: e.target.value.replace(/[^\d.]/g, "") })} inputMode="numeric" placeholder="150" />

            <label htmlFor="f-fcat">Menu section</label>
            <select id="f-fcat" value={draft.cat} onChange={(e) => set({ cat: e.target.value })}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              {!known.has(draft.cat) && draft.cat !== NEW_CAT && <option value={draft.cat}>Other</option>}
              <option value={NEW_CAT}>+ New section…</option>
            </select>
            {draft.cat === NEW_CAT && (
              <input id="f-fnewcat" value={draft.newCat} onChange={(e) => set({ newCat: e.target.value })} maxLength={24} placeholder="New section name, e.g. Momo" />
            )}

            <label htmlFor="f-fdesc">Funny description</label>
            <textarea id="f-fdesc" value={draft.desc} onChange={(e) => set({ desc: e.target.value })} maxLength={160} rows={2} placeholder="Make them smile. e.g. So juicy it needs its own napkin." />

            <label>Type</label>
            <div className="seg seg-tight" role="radiogroup" aria-label="Veg or non-veg">
              <button type="button" role="radio" aria-checked={draft.veg} className={draft.veg ? "on" : ""} onClick={() => set({ veg: true })}>Veg</button>
              <button type="button" role="radio" aria-checked={!draft.veg} className={!draft.veg ? "on" : ""} onClick={() => set({ veg: false })}>Non-veg</button>
            </div>

            <label>Spice</label>
            <div className="chips wrap" role="radiogroup" aria-label="Spice level">
              {SPICE.map((l, i) => (
                <button key={l} type="button" role="radio" aria-checked={draft.spice === i} className={draft.spice === i ? "on" : ""} onClick={() => set({ spice: i as 0 | 1 | 2 | 3 })}>
                  {i ? "🌶".repeat(i) + " " : ""}{l}
                </button>
              ))}
            </div>

            <label className="stock-row special-row" htmlFor="f-fspecial">
              <span>Today's special<small>Shows at the top with a Mummy Approved stamp</small></span>
              <input id="f-fspecial" type="checkbox" className="switch" checked={draft.special} onChange={(e) => set({ special: e.target.checked })} />
            </label>

            {err && <p className="err" role="alert">{err}</p>}
            <button className="cta" type="button" onClick={save} disabled={busy || photoBusy} id="btn-save-food">
              {busy ? "Saving…" : draft.isNew ? "Add to menu" : "Save changes"}
            </button>
            {!draft.isNew && (
              <button className={`ghost ${confirmDel ? "danger" : ""}`} type="button" onClick={del} disabled={busy} id="btn-del-food">
                {confirmDel ? `Tap again to delete ${draft.name}` : "Delete this food"}
              </button>
            )}
            <button className="ghost" type="button" onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
