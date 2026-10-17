import { button } from '../components/layout.js';

export const title = 'Page not found';

export async function render() {
  return `<main class="interior-page"><section class="interior-hero not-found"><div class="container"><span class="eyebrow"><i></i>Error 404</span><h1>We couldn’t find<em> that page.</em></h1><p>The link may be out of date or the page may have moved. Let’s get you back on track.</p><div class="hero-actions">${button('Return home', '/')}${button('Contact us', '/contact', 'secondary')}</div></div><div class="interior-orbit"></div></section></main>`;
}

export function mount() {}
