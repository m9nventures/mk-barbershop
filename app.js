/* =========================================================
   SHOP SETTINGS — edit this block to make the site yours.
   Everything below is sample data to show the client.
   ========================================================= */
const CONFIG = {
  shopName: "MK Barbershop",
  currency: "CAD",
  taxRate: 0.13, // Ontario HST
  cancellation: "Free cancellation up to 12 hours before your appointment.",

  // Live booking runs through Square once SQUARE_ACCESS_TOKEN is set on
  // Netlify (see README). Barbers and services are matched to Square by name,
  // and Square's prices, lengths and open times are used.
  // Optional: Square's own booking page (this shop's is
  // https://square.site/book/L5EPV9HV51JB4/mk-barbershop). Used only when the
  // booking server isn't running. Empty = Book shows the on-site sample flow.
  BOOKING_URL: "",

  // Opening hours per weekday (0 = Sunday). null = closed.
  hours: { 0: [10, 15], 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 20], 5: [9, 20], 6: [8, 17] },

  // Services. addOn: true = only bookable alongside another service.
  services: [
    { id: "adult",   group: "Cuts",          name: "Adult Haircut",     desc: "Cut, wash and style",            mins: 30, price: 40, badge: "Popular" },
    { id: "fade",    group: "Cuts",          name: "Skin Fade",         desc: "Fade to the skin, line-up",       mins: 45, price: 45 },
    { id: "taper",   group: "Cuts",          name: "Taper",             desc: "Low or mid taper, scissor top",   mins: 30, price: 40 },
    { id: "student", group: "Cuts",          name: "Student Haircut",   desc: "Valid student ID",                mins: 30, price: 35 },
    { id: "kids",    group: "Cuts",          name: "Kids Haircut",      desc: "Under 12",                        mins: 30, price: 30 },
    { id: "senior",  group: "Cuts",          name: "Senior Haircut",    desc: "65 and over",                     mins: 30, price: 30 },
    { id: "lineup",  group: "Cuts",          name: "Line-Up",           desc: "Edge-up only",                    mins: 15, price: 20 },
    { id: "beard",   group: "Beard & Shave", name: "Beard Trim",        desc: "Shape and line-up",               mins: 20, price: 25 },
    { id: "shave",   group: "Beard & Shave", name: "Hot Towel Shave",   desc: "Straight razor, hot towels",      mins: 45, price: 50 },
    { id: "combo",   group: "Beard & Shave", name: "Haircut and Beard", desc: "Adult haircut plus beard trim",   mins: 60, price: 60 },
    { id: "design",  group: "Add-ons",       name: "Hair Design",       desc: "Lines or patterns, from $15",     mins: 15, price: 15, addOn: true },
    { id: "enhance", group: "Add-ons",       name: "Enhancements",      desc: "Colour fill for line-up or beard", mins: 15, price: 15, addOn: true },
    { id: "brows",   group: "Add-ons",       name: "Eyebrow Clean-Up",  desc: "Razor or trim",                   mins: 5,  price: 10, addOn: true },
  ],

  // Barbers. Photos go in images/ (portrait, about 4:5).
  // offDays: weekdays they don't work (0 = Sunday), demo only; live hours come from Square.
  // owner: true = this barber is the Square account owner.
  barbers: [
    { id: "marcus", name: "Marcus", role: "Owner — Fades",        photo: "marcus.jpg", offDays: [0], owner: true },
    { id: "andre",  name: "Andre",  role: "Tapers, designs",      photo: "andre.jpg",  offDays: [1] },
    { id: "kevin",  name: "Kevin",  role: "Beards, hot shaves",   photo: "kevin.jpg",  offDays: [2] },
    { id: "jordan", name: "Jordan", role: "Textured hair",        photo: "jordan.jpg", offDays: [0, 3] },
    { id: "tyler",  name: "Tyler",  role: "Scissor cuts",         photo: "tyler.jpg",  offDays: [4] },
    { id: "sam",    name: "Sam",    role: "Kids, classic cuts",   photo: "sam.jpg",    offDays: [0, 1] },
  ],
};

