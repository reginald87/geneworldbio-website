import { icons } from '../lib/icons.js';
import { esc } from '../lib/dom.js';

export const navItems = [
  { path: '/services', label: 'Services' },
  { path: '/healthcare-providers', label: 'Providers' },
  { path: '/patients', label: 'Patients' },
  { path: '/faqs', label: 'FAQs' },
  { path: '/quality-compliance', label: 'Quality' },
  { path: '/about', label: 'About' },
  { path: '/contact', label: 'Contact' },
];

export function logo() {
  return `<a class="brand" href="/" data-link><img class="brand-mark-img" src="/logo-mark.png" width="113" height="113" alt="" /><img class="brand-wordmark" src="/logo-wordmark.png" width="251" height="45" alt="GeneWorldBio" /></a>`;
}

export function header() {
  const links = navItems
    .map((item) => `<a href="${item.path}" data-link>${item.label}</a>`)
    .join('');
  return `<a class="skip-link" href="#main-content">Skip to content</a><header class="site-header"><div class="container nav-wrap">${logo()}<button class="menu-toggle" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button><nav class="main-nav" aria-label="Primary">${links}<a class="button primary nav-cta" href="/contact?category=provider" data-link>Partner with us ${icons.arrow}</a></nav></div></header>`;
}

export function footer() {
  const explore = navItems
    .map((item) => `<a href="${item.path}" data-link>${item.label}</a>`)
    .join('');
  return `<footer class="site-footer"><div class="container footer-top"><div class="footer-brand">${logo()}<p>Building clearer diagnostic pathways through thoughtful partnerships and connected care.</p></div><div class="footer-col"><h3>Explore</h3>${explore}</div><div class="footer-col"><h3>Information</h3><a href="/privacy-notice" data-link>Privacy notice</a><a href="/terms" data-link>Website terms</a><a href="/cookies" data-link>Cookie information</a><a href="/accessibility" data-link>Accessibility</a><a href="/complaints" data-link>Complaints &amp; feedback</a><a href="/admin" data-link>Staff sign in</a></div><div class="footer-col"><h3>Get in touch</h3><p>For provider, patient, supplier and general enquiries, choose the route that best fits your needs.</p><a class="footer-link" href="/contact" data-link>Visit contact page ${icons.arrow}</a></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} GENEWORLDBIO LTD · RC 9795367</span><span>No. 7B, Azikoro Road, Ekeki, Yenagoa, Bayelsa State, Nigeria</span></div></footer>`;
}

export function button(text, href, kind = 'primary') {
  return `<a class="button ${kind}" href="${href}" data-link>${text} ${icons.arrow}</a>`;
}

export function eyebrow(text) {
  return `<span class="eyebrow"><i></i>${esc(text)}</span>`;
}
