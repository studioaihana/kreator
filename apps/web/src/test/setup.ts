import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom misses a few browser APIs the workspace relies on.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!window.scrollTo) {
  window.scrollTo = (() => undefined) as unknown as typeof window.scrollTo;
}

if (!window.HTMLElement.prototype.scrollTo) {
  window.HTMLElement.prototype.scrollTo = () => undefined;
}

if (!window.speechSynthesis) {
  Object.defineProperty(window, 'speechSynthesis', {
    value: { speak: vi.fn(), cancel: vi.fn() },
    writable: true,
  });
}

afterEach(() => {
  cleanup();
  window.location.hash = '';
});
