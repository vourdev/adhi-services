# Adhi Nugroho: link-in-bio platform

A personal link-in-bio site with its own admin dashboard, first-party
analytics and product checkout.

- **Public profile** at `/{username}`: edge-to-edge cover, photo, bio, social
  icons, links (a "featured" link with an image becomes a large card),
  section headings and product cards (two or more in a row form a grid).
  Product pages at `/{username}/{slug}`.
- **Admin dashboard** at `/admin`: Overview, Analytics, Links, Products,
  Discounts, Orders, Profile, Settings.
- **Analytics** recorded on this server: profile views, unique visitors,
  link clicks, CTR, traffic sources, devices and the product funnel.
- **Products** with a per-product checkout method: **WhatsApp** (pre-filled
  chat) or **direct checkout** through Midtrans Snap, with signed, expiring
  downloads after verified payment, and **discount codes** (see below).
- **WhatsApp cards**: a link block that opens a chat with the number from
  Settings and a prefilled message (the "Jasa Pembuatan Website" card). It
  stays hidden on the profile until the number is set; the Links page says so.
- Social icons (including Portfolio) show their name in a tooltip on hover or
  keyboard focus. Web addresses typed in the bio become links.

Stack: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, shadcn/ui
(radix-nova components copied from the reference dashboard), Drizzle ORM on
SQLite/libSQL, zod, react-hook-form, recharts. Node 22.18 or newer.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run setup                # migrate the database, create the owner account and profile
npm run dev                  # http://localhost:3000  (dashboard: /admin)
```

`npm run setup` reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` and
`ADMIN_USERNAME` from `.env.local`, or asks for them. Remove `ADMIN_PASSWORD`
from the file afterwards. There is no public sign-up.

| Command                   | What it does                                                      |
| ------------------------- | ----------------------------------------------------------------- |
| `npm run dev`             | Development server                                                |
| `npm run check`           | ESLint + TypeScript + all tests                                   |
| `npm run build` / `start` | Production build / serve                                          |
| `npm run setup`           | Apply migrations; create the owner if none exists (safe to rerun) |
| `npm run db:migrate`      | Apply pending migrations only                                     |
| `npm run db:generate`     | Generate a migration after editing `db/schema.ts`                 |
| `npm run db:studio`       | Drizzle Studio (browse the database)                              |
| `npm run admin:password`  | Reset the owner password and sign out every session               |

## Environment variables

All are server-side; none use the `NEXT_PUBLIC_` prefix, so none reach the
browser.

| Variable                 | Required              | Purpose                                                                                                                                                                                                                                   |
| ------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | no                    | `file:./data/app.db` by default. A `libsql://...` URL for Turso.                                                                                                                                                                          |
| `DATABASE_AUTH_TOKEN`    | with Turso            | Turso auth token.                                                                                                                                                                                                                         |
| `SITE_URL`               | production            | Public origin, e.g. `https://adhinugroho.id`. Canonical URLs, Open Graph, sitemap, WhatsApp product links, Midtrans finish redirect. Without a public https value: `robots.txt` blocks indexing and direct checkout is off in production. |
| `AUTH_SECRET`            | production            | 32+ random characters. Signs download links. `openssl rand -base64 36`                                                                                                                                                                    |
| `STORAGE_DIR`            | no                    | `./storage` by default (uploaded images and private product files).                                                                                                                                                                       |
| `MIDTRANS_SERVER_KEY`    | for direct checkout   | Midtrans server key (`SB-Mid-server-...` for sandbox).                                                                                                                                                                                    |
| `MIDTRANS_IS_PRODUCTION` | no                    | `true` for live transactions. Anything else means sandbox.                                                                                                                                                                                |
| `RESEND_API_KEY`         | for order emails      | Set by the Vercel Resend integration.                                                                                                                                                                                                     |
| `EMAIL_FROM`             | for order emails      | Sender address on a domain verified in Resend, e.g. `pesanan@domain-anda.id`. Order emails stay off until this and `RESEND_API_KEY` are set.                                                                                              |
| `MIDTRANS_CLIENT_KEY`    | no                    | Not used: checkout uses Snap redirect mode, which needs only the server key.                                                                                                                                                              |
| `ADMIN_*`                | setup only            | Owner account values for `npm run setup`.                                                                                                                                                                                                 |

