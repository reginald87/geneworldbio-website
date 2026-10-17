import { esc } from '../lib/dom.js';
import { button } from '../components/layout.js';
import { serviceItems, serviceAccordion, bindServiceAccordion, interiorHero, notice } from '../components/sections.js';
import { store } from '../lib/store.js';

export const title = 'Services';

function meta() {
  const page = store.pages.find((item) => item.slug === 'services');
  return {
    label: page?.data?.eyebrow || 'GeneWorldBio',
    title: page?.data?.title || 'Diagnostics and specimen support',
    summary: page?.data?.summary || 'Explore service pathways and talk with our team about access, referrals and logistics.',
  };
}

export async function render() {
  const m = meta();
  return `<main class="interior-page">
    ${interiorHero({ label: m.label, title: m.title, summary: m.summary })}
    <section class="section interior-content"><div class="container">
      <div class="service-grid-wrap">${serviceAccordion(serviceItems(store.services.length || 4))}</div>
      ${notice('Service availability', 'Service scope, access and operating availability are confirmed through a direct enquiry. The categories shown here describe discussion pathways, not a guarantee of current testing availability.')}
      ${button('Ask about a service', '/contact')}
    </div></section>
    <section class="final-cta"><div class="container cta-inner"><div><h2>Not sure which route fits?</h2><p>${esc('Tell us what you need and we will help you find the right pathway.')}</p></div>${button('Get in touch', '/contact')}</div></section>
  </main>`;
}

export function mount(root) {
  const openSlug = new URLSearchParams(location.search).get('service') || '';
  bindServiceAccordion(root, { openSlug });
}
