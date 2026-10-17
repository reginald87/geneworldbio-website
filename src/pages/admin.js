import { api } from '../lib/api.js';
import { icons } from '../lib/icons.js';
import { esc } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { logo } from '../components/layout.js';

export const title = 'Staff workspace';

const modules = [
  { key: 'pages', label: 'Pages', icon: 'page', singular: 'page', blurb: 'Manage public pages and the home hero carousel.' },
  { key: 'services', label: 'Services', icon: 'layers', singular: 'service', blurb: 'Service pathways shown across the website.' },
  { key: 'faqs', label: 'FAQs', icon: 'sparkle', singular: 'question', blurb: 'Frequently asked questions and answers.' },
  { key: 'claims', label: 'Claims register', icon: 'check', singular: 'claim', blurb: 'Public claims with evidence and review owners.' },
  { key: 'team', label: 'Team', icon: 'users', singular: 'team member', blurb: 'Team profiles shown on the public team page.' },
  { key: 'inquiries', label: 'Enquiries', icon: 'inbox', singular: 'enquiry', blurb: 'Messages submitted through the contact form.' },
  { key: 'staff', label: 'Staff & audit', icon: 'shield', singular: 'account', blurb: 'Staff accounts and the audit trail.', custom: true },
];

const contentModules = modules.filter((m) => !m.custom);

const fields = {
  pages: ['title', 'slug', 'eyebrow', 'summary', 'status'],
  services: ['title', 'slug', 'description', 'audience', 'access', 'preparation', 'status'],
  faqs: ['title', 'question', 'answer', 'status'],
  claims: ['title', 'claim', 'evidence', 'owner', 'reviewDate', 'status'],
  team: ['title', 'slug', 'role', 'credentials', 'bio', 'photo', 'order', 'status'],
  inquiries: ['title', 'reference', 'name', 'email', 'category', 'organisation', 'orgType', 'institutionType', 'role', 'location', 'language', 'subject', 'needs', 'volume', 'volumeUnit', 'logistics', 'ethicsStatus', 'timeline', 'website', 'registrationNumber', 'contactMethod', 'phone', 'consentAt', 'message', 'status'],
};

const fieldLabels = {
  title: 'Title', slug: 'URL slug', eyebrow: 'Section label', summary: 'Short description', description: 'Description',
  access: 'Access information', audience: 'Audience', question: 'Question', answer: 'Answer', claim: 'Public claim',
  preparation: 'Required preparation',
  evidence: 'Evidence or source', owner: 'Approving owner', reviewDate: 'Review date', email: 'Email address',
  category: 'Enquiry type', location: 'Location', needs: 'Testing needs', volume: 'Estimated volume',
  logistics: 'Logistics requirement', contactMethod: 'Preferred contact method', message: 'Enquiry message', name: 'Name',
  organisation: 'Organisation', phone: 'Phone number', reference: 'Reference', orgType: 'Organisation type',
  institutionType: 'Institution type', role: 'Role', language: 'Preferred language', subject: 'Subject',
  volumeUnit: 'Volume period', ethicsStatus: 'Ethics approval', timeline: 'Expected timeline', website: 'Website',
  registrationNumber: 'Registration number', consentAt: 'Consent captured at',
  credentials: 'Credentials', bio: 'Biography', photo: 'Photo path or URL', order: 'Display order',
};

const multiline = ['summary', 'description', 'access', 'answer', 'claim', 'evidence', 'message', 'needs', 'logistics', 'preparation', 'bio'];
const required = ['title', 'email', 'message'];

const slideFields = [
  ['eyebrow', 'Eyebrow label'],
  ['heading', 'Heading'],
  ['highlight', 'Highlighted word'],
  ['text', 'Supporting text'],
  ['primaryLabel', 'Primary button label'],
  ['primaryHref', 'Primary button link'],
  ['secondaryLabel', 'Secondary button label'],
  ['secondaryHref', 'Secondary button link'],
  ['note', 'Small note'],
];

let root = null;
const state = { module: 'pages', cache: {}, editing: null, slides: [], search: '' };

export async function render() {
  return `<div class="admin-root" id="admin-root"></div>`;
}

export async function mount(mountRoot) {
  root = mountRoot.querySelector('#admin-root') || mountRoot;
  await init();
}