## Before going live

1. **Domain**: set `SITE_URL` to the https domain and `AUTH_SECRET` to a new
   random value on the server.
2. **WhatsApp number**: Dashboard → Settings → "Nomor WhatsApp default". It is
   used by WhatsApp-checkout products and WhatsApp cards (the website-service
   card appears once it is set), and is never shown on the profile. It is not
   in the CV, so it has not been filled in.
3. **Midtrans** (only for direct checkout):
   - Dashboard Midtrans → Settings → Payment. Settings in this dashboard lists
     these URLs with copy buttons:

     | Midtrans field                     | URL                                                |
     | ---------------------------------- | -------------------------------------------------- |
     | Finish Redirect URL                | `{SITE_URL}/api/payments/midtrans/finish`          |
     | Unfinish Redirect URL              | `{SITE_URL}/api/payments/midtrans/unfinish`        |
     | Error Redirect URL                 | `{SITE_URL}/api/payments/midtrans/error`           |
     | Payment notification URL           | `{SITE_URL}/api/payments/midtrans`                 |
     | Recurring payment notification URL | `{SITE_URL}/api/payments/midtrans/recurring`       |
     | Account linking notification URL   | `{SITE_URL}/api/payments/midtrans/account-linking` |

     Every order already sends its own finish and error redirect and its
     notification URL (`X-Override-Notification`), so only Unfinish strictly
     needs the dashboard. If another shop shares the Midtrans account, its
     orders follow the dashboard values: changing them moves its redirects and
     notifications here (they are acknowledged and ignored).
   - Set the merchant name in Midtrans (Snap currently shows "Order Store").
   - Test in sandbox, then switch to production keys and
     `MIDTRANS_IS_PRODUCTION=true`. Production keys need an approved Midtrans
     merchant account.
4. **Hosting**: see "Deploying". Uploaded files need a persistent disk.

## How it works

### Routes

| Route                                                | Purpose                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/`                                                  | Redirects to the owner's profile                                                                     |
| `/{username}`                                        | Public profile                                                                                       |
| `/{username}/{slug}`                                 | Product page (drafts visible only to the signed-in owner)                                            |
| `/{username}/{slug}/checkout`                        | Direct-checkout form (with discount code) → Midtrans Snap                                            |
| `/pesanan/{code}?t={token}`                          | Buyer's order page: status, download (`&hasil=` adds a note after an unfinished or failed payment)   |
| `/pesanan/{code}/invoice?t=` (or `?k=`)              | Printable invoice (print or save as PDF from the browser)                                            |
| `/pembayaran/{selesai,belum-selesai,gagal}`          | Payment result for a browser that does not hold the order's link                                     |
| `/go/l/{id}`, `/go/p/{id}`, `/go/wa/{id}`            | Tracked redirects: link click, product card click, WhatsApp hand-off (`?kode=` adds a discount code) |
| `/api/events`                                        | Page-view beacon (profile, product, checkout)                                                        |
| `/api/payments/midtrans`                             | Midtrans HTTP notification (webhook)                                                                 |
| `/api/payments/midtrans/{finish,unfinish,error}`     | Midtrans browser redirects (GET or POST) → order page or `/pembayaran/...`                           |
| `/api/payments/midtrans/{recurring,account-linking}` | Midtrans notifications for features not used here: verified or acknowledged, nothing stored          |
| `/api/download/{id}?exp&sig`                         | Signed, expiring download for a paid order                                                           |
| `/api/admin/uploads`                                 | Owner-only image and product-file upload                                                             |
| `/media/...`                                         | Uploaded images (re-encoded WebP)                                                                    |
| `/admin/...`                                         | Dashboard (sign-in at `/admin/login`)                                                                |
| `/privasi`                                           | What is recorded and why                                                                             |

### Code layout

```
app/                 routes (public pages, admin, route handlers)
  admin/_actions/    Server Actions: each verifies the session, validates with zod, calls a service
  admin/_components/ dashboard shell, charts, shared admin widgets
