# Client data: security & privacy design

This document explains how client information is handled, so you can answer client questions accurately. Every claim in the client portal's banners is backed by the code and tests listed here.

## Separation: your business vs. your clients

| Data | Where it lives | Who can see it |
|---|---|---|
| Leads, pipeline, quotes, staff accounts | Bizzle's database (Cloudflare D1 `bizzle`) | Your staff, by role |
| An index row per client (id, slug, business name, chosen services, status) | Bizzle's database (`clients` table) | Staff with `clients:manage` (owner, sales) |
| Everything the client enters: settings, logo, keys, sign-in, sessions, access log, security report | **The client's own workspace database.** On Cloudflare this is a Durable Object with its own SQLite storage; locally it's one file per client. | The client. Staff see setup progress and non-secret settings needed to do the work, and **never key values**. |

Clients sign in with their own email and password, which are stored in their workspace and not in your staff user table. Client sessions use a separate cookie (`csid`) that is checked against the client's own workspace.

## Keys (credentials)

- **Least privilege first.** Each workflow (`public/workflows.js`) prefers *invites* (the client adds you with a limited role) and *self-service steps* (the client flips a setting) over sharing keys. A key is only accepted when a workflow the client bought declares it; anything else is refused.
- **Encrypted at rest.** Keys are encrypted with AES-256-GCM using a key derived for each client: HKDF-SHA-256 from the `WORKSPACE_KEY` Worker secret plus the client's id. The key name is bound as additional authenticated data. One client's key cannot decrypt another client's ciphertext.
- **Write-only.** No endpoint, staff screen, export or runbook returns a key's value. The client sees "Saved on …" and can replace or delete it.
- **Used only at the moment of use, and logged.** Keys are decrypted only inside `verifySecret()`, for a read-only connection test against one fixed vendor host (`src/vault-verify.js`). Each use is written to the client's access log.
- **Honest limit.** Anyone holding both the `WORKSPACE_KEY` secret and Cloudflare account access could decrypt keys. That's why the portal says *"can't be viewed by anyone in our tools"* rather than claiming no one could ever read them. Keep Cloudflare account access to as few people as possible, with MFA.

## "Never sent to AI services"

- The workspace, portal, site generator, verification and security-scan code make no calls to AI providers. `test/workspace.test.js` fails the build if any server file references a known AI API host.
- **Runbooks for AI agents** (`src/runbook.js`, `docs/WORKFLOWS.md`, and the per-client "Download runbook" button) contain only placeholders such as `{{business.phone}}` and `{{secret:SQUARE_ACCESS_TOKEN}}`, plus progress flags. They never contain client values. Tests check that a client's phone number, links and keys don't appear. Agents work on the template, and Bizzle's non-AI system fills in the values.
- **Your obligation.** Don't paste client details from the staff screens into an AI tool yourself. The banner is a promise your business makes.

## The generated website

- It is rendered by `public/site-template.js`: the client sees the same output in the preview that gets published.
- There's no JavaScript. All client text is HTML-escaped, colors must be `#rrggbb`, and links must be `http(s)`, `tel:` or `sms:`.
- Published pages are served with `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self'`, plus `nosniff` and HSTS.
- The live preview runs in a sandboxed iframe (no scripts, no navigation).
- Logos are accepted only if their bytes are PNG, JPEG or WebP, and must be under 300 KB. SVG is refused because it can carry scripts.

## Sign-in & sessions

- Invite links are single-use and expire after 14 days. The token travels in the URL fragment (`#invite=`), so it never reaches server logs or `Referer` headers, and the portal removes it from the address bar after use. Only a SHA-256 hash of the token is stored.
- Client passwords use PBKDF2-SHA-256 (100k iterations). Sessions are random 256-bit tokens stored only as hashes and expire after 12 hours. Setting a new password signs out all other sessions.
- Failed sign-ins are throttled per IP.

## Client control

- **Download my data:** a JSON file with settings, logo, which keys were saved (not their values), the security report and the access log.
- **Delete my workspace:** removes settings, logo, keys, sessions and log, takes the site offline, and marks the client deleted in your index.

## Security check of the client's existing systems (`src/security-scan.js`)

The check is read-only and never logs in to anything. It covers:

- HTTPS and the http→https redirect.
- Security headers: HSTS, CSP, frame protection, nosniff and referrer policy.
- Whether server software versions are disclosed.
- Email spoofing protection (SPF, DMARC policy) and MX records, looked up over DNS-over-HTTPS.

Results are shown in plain language with how to fix each item. The check runs automatically at first launch, and the client or staff can re-run it.

## Operational checklist

- Set `WORKSPACE_KEY` (32 random bytes, base64) as a Worker secret before onboarding real clients. If you rotate it, existing keys become unreadable, so ask clients to re-enter them.
- Turn `ALPHA_MODE` off before onboarding real clients. The demo staff logins are public.
- Use MFA on Cloudflare, GitHub and Google accounts, and keep the number of Cloudflare account members small.
