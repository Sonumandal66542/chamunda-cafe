# Chamunda Cafe

Mobile ordering site for Chamunda Cafe, home of the paratha. Customers pick a table (1–8) as a guest or with their name and number, order from the menu, and track their order live. The Kitchen Boss screen shows incoming orders with a ding, moves them through cooking → ready → served, shows each table's bill, and switches items to sold out.

## Change the menu, prices or name

Everything lives in `src/data.ts`: restaurant name, tagline, number of tables, menu items, prices and the mascot's jokes.

## Firebase

- `src/firebase-config.ts` holds the Firebase web config (public by design).
- `firestore.rules` holds the database security rules. Paste them into Firebase console → Firestore → Rules.
- The admin logs in with the email and password created in Firebase console → Authentication → Users.

## Build and publish

```bash
pnpm install
./build-pages.sh          # builds the site into dist/
```

The contents of `dist/` are published on the `gh-pages` branch.
