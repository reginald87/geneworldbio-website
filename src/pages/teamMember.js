import { button } from '../components/layout.js';
import { memberAvatar, memberName, teamMember } from '../components/team.js';
import { esc, setDocumentTitle } from '../lib/dom.js';

export const title = 'Team member';

function profileNotFound() {
  return `<main class="interior-page">
    <section class="interior-hero team-profile-hero"><div class="container"><a class="team-back-link" href="/about" data-link>&larr; Back to about</a><span class="eyebrow"><i></i>GeneWorldBio</span><h1>Profile not found.</h1></div><div class="interior-orbit"></div></section>
    <section class="section interior-content"><div class="container"><div class="empty-state"><span>?</span><h2>This profile is unavailable</h2><p>The person you are looking for may have moved or the link may be out of date.</p>${button('Back to about', '/about')}</div></div></section>
  </main>`;
}

export async function render(_slug, ctx) {
  const person = teamMember(ctx?.slug || _slug);
  if (!person) return profileNotFound();

  const data = person.data || {};
  const name = esc(memberName(person));
  const role = esc(data.role || '');
  const credentials = data.credentials ? esc(data.credentials) : '';
  const bio = data.bio ? esc(data.bio) : '';
  const photo = data.photo ? esc(data.photo) : '';
  const focus = Array.isArray(data.focus)
    ? data.focus.filter(Boolean)
    : data.focus
      ? String(data.focus).split(',').map((item) => item.trim()).filter(Boolean)
      : [];

  const facts = [
    focus.length ? `<div><dt>Focus areas</dt><dd>${focus.map((item) => esc(item)).join(' &middot; ')}</dd></div>` : '',
    data.education ? `<div><dt>Education</dt><dd>${esc(data.education)}</dd></div>` : '',
    data.location ? `<div><dt>Based in</dt><dd>${esc(data.location)}</dd></div>` : '',
  ].filter(Boolean).join('');

  return `<main class="interior-page">
    <section class="interior-hero team-profile-hero${photo ? ' has-photo' : ''}"${photo ? ` style="--team-photo:url('${photo}')"` : ''}>${photo ? '<div class="team-hero-banner" aria-hidden="true"></div>' : ''}<div class="container"><a class="team-back-link" href="/about" data-link>&larr; Back to about</a><span class="eyebrow"><i></i>${role || 'Our team'}</span><h1>${name}</h1>${credentials ? `<span class="team-profile-credentials">${credentials}</span>` : ''}</div><div class="interior-orbit"></div></section>
    <section class="section interior-content"><div class="container"><div class="team-profile">
      <div class="team-profile-media">${memberAvatar(person, 320)}</div>
      <div class="team-profile-body">
        ${role ? `<span class="team-role">${role}</span>` : ''}
        ${bio ? `<p class="team-profile-bio">${bio}</p>` : ''}
        ${facts ? `<dl class="team-facts">${facts}</dl>` : ''}
        <div class="team-profile-actions">${data.linkedin ? `<a class="button secondary" href="${esc(data.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn profile</a>` : ''}${button('Contact the team', '/contact')}</div>
      </div>
    </div><div class="section-end"><a class="text-link" href="/about" data-link>&larr; Back to all team members</a></div></div></section>
  </main>`;
}

export function mount(app, _slug, ctx) {
  const person = teamMember(ctx?.slug || '');
  if (person) setDocumentTitle(memberName(person));
}
