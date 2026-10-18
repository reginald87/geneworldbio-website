import { icons } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { interiorHero } from '../components/sections.js';
import { store } from '../lib/store.js';
import { track } from '../lib/analytics.js';

export const title = 'Contact';

const turnstileSiteKey = import.meta.env?.VITE_TURNSTILE_SITE_KEY || '';
let turnstileScriptPromise = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error('The bot check could not be loaded.'));
      document.head.appendChild(script);
    });
  }
  return turnstileScriptPromise;
}

const routes = [
  { value: 'provider', label: 'Healthcare provider', audience: 'Hospitals, clinics and laboratories', blurb: 'Referral capacity, specimen logistics and partnership arrangements.', heading: 'Start a partnership conversation', intro: 'Tell us about your organisation, location, testing needs and logistics requirements.' },
  { value: 'patient', label: 'Patient or carer', audience: 'Patients and carers', blurb: 'General guidance and pathway support for your questions.', heading: 'Ask for patient support', intro: 'Share your question and we will help route it. Please do not send clinical results or medical details.' },
  { value: 'research', label: 'Research collaboration', audience: 'Researchers and institutions', blurb: 'Studies, test menus and academic partnerships.', heading: 'Discuss a research collaboration', intro: 'Tell us about your institution, study area and the testing or pathway support you need.' },
  { value: 'supplier', label: 'Supplier', audience: 'Suppliers and vendors', blurb: 'Products, services and vendor enquiries.', heading: 'Tell us what you supply', intro: 'Share your company, location and the products or services you would like to discuss.' },
  { value: 'general', label: 'General enquiry', audience: 'Everyone', blurb: 'Anything else, including feedback and privacy questions.', heading: 'Send an enquiry', intro: 'Tell us what you need and we will direct your message to the appropriate team.' },
];

const contactMethodField = ['contactMethod', 'Preferred contact method', { type: 'select', options: [['email', 'Email'], ['phone', 'Phone'], ['whatsapp', 'WhatsApp']] }];
const phoneField = ['phone', 'Phone number', { type: 'tel', autocomplete: 'tel', inputmode: 'tel', pattern: '[+0-9()\\-\\s.]{6,40}', optional: true, maxlength: 40, placeholder: 'Include country code, e.g. +234…' }];
const group = (label) => ['_group', label];

