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

## Launch controls

The initial public copy avoids operational claims that were not verified in the supplied blueprint. The privacy notice and terms are starter text and require review by the responsible privacy and legal owners. Before launch, configure backups, form routing and response ownership, privacy and retention rules, a cookie and analytics position, and accessibility, security and performance review. Public forms deliberately do not request clinical results, detailed medical histories, identity documents or genomic files. Patient results, booking and provider portal capabilities are not included.

The database is designed for a single-process launch environment. For a multi-instance or higher-volume deployment, move persistence to a managed database and add centralised session storage, audit events, backup monitoring and a controlled content approval workflow.

