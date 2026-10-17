import { icons } from '../lib/icons.js';
import { esc } from '../lib/dom.js';

function slideMarkup(slide, index) {
  const primary = slide.primary?.label
    ? `<a class="button primary" href="${esc(slide.primary.href || '/contact')}" data-link>${esc(slide.primary.label)} ${icons.arrow}</a>`
    : '';
  const secondary = slide.secondary?.label
    ? `<a class="button secondary" href="${esc(slide.secondary.href || '/services')}" data-link>${esc(slide.secondary.label)} ${icons.arrow}</a>`
    : '';
  return `<article class="hero-slide ${index === 0 ? 'is-active' : ''}" id="hero-slide-${index}" role="tabpanel" aria-label="Slide ${index + 1}" ${index === 0 ? '' : 'aria-hidden="true"'}>
    <span class="eyebrow"><i></i>${esc(slide.eyebrow || 'GeneWorldBio')}</span>
    <h1>${esc(slide.heading || '')}${slide.highlight ? ` <em>${esc(slide.highlight)}</em>` : ''}</h1>
    ${slide.text ? `<p>${esc(slide.text)}</p>` : ''}
    ${primary || secondary ? `<div class="hero-actions">${primary}${secondary}</div>` : ''}
    ${slide.note ? `<div class="hero-note"><span class="note-icon">${icons.check}</span><span>${esc(slide.note)}</span></div>` : ''}
  </article>`;
}

function railMarkup(slides) {
  const toggle =
    slides.length > 1
      ? `<button class="hero-toggle" type="button" aria-label="Pause slideshow" aria-pressed="false" data-hero-toggle>
        <span class="hero-toggle-icon icon-pause">${icons.pause}</span>
        <span class="hero-toggle-icon icon-play">${icons.play}</span>
        <span class="hero-toggle-text">Pause</span>
      </button>`
      : '';
  return `<div class="hero-controls">
    <div class="hero-rail" role="tablist" aria-label="Hero slides" aria-orientation="vertical">
      <span class="hero-rail-line"></span>
      ${slides
        .map(
          (slide, index) => `<button class="hero-dot ${index === 0 ? 'is-active' : ''}" role="tab" aria-selected="${index === 0}" aria-controls="hero-slide-${index}" data-slide="${index}">
        <span class="hero-dot-circle"><span class="hero-dot-index">0${index + 1}</span></span>
        <span class="hero-dot-label">${esc(slide.eyebrow || `Slide ${index + 1}`)}</span>
      </button>`
        )
        .join('')}
    </div>
    ${toggle}
  </div>`;
}

export function heroCarousel(slides) {
  const list = Array.isArray(slides) && slides.length ? slides : [];
  if (!list.length) return '';
  return `<section class="hero" aria-roledescription="carousel" aria-label="Highlights">
    <div class="hero-grid"></div>
    <div class="container hero-inner">
      <div class="hero-copy">
        <div class="hero-slides">${list.map(slideMarkup).join('')}</div>
      </div>
      ${railMarkup(list)}
      <div class="hero-art" aria-hidden="true">
        <div class="art-orbit orbit-one"></div>
        <div class="art-orbit orbit-two"></div>
        <div class="art-card card-top"><span class="mini-dot"></span><span>Connected care</span><b>01 — 04</b></div>
        <div class="art-disc"><div class="disc-ring"></div><div class="molecule"><i></i><i></i><i></i><i></i><i></i><i></i><span></span></div><div class="disc-label">A better<br>pathway</div></div>
        <div class="art-card card-bottom"><span class="green-dot"></span><span>Provider network</span>${icons.arrow}</div>
        <span class="art-caption">Precision in every connection</span>
      </div>
    </div>
    <div class="container hero-foot"><span>Thoughtfully connected pathways</span><span class="hero-foot-line"></span><span>Built for people. Designed for care.</span></div>
  </section>`;
}

let cleanup = null;

export function mountHeroCarousel(root, options = {}) {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  const interval = options.interval || 6500;
  const hero = root.querySelector('.hero');
  if (!hero) return;
  const slides = Array.from(hero.querySelectorAll('.hero-slide'));
  const dots = Array.from(hero.querySelectorAll('.hero-dot'));
  const toggle = hero.querySelector('[data-hero-toggle]');
  const slidesRegion = hero.querySelector('.hero-slides');
  if (slides.length < 2) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let timer = null;
  let focusWithin = false;
  let playing = !reduceMotion;

  function autoplayActive() {
    return playing && !focusWithin && !document.hidden;
  }

  function syncLiveRegion() {
    slidesRegion?.setAttribute('aria-live', autoplayActive() ? 'off' : 'polite');
  }

  function syncToggle() {
    if (!toggle) return;
    toggle.classList.toggle('is-paused', !playing);
    toggle.setAttribute('aria-pressed', String(!playing));
    toggle.setAttribute('aria-label', playing ? 'Pause slideshow' : 'Play slideshow');
    const text = toggle.querySelector('.hero-toggle-text');
    if (text) text.textContent = playing ? 'Pause' : 'Play';
  }

  function show(next, { focus = false } = {}) {
    if (!document.contains(hero)) return;
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.toggleAttribute('aria-hidden', !active);
    });
    dots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', String(active));
      if (active) {
        dot.classList.remove('restart');
        void dot.offsetWidth;
        dot.classList.add('restart');
      }
    });
    if (focus) dots[index].focus();
  }

  function schedule() {
    clearTimeout(timer);
    if (!autoplayActive()) return;
    timer = setTimeout(() => {
      if (!document.contains(hero)) return;
      show(index + 1);
      schedule();
    }, interval);
  }

  function setPlaying(next) {
    playing = next;
    syncToggle();
    syncLiveRegion();
    schedule();
  }

  function onVisibility() {
    if (document.hidden) clearTimeout(timer);
    else schedule();
    syncLiveRegion();
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      show(i);
      schedule();
    });
    dot.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        show(index + 1, { focus: true });
        schedule();
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        show(index - 1, { focus: true });
        schedule();
      }
    });
  });

  toggle?.addEventListener('click', () => setPlaying(!playing));

  hero.addEventListener('focusin', () => {
    focusWithin = true;
    clearTimeout(timer);
    syncLiveRegion();
  });
  hero.addEventListener('focusout', (event) => {
    if (hero.contains(event.relatedTarget)) return;
    focusWithin = false;
    syncLiveRegion();
    schedule();
  });
  document.addEventListener('visibilitychange', onVisibility);

  cleanup = () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };

  syncToggle();
  show(0);
  schedule();
}
