import { icons } from '../lib/icons.js';
import { esc } from '../lib/dom.js';
import { button, eyebrow } from '../components/layout.js';
import { heroCarousel, mountHeroCarousel } from '../components/heroCarousel.js';
import { serviceCards } from '../components/sections.js';
import { store, heroSlides } from '../lib/store.js';

export const title = 'Diagnostics, connected with care';

export async function render() {
  const page = store.pages.find((item) => item.slug === 'home');
  const s = page?.data || {};
  return `<main>
    ${heroCarousel(heroSlides())}

    <section class="principles"><div class="container principle-row">
      <div><span class="principle-number">01</span><strong>Institution-led</strong><span>Practical partnerships that work for care teams.</span></div>
      <div><span class="principle-number">02</span><strong>Quality-controlled</strong><span>Clear standards shape every conversation.</span></div>
      <div><span class="principle-number">03</span><strong>Connected access</strong><span>Guidance that helps people find their next step.</span></div>
    </div></section>

    <section class="section services-section" id="service-preview"><div class="container"><div class="section-head"><div>${eyebrow('How we can help')}<h2>Support that moves<br>care <em>forward.</em></h2></div><p>From referral pathways to specimen logistics, we help teams plan the practical details behind diagnostic access.</p></div><div class="service-grid">${serviceCards(4)}</div><div class="section-end">${button('View all services', '/services', 'text')}</div></div></section>

    <section class="partner-band"><div class="container partner-layout"><div class="partner-art"><div class="partner-ring"></div><div class="partner-cross">+</div><div class="partner-stat"><span>Care works better</span><b>together.</b>${icons.spark}</div></div><div class="partner-copy">${eyebrow('For healthcare teams')}<h2>Good partnerships<br>make better <em>pathways.</em></h2><p>We work with hospitals, clinics and laboratories to shape referral and logistics arrangements around real operational needs.</p><ul><li>${icons.check} A dependable referral discussion</li><li>${icons.check} Clear logistics planning</li><li>${icons.check} A responsive point of contact</li></ul>${button('Start a conversation', '/healthcare-providers')}</div></div></section>

    <section class="section approach-section"><div class="container"><div class="approach-head">${eyebrow('Quality and safety proof')}<h2>Careful by nature.<br><em>Clear by design.</em></h2><p>Every public claim is reviewed and owned before publication. Trust is built through clear standards, responsible claims and respect for every person’s information.</p></div><div class="approach-grid"><article><span class="icon-box">01</span><h3>Clinical accountability</h3><p>Scientific and service information should be clear, reviewed and owned by the right people.</p></article><article><span class="icon-box">02</span><h3>Privacy with purpose</h3><p>We ask for only what is needed to route an enquiry. Sensitive clinical information stays out of public forms.</p></article><article><span class="icon-box">03</span><h3>Thoughtful handling</h3><p>Referral and specimen conversations begin with practical requirements and agreed responsibilities.</p></article></div><a class="text-link" href="/quality-compliance" data-link>Review our quality approach ${icons.arrow}</a></div></section>

    <section class="patient-band"><div class="container patient-layout"><div>${eyebrow('For patients & carers')}<h2>Know what to expect.<br>Feel supported <em>along the way.</em></h2><p>We want diagnostic pathways to feel easier to understand. Find practical guidance and a clear route for your questions.</p>${button('Find patient support', '/patients', 'light')}</div><div class="journey"><div class="journey-line"></div><div class="journey-step"><span>01</span><div><b>Understand</b><small>Get clear information</small></div></div><div class="journey-step"><span>02</span><div><b>Prepare</b><small>Know your next step</small></div></div><div class="journey-step"><span>03</span><div><b>Connect</b><small>Find the right support</small></div></div></div></div></section>

    <section class="final-cta"><div class="container cta-inner"><div>${eyebrow('Let’s move forward')}<h2>Start with a <em>conversation.</em></h2><p>${esc(s.summary || 'Whether you represent a care team or need patient guidance, we’ll help you find the right route.')}</p></div>${button('Get in touch', '/contact')}</div></section>
  </main>`;
}

export function mount(root) {
  mountHeroCarousel(root);
}
