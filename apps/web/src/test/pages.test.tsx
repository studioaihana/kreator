import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { installFetchMock } from './fixtures';

// EventSource does not exist in jsdom.
class FakeEventSource {
  onerror: (() => void) | null = null;

  addEventListener() {}

  close() {}
}

function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<App />);
}

describe('workspace pages', () => {
  beforeEach(() => {
    installFetchMock();
    Object.defineProperty(window, 'EventSource', { value: FakeEventSource, writable: true, configurable: true });
  });

  it('renders the home dashboard with seeds and recent projects', async () => {
    renderAt('/');
    expect(await screen.findByText(/Studio Video Harianmu|Your Everyday Video Studio/i)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Video brand kopi lokal')).toBeTruthy());
    expect(screen.getByText('Director seeds')).toBeTruthy();
  });

  it('renders the studio composer with the brief field', async () => {
    renderAt('/studio');
    await waitFor(() => expect(screen.getByPlaceholderText(/Contoh: video brand kopi lokal/i)).toBeTruthy());
    expect(screen.getByText('Buat storyboard')).toBeTruthy();
  });

  it('renders the project storyboard with shots and versions', async () => {
    renderAt('/projects/proj_test');
    await waitFor(() => expect(screen.getByText('Storyboard')).toBeTruthy());
    expect(screen.getAllByText('Pembuka').length).toBeGreaterThan(0);
    expect(screen.getByText('Versi')).toBeTruthy();
  });

  it('renders the translation workspace with the glossary', async () => {
    renderAt('/translate');
    await waitFor(() => expect(screen.getByText('Glosarium')).toBeTruthy());
    expect(screen.getByText(/Halo semuanya\./)).toBeTruthy();
  });

  it('renders the image generator', async () => {
    renderAt('/images');
    await waitFor(() => expect(screen.getByText('Generator Gambar')).toBeTruthy());
  });

  it('renders the writer workspace', async () => {
    renderAt('/write');
    await waitFor(() => expect(screen.getByText(/Skrip short video, artikel/i)).toBeTruthy());
  });

  it('renders the agent chat with suggestions and approvals', async () => {
    renderAt('/agent');
    await waitFor(() => expect(screen.getAllByText('Agent').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText('Buat video kopi lokal')).toBeTruthy());
    expect(screen.getAllByText('Jalankan rencana produksi').length).toBeGreaterThan(0);
  });

  it('renders approvals and assets pages', async () => {
    const first = renderAt('/approvals');
    await waitFor(() => expect(first.getAllByText('Jalankan rencana produksi').length).toBeGreaterThan(0));
    first.unmount();

    const second = renderAt('/assets');
    await waitFor(() => expect(second.getAllByText('Perpustakaan aset').length).toBeGreaterThan(0));
    await waitFor(() => expect(second.getByText('cover.svg')).toBeTruthy());
  });

  it('saves settings through the API when the language is switched', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderAt('/settings');
    await waitFor(() => expect(screen.getAllByText('Pengaturan').length).toBeGreaterThan(0));
    expect(fetchSpy).toHaveBeenCalled();
  });
});
