// Booking backend: talks to Square so the access token never reaches the browser.
//
//   GET  /api/shop          barbers + services set up in Square
//   POST /api/availability  { serviceIds, barberId?, from, to } → open times
//   POST /api/book          { serviceIds, barberId?, startAt, name, phone, email?, note? }
//
// Netlify environment variables:
//   SQUARE_ACCESS_TOKEN  (required) Square Developer → your app → Credentials
//   SQUARE_ENV           "sandbox" to use the Square sandbox
//   SQUARE_LOCATION_ID   only if the account has more than one location

import { randomUUID } from "node:crypto";

const TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const BASE = process.env.SQUARE_ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";

class SquareError extends Error {}

async function square(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "Square-Version": "2025-01-23" },
    body: body && JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(method, path, res.status, JSON.stringify(json.errors));
    const e = json.errors?.[0] ?? {};
    throw new SquareError(res.status === 403 && path.startsWith("/v2/bookings")
      ? "Online booking isn't enabled for this Square account yet."
      : e.detail || "Square request failed.");
  }
  return json;
}

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

// Shop data changes rarely; cache it for a few minutes per function instance.
let shopCache, shopCachedAt = 0;
async function getShop() {
  if (shopCache && Date.now() - shopCachedAt < 5 * 60 * 1000) return shopCache;

  const { locations = [] } = await square("GET", "/v2/locations");
  const location = locations.find((l) => l.id === process.env.SQUARE_LOCATION_ID) ?? locations.find((l) => l.status === "ACTIVE");
  if (!location) throw new SquareError("No active Square location.");

  const { team_member_booking_profiles: profiles = [] } = await square("GET",
    `/v2/bookings/team-member-booking-profiles?bookable_only=true&location_id=${location.id}`);
  const { team_members: team = [] } = await square("POST", "/v2/team-members/search", {
    query: { filter: { location_ids: [location.id], status: "ACTIVE" } },
  });
  const ownerId = team.find((m) => m.is_owner)?.id;
  const { items = [] } = await square("POST", "/v2/catalog/search-catalog-items", {
    product_types: ["APPOINTMENTS_SERVICE"],
    enabled_location_ids: [location.id],
  });

  const services = items.flatMap((item) => (item.item_data.variations ?? [])
    .filter((v) => v.item_variation_data.available_for_booking !== false)
    .map((v) => ({
      id: v.id,
      name: item.item_data.variations.length > 1 ? `${item.item_data.name} — ${v.item_variation_data.name}` : item.item_data.name,
      minutes: Math.round((v.item_variation_data.service_duration ?? 0) / 60000),
      price: (v.item_variation_data.price_money?.amount ?? 0) / 100,
      barberIds: v.item_variation_data.team_member_ids ?? [],
    })));

  shopCache = {
    location: { id: location.id, name: location.name, timezone: location.timezone, currency: location.currency },
    barbers: profiles.map((p) => ({ id: p.team_member_id, name: p.display_name.trim(), isOwner: p.team_member_id === ownerId })),
    services,
  };
  shopCachedAt = Date.now();
  return shopCache;
}

// Validates input against the shop and asks Square for open times.
async function searchAvailability({ serviceIds, barberId, from, to }) {
  const shop = await getShop();
  if (!Array.isArray(serviceIds) || !serviceIds.length || serviceIds.length > 5) throw new SquareError("Pick 1 to 5 services.");
  for (const id of serviceIds) if (!shop.services.some((s) => s.id === id)) throw new SquareError("Unknown service.");
  if (barberId && !shop.barbers.some((b) => b.id === barberId)) throw new SquareError("Unknown barber.");
  // Square errors if no bookable barber offers a service; treat that as "no times".
  const services = serviceIds.map((id) => shop.services.find((s) => s.id === id));
  const bookable = new Set(shop.barbers.map((b) => b.id));
  if (services.some((s) => !s.barberIds.some((id) => bookable.has(id) && (!barberId || id === barberId)))) return { shop, availabilities: [] };

  const { availabilities = [] } = await square("POST", "/v2/bookings/availability/search", {
    query: {
      filter: {
        start_at_range: { start_at: new Date(from).toISOString(), end_at: new Date(to).toISOString() },
        location_id: shop.location.id,
        segment_filters: serviceIds.map((id) => ({
          service_variation_id: id,
          ...(barberId && { team_member_id_filter: { any: [barberId] } }),
        })),
      },
    },
  });
  return { shop, availabilities };
}