const fieldSets = {
  provider: [
    group('Organisation & context'),
    ['organisation', 'Organisation', { required: true, maxlength: 150, placeholder: 'Hospital, clinic or laboratory' }],
    ['orgType', 'Organisation type', { type: 'select', options: [['hospital', 'Hospital'], ['clinic', 'Clinic'], ['laboratory', 'Independent laboratory'], ['diagnostic-centre', 'Diagnostic centre'], ['public-health', 'Public health body'], ['other', 'Other']] }],
    ['country', 'Country', { maxlength: 120, placeholder: 'e.g. Nigeria' }],
    ['state', 'State', { maxlength: 120, placeholder: 'e.g. Bayelsa' }],
    ['location', 'Location (city/area)', { maxlength: 200, placeholder: 'City, area' }],
    ['role', 'Your role or department', { optional: true, maxlength: 120, placeholder: 'e.g. Laboratory manager' }],
    ['gender', 'Gender', { type: 'select', optional: true, options: [['', 'Prefer not to say'], ['female', 'Female'], ['male', 'Male'], ['non-binary', 'Non-binary'], ['other', 'Other']] }],
    group('Testing & logistics'),
    ['service', 'Service of interest', { type: 'select', optional: true, options: [
      ['', 'Select a service (optional)'],
      ['genomics-molecular-biology', 'Genomics & Molecular Biology'],
      ['molecular-diagnostics', 'Molecular Diagnostics'],
      ['bioinformatics-data-science', 'Bioinformatics & Data Science'],
      ['research-contract-research', 'Research & Contract Research'],
      ['laboratory-reagents-consumables', 'Laboratory Reagents & Consumables'],
      ['laboratory-equipment-technology', 'Laboratory Equipment & Technology'],
      ['research-training-capacity-building', 'Research Training & Capacity Building'],
      ['clinical-translational-research', 'Clinical & Translational Research'],
      ['biotechnology-innovation-commercialisation', 'Biotechnology Innovation & Commercialisation'],
      ['environmental-public-health-genomics', 'Environmental & Public Health Genomics'],
      ['other', 'Other / Not specified'],
    ] }],
    ['needs', 'Testing needs', { type: 'textarea', span: 2, maxlength: 500, placeholder: 'Referral, service or testing needs' }],
    ['volume', 'Estimated volume', { maxlength: 60, placeholder: 'e.g. 200' }],
    ['volumeUnit', 'Per', { type: 'select', options: [['week', 'Week'], ['month', 'Month']] }],
    ['logistics', 'Logistics requirements', { type: 'textarea', span: 2, maxlength: 500, placeholder: 'Collection, packaging or transport needs' }],
    group('How should we reply?'),
    contactMethodField,
    phoneField,
  ],
  patient: [
    group('Where you are'),
    ['country', 'Country', { maxlength: 120, placeholder: 'e.g. Nigeria' }],
    ['state', 'State', { maxlength: 120, placeholder: 'e.g. Lagos' }],
    ['location', 'City or area', { maxlength: 200, placeholder: 'Where are you based?' }],
    ['gender', 'Gender', { type: 'select', optional: true, options: [['', 'Prefer not to say'], ['female', 'Female'], ['male', 'Male'], ['non-binary', 'Non-binary'], ['other', 'Other']] }],
    ['language', 'Preferred language', { type: 'select', options: [['english', 'English'], ['pidgin', 'Nigerian Pidgin'], ['other', 'Other']] }],
    group('How should we reply?'),
    contactMethodField,
    phoneField,
  ],
  research: [
    group('Institution'),
    ['organisation', 'Institution', { required: true, maxlength: 150, placeholder: 'University, hospital or laboratory' }],
    ['institutionType', 'Institution type', { type: 'select', options: [['university', 'University'], ['hospital', 'Hospital'], ['research-institute', 'Research institute'], ['industry', 'Industry'], ['government', 'Government'], ['other', 'Other']] }],
    ['country', 'Country', { maxlength: 120, placeholder: 'e.g. Nigeria' }],
    ['state', 'State', { maxlength: 120, placeholder: 'e.g. FCT' }],
    ['location', 'Location', { maxlength: 200, placeholder: 'City, area' }],
    group('Study or collaboration'),
    ['service', 'Service of interest', { type: 'select', optional: true, options: [
      ['', 'Select a service (optional)'],
      ['genomics-molecular-biology', 'Genomics & Molecular Biology'],
      ['molecular-diagnostics', 'Molecular Diagnostics'],
      ['bioinformatics-data-science', 'Bioinformatics & Data Science'],
      ['research-contract-research', 'Research & Contract Research'],
      ['laboratory-reagents-consumables', 'Laboratory Reagents & Consumables'],
      ['laboratory-equipment-technology', 'Laboratory Equipment & Technology'],
      ['research-training-capacity-building', 'Research Training & Capacity Building'],
      ['clinical-translational-research', 'Clinical & Translational Research'],
      ['biotechnology-innovation-commercialisation', 'Biotechnology Innovation & Commercialisation'],
      ['environmental-public-health-genomics', 'Environmental & Public Health Genomics'],
      ['other', 'Other / Not specified'],
    ] }],
    ['needs', 'Research focus or testing needs', { type: 'textarea', span: 2, maxlength: 500, placeholder: 'Study area, test menu or collaboration goal' }],
    ['ethicsStatus', 'Ethics approval', { type: 'select', options: [['approved', 'Approved'], ['in-progress', 'In progress'], ['not-required', 'Not required'], ['not-sure', 'Not sure yet']] }],
    ['timeline', 'Expected timeline', { optional: true, maxlength: 120, placeholder: 'e.g. Q1 2026' }],
    group('How should we reply?'),
    contactMethodField,
    phoneField,
  ],
  supplier: [
    group('Company'),
    ['organisation', 'Company', { required: true, maxlength: 150, placeholder: 'Company name' }],
    ['website', 'Website', { type: 'url', optional: true, maxlength: 200, placeholder: 'https://' }],
    ['country', 'Country', { maxlength: 120, placeholder: 'e.g. Nigeria' }],
    ['state', 'State', { maxlength: 120, placeholder: 'e.g. Lagos' }],
    ['location', 'Location', { maxlength: 200, placeholder: 'City, area' }],
    ['registrationNumber', 'Registration number', { optional: true, maxlength: 60, placeholder: 'RC or company number' }],
    group('What you offer'),
    ['service', 'Service category', { type: 'select', optional: true, options: [
      ['', 'Select (optional)'],
      ['genomics-molecular-biology', 'Genomics & Molecular Biology'],
      ['molecular-diagnostics', 'Molecular Diagnostics'],
      ['bioinformatics-data-science', 'Bioinformatics & Data Science'],
      ['research-contract-research', 'Research & Contract Research'],
      ['laboratory-reagents-consumables', 'Laboratory Reagents & Consumables'],
      ['laboratory-equipment-technology', 'Laboratory Equipment & Technology'],
      ['research-training-capacity-building', 'Research Training & Capacity Building'],
      ['clinical-translational-research', 'Clinical & Translational Research'],
      ['biotechnology-innovation-commercialisation', 'Biotechnology Innovation & Commercialisation'],
      ['environmental-public-health-genomics', 'Environmental & Public Health Genomics'],
      ['other', 'Other'],
    ] }],
    ['needs', 'Products or services offered', { type: 'textarea', span: 2, maxlength: 500, placeholder: 'What you supply or provide' }],
    group('How should we reply?'),
    contactMethodField,
    phoneField,
  ],
  general: [
    group('Your enquiry'),
    ['subject', 'Subject', { optional: true, maxlength: 120, placeholder: 'What is this about?' }],
    ['organisation', 'Organisation', { optional: true, maxlength: 150, placeholder: 'Organisation name (if relevant)' }],
    ['country', 'Country', { maxlength: 120, placeholder: 'e.g. Nigeria' }],
    ['state', 'State', { maxlength: 120, placeholder: 'e.g. Lagos' }],
    ['gender', 'Gender', { type: 'select', optional: true, options: [['', 'Prefer not to say'], ['female', 'Female'], ['male', 'Male'], ['non-binary', 'Non-binary'], ['other', 'Other']] }],
    group('How should we reply?'),
    contactMethodField,
    phoneField,
  ],
};

