import { api } from './api.js';

export const store = {
  pages: [],
  services: [],
  loaded: false,
};

export const fallbackHero = {
  slides: [
    {
      eyebrow: 'Diagnostics, connected with care',
      heading: 'A clearer path to better',
      highlight: 'health.',
      text: 'We bring healthcare teams, diagnostic pathways and people closer together — with thoughtful support at every step.',
      primary: { label: 'Partner with us', href: '/healthcare-providers' },
      secondary: { label: 'Explore our services', href: '/services' },
      note: 'Designed around trusted partnerships and more connected access.',
    },
    {
      eyebrow: 'For healthcare teams',
      heading: 'Good partnerships make better',
      highlight: 'pathways.',
      text: 'Referral planning, specimen logistics and a responsive point of contact shaped around your operational needs.',
      primary: { label: 'Start a conversation', href: '/healthcare-providers' },
      secondary: { label: 'View services', href: '/services' },
      note: 'Institution-led, quality-controlled and easy to work with.',
    },
    {
      eyebrow: 'For patients & carers',
      heading: 'Know what to expect, feel',
      highlight: 'supported.',
      text: 'Practical guidance that makes diagnostic pathways easier to understand, with a clear route for your questions.',
      primary: { label: 'Find patient support', href: '/patients' },
      secondary: { label: 'Contact us', href: '/contact' },
      note: 'Clear information at every step of your journey.',
    },
  ],
};

export async function loadPublicContent(force = false) {
  if (store.loaded && !force) return store;
  try {
    const [pages, services] = await Promise.all([api('/public/pages'), api('/public/services')]);
    store.pages = pages;
    store.services = services;
  } catch {
    store.pages = [];
    store.services = [];
  }
  store.loaded = true;
  return store;
}

export function pageBySlug(slug) {
  return store.pages.find((page) => page.slug === slug);
}

export function heroSlides() {
  const home = pageBySlug('home');
  const slides = home?.data?.hero?.slides;
  return Array.isArray(slides) && slides.length ? slides : fallbackHero.slides;
}
