// One command from "sample site" to "live bookings in Square".
//
//   SQUARE_ACCESS_TOKEN=... node go-live.mjs                  # set up Square + check everything
//   SQUARE_ACCESS_TOKEN=... node go-live.mjs --test-booking   # also book + cancel one test appointment
//   SQUARE_ACCESS_TOKEN=... node go-live.mjs --deploy         # also publish to Netlify with the token set
//
// Safe to re-run. Square can't make barbers bookable or set their hours by
// API, so the script tells you exactly which barbers still need that in the
// Square Dashboard, and checks again each time it runs.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const BASE = process.env.SQUARE_ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
const args = new Set(process.argv.slice(2));
const here = (p) => new URL(p, import.meta.url).pathname;
const shop = JSON.parse(readFileSync(here("./square-setup/shop.json")));

if (!TOKEN) {
  console.error("Set SQUARE_ACCESS_TOKEN first (Square Developer → your app → Production → Access token).");
  process.exit(1);
}

async function square(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "Square-Version": "2025-01-23" },
    body: body && JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.errors?.[0]?.detail ?? `${res.status}`), { status: res.status });
  return json;
}

const ok = (s) => console.log(`  ✓ ${s}`);
const todo = [];
const fail = (s, fix) => { console.log(`  ✗ ${s}`); if (fix) todo.push(fix); };

// 1. Barbers and services
console.log("\n1. Barbers and services in Square");
execFileSync("node", [here("./square-setup/setup.mjs"), "--apply"], { stdio: ["ignore", "pipe", "inherit"] })
  .toString().split("\n").filter((l) => l.startsWith("+")).forEach((l) => console.log(`  ${l}`));

const { locations = [] } = await square("GET", "/v2/locations");
const location = locations.find((l) => l.id === process.env.SQUARE_LOCATION_ID) ?? locations.find((l) => l.status === "ACTIVE");
ok(`Location: ${location.name} (${location.timezone})`);

const { items = [] } = await square("POST", "/v2/catalog/search-catalog-items", { product_types: ["APPOINTMENTS_SERVICE"], enabled_location_ids: [location.id] });
const services = items.flatMap((i) => i.item_data.variations.map((v) => ({ id: v.id, name: i.item_data.name, barberIds: v.item_variation_data.team_member_ids ?? [] })));
const missing = shop.services.filter((s) => !services.some((x) => x.name === s.name));
missing.length ? fail(`Services missing: ${missing.map((s) => s.name).join(", ")}`) : ok(`${shop.services.length} services`);

// 2. Bookable barbers with hours
console.log("\n2. Barbers bookable online, with open times this week");
const { team_member_booking_profiles: profiles = [] } = await square("GET", `/v2/bookings/team-member-booking-profiles?bookable_only=true&location_id=${location.id}`);
const { team_members: team = [] } = await square("POST", "/v2/team-members/search", { query: { filter: { location_ids: [location.id], status: "ACTIVE" } } });
const firstOpen = {};
for (const b of shop.barbers) {
  const member = b.owner ? team.find((m) => m.is_owner) : team.find((m) => m.given_name === b.given_name && (m.family_name ?? "") === b.family_name);
  if (!member) { fail(`${b.given_name}: not in Square`); continue; }
  if (!profiles.some((p) => p.team_member_id === member.id)) {
    fail(`${b.given_name}: not bookable`, `Square Dashboard → Staff → ${b.given_name} ${b.family_name}: turn on "Bookable", set bookable hours`);
    continue;
  }
  const service = services.find((s) => s.barberIds.includes(member.id));
  const { availabilities = [] } = await square("POST", "/v2/bookings/availability/search", {
    query: { filter: {
      start_at_range: { start_at: new Date().toISOString(), end_at: new Date(Date.now() + 7 * 864e5).toISOString() },
      location_id: location.id,
      segment_filters: [{ service_variation_id: service.id, team_member_id_filter: { any: [member.id] } }],
    } },
  });
  if (!availabilities.length) {
    fail(`${b.given_name}: bookable, but no open times in the next 7 days`, `Square Dashboard → Staff → ${b.given_name} ${b.family_name}: set bookable hours`);
    continue;
  }
  firstOpen[b.given_name] = availabilities[0];
  ok(`${b.given_name}: ${availabilities.length} open times this week`);
}

// 3. Optional: prove bookings can be created (needs Appointments Plus or Premium)
if (args.has("--test-booking")) {
  console.log("\n3. Test booking");
  const slot = Object.values(firstOpen)[0];
  if (!slot) fail("Skipped: no barber has open times yet");
  else {
    try {
      const { customer } = await square("POST", "/v2/customers", { idempotency_key: randomUUID(), given_name: "Test", family_name: "Booking (go-live check)" });
      const { booking } = await square("POST", "/v2/bookings", {
        idempotency_key: randomUUID(),
        booking: { start_at: slot.start_at, location_id: location.id, customer_id: customer.id, appointment_segments: slot.appointment_segments },
      });
      await square("POST", `/v2/bookings/${booking.id}/cancel`, { idempotency_key: randomUUID(), booking_version: booking.version });
      await square("DELETE", `/v2/customers/${customer.id}`);
      ok("Created a booking, then cancelled it — online booking works");
    } catch (err) {
      err.status === 403
        ? fail("Square refused the booking", "Square Dashboard → Appointments → subscribe to Appointments Plus or Premium (free trial available)")
        : fail(`Booking failed: ${err.message}`);
    }
  }
}

// 4. Optional: publish the site with the token set on the server
if (args.has("--deploy")) {
  console.log("\n4. Publish to Netlify");
  const site = process.env.NETLIFY_SITE ?? "mk-barbershop";
  const netlify = (...a) => execFileSync("npx", ["--yes", "netlify-cli", ...a], { cwd: here("../"), stdio: ["inherit", "pipe", "inherit"] }).toString();
  try {
    netlify("status");
  } catch {
    console.log("  Log in to Netlify in the browser window that opens…");
    execFileSync("npx", ["--yes", "netlify-cli", "login"], { stdio: "inherit" });
  }
  let out;
  try { out = netlify("deploy", "--prod", "--site", site, "--json"); }
  catch { out = netlify("deploy", "--prod", "--site-name", site, "--json"); }
  const deploy = JSON.parse(out);
  netlify("env:set", "SQUARE_ACCESS_TOKEN", TOKEN, "--secret", "--site", deploy.site_id);
  netlify("deploy", "--prod", "--site", deploy.site_id, "--json"); // redeploy so the function sees the token
  ok(`Live at ${deploy.url}`);
}

console.log(todo.length
  ? `\nStill to do (then run this again):\n${[...new Set(todo)].map((t) => `  - ${t}`).join("\n")}\n`
  : "\nAll set: the site books straight into Square.\n");
