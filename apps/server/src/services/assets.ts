import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ASSETS_DIR, store } from '../store.js';
import { newId, nowIso, slugify } from '../util.js';
import type { Asset, AssetKind } from '../types.js';

export interface SaveAssetInput {
  name: string;
  mimeType: string;
  buffer: Buffer;
  kind: AssetKind;
  origin: Asset['origin'];
  meta?: Asset['meta'];
}

export async function saveAsset(input: SaveAssetInput): Promise<Asset> {
  const id = newId('asset');
  const extension = path.extname(input.name) || mimeToExtension(input.mimeType);
  const storedName = `${id}-${slugify(path.basename(input.name, extension))}${extension}`;
  const filePath = path.join(ASSETS_DIR, storedName);
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  await fs.writeFile(filePath, input.buffer);
  const asset: Asset = {
    id,
    kind: input.kind,
    name: input.name,
    mimeType: input.mimeType,
    path: filePath,
    sizeBytes: input.buffer.byteLength,
    createdAt: nowIso(),
    meta: input.meta,
    origin: input.origin,
  };
  await store.update((db) => {
    db.assets.unshift(asset);
    return asset;
  });
  return asset;
}

export async function saveTextAsset(
  name: string,
  content: string,
  kind: AssetKind,
  origin: Asset['origin'] = 'render',
  meta?: Asset['meta'],
): Promise<Asset> {
  return saveAsset({
    name,
    mimeType: mimeToMime(kind, name),
    buffer: Buffer.from(content, 'utf8'),
    kind,
    origin,
    meta,
  });
}

export function assetById(id: string): Asset | undefined {
  return store.data().assets.find((asset) => asset.id === id);
}

export function findAssetByFileName(name: string): Asset | undefined {
  return store.data().assets.find((asset) => asset.name === name);
}

function mimeToExtension(mimeType: string): string {
  if (mimeType.includes('svg')) return '.svg';
  if (mimeType.includes('png')) return '.png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
  if (mimeType.includes('webp')) return '.webp';
  if (mimeType.includes('mp4')) return '.mp4';
  if (mimeType.includes('webm')) return '.webm';
  if (mimeType.includes('mpeg')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('plain')) return '.txt';
  return '.bin';
}

function mimeToMime(kind: AssetKind, name: string): string {
  if (name.endsWith('.srt') || kind === 'subtitle') return 'application/x-subrip';
  if (name.endsWith('.md') || kind === 'document') return 'text/markdown';
  if (name.endsWith('.json')) return 'application/json';
  return 'text/plain';
}
