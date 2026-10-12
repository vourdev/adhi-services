---
version: 1
slug: "app-username-page-tsx"
primary_target: "app/[username]/page.tsx"
related_targets: ["app/[username]/[slug]/page.tsx","app/[username]/[slug]/checkout/page.tsx","app/pesanan/[code]/page.tsx","components/profile"]
---

# Public profile (/[username], product, checkout, order pages)

Scope: the public link-in-bio profile and the pages a visitor reaches from it (product, checkout, order status). Mode: Persuade. Mobile first: visitors arrive from TikTok/Instagram bios on phones. Admin dashboard and /jasa-pembuatan-website are out of scope.

Audience and job: small-business owners deciding whether to consult Adhi about a website (primary); developers/students looking at digital products (secondary). Order on the page: website service first, then products. All socials shown (LinkedIn, TikTok, GitHub, email). No invented social proof.

## Direction contract

THESIS: Simple and familiar beats concept (owner, 2026-10-11, after rejecting the "Kartu Nama" business-card direction, seed ca6939ec). On 2026-10-12 the owner added: inspired by the Lynk-style reference screenshot but not identical to it, with more modern icons.

OWN-WORLD: Light grey page, white 16px cards with a hairline ring and a faint shadow, accent-tinted icon tiles, Hugeicons stroke-rounded icons at one stroke weight, Plus Jakarta Sans. Theme and one accent preset are owner settings. Shape rule: cards 16px, media inside cards and icon buttons 12px, buttons with text full pills, photo round, cover 24px only when it has margins around it.

STORY: Edge-to-edge cover, round photo overlapping its lower-left edge with a "Bagikan" pill opposite, name and bio aligned left, a row of square social icon buttons, then the blocks: a "featured" link with an image as a large card (the website service), plain links as compact rows (tinted icon tile, arrow up-right for external, arrow right for internal), headings as small uppercase labels with a hairline, products in a two-column grid (an odd one out becomes a full-width row). Prices are plain; discounts are codes entered at checkout or before ordering through WhatsApp.

FIRST VIEWPORT: Phone (390px): 16:9 cover (default: design/profile-banner.html), 88px photo overlapping it, name, bio, socials, and the top of the featured card.

FORM: Container queries (not viewport breakpoints) switch the cover to its rounded, inset form, so the dashboard preview shows the phone layout.

FINISH: Verified on 2026-10-12 by screenshots at 360/390/430/1280, the admin preview at 1440, the code flow on the checkout and WhatsApp product pages, and a Midtrans sandbox transaction with a discounted total. The impeccable finish-review and DESIGN.md steps were not run, at the owner's request for a simpler result.
