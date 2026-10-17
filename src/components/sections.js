import { icons } from '../lib/icons.js';
import { esc } from '../lib/dom.js';
import { eyebrow } from './layout.js';
import { store } from '../lib/store.js';

const glyphs = ['◌', '⌘', '↗', '⌂'];

const fallbackServices = [
  { slug: 'genomics-molecular-biology', title: 'Genomics & Molecular Biology', text: 'DNA and RNA sequencing, whole-genome and targeted sequencing, genotyping, molecular epidemiology, pathogen genomics and antimicrobial-resistance surveillance.', audience: 'Providers, researchers and institutions', access: 'Availability and access are confirmed through a direct enquiry.', preparation: 'Confirm the sample type, sequencing scope and any data or consent requirements before collection.' },
  { slug: 'molecular-diagnostics', title: 'Molecular Diagnostics', text: 'PCR and qPCR testing, infectious-disease and genetic testing, antimicrobial-resistance detection, plus molecular screening and laboratory diagnostics.', audience: 'Providers and patients', access: 'Availability and access are confirmed through a direct enquiry.', preparation: 'Follow the referring clinician’s or provider’s instructions on sample type and timing.' },
  { slug: 'bioinformatics-data-science', title: 'Bioinformatics & Data Science', text: 'Genomic data analysis, next-generation sequencing analysis, bioinformatics pipelines, AI and machine learning, genomic databases, visualisation and health-data analytics.', audience: 'Researchers and institutions', access: 'Availability and access are confirmed through a direct enquiry.', preparation: 'Share the data format, analysis goals and any governance or privacy requirements.' },
  { slug: 'research-contract-research', title: 'Research & Contract Research', text: 'Contract research, study design, laboratory investigations, biomarker discovery, clinical and translational research, and research consultancy.', audience: 'Researchers, institutions and industry', access: 'Availability and access are confirmed through a direct enquiry.', preparation: 'Outline the study aims, scope and timelines so we can agree a research plan.' },
  { slug: 'laboratory-reagents-consumables', title: 'Laboratory Reagents & Consumables', text: 'Importation, distribution and supply of molecular biology reagents, extraction kits, PCR reagents, sequencing consumables, plastics and laboratory supplies.', audience: 'Laboratories and institutions', access: 'Availability and access are confirmed through a direct enquiry.', preparation: 'List the reagents, kits and consumables you need, with quantities and delivery details.' },
  { slug: 'laboratory-equipment-technology', title: 'Laboratory Equipment & Technology', text: 'Supply, installation, maintenance and servicing of molecular biology, genomics and diagnostic equipment.', audience: 'Laboratories and institutions', access: 'Availability and access are confirmed through a direct enquiry.', preparation: 'Share the equipment, site requirements and any installation or servicing needs.' },
  { slug: 'research-training-capacity-building', title: 'Research Training & Capacity Building', text: 'Workshops, professional training and laboratory-skills development across genomics, bioinformatics, molecular diagnostics and research commercialisation.', audience: 'Researchers, laboratories and institutions', access: 'Availability and access are confirmed through a direct enquiry.', preparation: 'Tell us the skills, audience size and preferred format or location.' },
  { slug: 'clinical-translational-research', title: 'Clinical & Translational Research', text: 'Clinical research support, biobanking, biomarker studies, clinical laboratory support and translational research infrastructure.', audience: 'Clinicians, researchers and institutions', access: 'Availability and access are confirmed through a direct enquiry.', preparation: 'Confirm the protocol, sample or biobanking needs and any approvals already in place.' },
  { slug: 'biotechnology-innovation-commercialisation', title: 'Biotechnology Innovation & Commercialisation', text: 'Development of diagnostic products and research tools, intellectual property, technology licensing, patents and commercialisation support.', audience: 'Innovators, institutions and industry', access: 'Availability and access are confirmed through a direct enquiry.', preparation: 'Describe the technology, its stage of development and the support you are seeking.' },
  { slug: 'environmental-public-health-genomics', title: 'Environmental & Public Health Genomics', text: 'Disease surveillance, wastewater and environmental surveillance, outbreak investigation, antimicrobial-resistance surveillance and environmental-health studies.', audience: 'Public-health bodies and institutions', access: 'Availability and access are confirmed through a direct enquiry.', preparation: 'Outline the surveillance or study objectives, sites and sampling approach.' },
];

