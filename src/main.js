import { createRouter } from './lib/router.js';
import { loadPublicContent } from './lib/store.js';
import { setDocumentTitle, setMetaDescription } from './lib/dom.js';
import { setCanonical, setStructuredData } from './lib/seo.js';
import { initAnalytics, trackPageView } from './lib/analytics.js';
import { header, footer } from './components/layout.js';
import * as home from './pages/home.js';
import * as services from './pages/services.js';
import * as providers from './pages/providers.js';
import * as patients from './pages/patients.js';
import * as quality from './pages/quality.js';
import * as about from './pages/about.js';
import * as team from './pages/team.js';
import * as contact from './pages/contact.js';
import * as legal from './pages/legal.js';
import * as admin from './pages/admin.js';
import * as notFound from './pages/notFound.js';

const app = document.querySelector('#app');

const routes = [
  { path: '/', page: home },
  { path: '/services', page: services },
  { path: '/healthcare-providers', page: providers },
  { path: '/patients', page: patients },
  { path: '/quality-compliance', page: quality },
  { path: '/about', page: about },
  { path: '/team', page: team },
  { path: '/contact', page: contact },
  { path: '/privacy-notice', page: legal },
  { path: '/terms', page: legal },
  { path: '/complaints', page: legal },
  { path: '/accessibility', page: legal },
  { path: '/cookies', page: legal },
  { path: '/admin', page: admin, bare: true, bodyClass: 'admin-body' },
];

function currentMenu() {
  const toggle = app.querySelector('.menu-toggle');
  const nav = app.querySelector('.main-nav');
  return toggle && nav ? { toggle, nav } : null;
}

function setMenuOpen(toggle, nav, open) {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  nav.classList.toggle('open', open);
}

let menuDocumentBound = false;

function bindMenu() {
  const menu = currentMenu();
  if (!menu) return;
  const { toggle, nav } = menu;

  toggle.addEventListener('click', () => {
    setMenuOpen(toggle, nav, toggle.getAttribute('aria-expanded') !== 'true');
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuOpen(toggle, nav, false);
  });

  if (menuDocumentBound) return;
  menuDocumentBound = true;

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const live = currentMenu();
    if (live && live.toggle.getAttribute('aria-expanded') === 'true') {
      setMenuOpen(live.toggle, live.nav, false);
      live.toggle.focus();
    }
  });

  document.addEventListener('pointerdown', (event) => {
    const live = currentMenu();
    if (!live || live.toggle.getAttribute('aria-expanded') !== 'true') return;
    if (live.nav.contains(event.target) || live.toggle.contains(event.target)) return;
    setMenuOpen(live.toggle, live.nav, false);
  });
}

function markMainLandmark() {
  const main = app.querySelector('main');
  if (main && !main.id) main.id = 'main-content';
}

async function handle(definition, ctx) {
  const slug = definition.page === legal ? ctx.__raw.replace(/^\//, '') : undefined;

  if (!definition.bare) await loadPublicContent();

  const html = await definition.page.render(slug, ctx);
  app.innerHTML = definition.bare ? html : `${header()}${html}${footer()}`;
  markMainLandmark();

  setDocumentTitle(definition.page.title);
  const description =
    definition.page === home
      ? 'GeneWorldBio connects healthcare providers and patients with clear diagnostics and specimen support pathways.'
      : `${definition.page.title} — GeneWorldBio, diagnostics connected with care.`;
  setMetaDescription(description);
  setCanonical(location.pathname);
  setStructuredData({ title: `${definition.page.title} | GeneWorldBio`, description });
  trackPageView(location.pathname, definition.page.title);

  definition.page.mount?.(app, slug);
  if (!definition.bare) bindMenu();
}

const router = createRouter(
  routes.map((definition) => ({
    path: definition.path,
    bodyClass: definition.bodyClass,
    handler: (ctx) => handle(definition, ctx),
  })),
  {
    notFound: async () => {
      await loadPublicContent();
      app.innerHTML = `${header()}${await notFound.render()}${footer()}`;
      markMainLandmark();
      setDocumentTitle(notFound.title);
      bindMenu();
    },
  }
);

initAnalytics();
router.start();
