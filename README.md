# Bizzle

Lead intelligence for selling AI implementation to "boring" local businesses in **Central Texas**: HVAC, dental, legal, property management, auto repair and similar trades.

Bizzle finds and ranks prospects, explains why each one scored as it did, and generates a pitch strategy with ROI estimates. Each part of the app is a separate permission zone.

## Quick start

Requires **Node ≥ 22.5**. There are no npm dependencies: it uses the built-in `node:sqlite`, `node:http` and `node:crypto`.

```bash
npm run seed     # creates users + 45 FICTIONAL demo businesses (idempotent)
npm start        # http://localhost:3000
npm test
```

Dev logins (seeded only when `NODE_ENV` ≠ `production`):

| Role    | Email                  | Password            |
|---------|------------------------|---------------------|
| owner   | owner@bizzle.local     | change-me-owner     |
| analyst | analyst@bizzle.local   | change-me-analyst   |
| sales   | sales@bizzle.local     | change-me-sales     |

In production, set `BIZZLE_OWNER_EMAIL` and `BIZZLE_OWNER_PASSWORD` before you seed, then add other users from the Admin zone.

## Zones & roles

| Zone | Permission | owner | analyst | sales |
|---|---|:-:|:-:|:-:|
| **Lead Finder**: browse/filter ranked leads | `leads:read` | ✓ | ✓ | ✓ |
| Sourcing: CSV import, Google Places discovery | `leads:write` | ✓ | ✓ | |
| **Strategy**: pitch, pilot, ROI, talking points | `strategy:read` | ✓ | ✓ | ✓ |
| **Pipeline**: stages, value, notes | `pipeline:write` | ✓ | | ✓ |
| **Analytics**: funnel, segments, top opportunities | `analytics:read` | ✓ | ✓ | |
| **Admin**: users & roles | `admin:users` | ✓ | | |

The server enforces permissions on every API route (`src/rbac.js`). The UI only hides zones that a role can't open. Sales reps can update only unassigned leads, which they claim automatically when they do, and their own leads. The owner can update and reassign any lead.

## How leads are ranked (`src/scoring.js`)

Each lead gets a score from 0 to 100. The breakdown appears in the UI so reps can see *why* a lead scored as it did:

| Factor | Max | Signals |
|---|---|---|
| Industry AI fit | 30 | Per-industry fit from `src/playbooks.js` |
| Automation need | 25 | No website, no online booking, no chat, low review response rate |
| Capacity to buy | 20 | Employee count (log scale) |
| Growth momentum | 15 | Hiring, new location, share of reviews from the last 90 days |
| Central Texas proximity | 10 | Locally headquartered, core metro county (Travis/Williamson/Hays) |

Tiers: **A** ≥ 75, **B** ≥ 60, **C** ≥ 45, otherwise **D**.

Segments (a lead can match more than one):

- **Up-and-coming**: ≤ 3 years old, and either fast review growth, hiring or a new location.
- **Popular local favorite**: 300+ reviews and a rating of 4.5 or higher.
- **Hometown anchor**: headquartered locally, 50+ employees, 10+ years in business.

**Strategy** combines the industry playbook with the lead's gaps:

- Use cases are ordered so the ones that fix the lead's gaps come first; the top two become the pilot.
- The pitch angle depends on the segment.
- Talking points come from the lead's signals.
- ROI = estimated hours saved × a $35/hr loaded front-office rate, compared with pilot setup and monthly fees.

Playbook prices and hours are planning defaults. Tune them in `src/playbooks.js` as real deals close.

## Getting real leads

- **CSV import** (Lead Finder → Source new leads). Columns match the lead fields: `name` (required), `industry`, `city`, `phone`, `website`, `employees`, `years_in_business`, `rating`, `review_count`, `reviews_last_90d`, `review_response_rate`, `hiring`, `new_location`, `locally_headquartered`, `has_online_booking`, `has_chat`. Each row is validated, and errors are reported per row.
- **Google Places discovery.** Set `GOOGLE_PLACES_API_KEY` to search "HVAC contractor in Round Rock, TX" and similar queries. Places supplies the name, address, phone, website, rating and review count. Fields Places can't know (employees, booking, chat, hiring) start at their defaults and should be filled in by a rep.

## Layout

```
src/server.js      HTTP API + static files, route → permission table
src/rbac.js        roles → permissions (zones)
src/scoring.js     scoring, segments, strategy/ROI (pure functions)
src/playbooks.js   per-industry AI use cases, pains, objections, pricing
src/db.js          SQLite schema, input normalization
src/auth.js        scrypt passwords, DB-backed sessions, login throttle
src/csv.js         CSV parser
src/sources/       external lead sources (Google Places)
public/            vanilla-JS single-page UI
data/seed-businesses.json   fictional demo data
```

## Security notes

- Passwords are hashed with scrypt.
- Sessions use random 256-bit tokens stored server-side, in an `HttpOnly; SameSite=Strict` cookie that is also `Secure` in production. They expire after 12 hours.
- The API accepts only JSON bodies, which together with the SameSite cookie guards against CSRF.
- Static pages are served with a strict CSP, and the UI never uses `innerHTML`.
- Failed logins are throttled per IP.

## Roadmap ideas

- Enrichment jobs: detect online booking or chat from the website, track hiring from job boards, pull new business filings from the Texas SOS / Comptroller.
- A client portal zone, so businesses you've signed can see their implementation progress.
- Outreach sequences (email/SMS) linked to pipeline stages.
- Postgres and a job queue, once data volume needs them.
