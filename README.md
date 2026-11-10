# Bizzle

Lead intelligence for selling AI implementation to "boring" local businesses in **Central Texas**: HVAC, plumbing, dental, legal, restaurants, salons and similar trades.

Bizzle uses only real data. Businesses come from Texas state records and Google. Each lead is checked against live sources and scored only on what was observed, and anything not checked yet is shown as unknown rather than guessed. The app is split into permission-based zones for owner, analyst and sales roles.

## Quick start

Requires **Node ≥ 22.5**. There are no npm dependencies: it uses the built-in `node:sqlite`, `node:http` and `node:crypto`.

```bash
export GOOGLE_PLACES_API_KEY=...   # optional but strongly recommended (GOOGLE_MAPS_API_KEY also works)
npm run seed                       # creates logins only — no business data is seeded
npm start                          # http://localhost:3000
npm test
```

Then open **Lead Finder → Source new leads**:

1. **Texas Comptroller registry.** Pick counties and an industry, then click Import.
2. **Enrich.** Pulls the Google listing, scans the website and checks state records.
3. Sort by score and open a lead to see its evidence and talking points.

**Alpha mode** works the same way as ShoalCreekClean. With `ALPHA_MODE=true`, set in `wrangler.jsonc` and on by default locally, the sign-in page shows one button per access portal. Every demo account uses the password `alpha2026!`:

| Button | Login | Portal |
|---|---|---|
| Owner (admin) | `owner@bizzle.test` | Every zone: Lead Finder, Pipeline, Analytics, Admin |
| Analyst | `analyst@bizzle.test` | Lead Finder, sourcing, Strategy, Analytics |
| Sales rep | `sales@bizzle.test` | Lands on Pipeline; Lead Finder + Strategy |

The demo accounts are created automatically, and their shared password can't be changed. **Before real use, set `ALPHA_MODE` to `"false"` and redeploy.** That hides the buttons, and you then create real users with `npm run create-user` or from the Admin zone.

## Hosting (Cloudflare Workers + D1)

Production runs at **https://biz.ackerworks.com** as the `bizzle` Worker, with the `bizzle` D1 database. The UI is embedded in the Worker bundle at build time.

```bash
npm run db:migrate                                   # apply migrations/ to the remote D1 database
npm run deploy                                       # build UI + deploy Worker (custom domain biz.ackerworks.com)
npx wrangler secret put GOOGLE_PLACES_API_KEY        # enables Google discovery/matching in production
BIZZLE_PASSWORD='choose-a-strong-one' npm run create-user -- you@example.com "Your Name" owner
```

Workers notes:

- Enrichment runs one lead per request, and the UI works through the queue. This keeps each request under the Workers Free limit of 50 outbound calls.
- Registry imports are capped at 200 per request.
- Passwords use PBKDF2-SHA256 at 100k iterations, the maximum Workers allows.
- `npm run dev:worker` runs the Worker locally on `workerd` with a local D1 database.

## Data sources

