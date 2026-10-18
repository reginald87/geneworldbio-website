import { esc } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { interiorHero, notice } from '../components/sections.js';
import { button } from '../components/layout.js';
import { store } from '../lib/store.js';

export const title = 'Frequently Asked Questions';

function meta() {
  const page = store.pages.find((item) => item.slug === 'faqs');
  return {
    label: page?.data?.eyebrow || 'GeneWorldBio',
    title: page?.data?.title || 'Frequently Asked Questions',
    summary:
      page?.data?.summary ||
      'Answers to common questions about our services, access and how to get in touch.',
  };
}

function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function faqAccordion(items) {
  if (!items.length) {
    return `<div class="empty-state"><span>✳</span><h2>No FAQs available yet</h2><p>Check back soon or contact us with your question.</p></div>`;
  }
  return `<div class="service-accordion" data-faq-accordion>${items
    .map((item, i) => {
      const triggerId = `faq-trigger-${item.slug || i}`;
      const panelId = `faq-panel-${item.slug || i}`;
      const answer = escapeHtml(item.answer).replace(/\n/g, '<br>');
      return `<div class="accordion-item" data-slug="${esc(item.slug || '')}">
        <h3 class="accordion-heading">
          <button class="accordion-trigger" type="button" id="${triggerId}" aria-expanded="false" aria-controls="${panelId}">
            <span class="accordion-title">${esc(item.question)}</span>
            <span class="accordion-icon">${icons.chevron}</span>
          </button>
        </h3>
        <div class="accordion-panel" id="${panelId}" role="region" aria-labelledby="${triggerId}" hidden>
          <div class="accordion-panel-inner">
            <div class="accordion-detail">${answer}</div>
          </div>
        </div>
      </div>`;
    })
    .join('')}</div>`;
}

export async function render(slug, ctx) {
  const m = meta();
  const faqs = (store.faqs || [])
    .filter((item) => item.status !== 'draft')
    .map((item, i) => ({
      slug: item.slug || `faq-${i}`,
      question: item.data?.question || item.title || '',
      answer: item.data?.answer || '',
      order: Number.isFinite(item.data?.order) ? item.data.order : i + 1,
    }))
    .sort((a, b) => a.order - b.order);

  return `<main class="interior-page">
    ${interiorHero({ label: m.label, title: m.title, summary: m.summary })}
    <section class="section interior-content"><div class="container">
      <div class="service-grid-wrap">${faqAccordion(faqs)}</div>
      ${notice('Still have a question?', 'If you can’t find what you’re looking for, reach out to our team.')}
      ${button('Contact us', '/contact')}
    </div></section>
    <section class="final-cta"><div class="container cta-inner"><div><h2>Not sure which route fits?</h2><p>${esc(
      'Tell us what you need and we will help you find the right pathway.'
    )}</p></div>${button('Get in touch', '/contact')}</div></section>
  </main>`;
}

export function mount(root, slug, ctx) {
  const accordion = root.querySelector('[data-faq-accordion]');
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

  function openItem(item) {
    items.forEach((other) => setOpen(other, other === item));
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
}
