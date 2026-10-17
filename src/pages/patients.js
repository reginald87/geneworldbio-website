import { button } from '../components/layout.js';
import { interiorHero, notice } from '../components/sections.js';
import { store } from '../lib/store.js';

export const title = 'Patients';

function meta() {
  const page = store.pages.find((item) => item.slug === 'patients');
  return {
    label: page?.data?.eyebrow || 'Patients & carers',
    title: page?.data?.title || 'Clear guidance at every step',
    summary: page?.data?.summary || 'Understand what to expect, how to prepare and where to find support for your testing pathway.',
  };
}

export async function render() {
  const m = meta();
  return `<main class="interior-page">
    ${interiorHero({ label: m.label, title: m.title, summary: m.summary })}
    <section class="section interior-content"><div class="container">
      <div class="patient-steps">
        <article><span>01</span><h3>What happens?</h3><p>Your care team can explain the test pathway. If you need general support, contact us and we’ll help route your question.</p></article>
        <article><span>02</span><h3>How do I prepare?</h3><p>Preparation depends on the service. Follow the instructions provided by your clinician or the responsible provider.</p></article>
        <article><span>03</span><h3>Where do I go?</h3><p>Collection arrangements are confirmed through your care team or direct service contact. We do not publish unverified collection locations.</p></article>
        <article><span>04</span><h3>How do I get support?</h3><p>For clinical questions, contact your healthcare provider. For general pathway support, use the patient enquiry form.</p></article>
      </div>
      ${notice('For urgent medical needs', 'This website is not a substitute for medical advice or urgent clinical care. Contact your care team or local emergency services.', 'warm')}
      ${button('Ask for patient support', '/contact?category=patient')}
    </div></section>
  </main>`;
}

export function mount() {}
