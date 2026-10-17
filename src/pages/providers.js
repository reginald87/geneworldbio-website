import { icons } from '../lib/icons.js';
import { button } from '../components/layout.js';
import { interiorHero } from '../components/sections.js';
import { enquiryForm, bindEnquiryForm } from './contact.js';
import { store } from '../lib/store.js';

export const title = 'Healthcare Providers';

function meta() {
  const page = store.pages.find((item) => item.slug === 'healthcare-providers');
  return {
    label: page?.data?.eyebrow || 'For providers',
    title: page?.data?.title || 'A diagnostics partner for your team',
    summary: page?.data?.summary || 'Build a dependable referral pathway with clear communication, logistics planning and account support.',
  };
}

export async function render() {
  const m = meta();
  return `<main class="interior-page">
    ${interiorHero({ label: m.label, title: m.title, summary: m.summary })}
    <section class="section interior-content"><div class="container"><div class="split-feature"><div><h2>Built around your team's needs.</h2><p>We welcome conversations with hospitals, clinics and independent laboratories about dependable referral capacity, controlled logistics, escalation routes and account support.</p><ul class="check-list"><li>${icons.check} Referral service requirements</li><li>${icons.check} Specimen handling and logistics</li><li>${icons.check} Preferred contact and escalation pathways</li></ul>${button('Request a partnership discussion', '#partnership-form')}</div><div class="side-panel"><span class="panel-label">Partnership discussion</span><div class="panel-mark">${icons.spark}</div><h3>Let’s start with the practical details.</h3><p>Tell us about your organisation, location, testing needs and logistics requirements.</p></div></div></div></section>
    <section class="section partnership-section" id="partnership-form"><div class="container">${enquiryForm('provider')}</div></section>
    <section class="final-cta"><div class="container cta-inner"><div><h2>Ready when your team is.</h2><p>A responsive point of contact is one enquiry away.</p></div>${button('Start a conversation', '/contact?category=provider')}</div></section>
  </main>`;
}

export function mount(root) {
  bindEnquiryForm(root);
}
