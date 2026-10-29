# MK Barbershop — website with Square booking

**Fastest path:** run `SQUARE_ACCESS_TOKEN=... node tools/go-live.mjs`. It sets up Square, checks every barber is bookable with open times, and lists anything left to do. Add `--test-booking` to prove bookings go through, and `--deploy` to publish to Netlify with the token set.

Customers book on this site with its own booking screens: barber → services → time → confirm. Open times come live from Square, and every booking lands in your Square Appointments calendar like any other.

## How it fits together
- `index.html`, `styles.css`, `app.js`: the website.
- `netlify/functions/api.mjs`: a small server that talks to Square. Your Square key stays on the server, never in the browser.
- `tools/square-setup`: a one-time script that creates the barbers and services in Square.

## 1. Square account
1. Sign up for Square Appointments. **Online booking from your own site needs Appointments Plus or Premium**, since Square blocks bookings made with your own key on the free plan. Plus has a free trial.
2. Get an access token: developer.squareup.com → Applications → New application → Production → **Access token**. Treat it like a password.

## 2. Create the barbers and services (one time)
Edit `tools/square-setup/shop.json` if anything changed (names, prices, lengths, who offers what). Then run:

```bash
cd tools/square-setup
SQUARE_ACCESS_TOKEN=your-token node setup.mjs           # preview
SQUARE_ACCESS_TOKEN=your-token node setup.mjs --apply   # create
```

Already done for this account: 6 example barbers (last name "Example") and 13 services. When the real team is known, change the names in Square and in `app.js`, or deactivate the examples.

Then in the Square Dashboard → Staff, for each barber: turn on **bookable** and set their **working hours**. That's the calendar the site reads. Square doesn't allow either of those to be set by a script.

## 3. Publish on Netlify
Drag-and-drop deploys can't run the booking server, so deploy with the Netlify CLI or a Git repo:

```bash
npx netlify-cli deploy --prod
```

Then in Netlify → Site configuration → Environment variables, add:
- `SQUARE_ACCESS_TOKEN`: your token
- `SQUARE_LOCATION_ID`: only if you have more than one Square location

Redeploy after adding them. The "Demo" tag disappears from the booking screen once the site is talking to Square.

## Notes
- Barbers and services are matched to Square **by name**. A service missing in Square shows as unavailable, and a barber missing in Square is hidden from booking. Prices and lengths shown on the site come from Square.
- Customers pay in the shop. Use Square's settings for confirmation texts or emails, reminders and cancellation policy.
- Edit the address, phone and hours in `index.html`. Edit the shop name, services and barbers' descriptions in `app.js`. Add photos to `images/`.
- Photos and the hero video are stock samples (credits in `images/README.txt`). Swap in the shop's own with the same file names.
- Until at least one barber is bookable in Square, Book buttons open a sample flow marked "Demo" — good for showing the shop. It switches to live Square booking by itself, with no code change.
- Want Square's own booking page instead? Paste its link into `BOOKING_URL` in `app.js` (this shop's: https://square.site/book/L5EPV9HV51JB4/mk-barbershop).