function e164(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (String(phone).trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits; // Canada / US
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  return null;
}

async function findOrCreateCustomer({ name, phone, email }) {
  const { customers = [] } = await square("POST", "/v2/customers/search", {
    query: { filter: { phone_number: { exact: phone } } },
    limit: 1,
  });
  if (customers[0]) return customers[0].id;
  const [given, ...rest] = name.trim().split(/\s+/);
  const { customer } = await square("POST", "/v2/customers", {
    idempotency_key: randomUUID(),
    given_name: given,
    ...(rest.length && { family_name: rest.join(" ") }),
    phone_number: phone,
    ...(email && { email_address: email }),
  });
  return customer.id;
}

const routes = {
  "GET /api/shop": () => getShop(),

  "POST /api/availability": async (body) => {
    const days = (new Date(body.to) - new Date(body.from)) / 86400000;
    if (!(days >= 1 && days <= 31)) throw new SquareError("Date range must be 1 to 31 days.");
    const { availabilities } = await searchAvailability(body);
    return {
      slots: availabilities.map((a) => ({
        startAt: a.start_at,
        barberIds: [...new Set(a.appointment_segments.map((s) => s.team_member_id))],
      })),
    };
  },

  "POST /api/book": async (body) => {
    const name = String(body.name ?? "").trim().slice(0, 100);
    const phone = e164(body.phone ?? "");
    const email = String(body.email ?? "").trim().slice(0, 200);
    if (!name) throw new SquareError("Please enter your name.");
    if (!phone) throw new SquareError("Please enter a valid phone number.");

    // Re-check the time with Square and use its segments, never the browser's.
    const start = new Date(body.startAt);
    if (isNaN(start)) throw new SquareError("Pick a time.");
    const { shop, availabilities } = await searchAvailability({
      serviceIds: body.serviceIds, barberId: body.barberId,
      from: start.getTime() - 60000, to: start.getTime() + 86400000,
    });
    const slot = availabilities.find((a) => new Date(a.start_at).getTime() === start.getTime());
    if (!slot) throw new SquareError("That time was just taken. Please pick another.");

    const customerId = await findOrCreateCustomer({ name, phone, email });
    const { booking } = await square("POST", "/v2/bookings", {
      idempotency_key: randomUUID(),
      booking: {
        start_at: slot.start_at,
        location_id: shop.location.id,
        customer_id: customerId,
        ...(body.note && { customer_note: String(body.note).slice(0, 500) }),
        appointment_segments: slot.appointment_segments.map((s) => ({
          team_member_id: s.team_member_id,
          service_variation_id: s.service_variation_id,
          service_variation_version: s.service_variation_version,
          duration_minutes: s.duration_minutes,
        })),
      },
    });
    return { id: booking.id, startAt: booking.start_at, barberIds: [...new Set(booking.appointment_segments.map((s) => s.team_member_id))] };
  },
};

export default async (req) => {
  if (!TOKEN) return json({ error: "Square isn't connected (SQUARE_ACCESS_TOKEN not set)." }, 503);
  const route = routes[`${req.method} ${new URL(req.url).pathname.replace(/\/$/, "")}`];
  if (!route) return json({ error: "Not found" }, 404);
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : undefined;
    return json(await route(body));
  } catch (err) {
    if (err instanceof SquareError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: "Something went wrong. Please call the shop." }, 500);
  }
};

export const config = { path: "/api/*" };