async function init() {
  root.innerHTML = `<div class="admin-loading"><span class="spinner"></span>Loading workspace…</div>`;
  try {
    const results = await Promise.all(contentModules.map((m) => api(`/admin/${m.key}`)));
    contentModules.forEach((m, i) => {
      state.cache[m.key] = results[i];
    });
    state.cache.staff = [];
    state.cache.audit = [];
    state.me = null;
    state.staffNotice = '';
    try {
      state.me = await api('/admin/me');
      state.cache.staff = await api('/admin/users');
      state.cache.audit = await api('/admin/audit?limit=100');
    } catch (err) {
      state.staffNotice = err.message;
    }
    state.module = 'pages';
    paintShell();
  } catch (error) {
    if (/sign in/i.test(error.message)) showLogin();
    else root.innerHTML = `<div class="admin-error">${esc(error.message)}</div>`;
  }
}

function showLogin(error = '') {
  root.className = 'admin-root admin-body';
  document.body.className = 'admin-body';
  root.innerHTML = loginPage(error);
  const form = root.querySelector('.login-form-inner');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorEl = root.querySelector('.login-error');
    errorEl.textContent = '';
    const fields = new FormData(form);
    try {
      const username = String(fields.get('username') || '').trim().toLowerCase();
      const password = String(fields.get('password') || '');
      await api('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      await init();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

function loginPage(error = '') {
  return `<main class="login-screen"><div class="login-art"><div class="login-orb"></div><div class="login-orb small"></div>${logo()}<div class="login-art-copy"><span>GENEWORLDBIO / CONTENT WORKSPACE</span><h1>Keep every<br>detail <em>connected.</em></h1><p>A considered space to manage pages, the home hero, enquiries and the details that shape your website.</p></div><span class="login-footer">GENEWORLDBIO LTD · RC 9795367</span></div><div class="login-form-side"><div class="login-form">${logo()}<span class="eyebrow">Staff access</span><h2>Welcome back.</h2><p>Sign in to manage the GeneWorldBio website.</p><form class="login-form-inner"><label>Username<input name="username" type="text" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="your-username"></label><label>Password<input name="password" type="password" required autocomplete="current-password" placeholder="Enter your password"></label><button class="button primary" type="submit">Sign in ${icons.arrow}</button><div class="login-error" role="alert">${esc(error)}</div></form><small>Access is intended for approved website staff accounts.</small></div></div></main>`;
}

function visibleModules() {
  const isAdmin = state.me?.role === 'admin';
  return modules.filter((m) => (m.custom ? isAdmin : true));
}

function paintShell() {
  const navModules = visibleModules();
  if (!navModules.some((m) => m.key === state.module)) state.module = 'pages';
  const active = navModules.find((m) => m.key === state.module);
  const isCustom = Boolean(active.custom);
  const who = state.me || {};
  const initials = (who.username || 'gw').slice(0, 2).toUpperCase();
  const roleLabel = who.role === 'admin' ? 'Administrator' : who.role === 'editor' ? 'Editor' : 'Staff';
  root.className = 'admin-root';
  root.innerHTML = `<div class="admin-shell">
    <aside class="admin-sidebar">${logo()}<div class="admin-label">Workspace</div><nav>${navModules
      .map(
        (m) => `<button class="admin-nav ${m.key === state.module ? 'active' : ''}" data-module="${m.key}">${iconSvg(m.icon)}<span>${m.label}</span><small>${(state.cache[m.key] || []).length}</small></button>`
      )
      .join('')}</nav><button class="logout-btn">Sign out ${icons.arrow}</button><div class="admin-identity"><span class="avatar">${esc(initials)}</span><span><b>${esc(who.username || 'staff')}</b><small>${esc(roleLabel)}</small></span></div></aside>
    <main class="admin-main">
      <div class="admin-top"><div><span class="admin-breadcrumb">Workspace / ${esc(active.label)}</span><h1>${esc(active.label)}</h1><p>${esc(active.blurb)}</p></div><div class="admin-actions">${isCustom || state.module === 'inquiries' ? '' : `<button class="button primary create-record">${icons.plus} Create ${active.singular}</button>`}<button class="admin-logout">Sign out</button></div></div>
      <div class="admin-toolbar"><label class="search-box">${icons.search}<input class="admin-search" placeholder="Search ${esc(active.label.toLowerCase())}…" value="${esc(state.search)}"></label><span class="record-count">${(state.cache[state.module] || []).length} ${(state.cache[state.module] || []).length === 1 ? 'record' : 'records'}</span></div>
      <div class="admin-records"></div>
    </main>
  </div>`;

  root.querySelectorAll('[data-module]').forEach((button) =>
    button.addEventListener('click', () => {
      state.module = button.dataset.module;
      state.editing = null;
      paintShell();
    })
  );
  root.querySelector('.admin-logout')?.addEventListener('click', signOut);
  root.querySelector('.logout-btn')?.addEventListener('click', signOut);
  root.querySelector('.create-record')?.addEventListener('click', () => openEditor(null));
  const search = root.querySelector('.admin-search');
  search?.addEventListener('input', (event) => {
    state.search = event.target.value;
    paintRecords();
  });
  paintRecords();
}

function paintRecords() {
  const wrap = root.querySelector('.admin-records');
  if (!wrap) return;
  const module = modules.find((m) => m.key === state.module);
  if (module.custom) {
    paintStaff(wrap);
    return;
  }
  const records = orderRecords(filterRecords(state.cache[state.module] || []));
  if (!records.length) {
    wrap.innerHTML = `<div class="empty-state"><span>✳</span><h2>No ${module.label.toLowerCase()} yet</h2><p>New records will appear here when they are added.</p></div>`;
    return;
  }
  wrap.innerHTML = records.map(recordCard).join('');
  wrap.querySelectorAll('[data-edit]').forEach((button) =>
    button.addEventListener('click', () => {
      const record = (state.cache[state.module] || []).find((r) => r.id === button.dataset.edit);
      openEditor(record);
    })
  );
}

function paintStaff(wrap) {
  if (state.staffNotice) {
    wrap.innerHTML = `<div class="empty-state"><span>✳</span><h2>Staff management unavailable</h2><p>${esc(state.staffNotice)}</p></div>`;
    return;
  }
  const users = state.cache.staff || [];
  const audit = state.cache.audit || [];
  const term = state.search.trim().toLowerCase();
  const shown = term
    ? users.filter((u) => `${u.username} ${u.role} ${u.last_login_at || ''}`.toLowerCase().includes(term))
    : users;
  wrap.innerHTML = `
    <section class="staff-section">
      <div class="staff-section-head"><div><h3>Staff accounts</h3><p>Admins can add, disable and remove accounts. Editors manage content only.</p></div><button class="button primary add-user">${icons.plus} Add account</button></div>
      <form class="user-form" hidden>
        <div class="record-form-grid">
          <label>Username *<input name="username" required minlength="3" autocomplete="off" placeholder="e.g. jdoe"></label>
          <label>Role *<select name="role"><option value="editor">editor</option><option value="admin">admin</option></select></label>
          <label>Password *<input name="password" type="password" required minlength="12" autocomplete="new-password" placeholder="At least 12 characters"></label>
        </div>
        <div class="record-form-actions"><span class="user-form-error" role="alert"></span><button type="button" class="cancel-user">Cancel</button><button class="button primary">Create account</button></div>
      </form>
      ${
        shown.length
          ? `<div class="staff-table">${shown
              .map((u) => {
                const active = u.status !== 'disabled';
                const mine = u.username === state.me?.username;
                return `<div class="staff-row"><span class="avatar">${esc((u.username || 's').slice(0, 2).toUpperCase())}</span><div class="staff-meta"><b>${esc(u.username)}</b><small>${esc(u.role)} · last sign-in ${esc(formatWhen(u.last_login_at))}</small></div><span class="status-pill ${active ? 'published' : 'draft'}">${active ? 'active' : 'disabled'}</span><div class="staff-actions">${active ? `<button data-disable="${esc(u.id)}" ${mine ? 'disabled title="You cannot disable your own account"' : ''}>Disable</button>` : `<button data-enable="${esc(u.id)}">Enable</button>`}<button data-reset="${esc(u.id)}">Reset password</button><button class="danger" data-remove-user="${esc(u.id)}" ${mine ? 'disabled title="You cannot delete your own account"' : ''}>Delete</button></div></div>`;
              })
              .join('')}</div>`
          : `<div class="empty-state small"><p>No accounts match that search.</p></div>`
      }
    </section>
    <section class="staff-section">
      <div class="staff-section-head"><div><h3>Audit trail</h3><p>Sign-ins and every content, account and team change. Newest first.</p></div><button class="button secondary refresh-audit">Refresh</button></div>
      ${
        audit.length
          ? `<div class="audit-list">${audit
              .map(
                (entry) => `<div class="audit-row"><span class="audit-time">${esc(formatWhen(entry.created_at))}</span><span class="audit-who">${esc(entry.username || 'system')}</span><span class="audit-action">${esc(entry.action)}${entry.collection ? ` on ${esc(entry.collection)}` : ''}</span>${entry.ip ? `<span class="audit-ip">${esc(entry.ip)}</span>` : ''}</div>`
              )
              .join('')}</div>`
          : `<div class="empty-state small"><p>No audit entries yet.</p></div>`
      }
    </section>`;

  wrap.querySelector('.add-user')?.addEventListener('click', () => {
    const form = wrap.querySelector('.user-form');
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector('input')?.focus();
  });
  wrap.querySelector('.cancel-user')?.addEventListener('click', () => {
    const form = wrap.querySelector('.user-form');
    form.hidden = true;
    form.reset();
  });
  wrap.querySelector('.user-form')?.addEventListener('submit', createUser);
  wrap.querySelector('.refresh-audit')?.addEventListener('click', async () => {
    state.cache.audit = await api('/admin/audit?limit=100');
    paintRecords();
  });
  wrap.querySelectorAll('[data-disable], [data-enable]').forEach((button) =>
    button.addEventListener('click', () => setAccountActive(button.dataset.disable || button.dataset.enable, !button.dataset.disable))
  );
  wrap.querySelectorAll('[data-reset]').forEach((button) => button.addEventListener('click', () => resetPassword(button.dataset.reset)));
  wrap.querySelectorAll('[data-remove-user]').forEach((button) => button.addEventListener('click', () => removeUser(button.dataset.removeUser)));
}

function formatWhen(value) {
  if (!value) return 'never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

async function createUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorEl = form.querySelector('.user-form-error');
  errorEl.textContent = '';
  const payload = Object.fromEntries(new FormData(form));
  try {
    await api('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
    state.cache.staff = await api('/admin/users');
    state.cache.audit = await api('/admin/audit?limit=100');
    form.reset();
    form.hidden = true;
    paintRecords();
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function setAccountActive(id, active) {
  try {
    await api(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ status: active ? 'active' : 'disabled' }) });
    await refreshStaff();
  } catch (error) {
    alert(error.message);
  }
}

async function resetPassword(id) {
  const password = prompt('New password for this account (at least 12 characters):');
  if (password === null) return;
  try {
    await api(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ password }) });
    await refreshStaff();
  } catch (error) {
    alert(error.message);
  }
}

