# Thavisha's Den

A personal workshop of 27 web development tools. It's built with Next.js 16, React 19 and TypeScript.

Most tools run entirely in the browser. The few that need to fetch live websites use small server routes in `src/app/api/`.

## Run it

```bash
npm install        # also copies the AVIF encoder into public/codecs
npm run dev        # http://localhost:3000
```

For production:

```bash
npm run build
npm start
```

It deploys to Vercel or any Node host. The online tools need the Node server, so a pure static export won't work.

## Finding your way around

- **Sidebar**: tools are grouped by category, with a search box at the top. Collapse it to icons with the panel button. On phones it becomes a slide-out menu.
- **Ctrl / ⌘ + K** or **/**: jump to any tool from anywhere. It matches names and keywords, e.g. "webp", "salts" or "jwt".
- **Pin**: every tool header has a Pin button. Pinned tools sit at the top of the sidebar and on the home page, next to your recent tools.
- **Backup & restore** (bottom of the sidebar): exports everything the Den saves to one JSON file, and restores it on another computer.

## Tools

### Code & files
- **Theme Diff**: compare a theme ZIP before and after your changes. You get step-by-step edits, diffs, a patch, a changed-files ZIP, and a one-click hand-off to Delivery Notes.
- **Beautify & Minify**: formats or minifies HTML, CSS, JS, PHP and JSON (Prettier, Terser and PHP-aware minifiers). The language is auto-detected.
- **Regex Tester**: live highlighting, a groups table and replace preview, JS and `preg_match_all` output, and saved patterns. Runaway patterns time out instead of freezing the tab.
- **Encode & Decode**: Base64 (including file to data URI), URL encoding, HTML entities, a JWT decoder with HS* signature check, and MD5/SHA/HMAC hashes.
- **Snippet Library**: tagged, searchable snippets with favourites and import/export.

### WordPress & e-commerce
- **Plugin & Theme Inspector**: reads headers and readme.txt, and scans for 25 risky patterns: eval, encoded payloads, shell calls, hidden admins, nulled markers, SQLi/XSS and more.
- **Child Theme Generator**: presets for Divi, Hello Elementor, Astra, GeneratePress, Kadence, OceanWP, Blocksy, Storefront, Twenty Twenty-Five, or any other parent. Downloads an installable ZIP.
- **Shopify → WooCommerce CSV**: converts variants, sale prices, stock, weights, brands, SEO fields and custom meta.
- **Config File Generator**: builds wp-config.php (with local salts), .htaccess and robots.txt.

### Front-end & design
- **Breakpoint Previewer**: side-by-side device frames. Warns when a site blocks framing.
- **Fluid Type & Units**: a clamp() calculator, fluid type scale, and px ↔ rem converter.
- **Contrast & Palette**: WCAG checks with suggested fixes, and palette extraction from a screenshot (you can paste one with Ctrl+V).
- **Image Optimizer**: WebP, AVIF, JPEG and PNG output, resizing, a before/after slider, and SVGO.
- **Favicon Generator**: multi-size favicon.ico, Apple/Android/maskable icons, the manifest and the `<head>` snippet.

### SEO & performance
- **SERP & Social Preview**: previews for Google (pixel-accurate title cut-off), Facebook, WhatsApp and X, plus a meta tag generator. Can fetch the tags from a live URL.
- **Schema Builder**: JSON-LD for LocalBusiness, Product, FAQ and Hotel, with a checklist.
- **PageSpeed Tracker**: runs Google PageSpeed Insights and saves score history per site, with a CSV export. Add a free API key for more than a few runs a day.
- **Redirect Chain Checker**: every hop with status and timing, loop detection, and bulk checks.
- **Broken Link Crawler**: crawls a page or site, shows where each broken link appears, and exports CSV.
- **Heading Outline**: H1–H6 tree with skipped levels, empty headings and multiple H1s flagged.

### Debugging & server
- **PHP Error Log Parser**: groups repeated errors and traces them to the plugin or theme that caused them. Handles WP debug.log, cPanel and Nginx/FPM logs.
- **Headers, SSL & DNS**: security-header grade, cache detection, certificate chain and expiry, DNS records with SPF/DMARC checks.
- **Cron Builder**: plain-English descriptions, next run times in any zone, and ready crontab lines for wp-cron.
- **Timestamp Converter**: seconds, ms or µs; ISO and MySQL formats; world clocks; batch conversion.

### Client workflow
- **Project Dashboard**: each client's URLs, stack, contacts and notes, with shortcuts to PageSpeed, the site check, Breakpoints and reports.
- **Maintenance Reports**: paste plugin updates, add backups, uptime, security and speed, then print to PDF, download HTML or copy as email text. Can start next month's report from last month's.
- **Delivery Notes**: Fiverr-ready handover messages written from a theme ZIP diff, in friendly, professional or brief tone, with install steps.

## Where data lives

Snippets, projects, reports, PageSpeed history and settings are stored in your browser's localStorage under `den.*` keys. Use **Backup & restore** to move them. Don't store passwords in the Den; nothing is encrypted.

## Online tools and your own network

The server routes (`/api/page`, `/api/redirects`, `/api/links`, `/api/ssl`, `/api/dns`) can reach `localhost` and LAN sites when you use the Den on `localhost`. When it's hosted and used over the internet, they refuse private addresses so they can't be used to probe the server's network. Set `DEN_ALLOW_PRIVATE=1` to lift that restriction.

## Adding a tool

1. Add an entry to `src/lib/tools.ts` with a slug, category, icon and keywords.
2. Create `src/components/tools/<Name>.tsx` wrapped in `<ToolFrame slug="…">`. Use the building blocks in `src/components/ui.tsx`.
3. Create the page in `src/app/tools/<slug>/page.tsx`. `python3 scripts/gen-pages.py` can write it for you.

The sidebar, command palette, search and home page pick up the new tool automatically. Design tokens are at the top of `src/app/globals.css`.
