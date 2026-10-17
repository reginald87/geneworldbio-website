import { esc } from '../lib/dom.js';
import { interiorHero } from '../components/sections.js';
import { store } from '../lib/store.js';
import { enquiryForm, bindEnquiryForm } from './contact.js';

const labels = {
  'privacy-notice': 'Information',
  terms: 'Information',
  complaints: 'Information',
  accessibility: 'Information',
  cookies: 'Information',
};

const bodies = {
  'privacy-notice': `<div class="legal-copy"><p>We collect the minimum information needed to route and respond to your enquiry. Contact details and the information you choose to share may be stored by our staff for follow-up and service improvement.</p><h2>What not to send</h2><p>Do not submit clinical results, detailed medical histories, identity documents or genomic files through this website. If you need clinical support, contact your healthcare provider.</p><h2>Access and retention</h2><p>Enquiries are accessible to staff responsible for the relevant category. Retention periods, lawful purposes and access ownership must be confirmed by the company’s privacy lead before launch.</p><h2>Your questions</h2><p>For a privacy question or complaint, choose “General enquiry” on the contact page and include “Privacy” in your subject.</p><p class="notice"><b>Launch requirement</b><br>This starter notice needs review and approval by the responsible privacy and legal owners before publication.</p></div>`,
  terms: `<div class="legal-copy"><h2>General information</h2><p>Website content is general information and does not replace medical advice, diagnosis or treatment. Always consult a qualified healthcare professional about clinical decisions.</p><h2>Availability and claims</h2><p>Service availability, prices, turnaround times, locations and regulatory status must be confirmed directly with an authorised GeneWorldBio representative.</p><h2>Urgent care</h2><p>Do not use this website for urgent medical needs. Contact your care team or local emergency services.</p><p class="notice"><b>Launch requirement</b><br>These terms need review and approval by the responsible legal owner before publication.</p></div>`,
  accessibility: `<div class="legal-copy"><h2>Our approach</h2><p>We aim to make this website accessible and usable on mobile and desktop devices. Our interface uses semantic page landmarks, keyboard-operable navigation, visible focus styles, form labels and responsive layouts.</p><h2>Tell us about a barrier</h2><p>If a page or feature is difficult to use, contact us through the general enquiry form and include “Accessibility” in your message. Please describe the page and what happened so we can review it.</p><p class="notice"><b>Launch review</b><br>Complete an accessibility review against WCAG 2.2 AA before launch and assign an owner for ongoing checks.</p></div>`,
  cookies: `<div class="legal-copy"><h2>Essential cookies only</h2><p>The public website does not use advertising or analytics cookies. The staff workspace uses a secure, essential session cookie after an administrator signs in. It expires after eight hours or when the administrator signs out.</p><h2>Your choices</h2><p>No non-essential cookies are set on the public site, so no tracking consent is required for the current launch build. If analytics or other non-essential tools are introduced later, update this notice and add a consent control before enabling them.</p></div>`,
};

export async function render(slug) {
  const page = store.pages.find((item) => item.slug === slug);
  const title = page?.data?.title || slug.replaceAll('-', ' ');
  const summary = page?.data?.summary || 'Find the right information and a clear next step with the GeneWorldBio team.';
  const label = page?.data?.eyebrow || labels[slug] || 'Information';
  const body = slug === 'complaints' ? enquiryForm('general', { heading: 'Share feedback or a complaint', messageLabel: 'Your feedback or complaint' }) : bodies[slug] || `<div class="legal-copy"><p>${esc(summary)}</p></div>`;
  return `<main class="interior-page">
    ${interiorHero({ label, title, summary })}
    <section class="section interior-content"><div class="container">${body}</div></section>
  </main>`;
}

export function mount(root, slug) {
  if (slug === 'complaints') bindEnquiryForm(root);
}
