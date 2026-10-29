// Creates barbers (team members) and bookable services in a Square account.
//
//   SQUARE_ACCESS_TOKEN=... node setup.mjs            # dry run: shows what would change
//   SQUARE_ACCESS_TOKEN=... node setup.mjs --apply    # makes the changes
//
// Edit shop.json first. Safe to re-run: barbers and services are matched by
// name and never duplicated. Existing services are updated to match shop.json
// (price, length, which barbers offer them). A barber with "owner": true is
// the Square account owner, not a new team member.

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const APPLY = process.argv.includes("--apply");
const TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const BASE = process.env.SQUARE_ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
const shop = JSON.parse(readFileSync(new URL("./shop.json", import.meta.url)));

if (!TOKEN) {
  console.error("Set SQUARE_ACCESS_TOKEN first.");
  process.exit(1);
}

async function square(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "Square-Version": "2025-01-23" },
    body: body && JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}\n${JSON.stringify(json.errors, null, 2)}`);
  return json;
}

const fullName = (b) => [b.given_name, b.family_name].filter(Boolean).join(" ");

// 1. Location
const { locations = [] } = await square("GET", "/v2/locations");
const location = locations.find((l) => l.status === "ACTIVE");
if (!location) throw new Error("No active Square location found.");
console.log(`Location: ${location.name} (${location.country}, ${location.currency})`);
if (location.currency !== shop.currency) console.warn(`! shop.json currency is ${shop.currency}, location uses ${location.currency}`);

// 2. Barbers
const { team_members: existingTeam = [] } = await square("POST", "/v2/team-members/search", {
  query: { filter: { location_ids: [location.id], status: "ACTIVE" } },
});
const teamByName = new Map(existingTeam.map((m) => [fullName(m).toLowerCase(), m.id]));
const owner = existingTeam.find((m) => m.is_owner);
const barberId = {}; // given_name → team member id

for (const b of shop.barbers) {
  const name = fullName(b);
  if (b.owner && owner) { barberId[b.given_name] = owner.id; console.log(`  barber is the account owner: ${b.given_name}`); continue; }
  if (teamByName.has(name.toLowerCase())) { barberId[b.given_name] = teamByName.get(name.toLowerCase()); console.log(`  barber exists: ${name}`); continue; }
  console.log(`+ barber: ${name}`);
  if (!APPLY) continue;
  const { team_member } = await square("POST", "/v2/team-members", {
    idempotency_key: randomUUID(),
    team_member: {
      given_name: b.given_name,
      ...(b.family_name && { family_name: b.family_name }),
      ...(b.email && { email_address: b.email }),
      assigned_locations: { assignment_type: "EXPLICIT_LOCATIONS", location_ids: [location.id] },
    },
  });
  barberId[b.given_name] = team_member.id;
}

// 3. Services
const { objects: existingItems = [] } = await square("GET", "/v2/catalog/list?types=ITEM");
const itemByName = new Map(existingItems.map((o) => [o.item_data?.name?.toLowerCase(), o]));

const upserts = [];
for (const s of shop.services) {
  const who = s.barbers === "all" ? shop.barbers.map((b) => b.given_name) : s.barbers;
  const ids = who.map((n) => barberId[n]).filter(Boolean);
  const want = {
    price_money: { amount: Math.round(s.price * 100), currency: location.currency },
    service_duration: s.minutes * 60 * 1000,
    team_member_ids: ids,
  };
  const existing = itemByName.get(s.name.toLowerCase());

  if (existing) {
    const v = existing.item_data.variations?.[0];
    const d = v?.item_variation_data ?? {};
    const same = d.price_money?.amount === want.price_money.amount && d.service_duration === want.service_duration
      && [...(d.team_member_ids ?? [])].sort().join() === [...ids].sort().join();
    if (same) { console.log(`  service up to date: ${s.name}`); continue; }
    console.log(`~ service: ${s.name} — ${s.minutes} min, $${s.price} — ${who.join(", ")}`);
    upserts.push({ ...v, item_variation_data: { ...d, ...want, available_for_booking: true } });
    continue;
  }

  console.log(`+ service: ${s.name} — ${s.minutes} min, $${s.price} — ${who.join(", ")}`);
  const key = s.name.replace(/\W+/g, "_");
  upserts.push({
    type: "ITEM",
    id: `#${key}`,
    present_at_location_ids: [location.id],
    item_data: {
      name: s.name,
      description: s.description,
      product_type: "APPOINTMENTS_SERVICE",
      variations: [{
        type: "ITEM_VARIATION",
        id: `#${key}_v`,
        present_at_location_ids: [location.id],
        item_variation_data: { name: "Regular", pricing_type: "FIXED_PRICING", available_for_booking: true, ...want },
      }],
    },
  });
}

if (APPLY && upserts.length) {
  await square("POST", "/v2/catalog/batch-upsert", {
    idempotency_key: randomUUID(),
    batches: [{ objects: upserts }],
  });
}

console.log(APPLY ? "\nDone." : "\nDry run only. Re-run with --apply to make these changes.");
console.log(`Still to do in the Square dashboard: each barber's "bookable" toggle and bookable hours.`);
