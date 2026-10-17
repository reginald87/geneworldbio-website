function compile(path) {
  const keys = [];
  const pattern = path
    .replace(/\/+$/, '')
    .replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
  return { regex: new RegExp(`^${pattern || '/'}/?$`), keys };
}

function isPlainLeftClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function createRouter(routes, { notFound, onNavigate } = {}) {
  const table = routes.map((route) => ({ ...route, ...compile(route.path) }));
  let current = null;

  function resolve(pathname) {
    for (const route of table) {
      const match = route.regex.exec(pathname);
      if (!match) continue;
      const params = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1]);
      });
      return { route, params };
    }
    return null;
  }

  function updateLinks() {
    document.querySelectorAll('a[data-link]').forEach((link) => {
      const target = new URL(link.href, location.origin);
      if (target.pathname === current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  async function render(pathname, state) {
    const matched = resolve(pathname);
    current = pathname;
    if (onNavigate) onNavigate(pathname);
    if (matched) {
      document.body.className = matched.route.bodyClass ? matched.route.bodyClass : '';
      await matched.route.handler({ ...matched.params, __raw: pathname });
    } else if (notFound) {
      document.body.className = '';
      await notFound({ __raw: pathname });
    }
    updateLinks();
    if (!state || !state.keepScroll) window.scrollTo(0, 0);
  }

  function navigate(path, { replace = false, keepScroll = false } = {}) {
    const url = new URL(path, location.origin);
    const target = url.pathname + url.search;
    if (target === location.pathname + location.search) {
      render(url.pathname, { keepScroll });
      return;
    }
    if (replace) history.replaceState({ keepScroll }, '', target);
    else history.pushState({ keepScroll }, '', target);
    render(url.pathname, { keepScroll });
  }

  function start() {
    document.addEventListener('click', (event) => {
      if (!isPlainLeftClick(event)) return;
      const link = event.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.hasAttribute('download') || link.target === '_blank') return;
      const url = new URL(link.href, location.origin);
      if (url.origin !== location.origin) return;
      event.preventDefault();
      navigate(url.pathname + url.search);
    });

    window.addEventListener('popstate', (event) => {
      render(location.pathname, { keepScroll: event.state && event.state.keepScroll });
    });

    render(location.pathname, { keepScroll: true });
  }

  return { start, navigate, resolve, get current() { return current; } };
}