async function removeUser(id) {
  if (!confirm('Remove this staff account? This cannot be undone.')) return;
  try {
    await api(`/admin/users/${id}`, { method: 'DELETE' });
    await refreshStaff();
  } catch (error) {
    alert(error.message);
  }
}

async function refreshStaff() {
  state.cache.staff = await api('/admin/users');
  state.cache.audit = await api('/admin/audit?limit=100');
  paintShell();
}

function filterRecords(records) {
  const term = state.search.trim().toLowerCase();
  if (!term) return records;
  return records.filter((record) => {
    const haystack = `${record.title} ${record.slug || ''} ${JSON.stringify(record.data || {})}`.toLowerCase();
    return haystack.includes(term);
  });
}

function orderRecords(records) {
  if (state.module !== 'pages') return records;
  const homeIndex = records.findIndex((record) => (record.slug || record.data?.slug) === 'home');
  if (homeIndex <= 0) return records;
  const ordered = records.slice();
  const [home] = ordered.splice(homeIndex, 1);
  ordered.unshift(home);
  return ordered;
}

function recordCard(record) {
  const data = record.data || {};
  const title = data.title || record.title || 'Untitled';
  const slug = record.slug || data.slug || '';
  const isHome = slug === 'home';
  const sub = record.collection === 'inquiries' ? `${data.reference ? `${data.reference} · ` : ''}${data.name || 'Visitor'} · ${data.email || ''}` : slug || 'No page address';
  const pill = record.status || 'draft';
  const homeBadge = isHome ? '<span class="badge-home">Home page</span>' : '';
  return `<article class="record-card"><span class="record-icon">${iconSvg(symbolFor(record.collection))}</span><div class="record-info"><h3><span>${esc(title)}</span>${homeBadge}</h3><span>${esc(sub)}</span></div><span class="status-pill ${esc(pill)}">${esc(String(pill).replace('-', ' '))}</span><button class="record-edit" data-edit="${esc(record.id)}" aria-label="Edit ${esc(title)}">Edit ${icons.arrow}</button></article>`;
}