/* ========================================================= */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + (Number.isInteger(n) ? n : n.toFixed(2));
const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60 ? (m % 60) + " min" : ""}`.trim() : `${m} min`);
const groups = [...new Set(CONFIG.services.map((s) => s.group))];
const serviceById = (id) => CONFIG.services.find((s) => s.id === id);
const ANY = { id: "any", name: "Any barber", role: "First available" };

/* ---------- Page ---------- */

function renderMenu() {
  $("services-list").innerHTML = groups.map((g) => `
    <div class="service-group">
      <p class="label">${esc(g)}</p>
      ${CONFIG.services.filter((s) => s.group === g).map((s) => `
        <div class="service">
          <span class="service__name">${esc(s.name)}${s.badge ? `<span class="badge">${esc(s.badge)}</span>` : ""}
            <span class="service__desc">${esc(s.desc)}</span></span>
          <span class="service__time">${mins(s.mins)}</span>
          <span class="service__price">${money(s.price)}</span>
          <a class="service__book" data-book data-service="${s.id}">Book +</a>
        </div>`).join("")}
    </div>`).join("");
}
renderMenu();

$("barbers-list").innerHTML = CONFIG.barbers.map((b) => `
  <article class="barber">
    <div class="barber__photo" style="--img: url('images/${esc(b.photo)}')"></div>
    <div class="barber__meta">
      <div><div class="barber__name">${esc(b.name)}</div><div class="barber__role">${esc(b.role)}</div></div>
      <a class="barber__book" data-book data-barber="${b.id}">Book +</a>
    </div>
  </article>`).join("");

document.querySelectorAll("[data-shop-name]").forEach((el) => (el.textContent = CONFIG.shopName));
$("year").textContent = new Date().getFullYear();

// Hide a barber's initial once their photo exists.
const photoLoaded = {};
for (const b of CONFIG.barbers) {
  const img = new Image();
  img.onload = () => (photoLoaded[b.photo] = true);
  img.src = `images/${b.photo}`;
}

// Some hosts (e.g. Netlify's "Powered by" badge) pin a widget to the bottom
// corner. Keep the Book bar and the booking "Continue" button clear of it.
function clearHostBadge() {
  const badge = document.getElementById("nl-badge-frame");
  const h = badge ? badge.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty("--host-badge", `${Math.round(h)}px`);
}
new MutationObserver(clearHostBadge).observe(document.body, { childList: true, subtree: true });
addEventListener("resize", clearHostBadge);
clearHostBadge();

/* ---------- Square (live booking) ---------- */

async function api(path, body) {
  const res = await fetch(path, body && { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again or call the shop.");
  return data;
}

// Set once Square answers; null means demo or BOOKING_URL.
let LIVE = null;
const norm = (s) => s.trim().toLowerCase();

const liveReady = api("/api/shop").then((shop) => {
  const match = (b) => shop.barbers.find((x) => (b.owner && x.isOwner) || norm(x.name) === norm(b.name) || norm(x.name).split(" ")[0] === norm(b.name));
  // Stay in demo until at least one barber on the site is bookable in Square.
  if (!CONFIG.barbers.some(match)) throw new Error("No bookable barbers yet");
  for (const s of CONFIG.services) {
    s.square = shop.services.find((x) => [norm(s.name), `add-on: ${norm(s.name)}`].includes(norm(x.name)));
    if (s.square) Object.assign(s, { mins: s.square.minutes, price: s.square.price });
  }
  for (const b of CONFIG.barbers) {
    b.squareId = match(b)?.id;
  }
  LIVE = shop;
  renderMenu();
  document.querySelector("#booking .bk-bar .badge").style.display = "none";
}).catch(() => {
  if (!CONFIG.BOOKING_URL) return;
  document.querySelectorAll("[data-book]").forEach((a) => Object.assign(a, { href: CONFIG.BOOKING_URL, target: "_blank", rel: "noopener" }));
});

const barberBySquareId = (id) => CONFIG.barbers.find((b) => b.squareId === id);
// Square says which barbers offer each service.
const offers = (barber, service) => !LIVE || (!!service.square && !!barber.squareId && service.square.barberIds.includes(barber.squareId));
const bookableBarbers = () => CONFIG.barbers.filter((b) => !LIVE || b.squareId);

/* ---------- Availability ---------- */

const days = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + i);
  return d;
});

const timeLabel = (m) => {
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? "AM" : "PM"}`;
};
const dayLabel = (d, opts = { weekday: "long", month: "long", day: "numeric" }) => d.toLocaleDateString("en-CA", opts);

