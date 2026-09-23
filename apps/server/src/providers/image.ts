import { store } from '../store.js';
import { createRng, pick } from '../util.js';
import type { StylePreset } from '../creator/catalog.js';
import { COMPOSITIONS, renderSceneSvg, type Composition } from '../creator/scene.js';
import type { Language } from '../types.js';

export interface ImageRequest {
  prompt: string;
  aspect: string;
  style: StylePreset;
  seed: string;
  count?: number;
  language?: Language;
  composition?: Composition;
  caption?: string;
  kicker?: string;
  chapter?: number;
}

export interface GeneratedImage {
  name: string;
  mimeType: string;
  buffer: Buffer;
  provider: 'demo' | 'openai';
  composition?: Composition;
}

const ASPECT_SIZES: Record<string, string> = {
  '16:9': '1536x1024',
  '9:16': '1024x1536',
  '1:1': '1024x1024',
  '4:5': '1024x1280',
};

export function demoImage(request: ImageRequest, index = 0): GeneratedImage {
  const rng = createRng(`${request.seed}:image:${index}`);
  const composition = request.composition ?? pick(rng, COMPOSITIONS);
  const svg = renderSceneSvg({
    style: request.style,
    composition,
    seed: `${request.seed}:${index}`,
    aspect: request.aspect,
    caption: request.caption,
    kicker: request.kicker,
    chapter: request.chapter,
    language: request.language,
  });
  return {
    name: `${request.seed}-${index + 1}.svg`,
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(svg, 'utf8'),
    provider: 'demo',
    composition,
  };
}

async function openaiImage(request: ImageRequest, index: number): Promise<GeneratedImage> {
  const settings = store.settings().providers.openai;
  if (!settings.apiKey) throw new Error('OpenAI API key belum diisi / OpenAI API key is not set.');
  const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model: settings.imageModel,
      prompt: `${request.prompt}. Style: ${request.style.prompt}.`,
      size: ASPECT_SIZES[request.aspect] ?? '1024x1024',
      n: 1,
    }),
  });
  if (!response.ok) {
    throw new Error(`Image provider failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  const payload = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
  const entry = payload.data?.[0];
  let buffer: Buffer;
  if (entry?.b64_json) {
    buffer = Buffer.from(entry.b64_json, 'base64');
  } else if (entry?.url) {
    const fileResponse = await fetch(entry.url);
    buffer = Buffer.from(await fileResponse.arrayBuffer());
  } else {
    throw new Error('Image provider returned no image data.');
  }
  return { name: `${request.seed}-${index + 1}.png`, mimeType: 'image/png', buffer, provider: 'openai' };
}

/**
 * Generates the requested number of images. In demo mode every image is rendered
 * locally as a deterministic SVG still, so the workspace works offline.
 */
export async function generateImages(request: ImageRequest): Promise<{ images: GeneratedImage[]; provider: 'demo' | 'openai'; note: string }> {
  const count = Math.max(1, Math.min(4, request.count ?? 1));
  const provider = store.settings().providers.image;

  if (provider === 'openai') {
    try {
      const images: GeneratedImage[] = [];
      for (let index = 0; index < count; index += 1) {
        images.push(await openaiImage({ ...request, seed: `${request.seed}-${index}` }, index));
      }
      return { images, provider: 'openai', note: `Dibuat oleh ${store.settings().providers.openai.imageModel}.` };
    } catch (error) {
      const fallback = Array.from({ length: count }, (_, index) => demoImage(request, index));
      return {
        images: fallback,
        provider: 'demo',
        note: `Provider gambar gagal (${error instanceof Error ? error.message : 'unknown'}), memakai render lokal.`,
      };
    }
  }

  return {
    images: Array.from({ length: count }, (_, index) => demoImage(request, index)),
    provider: 'demo',
    note: 'Mode demo: gambar dirender lokal secara deterministik.',
  };
}