function symbolFor(collection) {
  const found = modules.find((m) => m.key === collection);
  return found ? found.icon : 'page';
}

function iconSvg(name) {
  return icons[name] || icons.page;
}

function signOut() {
  api('/admin/logout', { method: 'POST' }).finally(() => showLogin());
}

function openEditor(record) {
  root.querySelector('.record-editor')?.remove();
  state.editing = record;
  const collection = state.module;
  const data = record?.data || {};
  const isPage = collection === 'pages';
  state.slides = isPage ? normalizeSlides(data.hero?.slides) : [];

  const wrap = document.createElement('section');
  wrap.className = 'record-editor';
  wrap.innerHTML = `<div class="editor-head"><div><span class="admin-breadcrumb">${modules.find((m) => m.key === collection).label}</span><h2>${record ? `Edit ${isPage ? 'page' : ''}` : `Create ${modules.find((m) => m.key === collection).singular}`}</h2></div><button class="editor-close" aria-label="Close">${icons.close}</button></div>
    <form class="record-form" novalidate>
      <div class="record-form-grid">${fields[collection].map((key) => fieldControl(collection, key, record)).join('')}</div>
      ${isPage ? `<div class="hero-editor"><div class="hero-editor-head"><div><h3>Home hero carousel</h3><p>Slides appear on the home page with vertical indicators and smooth transitions.</p></div><button type="button" class="button secondary add-slide">${icons.plus} Add slide</button></div><div class="slides-list"></div></div>` : ''}
      <div class="record-form-actions"><span class="record-form-error" role="alert"></span>${record ? `<button type="button" class="delete-record">Delete</button>` : ''}<button type="button" class="cancel-record">Cancel</button><button class="button primary">Save changes</button></div>
    </form>`;

  const main = root.querySelector('.admin-main');
  main.insertBefore(wrap, root.querySelector('.admin-records'));

  wrap.querySelector('.editor-close').onclick = closeEditor;
  wrap.querySelector('.cancel-record').onclick = closeEditor;
  wrap.querySelector('.delete-record')?.addEventListener('click', () => removeRecord(record));
  if (isPage) {
    const list = wrap.querySelector('.slides-list');
    paintSlides(list);
    wrap.querySelector('.add-slide').addEventListener('click', () => {
      syncSlides(list);
      state.slides.push(blankSlide());
      paintSlides(list);
    });
  }
  wrap.querySelector('form').addEventListener('submit', (event) => saveRecord(event, record, wrap));
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditor() {
  root.querySelector('.record-editor')?.remove();
  state.editing = null;
}

function fieldControl(collection, key, record) {
  const data = record?.data || {};
  const value = collection === 'inquiries' ? data[key] : data[key] ?? record?.[key] ?? '';
  const label = fieldLabels[key] || key[0].toUpperCase() + key.slice(1);
  if (key === 'status') {
    const options = collection === 'inquiries' ? ['new', 'in-progress', 'resolved', 'archived'] : ['draft', 'published'];
    const current = record?.status || data.status || (collection === 'inquiries' ? 'new' : 'draft');
    return `<label>${label}<select name="status">${options.map((o) => `<option value="${o}" ${current === o ? 'selected' : ''}>${o.replace('-', ' ')}</option>`).join('')}</select></label>`;
  }
  const isReq = required.includes(key);
  const attr = `${isReq ? 'required' : ''} ${key === 'email' ? 'type="email"' : ''}`;
  if (multiline.includes(key)) {
    return `<label class="span-2">${label}${isReq ? ' *' : ''}<textarea name="${key}" maxlength="3000" rows="${key === 'message' ? 4 : 3}" ${attr}>${esc(value)}</textarea></label>`;
  }
  const wide = ['summary', 'description', 'address'].includes(key);
  return `<label class="${wide ? 'span-2' : ''}">${label}${isReq ? ' *' : ''}<input name="${key}" value="${esc(value)}" ${attr}></label>`;
}

function normalizeSlides(slides) {
  if (!Array.isArray(slides) || !slides.length) return [blankSlide()];
  return slides.map((slide) => ({
    eyebrow: slide.eyebrow || '',
    heading: slide.heading || '',
    highlight: slide.highlight || '',
    text: slide.text || '',
    primaryLabel: slide.primary?.label || '',
    primaryHref: slide.primary?.href || '',
    secondaryLabel: slide.secondary?.label || '',
    secondaryHref: slide.secondary?.href || '',
    note: slide.note || '',
  }));
}

function blankSlide() {
  return { eyebrow: '', heading: '', highlight: '', text: '', primaryLabel: '', primaryHref: '', secondaryLabel: '', secondaryHref: '', note: '' };
}

function paintSlides(list) {
  list.innerHTML = state.slides
    .map(
      (slide, index) => `<article class="slide-card" data-index="${index}"><div class="slide-card-head"><span class="slide-card-num">0${index + 1}</span><span class="slide-card-title">${esc(slide.eyebrow || slide.heading || 'New slide')}</span><div class="slide-card-tools"><button type="button" data-move="up" ${index === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button type="button" data-move="down" ${index === state.slides.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button><button type="button" class="slide-remove" aria-label="Remove slide">Remove</button></div></div><div class="slide-card-grid">${slideFields
        .map(([field, label]) => {
          const isLong = ['text', 'note'].includes(field);
          const control = isLong
            ? `<textarea name="${field}" rows="2" maxlength="600">${esc(slide[field])}</textarea>`
            : `<input name="${field}" value="${esc(slide[field])}" maxlength="200">`;
          return `<label class="${isLong ? 'span-2' : ''}">${label}${control}</label>`;
        })
        .join('')}</div></article>`
    )
    .join('');

  list.querySelectorAll('input, textarea').forEach((input) =>
    input.addEventListener('input', () => {
      const card = input.closest('.slide-card');
      state.slides[Number(card.dataset.index)][input.name] = input.value;
      card.querySelector('.slide-card-title').textContent = state.slides[Number(card.dataset.index)].eyebrow || state.slides[Number(card.dataset.index)].heading || 'New slide';
    })
  );
  list.querySelectorAll('[data-move]').forEach((button) =>
    button.addEventListener('click', () => {
      const index = Number(button.closest('.slide-card').dataset.index);
      syncSlides(list);
      const target = button.dataset.move === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= state.slides.length) return;
      [state.slides[index], state.slides[target]] = [state.slides[target], state.slides[index]];
      paintSlides(list);
    })
  );
  list.querySelectorAll('.slide-remove').forEach((button) =>
    button.addEventListener('click', () => {
      const index = Number(button.closest('.slide-card').dataset.index);
      syncSlides(list);
      state.slides.splice(index, 1);
      if (!state.slides.length) state.slides.push(blankSlide());
      paintSlides(list);
    })
  );
}