// Calendar day in the shop's time zone, e.g. "2026-10-29".
const shopDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: LIVE?.location.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const dayKey = (d) => shopDay(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));
const shopTime = (iso) => new Date(iso).toLocaleTimeString("en-CA", { timeZone: LIVE.location.timezone, hour: "numeric", minute: "2-digit" }).replace(/\./g, "").toUpperCase();

// Demo: deterministic "taken" slots so the flow looks lived-in.
function isTaken(barberId, date, minute) {
  let h = 0;
  for (const c of `${barberId}${date.toDateString()}${minute}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 10 < 4;
}

function worksOn(barber, date) {
  return CONFIG.hours[date.getDay()] && !barber.offDays.includes(date.getDay());
}

function slotsFor(barber, date, length) {
  const hours = CONFIG.hours[date.getDay()];
  if (!hours || !worksOn(barber, date)) return [];
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const out = [];
  for (let m = hours[0] * 60; m + length <= hours[1] * 60; m += 30) {
    if (isToday && m <= now.getHours() * 60 + now.getMinutes() + 30) continue;
    if (!isTaken(barber.id, date, m)) out.push(m);
  }
  return out;
}

function demoTimes(day) {
  const len = totalMins() || 30;
  const who = state.barber === "any" ? CONFIG.barbers : [barberObj()];
  const map = new Map();
  for (const b of who) for (const m of slotsFor(b, day, len)) if (!map.has(m)) map.set(m, b.id);
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([m, id]) => ({ key: String(m), label: timeLabel(m), who: id }));
}

// Live: one request covers all 14 days for the current barber + services.
async function loadSlots() {
  const req = JSON.stringify([state.barber, state.services]);
  if (state.slotsReq === req) return;
  Object.assign(state, { slotsReq: req, slots: null });
  let slots;
  try {
    const to = new Date(days[days.length - 1]);
    to.setDate(to.getDate() + 1);
    const res = await api("/api/availability", {
      serviceIds: chosen().map((s) => s.square.id),
      barberId: state.barber === "any" ? null : barberObj().squareId,
      from: new Date(), to,
    });
    slots = new Map();
    for (const s of res.slots) {
      const who = barberBySquareId(s.barberIds[0]);
      if (!who) continue;
      const k = shopDay(new Date(s.startAt));
      if (!slots.has(k)) slots.set(k, []);
      slots.get(k).push({ key: s.startAt, label: shopTime(s.startAt), who: who.id });
    }
  } catch (err) {
    slots = { error: err.message };
  }
  if (state.slotsReq !== req) return;
  state.slots = slots;
  if (state.step === "time") render();
}

function times(day) {
  if (!LIVE) return demoTimes(day);
  return state.slots instanceof Map ? state.slots.get(dayKey(day)) ?? [] : [];
}

/* ---------- Booking flow ---------- */

const STEPS = ["barber", "service", "time", "checkout", "done"];
const TITLES = { barber: "Choose a barber", service: "Choose services", time: "Choose a time", checkout: "Confirm booking", done: "You're booked" };
const state = {};

function reset() {
  Object.assign(state, {
    step: "barber", barber: null, services: [], day: null, time: null, timeText: "", assigned: null,
    name: "", phone: "", email: "", note: "",
    slots: null, slotsReq: null, submitting: false, error: "",
  });
}

function openBooking({ barber, service } = {}) {
  reset();
  if (service && (!LIVE || serviceById(service).square)) state.services = [service];
  if (barber && bookableBarbers().some((b) => b.id === barber)) state.barber = barber;
  state.step = state.barber ? "service" : "barber";
  $("booking").hidden = false;
  document.body.style.overflow = "hidden";
  render();
}

function closeBooking() {
  $("booking").hidden = true;
  document.body.style.overflow = "";
}

const chosen = () => state.services.map(serviceById);
const totalMins = () => chosen().reduce((n, s) => n + s.mins, 0);
const subtotal = () => chosen().reduce((n, s) => n + s.price, 0);
const barberObj = () => (state.barber === "any" ? ANY : CONFIG.barbers.find((b) => b.id === state.barber));
const assignedBarber = () => CONFIG.barbers.find((b) => b.id === (state.barber === "any" ? state.assigned : state.barber));

function canBook(s) {
  if (s.addOn && !state.services.some((id) => !serviceById(id).addOn)) return false;
  if (!LIVE) return true;
  if (!s.square) return false;
  return state.barber === "any" ? bookableBarbers().some((b) => offers(b, s)) : offers(barberObj(), s);
}

function totals() {
  const sub = subtotal(), tip = 0, tax = sub * CONFIG.taxRate;
  return { sub, tip, tax, total: sub + tip + tax };
}

function render() {
  const i = STEPS.indexOf(state.step);
  if (state.step === "time" && LIVE) loadSlots();
  $("bk-title").textContent = TITLES[state.step];
  $("bk-step").textContent = state.step === "done" ? CONFIG.shopName : `Step ${i + 1} of 4`;
  $("bk-back").style.visibility = i === 0 || state.step === "done" ? "hidden" : "visible";
  $("bk-body").innerHTML = VIEWS[state.step]();
  $("bk-body").scrollTop = 0;
  renderFoot();
}

function renderFoot() {
  const next = $("bk-next");
  const n = state.services.length;
  $("bk-meta").textContent = n ? `${barberObj()?.name ?? "No barber"} — ${n} service${n > 1 ? "s" : ""} — ${mins(totalMins())}` : barberObj() ? barberObj().name : "Nothing selected";
  $("bk-total").textContent = n ? `${money(subtotal())} ${CONFIG.currency}` : "";
  $("bk-foot").hidden = state.step === "done";

  const ready = {
    barber: !!state.barber,
    service: state.services.some((id) => !serviceById(id).addOn),
    time: state.time !== null,
    checkout: state.name.trim() && state.phone.trim() && !state.submitting,
  }[state.step];
  next.disabled = !ready;
  next.textContent = state.step !== "checkout" ? "Continue"
    : state.submitting ? "Booking…" : "Confirm booking";
}

const VIEWS = {
  barber: () => `
    <div class="bk-grid">
      ${[ANY, ...bookableBarbers()].map((b) => {
        const able = b.id === "any" || chosen().every((s) => offers(b, s));
        let sub = b.role;
        if (!able) sub = "Doesn't offer this";
        else if (!LIVE && b.id !== "any") {
          const next = days.find((d) => slotsFor(b, d, 30).length);
          sub = next ? `Next: ${next.toDateString() === days[0].toDateString() ? "Today" : dayLabel(next, { weekday: "short" })}` : "Fully booked";
        }
        return `
        <button class="bk-card bk-barber" data-pick-barber="${b.id}" aria-pressed="${state.barber === b.id}" ${able ? "" : "disabled"}>
          <span class="bk-photo${photoLoaded[b.photo] ? " has-photo" : ""}" ${b.photo ? `style="--img: url('images/${esc(b.photo)}')"` : ""}>${b.id === "any" ? "+" : esc(b.name[0])}</span>
          <strong>${esc(b.name)}</strong>
          <span class="bk-sub">${esc(sub)}</span>
        </button>`;
      }).join("")}
    </div>`,

  service: () => groups.map((g) => `
    <p class="label bk-group">${esc(g)}${g === "Add-ons" ? " — with another service" : ""}</p>
    <div class="bk-grid bk-grid--services">
      ${CONFIG.services.filter((s) => s.group === g).map((s) => `
        <button class="bk-card bk-service" data-pick-service="${s.id}" aria-pressed="${state.services.includes(s.id)}" ${canBook(s) ? "" : "disabled"}>
          <strong>${esc(s.name)}</strong>
          <span class="bk-sub">${mins(s.mins)}</span>
          <span class="bk-price">${money(s.price)}</span>
        </button>`).join("")}
    </div>`).join(""),

  time: () => {
    if (LIVE && !(state.slots instanceof Map)) {
      return state.slots?.error
        ? `<p class="bk-empty">${esc(state.slots.error)}</p><button class="btn" data-retry>Try again</button>`
        : `<p class="bk-empty">Checking ${esc(barberObj().name === ANY.name ? "the barbers'" : barberObj().name + "'s")} calendar…</p>`;
    }
    if (!state.day) state.day = days.find((d) => times(d).length) || days[0];
    const list = times(state.day);
    return `
      <div class="bk-days">
        ${days.map((d, i) => `
          <button class="bk-day" data-pick-day="${i}" aria-pressed="${d.getTime() === state.day.getTime()}" ${times(d).length ? "" : "disabled"}>
            <span>${dayLabel(d, { weekday: "short" })}</span><strong>${d.getDate()}</strong>
          </button>`).join("")}
      </div>
      <p class="label">${dayLabel(state.day)} — ${list.length} times available</p>
      ${list.length ? `<div class="bk-times">
        ${list.map((t) => `<button class="bk-time" data-pick-time="${esc(t.key)}" data-label="${esc(t.label)}" data-who="${t.who}" aria-pressed="${state.time === t.key}">${esc(t.label)}</button>`).join("")}
      </div>` : `<p class="bk-empty">No times this day. Try another date.</p>`}`;
  },

  checkout: () => {
    const t = totals(), b = assignedBarber();
    return `
      <div class="bk-checkout">
        <section>
          <p class="label">Appointment</p>
          <div class="bk-summary">
            <div><span>${esc(dayLabel(state.day))}</span><span>${esc(state.timeText)}</span></div>
            <div><span>Barber</span><span>${esc(b.name)}</span></div>
            ${chosen().map((s) => `<div><span>${esc(s.name)} — ${mins(s.mins)}</span><span>${money(s.price)}</span></div>`).join("")}
          </div>



          <p class="label">Your details</p>
          <label class="bk-field"><span>Name</span><input data-field="name" autocomplete="name" value="${esc(state.name)}" required></label>
          <label class="bk-field"><span>Phone</span><input data-field="phone" type="tel" autocomplete="tel" value="${esc(state.phone)}" required></label>
          <label class="bk-field"><span>Email (optional)</span><input data-field="email" type="email" autocomplete="email" value="${esc(state.email)}"></label>
          <label class="bk-field"><span>Note for your barber (optional)</span><input data-field="note" maxlength="500" value="${esc(state.note)}"></label>
        </section>

        <section>
          <p class="label">Payment</p>
          <p class="bk-note">Pay in the shop after your cut. Card, Apple Pay, Google Pay or cash.</p>

          <p class="label">Cancellation policy</p>
          <p class="bk-note">${esc(CONFIG.cancellation)}</p>

          <p class="label">Summary</p>
          <div class="bk-summary">
            <div><span>Services</span><span>${money(t.sub)}</span></div>
            <div><span>HST (${CONFIG.taxRate * 100}%)</span><span>${money(t.tax)}</span></div>
            <div class="bk-summary__total"><span>Total, paid in shop</span><span>${money(t.total)} ${CONFIG.currency}</span></div>
          </div>
          ${state.error ? `<p class="bk-error" role="alert">${esc(state.error)}</p>` : ""}
        </section>
      </div>`;
  },

  done: () => {
    const b = assignedBarber();
    return `
      <div class="bk-done">
        <p class="label">${LIVE ? "Booking confirmed" : "Demo — no booking was made"}</p>
        <h3>See you ${esc(dayLabel(state.day, { weekday: "long" }))}, ${esc(state.name.trim().split(" ")[0])}.</h3>
        <div class="bk-summary">
          <div><span>When</span><span>${esc(dayLabel(state.day))} — ${esc(state.timeText)}</span></div>
          <div><span>Barber</span><span>${esc(b.name)}</span></div>
          <div><span>Services</span><span>${chosen().map((s) => esc(s.name)).join(", ")}</span></div>
          <div class="bk-summary__total"><span>Total</span><span>${money(totals().total)} ${CONFIG.currency}</span></div>
        </div>
        <p class="bk-note">${LIVE ? "Need to change it? Use the link in your confirmation, or call the shop." : "Sample booking: on the live site this goes straight into the shop's Square calendar and a confirmation is sent."}</p>
        <button class="btn" data-close-booking>Done</button>
      </div>`;
  },
};

function go(step) {
  state.step = step;
  render();
}

async function submitBooking() {
  Object.assign(state, { submitting: true, error: "" });
  render();
  try {
    const res = await api("/api/book", {
      serviceIds: chosen().map((s) => s.square.id),
      barberId: state.barber === "any" ? null : barberObj().squareId,
      startAt: state.time,
      name: state.name, phone: state.phone, email: state.email, note: state.note,
    });
    state.assigned = barberBySquareId(res.barberIds[0])?.id ?? state.assigned;
    state.submitting = false;
    go("done");
  } catch (err) {
    // The time may have gone; fetch fresh times if they go back.
    Object.assign(state, { submitting: false, error: err.message, slotsReq: null });
    render();
  }
}

/* ---------- Events ---------- */

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-book],[data-pick-barber],[data-pick-service],[data-pick-day],[data-pick-time],[data-close-booking],[data-retry]");
  if (!el) return;

  if (el.matches("[data-book]")) {
    if (el.href) return; // Square's own booking page
    e.preventDefault();
    liveReady.then(() => {
      if (!LIVE && CONFIG.BOOKING_URL) window.open(CONFIG.BOOKING_URL, "_blank", "noopener");
      else openBooking({ barber: el.dataset.barber, service: el.dataset.service });
    });
  } else if (el.dataset.pickBarber) {
    state.barber = el.dataset.pickBarber;
    state.day = state.time = null;
    go("service");
  } else if (el.dataset.pickService) {
    const id = el.dataset.pickService;
    state.services = state.services.includes(id) ? state.services.filter((x) => x !== id) : [...state.services, id];
    // Drop add-ons if no main service is left.
    if (!state.services.some((x) => !serviceById(x).addOn)) state.services = [];
    state.day = state.time = null;
    render();
  } else if (el.dataset.pickDay) {
    state.day = days[Number(el.dataset.pickDay)];
    state.time = null;
    render();
  } else if (el.dataset.pickTime) {
    Object.assign(state, { time: el.dataset.pickTime, timeText: el.dataset.label, assigned: el.dataset.who });
    document.querySelectorAll("[data-pick-time]").forEach((b) => b.setAttribute("aria-pressed", b === el));
    renderFoot();
  } else if (el.matches("[data-retry]")) {
    state.slotsReq = null;
    render();
  } else if (el.matches("[data-close-booking]")) {
    closeBooking();
  }
});

document.addEventListener("input", (e) => {
  const f = e.target.dataset?.field;
  if (!f) return;
  state[f] = e.target.value;
  renderFoot();
});

$("bk-next").addEventListener("click", () => {
  const i = STEPS.indexOf(state.step);
  if (state.step === "checkout") {
    const form = document.querySelectorAll("#bk-body input");
    for (const input of form) if (!input.reportValidity()) return;
    if (LIVE) return submitBooking();
    // Demo: same "Booking…" moment as the real thing.
    Object.assign(state, { submitting: true });
    renderFoot();
    return setTimeout(() => { state.submitting = false; go("done"); }, 900);
  }
  go(STEPS[i + 1]);
});
$("bk-back").addEventListener("click", () => {
  state.error = "";
  go(STEPS[STEPS.indexOf(state.step) - 1]);
});
$("bk-close").addEventListener("click", closeBooking);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("booking").hidden) closeBooking();
});