components/profile/  public profile components (pure, also used for the dashboard preview)
components/ui/       shadcn/ui primitives copied from the reference dashboard
server/              services: auth, profile/links, products, checkout, analytics, storage, payments
lib/                 pure helpers: validation, analytics rules, formatting, env
db/                  Drizzle schema, client, migrations
tests/               node:test unit + integration tests (real SQLite file per test file)
scripts/             setup, migrate, password reset
```

Services in `server/` take a database handle and plain inputs, so they are
tested without Next.js. Pages and actions are thin: authenticate, validate,
call the service, revalidate.

### Data model

`users`, `sessions` (SHA-256 of an opaque token), `auth_attempts`,
`profiles`, `social_links`, `profile_links` (ordered blocks: link, WhatsApp card, heading
or product card), `products`, `discount_codes`, `orders` (with the code
text and rupiah cut copied in), `order_items`,
`payment_transactions`, `webhook_events`, `digital_deliveries`,
`analytics_events`. Foreign keys are enforced; money is whole rupiah in
integers; timestamps are epoch milliseconds. Indexes cover profile + event
type + time, link + time, product + type + time, and the unique keys used for
idempotency (event key, order code, idempotency key, webhook key).

### Analytics

| Metric               | Definition                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Profile views        | Profile page loads reported by the beacon. Each load has a random key; a repeated key is stored once.                          |
| Unique visitors      | Distinct `lb_vid` values (random first-party cookie, 1 year) on profile views in the period. This counts browsers, not people. |
| Sessions             | Distinct `lb_sid` values (rolling 30-minute cookie).                                                                           |
| Link clicks          | Recorded by `/go/l/{id}` before redirecting. The same browser clicking the same link within 2 s counts once.                   |
| Overall CTR          | link clicks ÷ profile views × 100                                                                                              |
| Link CTR             | clicks on that link ÷ profile views × 100 (same denominator, so link CTRs add up to the overall CTR)                           |
| Product CTR          | product card clicks ÷ profile views × 100                                                                                      |
| WhatsApp clicks      | Hand-offs to a WhatsApp chat. Not sales.                                                                                       |
| Paid orders, revenue | Orders verified paid by the server (webhook signature + Status API), counted by paid date.                                     |
| Conversion           | paid orders ÷ product page views × 100                                                                                         |

Traffic source is classified once, at ingestion: UTM parameters first, then
the referrer host (search engines, social and chat apps, other sites). No
referrer and no UTM means "Langsung / tidak diketahui" (direct or unknown).
Instagram's in-app browser often strips the referrer, so share links with
`?utm_source=instagram` for reliable attribution. A visit inside the site
keeps the session's original source.

**Not counted**: crawlers and link-preview fetchers (WhatsApp, Facebook,
Telegram, ...), headless browsers and scripts, browser prefetches, the
signed-in owner, and any browser where the owner switched on "Jangan hitung
kunjungan dari browser ini" (Settings). Development uses its own database
file, so local testing never touches production numbers.

**Privacy**: no IP address, full user agent or fingerprint is stored; only
the referrer host, UTM values and a device class. `/privasi` explains this
to visitors.

### Payments (Midtrans Snap)

1. The buyer submits the checkout form. The server re-validates, creates an
   `orders` row (pending) with a fresh access token, and requests a Snap
   transaction. The form carries an idempotency key, so a double submit reuses
   the same order. Checkout attempts are rate limited per client.
2. The buyer pays on Midtrans and returns to `/pesanan/{code}?t={token}`
   (finish and error redirects are set per order). Midtrans' Unfinish redirect
   only names the order, so checkout also stores the order link in an
   HttpOnly cookie (`lb_orders`, last five orders, 7 days); the redirect
   routes use it to send the buyer back to their order page, or show
   `/pembayaran/...` without any order details when this browser lacks it.
3. The order becomes **paid only from a status the server verified**:
   - webhook: signature `SHA512(order_id + status_code + gross_amount + ServerKey)`
     checked in constant time, then the status re-fetched from the Status API
     and the amount compared with the order;
   - the order page and the admin "Cek status di Midtrans" also use the Status
     API. The browser's redirect parameters are never trusted.
4. Webhook deliveries are stored with a content key. A delivery already
   processed returns 200 without side effects. Status changes are conditional
   updates, so parallel deliveries cannot apply twice. A paid order is never
   downgraded by a late `expire`.
5. On payment, a `digital_deliveries` row is created. The order page shows a
   download link signed with `AUTH_SECRET`, valid 15 minutes, max 10
   downloads per order. Product files live in `storage/private/` with no public
   URL.
6. Order emails (Resend, `server/email/`): at checkout a payment-link
   email is scheduled for 30 minutes later and cancelled if the order is paid
   first, so a buyer who pays straight away only gets the invoice (with a
   "Buka produk" button) once the order is paid; the seller gets a "Pesanan
   baru" notice. Emails link to
   the order page with `?k=`, a key derived from the order's token hash, so
   issuing a new order link also retires emailed ones. Each email claims a
   timestamp on the order before sending and gives it back on failure, so it
   goes out once; the webhook and the order page both trigger delivery, which
   doubles as the retry. Files are never attached (size limits, and an
   attachment cannot be revoked); the button leads to the download-limited
   order page.

Sandbox was tested end to end on 2026-10-11: order → Snap → BCA virtual
account paid in the Midtrans simulator → Status API `settlement` → order paid
→ delivery link worked. In local development the webhook cannot reach
`localhost`; the order page confirms payment through the Status API instead.

### Discount codes

The owner creates codes in Dashboard → Discounts, for example `1010` for 10%
off or `HEMAT10K` for Rp10.000 off. Each code has a type (percent 1-99 or
fixed rupiah), and optionally one product it applies to, a usage limit, a
start and end time (WIB) and an on/off switch. Codes are case-insensitive and
unique per profile. `server/discount-codes.ts` does the lookup and
`lib/pricing.ts` the arithmetic, always on the server:

- The checkout page shows "Punya kode diskon?" only while at least one active
  code could apply to the product. "Pakai" checks the code (limited to 15
  tries per 10 minutes per visitor, so short codes cannot be guessed) and
  shows the new total.
- Creating the order checks the code again and compares the total with the
  one the buyer saw; Midtrans is asked for the discounted amount. The order
  keeps the code text and the rupiah it took off, so editing or deleting the
  code later does not change past orders.
- Usage limit: paid orders count for good; an unpaid order holds one use for
  24 hours (the default Snap payment window), so abandoned checkouts give
  their use back. The limit check and the order insert run in one write
  transaction, so two buyers cannot both take the last use.
- A code never makes a product free (Midtrans cannot charge Rp0); a fixed cut
  as large as the price is refused.
- WhatsApp products accept a code too: it goes to `/go/wa/{id}?kode=...`,
  which checks it again and writes "Rp135.000 dengan kode diskon 1010, harga
  normal Rp150.000" into the chat. Those orders are paid outside the site, so
  they do not count against the usage limit.

Write transactions go through `writeTransaction()` in `db/client.ts`, which
queues them in-process: the local SQLite driver cannot wait for a lock
without blocking the event loop, so two interleaved write transactions would
otherwise fail with `SQLITE_BUSY`.

### Security

- Admin pages, Server Actions and route handlers each verify the session
  against the database (`server/session.ts`). `proxy.ts` only redirects
  visitors without a cookie to sign-in.
- Every admin query includes the owner's `profileId`; rows of another profile
  behave as missing (covered by tests).
- Passwords: scrypt (N=2^15). Sign-in is limited to 5 failures per 15 minutes
  per email and per client, with constant-time checks for unknown emails.
- Cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production.
  Cookie-authenticated POST routes also check the `Origin` header.
- Link destinations allow only `https`, `http`, `mailto:`, `tel:` and internal
  paths; `javascript:`, `data:` and protocol-relative URLs are rejected on save
  and again on redirect.
- Uploaded images are re-encoded to WebP (which strips metadata such as GPS
  location). Product files are limited to a list of extensions and 50 MB.
- Security headers: `nosniff`, `Referrer-Policy`, `Permissions-Policy`;
  `/admin` and `/pesanan` add `X-Frame-Options: DENY` and `noindex`.

## Deploying

Two supported shapes:

- **Vercel** (current): database on Turso (Vercel Marketplace), uploads in a
  private Vercel Blob store, functions in Mumbai (`bom1`, `vercel.json`) next
  to the database (Turso on the Marketplace has no Singapore region).
  1. Connect a Turso database and a private Blob store to the project, for
     the Production and Preview environments. They set `TURSO_DATABASE_URL`,
     `TURSO_AUTH_TOKEN` and `BLOB_READ_WRITE_TOKEN` (or `BLOB_STORE_ID`);
     local development keeps using `data/` and `storage/`.
  2. Set `SITE_URL`, `AUTH_SECRET` and, for direct
     checkout, `MIDTRANS_SERVER_KEY` / `MIDTRANS_IS_PRODUCTION`.
  3. Deploy. Production builds run `npm run vercel-build`, which applies
     database migrations first; preview builds never touch the schema.
  4. Create the owner account once, from this folder:
     `vercel env pull .env.production.local --environment=production`, then
     `npm run setup:production` (asks for email and password), then delete
     `.env.production.local`.

  Function requests are capped at 4.5 MB: the dashboard scales large photos
  down before uploading, and product files (up to 50 MB) go straight from
  the browser to Blob with a one-file, 15-minute token
  (`/api/admin/uploads/blob`).

- **VPS / container with a volume**: `npm ci && npm run build &&
npm run setup && npm start`, with `data/` and `storage/` on persistent disk.
  Put it behind a reverse proxy that sends `X-Forwarded-Host`.

SQLite on local disk suits one server process. For several instances, use
Turso.

## Testing

`npm test` runs 90 tests: validation and URL safety, links in the bio, copy
rules, analytics rules (source
classification, bot filter, date ranges in WIB, metric math), payment rules
(signature, status mapping, transitions), and integration tests against a real
SQLite database: auth and rate limiting, ownership isolation, link
CRUD/reorder, beacon dedupe, totals/unique visitors/CTR/top links, date
filtering, checkout with a fake gateway, webhook signature and idempotency,
no downgrade after payment, amount mismatch, download limits and access
tokens, and discount codes (rejections, product and profile limits, usage
limit with the 24-hour hold, two buyers racing for the last use, deleting a
used code).

## Notes

- Icons are a letter "A" on black (`app/icon.svg`, `favicon.ico`,
  `apple-icon.png`), not the portrait.
- Public pages (profile, product, checkout, order) use
  Hugeicons (stroke-rounded, one stroke weight, through
  `components/profile/icon.tsx`); the dashboard uses lucide (shadcn).
- The profile banner `public/adhi-nugroho-banner.webp` (1600x900 WebP, 16:9)
  is the owner's own design; the original export is kept in
  `design/assets/profile-banner-source.webp` (3344x1882). On phones the round
  photo overlaps the banner's lower edge by 28px (44px on wider screens), so
  keep text out of the bottom-left corner. `design/profile-banner.html` is the
  previous generated banner, kept for reference, with its portrait cutout
  (lifted from `design/assets/adhi-nugroho.webp` with Apple's Vision
  subject-lifting API). Replace the banner in Dashboard → Profile → Gambar
  sampul; the round photo is `public/adhi-nugroho-avatar.webp`.
- The website-service card image is `public/jasa-pembuatan-website.webp`
  (1200x750, 16:10), generated by the owner in ChatGPT; the original is in
  `design/assets/jasa-pembuatan-website-source.webp`. Featured link cards show
  images at 16:10 (about 358x224 on phones, 512x320 on desktop).
- `AGENTS.md` is written by `next dev` (Next.js agent rules). Keep it.
- `npm audit` reports a `braces` advisory inside `eslint-config-next`
  (dev-only lint tooling, not shipped).
- The services page (`/jasa-pembuatan-website`) was removed on 2026-10-12 at
  the owner's request; the profile and its products cover the offer. Copy
  rules for every page are enforced by `tests/content.test.mjs`.
