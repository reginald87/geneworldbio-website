import { icons } from '../lib/icons.js';
import { interiorHero, notice } from '../components/sections.js';
import { store } from '../lib/store.js';

export const title = 'Quality & Compliance';

function meta() {
  const page = store.pages.find((item) => item.slug === 'quality-compliance');
  return {
    label: page?.data?.eyebrow || 'GeneWorldBio',
    title: page?.data?.title || 'Quality begins with clear standards',
    summary: page?.data?.summary || 'Our approach puts accountability, careful handling, privacy and transparent communication at the centre.',
  };
}

export async function render() {
  const m = meta();
  return `<main class="interior-page">
    ${interiorHero({ label: m.label, title: m.title, summary: m.summary })}
    <section class="section interior-content"><div class="container">
      <div class="quality-intro"><h2>A careful approach to quality and trust.</h2><p>Quality is built through clear ownership, responsible communication and well-defined processes. We aim to publish evidence only when it has been verified and approved for public use.</p></div>
      <div class="quality-grid">
        <article><span>01</span><h3>Clinical accountability</h3><p>Scientific, test-performance and service claims should be reviewed by an appropriately qualified lead.</p></article>
        <article><span>02</span><h3>Partner selection</h3><p>Referral and partner-laboratory discussions should be grounded in defined responsibilities and service expectations.</p></article>
        <article><span>03</span><h3>Privacy controls</h3><p>Public enquiries are limited to contact and routing information; results and genomic files are not accepted here.</p></article>
        <article><span>04</span><h3>Open feedback</h3><p>Questions, concerns and complaints should have a clear route and a responsible owner.</p></article>
      </div>
      ${notice('Claims are reviewed before publication', 'Licences, registrations, accreditations, test availability, turnaround times, prices and collection locations require verification from the responsible owner before publication.')}
      <a class="text-link" href="/complaints" data-link>See our complaints and feedback route ${icons.arrow}</a>
    </div></section>
  </main>`;
}

export function mount() {}