| Source | What it provides | Key needed |
|---|---|---|
| Texas Comptroller, Active Sales Tax Permit Holders ([`jrea-zgmq`](https://data.texas.gov/d/jrea-zgmq)) | Every registered outlet: name, address, county, NAICS industry code, when that location's permit began, taxpayer HQ, active location count | No (`SOCRATA_APP_TOKEN` raises rate limits) |
| Texas Comptroller, Active Franchise Tax Permit Holders ([`9cir-efmm`](https://data.texas.gov/d/9cir-efmm)) | The legal entity's Texas charter date, which is the true business age | No |
| Texas Comptroller, Mixed Beverage Sales Receipts ([`g5bj-yb6k`](https://data.texas.gov/d/g5bj-yb6k)) | Monthly alcohol sales per licensed location, giving trailing-12-month revenue and year-over-year growth for bars and restaurants | No |
| Google Places API (New), Text Search | Listing match, rating, review count, website, phone, open/closed status, Maps link; also discovers industries that don't hold sales-tax permits | Yes |
| Live website scan | Which booking, ordering, chat and review tools the business already uses, plus mobile-friendliness, HTTPS and copyright year | No |

The registry covers all 14 playbook industries in Travis, Williamson and Hays counties. For example, it lists about 1,100 HVAC, plumbing and electrical outlets, about 10,000 restaurants, and about 130 dental offices. Industries that rarely collect sales tax (dental, legal, medical) are better sourced with **Google search**.

**Google billing.** Requesting rating and website fields bills at Google's *Text Search Enterprise* rate. Each lead's enrichment makes one or two Google calls, and bulk enrichment is capped at 50 leads per run.

## Client onboarding: private workspaces & portal

**For staff (Clients zone, or "Onboard as client" on a lead):** pick the services the client bought, and Bizzle creates a **private workspace** and a single-use invite link valid for 14 days. You send the link.

**For the client (`/portal`):**
- They create their own sign-in, then fill in their business details and services.
- They choose colors, a style and a font, upload a logo, and add links and workflow-specific answers.
- A **live preview** of their site updates as they type. **Review & launch** publishes it to `/s/<their-name>`, and later edits go live with **Publish changes**.
- They add keys to a **write-only vault**, with an optional read-only "Test connection" for Square, Calendly and Twilio.
- They can run a **security check** of their current website and email domain, read their **access log**, **download** their data, or **delete** everything.

**Privacy model:**
- Each client's data lives in its **own database**: a Durable Object with SQLite storage on Cloudflare, one file per client locally. It is separate from Bizzle's sales database.
- Keys are encrypted with a per-client key, are never returned by any screen or endpoint, and each use is logged.
- No client-facing code calls an AI service, and tests enforce this.
- Details are in [docs/SECURITY-PRIVACY.md](docs/SECURITY-PRIVACY.md).

**Runbooks for operators and AI agents:**
- [docs/WORKFLOWS.md](docs/WORKFLOWS.md) is generated with `npm run docs:workflows`.
- Per-client runbooks download from the Clients zone.
- They contain **only placeholders** (`{{business.phone}}`, `{{secret:…}}`) and progress flags, never client values. They're safe to give an AI agent, and the values are filled in by Bizzle's non-AI system.
- Every service is defined in `public/workflows.js`: inputs, least-privilege access, security checks, automated/manual steps, verification and rollback.

**Production requirement:** set the `WORKSPACE_KEY` Worker secret (32 random bytes, base64) before clients save keys:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))" | npx wrangler secret put WORKSPACE_KEY
```

## Client website templates

Clients choose from **50 curated designs** (four hand-built, plus 46 composed from layout modules) in a seven-step builder, which includes an **Upgrades** step with live previews and pricing. They pick with a live desktop/phone preview:

| Template | Inspired by |
|---|---|
| **Atelier** | Aesop / luxury editorial |
| **Studio** | Stripe |
| **Midnight** | Linear dark mode / premium "dark glass" |
| **Heritage** | Premium trades and hospitality |

Each template comes with:
- hand-picked palettes only, each passing an automated WCAG contrast test;
- two typography pairings using self-hosted open-licence fonts;
- layouts that adapt to whether the client has a photo, highlights or a founding year.

See [docs/DESIGN.md](docs/DESIGN.md) for the references, guard-rails and research sources.

## Quotes & pricing

- **Public quote builder.** **https://biz.ackerworks.com/quote** needs no login. Customers choose training, done-with-you workflows, locations, a care plan and how to pay, and see a live total with the payment schedule, timeline and separate third-party software estimates beside published market pricing. "Send me this quote" saves the request, creates a lead, and returns a shareable link.
- **Rep proposals.** **Build a quote** on any lead or client brief opens the same page, pre-filled from that lead's observed gaps and recommended approach. **Save** produces a shareable proposal link for the customer.
- **Quotes zone.** Lists customer requests and proposals with their contact details.
- **Pricing.** Prices live in `public/pricing.js`, and the server recomputes every saved quote. See [docs/PRICING.md](docs/PRICING.md) for the competitive research and how each price was set.

## Without a Google key

Digital Gaps and Customer Demand still fill in where real evidence exists:

- **Website search.** Bizzle tries likely `.com` domains built from the business name, for example `gtxplumbing.com`. A site is accepted only if the page itself names the business (every distinctive word) **and** its city or ZIP. Then the full website scan runs.
- **Self-reported reviews.** If the site publishes a schema.org `AggregateRating`, it counts toward demand at a discount and is labelled *self-reported*.

Google is still the best source for demand, giving independent ratings and review counts. Add the `GOOGLE_PLACES_API_KEY` Worker secret to enable it. Billable Google calls are capped at `GOOGLE_DAILY_LIMIT` per day (default 300).

## Client brief & call script

Each lead has a **Client brief** (button in the lead panel). You can print it or save it as PDF, download it as Markdown, and copy any section. It contains:

- **What we know.** Every fact with its source (Comptroller, Google, website scan).
- **Observed opportunities.** The evidence behind each recommendation.
- **Recommended approach.** Teams already paying for tools get **one-on-one training** to get more out of them. Businesses with several gaps, or busy and expanding owners, get a **done-with-you setup**: we take the initiative, and they approve every step through discovery, a written plan, setup, review, a two-week pilot, a keep/adjust/roll-back decision and training handoff.
- **Call script.**
  - A permission-based opener.
  - A "why I'm calling" hook built from what we observed (their reviews, a new location, an ownership change, a missing booking tool).
  - What we do.
  - Industry-specific discovery questions, so the owner puts their own numbers on the problem.
  - An offer of both ways of working, and a small-step close.
- **Voicemail and follow-up email.**
- **Handling hesitation.** Busy, cost, "customers want a person", failed software before, data/AI trust, "we're fine", "send info", "we already use X".
- **Building confidence.** They approve every step, a small pilot, their existing number and tools are kept, every change can be rolled back, success is measured together, and training is included.
- **Guardrails** and a next-steps checklist.

Scripts never quote statistics that can't be backed up; reps use the owner's own answers instead. The company name in scripts comes from `BIZZLE_COMPANY` (default `Ackerworks`).

## Accuracy rules

These rules were found and fixed by checking live output against real records:

- **Google matching never guesses.** A listing is accepted only in these cases:
  - The street address, suite and ZIP agree, and the names share a distinctive word.
  - The street number, suite and ZIP agree when the road has two names, as with "N Highway 183" and "Research Blvd".
  - Every distinctive word of the registry name appears in Google's name, in the same city.
- **Rejected Google results:**
  - bare-address results;
  - other tenants in the same building;
  - apartment complexes for home-based businesses;
  - same-name businesses in other cities;
  - single-word overlaps, such as "KS Southwest Austin LLC" against "Southwest" the airline.
- **Business age** comes from the entity's state charter date, not a location's permit date. A young entity behind an established brand (300+ reviews) is flagged as a *likely ownership change*, not as a new business.
- **Website scans** identify themselves honestly (`BizzleSiteCheck`) and never try to get past bot protection:
  - A blocked site is shown as *"review manually"* and is not counted as a gap.
  - Only known vendor signatures count; a plain Facebook "like" script is not a chat widget.
  - Each scan also reads the page's Google Tag Manager containers and first-party scripts, which catches widgets injected there.
- **Alcohol revenue** is reported only for the location whose address matches, and year-over-year growth only when a full prior year exists.

## Scoring (`src/scoring.js`)

Each lead gets a score from 0 to 100, with a breakdown in the UI. Factors with no data score 0 and are marked unknown, and **coverage** shows how much of the score is backed by checked data.

| Factor | Max | Evidence |
|---|---|---|
| Industry AI fit | 25 | NAICS → playbook. This is Bizzle's editorial weighting and the only input that isn't data. |
| Digital gaps | 25 | Website scan: no booking, no chat, no review tool, no ordering, not mobile, stale site. Also a missing website on Google. |
| Customer demand | 20 | Google review volume and rating, or real alcohol sales |
| Growth momentum | 15 | Entity age, new locations in the last 12 months, revenue growth |
| Local roots & scale | 15 | HQ in Central Texas, number of active Texas locations |

Segments:

- **Up-and-coming**: entity ≤ 3 years old without an established review base, a new location, or alcohol sales up 20%+ year over year.
- **Popular local favorite**: 250+ reviews at 4.5★ or higher, or $1M+ in alcohol sales over 12 months.
- **Hometown anchor**: Central Texas HQ with 3+ locations, or an entity 10+ years old.
- **Closed**: closed according to Google. These are hidden by default.

**Strategy** recommends only use cases backed by an observed gap, and shows the evidence for each, for example "No online booking/scheduling tool detected on their website". It also lists tools the business already uses, so reps don't pitch what it already has. No invented prices or ROI figures are shown.

## Zones & roles

| Zone | Permission | owner | analyst | sales |
|---|---|:-:|:-:|:-:|
| Lead Finder (browse, refresh a lead) | `leads:read` | ✓ | ✓ | ✓ |
| Sourcing & bulk enrichment | `leads:write` | ✓ | ✓ | |
| Strategy | `strategy:read` | ✓ | ✓ | ✓ |
| Pipeline | `pipeline:write` | ✓ | | ✓ |
| Analytics | `analytics:read` | ✓ | ✓ | |
| Admin | `admin:users` | ✓ | | |

The server enforces permissions on every API route. Sales reps can work only unassigned leads, which they claim automatically when they do, and their own leads.

## Security

- Passwords are hashed with scrypt.
- Sessions use random 256-bit tokens in an `HttpOnly; SameSite=Strict` cookie, and the API accepts only JSON bodies. Together these guard against CSRF.
- Static pages are served with a strict CSP, the UI never uses `innerHTML`, and only `http(s)` links are rendered.
- Failed logins are throttled per IP.
- Registry queries use whitelisted counties and industries only.
- The website scanner refuses private and internal addresses at every redirect (SSRF guard).

## Layout

```
src/server.js            API routes + static files
src/sources/comptroller.js  Texas open data (permits, charter dates, alcohol sales)
src/sources/places.js    Google Places discovery + strict matching
src/sources/website.js   website scan + vendor signatures
src/enrich.js            enrichment pipeline
src/scoring.js           scoring, segments, evidence-based strategy
src/playbooks.js         industries, NAICS ranges, use cases
src/db.js                SQLite schema, merge-on-import
public/                  vanilla-JS UI
```
