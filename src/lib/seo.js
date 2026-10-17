export const launchPaths = [
  '/',
  '/services',
  '/healthcare-providers',
  '/patients',
  '/quality-compliance',
  '/about',
  '/contact',
  '/privacy-notice',
  '/terms',
  '/complaints',
  '/accessibility',
  '/cookies',
];

export function setCanonical(path) {
  const href = new URL(path || '/', location.origin).href;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

export function setStructuredData({ title, description }) {
  const id = 'gw-structured-data';
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    document.head.appendChild(script);
  }
  const origin = location.origin;
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Organization', 'LocalBusiness'],
        '@id': `${origin}/#organization`,
        name: 'GeneWorldBio',
        legalName: 'GENEWORLDBIO LTD',
        description: description || 'GeneWorldBio connects healthcare providers and patients with clear diagnostics and specimen support pathways.',
        url: `${origin}/`,
        logo: `${origin}/logo-mark.png`,
        identifier: 'RC 9795367',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'No. 7B, Azikoro Road, Ekeki',
          addressLocality: 'Yenagoa',
          addressRegion: 'Bayelsa State',
          addressCountry: 'NG',
        },
        areaServed: { '@type': 'Country', name: 'Nigeria' },
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: `${origin}/`,
        name: title || 'GeneWorldBio',
        publisher: { '@id': `${origin}/#organization` },
      },
    ],
  });
}