const messageLabels = {
  provider: 'How can we support your team?',
  patient: 'Your question',
  research: 'Tell us about the collaboration',
  supplier: 'Tell us what you offer',
  general: 'Message',
};

export function routeByValue(value) {
  return routes.find((route) => route.value === value) || routes[routes.length - 1];
}

function fieldMarkup(name, label, options = {}) {
  const id = `enquiry-${name}`;
  const required = options.required ? ' *' : options.optional ? ` <span class="optional" data-optional-for="${id}">(optional)</span>` : '';
  const width = options.span === 2 ? ' class="span-2"' : '';
  const attributes = [
    `id="${id}"`,
    `name="${name}"`,
    options.required ? 'required' : '',
    options.maxlength ? `maxlength="${options.maxlength}"` : '',
    options.autocomplete ? `autocomplete="${options.autocomplete}"` : '',
    options.inputmode ? `inputmode="${options.inputmode}"` : '',
    options.pattern ? `pattern="${options.pattern}"` : '',
  ].filter(Boolean).join(' ');
  let control;
  if (options.type === 'textarea') {
    control = `<textarea ${attributes} rows="3" placeholder="${options.placeholder || ''}"></textarea>`;
  } else if (options.type === 'select') {
    control = `<select ${attributes}>${(options.options || []).map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select>`;
  } else {
    control = `<input type="${options.type || 'text'}" ${attributes} placeholder="${options.placeholder || ''}">`;
  }
  return `<label${width} for="${id}">${label}${required}${control}</label>`;
}