function syncSlides(list) {
  list.querySelectorAll('.slide-card').forEach((card) => {
    const index = Number(card.dataset.index);
    card.querySelectorAll('input, textarea').forEach((input) => {
      state.slides[index][input.name] = input.value;
    });
  });
}

async function saveRecord(event, record, wrap) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorEl = wrap.querySelector('.record-form-error');
  errorEl.textContent = '';
  const payload = Object.fromEntries(new FormData(form));
  if (state.module === 'pages') {
    syncSlides(wrap.querySelector('.slides-list'));
    payload.hero = {
      slides: state.slides
        .filter((slide) => slide.heading || slide.text)
        .map((slide) => ({
          eyebrow: slide.eyebrow,
          heading: slide.heading,
          highlight: slide.highlight,
          text: slide.text,
          note: slide.note,
          primary: { label: slide.primaryLabel, href: slide.primaryHref },
          secondary: { label: slide.secondaryLabel, href: slide.secondaryHref },
        })),
    };
  }
  try {
    const path = `/admin/${state.module}${record ? `/${record.id}` : ''}`;
    await api(path, { method: record ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    store.loaded = false;
    state.cache[state.module] = await api(`/admin/${state.module}`);
    state.search = '';
    paintShell();
  } catch (error) {
    errorEl.textContent = error.message;
  }
}

async function removeRecord(record) {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  const errorEl = root.querySelector('.record-form-error');
  try {
    await api(`/admin/${state.module}/${record.id}`, { method: 'DELETE' });
    store.loaded = false;
    state.cache[state.module] = await api(`/admin/${state.module}`);
    state.search = '';
    paintShell();
  } catch (error) {
    if (errorEl) errorEl.textContent = error.message;
  }
}
