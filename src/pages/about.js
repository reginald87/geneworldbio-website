import { button } from '../components/layout.js';
import { interiorHero } from '../components/sections.js';
import { store } from '../lib/store.js';

export const title = 'About';

function meta() {
  const page = store.pages.find((item) => item.slug === 'about');
  return {
    label: page?.data?.eyebrow || 'GeneWorldBio',
    title: page?.data?.title || 'Built around better access',
    summary: page?.data?.summary || 'GeneWorldBio is developing a Nigeria-first diagnostics and laboratory-solutions model grounded in practical partnerships.',
  };
}

const roles = [
  ['01', 'Clinical & scientific accountability', 'Owns the accuracy of scientific, test-performance and service information we share publicly.'],
  ['02', 'Quality & compliance', 'Owns our standards, partner expectations and the verification of regulatory status.'],
  ['03', 'Partnerships & operations', 'Owns referral pathways, logistics planning and day-to-day account support.'],
  ['04', 'Patient experience & privacy', 'Owns clear patient information and responsible handling of personal data.'],
];

export async function render() {
  const m = meta();
  return `<main class="interior-page">
    ${interiorHero({ label: m.label, title: m.title, summary: m.summary })}
    <section class="section interior-content"><div class="container"><div class="split-feature about-feature"><div><h2>A practical, Nigeria-first vision.</h2><p>GeneWorldBio is building a diagnostics and laboratory-solutions business focused on connected access, dependable provider relationships and a thoughtful patient experience.</p><p>Our launch approach centres on institutional partnerships, referral pathways and clear patient information. We will introduce additional service lines only when they are operationally justified.</p>${button('Talk with our team', '/contact')}</div><div class="about-card"><span class="about-big">G<span>W</span>B</span><div class="about-card-rule"></div><p>Connected pathways.<br>Thoughtful care.</p></div></div></div></section>
    <section class="section approach-section"><div class="container"><div class="quality-intro"><h2>How GeneWorldBio is organised.</h2><p>Our operating model connects clear accountabilities to the services we offer. Each area has a named responsible lead, so questions, claims and responsibilities always have an owner.</p></div><div class="quality-grid">${roles
      .map(([num, title, text]) => `<article><span>${num}</span><h3>${title}</h3><p>${text}</p></article>`)
      .join('')}</div><div class="section-end">${button('Start a conversation', '/contact', 'text')}</div></div></section>
  </main>`;
}

export function mount() {}
