# Client website design system

Clients build their sites in the portal (`/portal`) from four curated templates. All of the code lives in `public/site-template.js`, and the portal renders the live preview with the same code that renders the published site, so the preview always matches.

## Templates and their references

Each template takes its feel from a well-regarded site: layout, typography and pacing, not anyone's branding or content.

| Template | Inspired by | Signature details |
|---|---|---|
| **Atelier** | Aesop and luxury-editorial sites; Awwwards luxury and typography winners | Ivory "paper" ground and charcoal type. Cormorant serif display with an italic accent on the headline's last word. Sharp corners, numbered services, whitespace-led layout. An oversized italic monogram when there's no photo. |
| **Studio** | Stripe | Crisp Inter type with tight tracking, a soft blurred gradient glow, pill buttons with coloured shadows, elevated cards, a gradient call-to-action band. |
| **Midnight** | Linear's dark mode and the "dark glass" style popular with premium local-service sites | A near-black background with an accent glow, frosted-glass cards, gradient-clipped headline text, a centred hero with a status-pill eyebrow. |
| **Heritage** | Premium trades and hospitality brands | A top contact bar, Fraunces serif headlines, a trust strip, a framed photo with an offset shadow, and an "Established" seal when there's no photo. |

## Guard-rails that keep every site high-end

- **Curated colours only.** Each template offers four hand-picked palettes, and clients can't enter arbitrary colours. `test/templates.test.js` enforces WCAG contrast on every palette:
  - body text at least 7:1;
  - secondary text and button text at least 4.5:1;
  - accent details at least 3:1.
- **Curated typography.** Two font pairings per template, self-hosted from `public/fonts` (SIL OFL). No requests go to Google Fonts.
- **Content-aware layouts.** The hero adapts to whether there's a photo, highlights, a founding year or a booking link, so a sparse profile still looks finished.
- **Fast, safe output.**
  - No JavaScript.
  - Every value is escaped.
  - Strict CSP: `default-src 'none'`, with only self-hosted fonts and images allowed.
  - Entrance animations respect `prefers-reduced-motion`.
  - The FAQ is an accessible `<details>` accordion.
- **Images.** Logos and photos are resized in the browser before upload (logo up to 600 px, photo up to 2000 px as JPEG), then checked by content on the server.

## Client builder flow

The client works through six short steps, with a live desktop/phone preview and autosave:

1. **The basics:** name, phone, city, year founded, plus headline ideas built from their own answers.
2. **What you do:** services as chips, and one-click "why choose us" suggestions.
3. **Pick a design:** live thumbnails of all four templates showing the client's own content, palette swatches and typography samples.
4. **Logo & photo:** drag-and-drop uploads with automatic optimisation.
5. **Finishing touches:** about, question-and-answer pairs, hours and contact, plus optional links and service-specific questions.
6. **Review & launch:** a checklist, then one click to go live.

## Research sources

- [Awwwards — luxury websites](https://www.awwwards.com/websites/luxury/)
- [Awwwards — typography winners](https://www.awwwards.com/inspiration_search/winner_category_typography/?page=1)
- [DesignRush — best luxury website designs](https://www.designrush.com/best-designs/websites/luxury)
- [DesignRush — most creative website designs 2026](https://www.designrush.com/best-designs/websites/trends/most-creative-website-designs)
- [Aesop design analysis (webdesignhot)](https://www.webdesignhot.com/design.md/aesop/)
- [How Stripe designs beautiful websites (Lee Robinson)](https://archive.leerob.io/blog/how-stripe-designs-beautiful-websites)
- [Stripe style reference (Refero)](https://styles.refero.design/style/48e5de76-05d5-4c4e-a269-c7c245b291ec)
- [Best local service company websites 2026 (Freshysites)](https://freshysites.com/web-design-development/best-local-service-company-websites/)
- [High-end local service design patterns (Derick Downs)](https://derickdowns.com/?p=2653)
