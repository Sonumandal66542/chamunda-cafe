// ============================================================
//  EDIT THIS FILE to change the restaurant name, menu, prices,
//  tables and admin password. Everything else reads from here.
// ============================================================

export const RESTAURANT = {
  name: "Chamunda Cafe",
  tagline: "Home of the paratha. Diet starts tomorrow.",
  tables: 8,
  adminPassword: "TawaBoss#88",
  currency: "Rs",
};

export type Item = {
  id: string;
  name: string;
  desc: string;
  price: number;
  cat: string;
  special?: boolean;
  spice?: 0 | 1 | 2 | 3;
  veg?: boolean;
  // Real photo instead of the drawing. Put the photo in src/photos/, then at the top of this file:
  //   import alooPhoto from "./photos/aloo.jpg";
  // and on the item: photo: alooPhoto,
  photo?: string;
  order?: number; // position on the menu, set by the admin editor
};

export const CATEGORIES = [
  { id: "paratha", label: "Parathas" },
  { id: "burger", label: "Burgers" },
  { id: "snacks", label: "Snacks" },
  { id: "drinks", label: "Drinks" },
];

export const MENU: Item[] = [
  { id: "aloo", cat: "paratha", name: "Aloo Paratha", price: 100, special: true, spice: 1, veg: true,
    desc: "The OG. Mummy's recipe, stolen with love and zero permission." },
  { id: "aloo-cheese", cat: "paratha", name: "Aloo Cheese Paratha", price: 160, spice: 1, veg: true,
    desc: "Aloo met cheese. They fell in love. You get to eat the wedding." },
  { id: "aloo-pyar", cat: "paratha", name: "Aloo Pyar Paratha", price: 125, special: true, spice: 1, veg: true,
    desc: "Made with extra pyar. Cheaper than therapy, warmer than your ex." },
  { id: "paneer", cat: "paratha", name: "Paneer Paratha", price: 160, spice: 1, veg: true,
    desc: "So much paneer the cow sent a thank-you card." },
  { id: "chicken", cat: "paratha", name: "Chicken Paratha", price: 200, spice: 2, veg: false,
    desc: "The chicken crossed the road. Straight into this paratha. No regrets." },
  { id: "chicken-cheese", cat: "paratha", name: "Chicken Cheese Paratha", price: 250, special: true, spice: 2, veg: false,
    desc: "Chicken and cheese, together in one paratha. Gym trainers hate this one trick." },

  { id: "veg-burger", cat: "burger", name: "Veg Burger", price: 90, spice: 1, veg: true,
    desc: "For when your friend says 'I'm not that hungry'. They're lying." },
  { id: "chicken-smash", cat: "burger", name: "Chicken Smash Burger", price: 125, spice: 1, veg: false,
    desc: "Smashed flat, piled high. Hulk-approved. Napkins strongly advised." },

  { id: "aloo-chop", cat: "snacks", name: "Aloo Chop", price: 100, spice: 1, veg: true,
    desc: "Crispy outside, fluffy inside. Basically you after a good chiya." },
  { id: "paneer-pakoda", cat: "snacks", name: "Paneer Pakoda", price: 150, spice: 1, veg: true,
    desc: "Paneer in a crunchy jacket. Best friends with rain and chiya." },

  { id: "chiya", cat: "drinks", name: "Chiya", price: 40, spice: 0, veg: true,
    desc: "Fixes headaches, heartbreaks and Monday mornings." },
  { id: "lemon-mint", cat: "drinks", name: "Lemon Mint", price: 40, spice: 0, veg: true,
    desc: "Cool, fresh, a little sour. Like your crush's replies." },
  { id: "soft-drink", cat: "drinks", name: "Coke / Sprite / Fanta", price: 80, spice: 0, veg: true,
    desc: "Tell the staff which one. Or say 'surprise me' and live dangerously." },
];

// Things the paratha mascot says. Mix and match.
export const LINES = {
  idle: [
    "Oye! Diet kal se.",
    "I'm a paratha. I can talk. Don't make it weird.",
    "Calories don't count if you share. They do. Share anyway.",
    "Aaja cheat day ho, bhai.",
    "Tap me. I dare you.",
    "Aloo Pyar Paratha: because you deserve love too.",
    "Mummy approved. Gym trainer not approved.",
  ],
  poke: [
    "Aah! Careful, I'm still warm.",
    "Stop poking, start ordering.",
    "That tickles. Add butter to apologise.",
    "Bro I'm literally food.",
    "Hehe. Again? Okay, last time.",
  ],
  add: [
    "Good choice. Mummy would be proud.",
    "Ek aur? Hunchha ni!",
    "Your plate is getting heavy. Your heart, happy.",
    "The tawa just smiled.",
    "Butter levels rising. Stay calm.",
    "Legendary pick. Uncle at next table is jealous.",
  ],
  special: [
    "MUMMY APPROVED pick! Respect.",
    "You picked a special. You have taste, boss.",
  ],
  guest: [
    "Mystery guest! Very James Bond. Pick your table.",
    "No name? No problem. Hunger has no name.",
  ],
  customer: [
    "Name, number, table. Then pure paratha peace.",
    "We need your number. For the parathas, not for your mummy.",
  ],
  admin: [
    "Kitchen Boss only. Uncles who think they own the place, please go back.",
  ],
  wrongPass: [
    "Nice try, uncle. Kitchen Boss only.",
    "Wrong password. The tawa is judging you.",
    "Nope. Even the achar knows that's wrong.",
  ],
  empty: [
    "Your plate is empty. That's a crime here.",
  ],
};

export const STATUS = [
  { id: "new", label: "Order received", short: "New", line: "Your order reached the kitchen. Chef cracked his knuckles." },
  { id: "cooking", label: "On the tawa", short: "Cooking", line: "Sizzle sizzle. Your paratha is getting a tan." },
  { id: "ready", label: "Coming to your table", short: "Ready", line: "Hot plate incoming! Make space, move the phone." },
  { id: "served", label: "Served. Eat!", short: "Served", line: "Eat now, talk later. Rate us 5 stars in your heart." },
] as const;

export type StatusId = typeof STATUS[number]["id"];

export const BREAKING = [
  "BREAKING: Local paratha learns to talk, starts taking orders",
  "Butter declared a vegetable by the Ministry of Hunger",
  "Man orders 1 paratha, eats 4. Says 'just tasting'",
  "Local gym reports sudden drop in attendance. Owner suspects parathas",
  "Scientists confirm: Achar improves everything",
];

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
