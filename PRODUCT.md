# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Small-business owners (UMKM) in Indonesia**, arriving from Adhi's TikTok, Instagram or LinkedIn, usually on a phone. Their job: decide whether this person can build their business website, then start a conversation.
- **Developers and students**, arriving from the same channels, interested in Adhi's digital products (templates, ebooks, source code). Their job: see what is on offer, at what price, and buy or ask.

Priority on the public profile: the website-building service first, digital products second (confirmed 2026-10-11).

## Product Purpose

A personal link-in-bio platform for Muhammad Adhi Nugroho ("Adhi Nugroho"), a software developer. One public page at `/{username}` collects his service offer, products, portfolio and contacts; a private dashboard manages that content and measures visits, clicks and sales. Success: visitors from social media reach the right next step (consult about a website, open the portfolio, buy or ask about a product) and the owner can see which links and products work.

## Positioning

An independent developer, not an agency: the client talks directly to the person who builds the site. Confirmed differentiators, all true per the owner:

- Built personally, end to end.
- Experience building large-scale web applications for public-sector/institutional clients (never name the employer or tie projects to it publicly).
- Goes beyond pages to systems: admin dashboards, login, payment integration.
- Keeps language and process simple for small-business owners.

## Operating Context

- Visitors land from a social bio link, mostly in in-app browsers on phones; many come with no referrer.
- Services conversations happen on WhatsApp. Products are bought either via WhatsApp chat or a direct Midtrans checkout on the site.
- The owner edits everything (photo, bio, links, products, theme/accent from a limited preset list) in the dashboard; the public page must look finished with whatever content he enters, including very few links.

## Capabilities and Constraints

- Next.js 16 app, server-rendered public pages, first-party analytics via `/go/...` redirects and a page-view beacon. Public pages must stay light on client JavaScript.
- Profile data is owner-managed: display name, bio, avatar, optional cover, social links, ordered blocks (links, section headings, product cards), theme (system/light/dark) and one of six accent presets.
- No separate services page: the profile, its links and products carry the offer (the old `/jasa-pembuatan-website` page was removed on 2026-10-12). The portfolio is a link in the bio.
- Undecided: WhatsApp number (not yet provided), production domain.

## Brand Commitments

- Public name "Adhi Nugroho"; full name "Muhammad Adhi Nugroho". Vour.dev is a separate product brand and must not be the identity of personal pages.
- Indonesian, first person, plain words. No em or en dashes in copy. No agency language.
- Icons/favicon are a letter "A", not his face. His photo appears only as the public profile portrait, never tightly cropped.

## Evidence on Hand

- CV (Oct 2026): title "Software Developer | Frontend & Web Engineer", 5+ years of learning and hands-on web engineering, based in Bekasi. Skills: Angular, React.js, Next.js, TypeScript, Tailwind CSS, Laravel, Node.js, Flutter, PostgreSQL, MySQL.
- Portfolio site https://muhammadadhi.vour.dev/ is the owner's chosen source of proof for projects.
- Portrait: `public/adhi-nugroho.webp` (1024², dark background).
- Socials, all to be shown on the profile (owner request 2026-10-11): LinkedIn, TikTok, GitHub `github.com/vourdev` (live-checked), email `muhammadadhi@vour.dev` (from the CV). X `@ZoD3V` is dead (404) and stays off. No Instagram/YouTube/Facebook handles known yet.
- Absent and never to be invented: testimonials, client logos, ratings, client counts, prices for services, phone number.

## Product Principles

1. The next step is always obvious: service consultation first, products second.
2. Prove with what is real (skills, years, portfolio), never with invented social proof.
3. Personal, not corporate: it should feel like one capable person, not a company.
4. Works on a phone in an in-app browser before anything else.
5. Every visit and click is measured honestly; design never relies on tricks that distort the numbers.
