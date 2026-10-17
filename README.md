# GeneWorldBio Website

Responsive Vite website and Node.js CRUD backend built from the GeneWorldBio website blueprint.

## Local setup

1. Install Node.js 22 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set a unique `ADMIN_PASSWORD` with at least 12 characters.
4. Run `npm run dev` and open the Vite address shown in the terminal. If Vite cannot load its platform-specific Rollup binary, the Node server also serves a lightweight local fallback at `http://localhost:8787`.
5. Visit `/` for the public site or `/#admin` for the staff content workspace.

The backend creates `data/geneworldbio.sqlite` and seeds the initial approved page and service-category content on first launch. Keep the database and `.env` out of source control. Set `NODE_ENV=production`, use HTTPS, and provide a strong administrator password for deployment. Use a reverse proxy to serve the built Vite site and forward `/api` requests to the Node server.

## Content workspace

The staff workspace supports create, read, update and delete operations for pages, services, FAQs, the claims register and enquiries. Draft content remains private until published. Enquiry records have separate categories and can be triaged through new, in-progress, resolved and archived states.

## Testing and backups

Run `npm test` to execute the API smoke suite. It starts a throwaway server on a free port against a temporary database and covers service seeding, enquiry validation, consent capture, the honeypot, the timing guard, rate limiting, Turnstile enforcement and admin access control.

Run `npm run backup` to write a consistent snapshot of `data/geneworldbio.sqlite` into `data/backups/` (override with `BACKUP_DIR`) and keep the most recent copies (`BACKUP_KEEP`, default 30). Schedule it with cron, Task Scheduler or your process manager, and store the copies off the host.

## Launch controls

The initial public copy avoids operational claims that were not verified in the supplied blueprint. The privacy notice and terms are starter text and require review by the responsible privacy and legal owners. Before launch, configure backups, form routing and response ownership, privacy and retention rules, and accessibility, security and performance review. Set `SITE_URL` to the live domain so `robots.txt` and the XML sitemap use absolute URLs. A privacy-conscious, cookieless measurement hook is included: it honours Do Not Track and Global Privacy Control and makes no network requests unless `VITE_ANALYTICS_ENDPOINT` is set. Enquiry handling: the public form is rate limited per device, records a privacy-notice version and consent timestamp, issues a `GWB-` reference on submit and, when email is configured, sends an owner notification and an acknowledgement to the enquirer. Email can be sent two ways: via Resend (set `RESEND_API_KEY` and `ENQUIRY_NOTIFY_TO`) or via SMTP with no third-party account (set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `ENQUIRY_NOTIFY_TO`; Resend is preferred when both are present). When neither is configured, enquiries are still stored and visible in the admin workspace but no email is sent. Set `VITE_WHATSAPP_NUMBER` to add a click-to-chat link. The contact form can be protected by Cloudflare Turnstile: set the public `VITE_TURNSTILE_SITE_KEY` (build-time) and the private `TURNSTILE_SECRET_KEY` (server-side) and the server verifies each submission before storing it; when unset the check is skipped and the form still works. Public forms deliberately do not request clinical results, detailed medical histories, identity documents or genomic files. Provider, patient, research, supplier and general enquiries each use a dedicated form. Patient results, booking and provider portal capabilities are not included.

The database is designed for a single-process launch environment. For a multi-instance or higher-volume deployment, move persistence to a managed database and add centralised session storage, audit events, backup monitoring and a controlled content approval workflow.