function whatsappLink() {
  const raw = import.meta.env?.VITE_WHATSAPP_NUMBER;
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 6) return '';
  return `<a class="contact-whatsapp" href="https://wa.me/${digits}?text=${encodeURIComponent('Hello GeneWorldBio, I would like to ask about your services.')}" target="_blank" rel="noopener">${icons.phone}<span>Chat on WhatsApp</span></a>`;
}

export function enquiryForm(category = 'general', overrides = {}) {
  const route = routeByValue(category);
  const fields = fieldSets[route.value] || fieldSets.general;
  const heading = overrides.heading || route.heading;
  const intro = overrides.intro || route.intro;
  const messageLabel = overrides.messageLabel || messageLabels[route.value] || 'Message';
  const fieldsHtml = fields
    .map(([name, label, options]) => (name === '_group' ? `<div class="form-group-label span-2">${label}</div>` : fieldMarkup(name, label, options)))
    .join('');
  return `<div class="contact-layout"><div class="contact-aside"><h2>How can we<br>help <em>you?</em></h2><p>${intro}</p><div class="contact-note"><span class="note-icon">${icons.check}</span><p>Please do not send clinical results, detailed medical histories or genomic files. If you need to share a file, ask us for a secure transfer link.</p></div>${whatsappLink()}<div class="contact-address"><span>REGISTERED OFFICE</span><p>GENEWORLDBIO LTD<br>No. 7B, Azikoro Road, Ekeki<br>Yenagoa, Bayelsa State, Nigeria</p></div></div>
  <form class="form-card enquiry-form" data-category="${route.value}"><div class="form-heading"><span class="form-step">01 / 01</span><h3>${heading}</h3><p>Fields marked with * are required.</p></div>
    <input type="hidden" name="category" value="${route.value}">
    <input type="hidden" name="formStartedAt" value="">
    <div class="form-fields">
      <label for="enquiry-name">Your name *<input id="enquiry-name" name="name" required maxlength="100" autocomplete="name" placeholder="Full name"></label>
      <label for="enquiry-email">Email address *<input id="enquiry-email" name="email" type="email" required maxlength="180" autocomplete="email" placeholder="name@example.com"></label>
      ${fieldsHtml}
      <label class="span-2" for="enquiry-message">${messageLabel} *<textarea id="enquiry-message" name="message" required maxlength="3000" rows="4" placeholder="How can we help?"></textarea></label>
    </div>
    <label class="consent"><input type="checkbox" name="consent" required> I understand this form is not for clinical results and I accept the <a href="/privacy-notice" data-link>privacy notice</a>.</label>
    <input class="honeypot" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <p class="form-urgent">This form is not monitored for emergencies. For urgent medical needs, contact your care team or local emergency services.</p>
    ${turnstileSiteKey ? '<div class="cf-turnstile" data-action="enquiry"></div>' : ''}
    <button class="button primary" type="submit">Send enquiry ${icons.arrow}</button>
    <span class="form-result" role="status" aria-live="polite"></span>
    <small class="form-privacy">We collect only the information needed to route and respond to your enquiry, and we aim to respond within two business days.</small>
  </form></div>`;
}

function routeChooser(active) {
  return `<div class="route-grid">${routes
    .map((route) => `<a class="route-card${route.value === active ? ' active' : ''}"${route.value === active ? ' aria-current="true"' : ''} href="/contact?category=${route.value}" data-link><span class="route-card-audience">${route.audience}</span><strong>${route.label}</strong><span class="route-card-blurb">${route.blurb}</span><span class="circle-arrow">${icons.arrow}</span></a>`)
    .join('')}</div>`;
}

