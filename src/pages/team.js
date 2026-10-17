import { button } from '../components/layout.js';
import { interiorHero } from '../components/sections.js';
import { store } from '../lib/store.js';
import { esc } from '../lib/dom.js';

export const title = 'Our team';

export async function render() {
  const people = (store.team || []).slice().sort((a, b) => {
    const order = (a.data?.order ?? 0) - (b.data?.order ?? 0);
    return order || String(a.title || '').localeCompare(String(b.title || ''));
  });

  const cards = people.length
    ? people
        .map((person) => {
          const data = person.data || {};
          const name = esc(person.title || data.title || 'Team member');
          const role = esc(data.role || '');
          const credentials = esc(data.credentials || '');
          const bio = esc(data.bio || '');
          const photo = data.photo ? `<img src="${esc(data.photo)}" alt="${name}" loading="lazy" width="240" height="240">` : `<span class="team-avatar" aria-hidden="true">${esc((person.title || data.title || 'TM').slice(0, 2).toUpperCase())}</span>`;
          return `<article class="team-card">${photo}<div class="team-card-body"><h3>${name}${credentials ? ` <small>${credentials}</small>` : ''}</h3>${role ? `<span class="team-role">${role}</span>` : ''}${bio ? `<p>${bio}</p>` : ''}${data.linkedin ? `<a class="team-link" href="${esc(data.linkedin)}" rel="noopener noreferrer" target="_blank">LinkedIn profile</a>` : ''}</div></article>`;
        })
        .join('')
    : `<div class="empty-state"><span>✳</span><h2>Team profiles coming soon</h2><p>We are preparing profiles for the people behind GeneWorldBio. In the meantime, our operating model is described on the <a href="/about" data-link>about page</a>.</p></div>`;

  return `<main class="interior-page">
    ${interiorHero({ label: 'GeneWorldBio', title: 'The people behind the work.', summary: 'A growing team of scientists, clinicians and operators building better diagnostic access in Nigeria.' })}
    <section class="section interior-content"><div class="container"><div class="team-grid">${cards}</div><div class="section-end">${button('Work with us', '/contact')}</div></div></section>
  </main>`;
}

export function mount() {}
