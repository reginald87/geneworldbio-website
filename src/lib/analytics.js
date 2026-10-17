const endpoint = import.meta.env?.VITE_ANALYTICS_ENDPOINT || '';

let ready = false;

function privacyBlocked() {
  try {
    return (
      navigator.doNotTrack === '1' ||
      window.doNotTrack === '1' ||
      navigator.globalPrivacyControl === true
    );
  } catch {
    return true;
  }
}

export function initAnalytics() {
  if (ready) return ready;
  ready = !privacyBlocked();
  if (ready) window.dataLayer = window.dataLayer || [];
  return ready;
}

export function track(event, props = {}) {
  if (!ready) return;
  const payload = { event, ...props };
  try {
    (window.dataLayer = window.dataLayer || []).push(payload);
  } catch {
    /* no-op */
  }
  try {
    window.dispatchEvent(new CustomEvent('gw:analytics', { detail: payload }));
  } catch {
    /* no-op */
  }
  if (endpoint && typeof navigator.sendBeacon === 'function') {
    try {
      navigator.sendBeacon(endpoint, JSON.stringify(payload));
    } catch {
      /* no-op */
    }
  }
}

export function trackPageView(path, pageTitle) {
  track('page_view', { path, title: pageTitle });
}
