import { esc } from '../lib/dom.js';
import { icons } from '../lib/icons.js';
import { store } from '../lib/store.js';

export function sortedTeam() {
  return (store.team || []).slice().sort((a, b) => {
    const order = (Number(a.data?.order) || 0) - (Number(b.data?.order) || 0);
    return order || String(a.title || '').localeCompare(String(b.title || ''));
  });
}

export function teamMember(slug) {
  if (!slug) return null;
  return sortedTeam().find((person) => person.slug === slug) || null;
}

export function memberName(person) {
  return person?.title || person?.data?.title || 'Team member';
}

export function memberAvatar(person, size = 240) {
  const name = memberName(person);
  const photo = person?.data?.photo;
  if (photo) {
    return `<img src="${esc(photo)}" alt="${esc(name)}" loading="lazy" width="${size}" height="${size}">`;
  }
  const initials = name.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, '').slice(0, 2).toUpperCase();
  return `<span class="team-avatar team-avatar-lg" aria-hidden="true">${esc(initials)}</span>`;
}

export function teamCards() {
  const people = sortedTeam();
  if (!people.length) {
    return `<div class="empty-state"><span>?</span><h2>Team profiles coming soon</h2><p>We are preparing profiles for the people behind GeneWorldBio. In the meantime, our operating model is described above.</p></div>`;
  }
  return `<div class="team-grid">${people
    .map((person) => {
      const data = person.data || {};
      const name = esc(memberName(person));
      const role = esc(data.role || '');
      const credentials = esc(data.credentials || '');
      const bio = esc(data.bio || '');
      return `<a class="team-card team-card-link" href="/about/team/${esc(person.slug)}" data-link><div class="team-card-media">${memberAvatar(person, 180)}</div><div class="team-card-body"><h3>${name}${credentials ? ` <small>${credentials}</small>` : ''}</h3>${role ? `<span class="team-role">${role}</span>` : ''}${bio ? `<p>${bio}</p>` : ''}<span class="team-card-cta">View profile ${icons.arrow}</span></div></a>`;
    })
    .join('')}</div>`;
}