export function serviceItems(limit = 4) {
  const all = store.services
    .map((item, i) => ({
      slug: item.slug || `service-${i + 1}`,
      title: item.data.title || item.title,
      text: item.data.description || item.data.summary || '',
      audience: item.data.audience || '',
      access: item.data.access || '',
      preparation: item.data.preparation || '',
      order: Number.isFinite(item.data.order) ? item.data.order : i + 1,
    }))
    .sort((a, b) => a.order - b.order);
  const items = all.length ? all.slice(0, limit) : fallbackServices.slice(0, limit);
  return items.map((item, i) => ({ ...item, index: i }));
}

export function serviceCards(limit = 4) {
  return serviceItems(limit)
    .map(
      (item) => `<a class="service-card" href="/services?service=${encodeURIComponent(item.slug)}" data-link><div class="service-index">${String(item.index + 1).padStart(2, '0')}</div><div class="service-card-icon">${glyphs[item.index % glyphs.length]}</div><h3>${esc(item.title)}</h3><p>${esc(item.text || 'Talk with our team about the right service pathway.')}</p><span class="circle-arrow">${icons.arrow}</span></a>`
    )
    .join('');
}

export function serviceAccordion(items) {
  const list = items.length ? items : fallbackServices;
  return `<div class="service-accordion" data-service-accordion>${list
    .map((item, i) => {
      const triggerId = `service-trigger-${item.slug}`;
      const panelId = `service-panel-${item.slug}`;
      return `<div class="accordion-item" data-slug="${esc(item.slug)}">
      <h3 class="accordion-heading">
        <button class="accordion-trigger" type="button" id="${triggerId}" aria-expanded="false" aria-controls="${panelId}">
          <span class="service-index">${String(i + 1).padStart(2, '0')}</span>
          <span class="accordion-title">${esc(item.title)}</span>
          <span class="accordion-summary">${esc(item.text || 'Talk with our team about the right service pathway.')}</span>
          <span class="accordion-icon">${icons.chevron}</span>
        </button>
      </h3>
      <div class="accordion-panel" id="${panelId}" role="region" aria-labelledby="${triggerId}" hidden>
        <div class="accordion-panel-inner">
          <p class="accordion-detail">${esc(item.text || 'Talk with our team about the right service pathway.')}</p>
          <dl class="accordion-facts">
            ${item.audience ? `<div><dt>Who it is for</dt><dd>${esc(item.audience)}</dd></div>` : ''}
            ${item.access ? `<div><dt>Access</dt><dd>${esc(item.access)}</dd></div>` : ''}
            ${item.preparation ? `<div><dt>Preparation</dt><dd>${esc(item.preparation)}</dd></div>` : ''}
          </dl>
          <a class="button secondary" href="/contact?category=provider" data-link>Discuss this service ${icons.arrow}</a>
        </div>
      </div>
    </div>`;
    })
    .join('')}</div>`;
}

export function bindServiceAccordion(root, { openSlug = '' } = {}) {
  const accordion = root.querySelector('[data-service-accordion]');
  if (!accordion) return;
  const items = Array.from(accordion.querySelectorAll('.accordion-item'));
  const triggers = items.map((item) => item.querySelector('.accordion-trigger'));

  function setOpen(item, open) {
    const trigger = item.querySelector('.accordion-trigger');
    const panel = item.querySelector('.accordion-panel');
    trigger.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    item.classList.toggle('is-open', open);
  }

  function openItem(item, { focus = false, scroll = false } = {}) {
    items.forEach((other) => setOpen(other, other === item));
    if (focus) item.querySelector('.accordion-trigger').focus();
    if (scroll) requestAnimationFrame(() => item.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  items.forEach((item, i) => {
    triggers[i].addEventListener('click', () => {
      const expanded = triggers[i].getAttribute('aria-expanded') === 'true';
      if (expanded) setOpen(item, false);
      else openItem(item);
    });
    triggers[i].addEventListener('keydown', (event) => {
      const keys = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      const next = Math.max(0, Math.min(items.length - 1, keys[event.key]));
      triggers[next].focus();
    });
  });

  if (openSlug) {
    const target = items.find((item) => item.dataset.slug === openSlug);
    if (target) openItem(target, { scroll: true });
  }
}

export function notice(title, text, tone = '') {
  return `<div class="notice ${tone}">${title ? `<b>${esc(title)}</b>` : ''}<p>${esc(text)}</p></div>`;
}

export function interiorHero({ label, title, summary, highlight = '.' }) {
  return `<section class="interior-hero"><div class="container">${eyebrow(label || 'GeneWorldBio')}<h1>${esc(title)}<em>${esc(highlight)}</em></h1>${summary ? `<p>${esc(summary)}</p>` : ''}</div><div class="interior-orbit"></div></section>`;
}