function meta() {
  const page = store.pages.find((item) => item.slug === 'contact');
  return {
    label: page?.data?.eyebrow || 'GeneWorldBio',
    title: page?.data?.title || 'Let’s find the right route',
    summary: page?.data?.summary || 'Tell us what you need and we will direct your message to the appropriate team.',
  };
}

export async function render() {
  const m = meta();
  const requested = new URLSearchParams(location.search).get('category') || '';
  const active = routes.some((route) => route.value === requested) ? requested : 'general';
  return `<main class="interior-page">
    ${interiorHero({ label: m.label, title: m.title, summary: m.summary })}
    <section class="section interior-content"><div class="container">
      <div class="route-grid-wrap"><h2 class="route-grid-title">Choose your route</h2>${routeChooser(active)}</div>
      ${enquiryForm(active)}
    </div></section>
  </main>`;
}

export function mount(root) {
  bindEnquiryForm(root);
}

export function bindEnquiryForm(root) {
  root.querySelectorAll('.enquiry-form').forEach((formEl) => {
    const result = formEl.querySelector('.form-result');
    const submit = formEl.querySelector('button[type="submit"]');
    const startedAt = formEl.querySelector('[name="formStartedAt"]');
    const category = formEl.dataset.category || 'general';
    if (startedAt) startedAt.value = String(Date.now());
    let sending = false;

    formEl.addEventListener('invalid', (event) => event.target.setAttribute('aria-invalid', 'true'), true);
    formEl.addEventListener('input', (event) => {
      if (event.target.checkValidity()) event.target.removeAttribute('aria-invalid');
    });

    const methodSelect = formEl.querySelector('[name="contactMethod"]');
    const phoneInput = formEl.querySelector('[name="phone"]');
    if (methodSelect && phoneInput) {
      const optionalHint = phoneInput.closest('label')?.querySelector(`[data-optional-for="${phoneInput.id}"]`);
      const syncPhone = () => {
        const wantsPhone = methodSelect.value === 'phone' || methodSelect.value === 'whatsapp';
        phoneInput.required = wantsPhone;
        if (optionalHint) optionalHint.hidden = wantsPhone;
      };
      methodSelect.addEventListener('change', syncPhone);
      syncPhone();
    }

    const turnstileBox = formEl.querySelector('.cf-turnstile');
    let turnstileWidgetId = null;
    if (turnstileSiteKey && turnstileBox) {
      loadTurnstile()
        .then((widget) => {
          turnstileWidgetId = widget.render(turnstileBox, {
            sitekey: turnstileSiteKey,
            theme: 'light',
            action: 'enquiry',
            'response-field': false,
          });
        })
        .catch(() => { /* The form stays usable; the server skips the check when no secret is set. */ });
    }

    const clearInvalid = () => formEl.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));

    formEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (sending) return;
      sending = true;
      if (submit) submit.disabled = true;
      result.textContent = 'Sending…';
      result.className = 'form-result';
      const values = Object.fromEntries(new FormData(formEl));
      values.consent = true;
      if (startedAt) values.formStartedAt = startedAt.value;
      if (turnstileSiteKey && window.turnstile && turnstileWidgetId !== null) {
        values.turnstileToken = window.turnstile.getResponse(turnstileWidgetId) || '';
      }
      try {
        const response = await api('/public/inquiries', { method: 'POST', body: JSON.stringify(values) });
        formEl.reset();
        clearInvalid();
        if (startedAt) startedAt.value = String(Date.now());
        if (methodSelect) methodSelect.dispatchEvent(new Event('change'));
        if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
        result.textContent = response.reference ? `Thank you. Your enquiry has been received. Your reference is ${response.reference}.` : 'Thank you. Your enquiry has been received.';
        result.classList.add('success');
        track('enquiry_submitted', { category });
      } catch (error) {
        result.textContent = error.message;
        result.classList.add('error');
        if (/phone/i.test(error.message) && phoneInput) { phoneInput.setAttribute('aria-invalid', 'true'); phoneInput.focus(); }
        track('enquiry_failed', { category });
      } finally {
        sending = false;
        if (submit) submit.disabled = false;
      }
    });
  });
}
