import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
}

function currentRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '');
  const raw = hash.length > 0 ? hash : '/';
  const [path = '/', search = ''] = raw.split('?');
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(search) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export function navigate(path: string): void {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.hash.replace(/^#/, '') === target) return;
  window.location.hash = target;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
