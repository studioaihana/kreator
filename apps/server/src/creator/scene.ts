/**
 * Deterministic SVG "film still" generator.
 *
 * The demo pipeline renders every storyboard frame, thumbnail and cover locally,
 * so the workspace produces real image files without any external AI service.
 */
import { createRng, hashString } from '../util.js';
import type { StylePreset } from './catalog.js';
import type { Language, LocaleText } from '../types.js';

export type Composition = 'landscape' | 'city' | 'portrait' | 'product' | 'interior' | 'abstract' | 'macro';

export const COMPOSITIONS: Composition[] = ['landscape', 'city', 'portrait', 'product', 'interior', 'abstract', 'macro'];

export interface SceneSpec {
  style: StylePreset;
  composition: Composition;
  seed: string;
  aspect: string;
  caption?: string;
  kicker?: string;
  chapter?: number;
  language?: Language;
}

const SIZES: Record<string, [number, number]> = {
  '16:9': [1280, 720],
  '9:16': [720, 1280],
  '1:1': [1024, 1024],
  '4:5': [900, 1125],
  '3:2': [1200, 800],
};

export function sizeForAspect(aspect: string): [number, number] {
  return SIZES[aspect] ?? SIZES['16:9']!;
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function isLight(hex: string): boolean {
  return luminance(hex) > 0.6;
}

function bokeh(rng: () => number, width: number, height: number, colour: string, count: number): string {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const cx = rng() * width;
    const cy = rng() * height * 0.85;
    const r = 6 + rng() * 34;
    const opacity = 0.05 + rng() * 0.15;
    out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${colour}" opacity="${opacity.toFixed(3)}" filter="url(#soft)"/>`;
  }
  return out;
}

function ridgePath(rng: () => number, width: number, height: number, baseY: number, amplitude: number, segments: number): string {
  const step = width / segments;
  let d = `M -20 ${height} L -20 ${baseY}`;
  let current = baseY;
  for (let i = 0; i <= segments; i += 1) {
    const x = i * step;
    current = baseY + (rng() - 0.5) * amplitude;
    d += ` L ${x.toFixed(1)} ${current.toFixed(1)}`;
  }
  d += ` L ${width + 20} ${height} Z`;
  return d;
}

function windows(rng: () => number, x: number, y: number, w: number, h: number, colour: string): string {
  const cols = Math.max(2, Math.floor(w / 14));
  const rows = Math.max(3, Math.floor(h / 20));
  let out = '';
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (rng() > 0.45) continue;
      const wx = x + 5 + c * (w / cols);
      const wy = y + 8 + r * (h / rows);
      const opacity = 0.2 + rng() * 0.6;
      out += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${Math.max(2, w / cols - 7).toFixed(1)}" height="${Math.max(2, h / rows - 11).toFixed(1)}" fill="${colour}" opacity="${opacity.toFixed(2)}"/>`;
    }
  }
  return out;
}

function figure(x: number, groundY: number, scale: number, colour: string, opacity = 0.9): string {
  const headR = 6 * scale;
  return `
    <g opacity="${opacity}" fill="${colour}">
      <circle cx="${x}" cy="${groundY - 42 * scale}" r="${headR}"/>
      <path d="M ${x - 9 * scale} ${groundY} L ${x - 6 * scale} ${groundY - 34 * scale} Q ${x} ${groundY - 42 * scale} ${x + 6 * scale} ${groundY - 34 * scale} L ${x + 9 * scale} ${groundY} Z"/>
    </g>`;
}

export function renderSceneSvg(spec: SceneSpec): string {
  const { style, composition, seed, aspect } = spec;
  const [width, height] = sizeForAspect(aspect);
  const rng = createRng(`${seed}:${composition}:${style.id}`);
  const [bg, accent, light, deep] = style.palette as [string, string, string, string];
  const lightMode = isLight(bg);
  // `light` is the light source colour, `deep` the shadow colour. Palettes are
  // normalised here so a mis-ordered palette can never produce a washed out frame.
  const glow = luminance(light) >= 0.5 ? light : accent;
  const dark = luminance(deep) < 0.5 ? deep : '#101625';
  const horizon = height * (0.58 + rng() * 0.12);
  const captionFont = spec.language === 'en' ? 28 : 28;
  const captionSize = Math.round((captionFont * width) / 1280) + 6;

  let scene = '';
  let extraDefs = '';

  if (composition === 'landscape') {
    const sunX = width * (0.24 + rng() * 0.5);
    const sunY = horizon - height * (0.12 + rng() * 0.14);
    scene += `<circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${(height * 0.09).toFixed(0)}" fill="${glow}" opacity="0.95" filter="url(#soft)"/>`;
    scene += `<path d="${ridgePath(rng, width, height, horizon - height * 0.16, height * 0.1, 7)}" fill="${deep}" opacity="0.55"/>`;
    scene += `<path d="${ridgePath(rng, width, height, horizon - height * 0.06, height * 0.08, 9)}" fill="${deep}" opacity="0.75"/>`;
    scene += `<path d="${ridgePath(rng, width, height, horizon + height * 0.04, height * 0.06, 11)}" fill="${dark}" opacity="0.92"/>`;
    scene += `<rect x="0" y="${(horizon + height * 0.02).toFixed(0)}" width="${width}" height="${(height * 0.5).toFixed(0)}" fill="${dark}" opacity="0.75"/>`;
    for (let i = 0; i < 3; i += 1) {
      scene += figure(width * (0.2 + rng() * 0.6), height * (0.94 + rng() * 0.04), 0.5 + rng() * 0.7, dark, 0.95);
    }
  } else if (composition === 'city') {
    const moonX = width * (0.6 + rng() * 0.3);
    scene += `<circle cx="${moonX.toFixed(0)}" cy="${(height * 0.18).toFixed(0)}" r="${(height * 0.07).toFixed(0)}" fill="${glow}" opacity="0.9" filter="url(#soft)"/>`;
    let x = -20;
    while (x < width + 20) {
      const w = width * (0.06 + rng() * 0.09);
      const h = height * (0.22 + rng() * 0.4);
      const y = horizon + height * 0.18 - h;
      scene += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${dark}" opacity="0.94"/>`;
      scene += windows(rng, x, y, w, h, accent);
      scene += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="3" fill="${accent}" opacity="0.5"/>`;
      x += w + width * (0.01 + rng() * 0.02);
    }
    scene += `<rect x="0" y="${horizon.toFixed(0)}" width="${width}" height="${(height - horizon).toFixed(0)}" fill="${dark}" opacity="0.6"/>`;
    for (let i = 0; i < 28; i += 1) {
      const rx = rng() * width;
      const ry = rng() * height;
      scene += `<rect x="${rx.toFixed(0)}" y="${ry.toFixed(0)}" width="1.5" height="${(10 + rng() * 30).toFixed(0)}" fill="${light}" opacity="${(0.05 + rng() * 0.16).toFixed(2)}"/>`;
    }
    scene += `<rect x="0" y="${horizon.toFixed(0)}" width="${width}" height="${(height - horizon).toFixed(0)}" fill="url(#floor)" opacity="0.85"/>`;
  } else if (composition === 'portrait') {
    const cx = width * 0.5;
    const headR = Math.min(width * 0.19, height * 0.13);
    const headY = height * 0.34;
    const shoulderY = headY + headR * 2.35;
    scene += bokeh(rng, width, height * 0.6, accent, 12);
    scene += `<polygon points="${cx.toFixed(0)},${(headY - headR * 3).toFixed(0)} ${(cx - headR * 6).toFixed(0)},${height} ${(cx + headR * 6).toFixed(0)},${height}" fill="${glow}" opacity="0.07" filter="url(#soft)"/>`;
    // neck
    scene += `<rect x="${(cx - headR * 0.42).toFixed(0)}" y="${(headY + headR * 0.7).toFixed(0)}" width="${(headR * 0.84).toFixed(0)}" height="${(shoulderY - headY - headR * 0.4).toFixed(0)}" fill="${dark}"/>`;
    // shoulders
    scene += `<path d="M ${(cx - headR * 3.4).toFixed(0)} ${height} Q ${(cx - headR * 3.1).toFixed(0)} ${(shoulderY + headR * 0.5).toFixed(0)} ${(cx - headR * 1.15).toFixed(0)} ${shoulderY.toFixed(0)} L ${(cx + headR * 1.15).toFixed(0)} ${shoulderY.toFixed(0)} Q ${(cx + headR * 3.1).toFixed(0)} ${(shoulderY + headR * 0.5).toFixed(0)} ${(cx + headR * 3.4).toFixed(0)} ${height} Z" fill="${dark}"/>`;
    // head
    scene += `<ellipse cx="${cx.toFixed(0)}" cy="${headY.toFixed(0)}" rx="${headR.toFixed(0)}" ry="${(headR * 1.16).toFixed(0)}" fill="${dark}"/>`;
    scene += `<path d="M ${(cx - headR).toFixed(0)} ${(headY - headR * 0.25).toFixed(0)} Q ${cx.toFixed(0)} ${(headY - headR * 1.75).toFixed(0)} ${(cx + headR).toFixed(0)} ${(headY - headR * 0.25).toFixed(0)} Q ${cx.toFixed(0)} ${(headY - headR * 0.85).toFixed(0)} ${(cx - headR).toFixed(0)} ${(headY - headR * 0.25).toFixed(0)} Z" fill="${accent}" opacity="0.85"/>`;
    // rim light on one side
    scene += `<path d="M ${(cx + headR * 0.98).toFixed(0)} ${(headY - headR * 0.62).toFixed(0)} Q ${(cx + headR * 1.16).toFixed(0)} ${headY.toFixed(0)} ${(cx + headR * 0.86).toFixed(0)} ${(headY + headR * 0.92).toFixed(0)}" stroke="${accent}" stroke-width="${(headR * 0.12).toFixed(1)}" fill="none" opacity="0.9" stroke-linecap="round"/>`;
    scene += `<path d="M ${(cx + headR * 1.12).toFixed(0)} ${(shoulderY + headR * 0.1).toFixed(0)} Q ${(cx + headR * 2.9).toFixed(0)} ${(shoulderY + headR * 0.6).toFixed(0)} ${(cx + headR * 3.3).toFixed(0)} ${height.toFixed(0)}" stroke="${accent}" stroke-width="${(headR * 0.11).toFixed(1)}" fill="none" opacity="0.7"/>`;
    // collar detail
    scene += `<path d="M ${(cx - headR * 0.7).toFixed(0)} ${shoulderY.toFixed(0)} L ${cx.toFixed(0)} ${(shoulderY + headR * 0.75).toFixed(0)} L ${(cx + headR * 0.7).toFixed(0)} ${shoulderY.toFixed(0)}" fill="${glow}" opacity="0.16"/>`;
    scene += `<rect x="0" y="${(height * 0.9).toFixed(0)}" width="${width}" height="${(height * 0.1).toFixed(0)}" fill="${dark}" opacity="0.45" filter="url(#soft)"/>`;
  } else if (composition === 'product') {
    const cx = width / 2;
    const baseY = height * 0.7;
    const podW = width * 0.46;
    scene += bokeh(rng, width, height * 0.6, accent, 10);
    scene += `<polygon points="${(cx - width * 0.06).toFixed(0)},0 ${(cx + width * 0.06).toFixed(0)},0 ${(cx + podW * 0.6).toFixed(0)},${baseY.toFixed(0)} ${(cx - podW * 0.6).toFixed(0)},${baseY.toFixed(0)}" fill="${lightMode ? dark : light}" opacity="0.12"/>`;
    scene += `<ellipse cx="${cx.toFixed(0)}" cy="${baseY.toFixed(0)}" rx="${(podW * 0.55).toFixed(0)}" ry="${(height * 0.045).toFixed(0)}" fill="${dark}" opacity="0.9"/>`;
    scene += `<ellipse cx="${cx.toFixed(0)}" cy="${(baseY - height * 0.01).toFixed(0)}" rx="${(podW * 0.5).toFixed(0)}" ry="${(height * 0.032).toFixed(0)}" fill="${accent}" opacity="0.35"/>`;
    const bodyH = height * 0.26;
    const bodyW = width * 0.11;
    scene += `<rect x="${(cx - bodyW / 2).toFixed(0)}" y="${(baseY - bodyH).toFixed(0)}" width="${bodyW.toFixed(0)}" height="${bodyH.toFixed(0)}" rx="${(bodyW * 0.22).toFixed(0)}" fill="${dark}" opacity="0.96"/>`;
    scene += `<rect x="${(cx - bodyW / 2).toFixed(0)}" y="${(baseY - bodyH).toFixed(0)}" width="${(bodyW * 0.34).toFixed(0)}" height="${bodyH.toFixed(0)}" rx="${(bodyW * 0.2).toFixed(0)}" fill="${glow}" opacity="0.22"/>`;
    scene += `<rect x="${(cx - bodyW * 0.18).toFixed(0)}" y="${(baseY - bodyH - height * 0.07).toFixed(0)}" width="${(bodyW * 0.36).toFixed(0)}" height="${(height * 0.07).toFixed(0)}" rx="6" fill="${accent}" opacity="0.9"/>`;
    scene += `<ellipse cx="${cx.toFixed(0)}" cy="${(baseY + height * 0.035).toFixed(0)}" rx="${(bodyW * 0.8).toFixed(0)}" ry="${(height * 0.05).toFixed(0)}" fill="${glow}" opacity="0.08" filter="url(#soft)"/>`;
  } else if (composition === 'interior') {
    const wx = width * 0.08;
    const wy = height * 0.16;
    const ww = width * 0.36;
    const wh = height * 0.44;
    scene += `<g opacity="0.28" filter="url(#soft)">`;
    scene += `<polygon points="${wx.toFixed(0)},${wy.toFixed(0)} ${(wx + ww).toFixed(0)},${wy.toFixed(0)} ${(wx + ww * 1.9).toFixed(0)},${height.toFixed(0)} ${wx.toFixed(0)},${height.toFixed(0)}" fill="${glow}"/>`;
    scene += `</g>`;
    scene += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="${ww.toFixed(0)}" height="${wh.toFixed(0)}" fill="${glow}" opacity="0.75"/>`;
    scene += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="${ww.toFixed(0)}" height="${wh.toFixed(0)}" fill="none" stroke="${dark}" stroke-width="10" opacity="0.85"/>`;
    scene += `<line x1="${(wx + ww / 2).toFixed(0)}" y1="${wy.toFixed(0)}" x2="${(wx + ww / 2).toFixed(0)}" y2="${(wy + wh).toFixed(0)}" stroke="${dark}" stroke-width="8" opacity="0.85"/>`;
    const deskY = height * 0.74;
    scene += `<rect x="${(width * 0.06).toFixed(0)}" y="${deskY.toFixed(0)}" width="${(width * 0.88).toFixed(0)}" height="${(height * 0.05).toFixed(0)}" rx="6" fill="${dark}" opacity="0.94"/>`;
    scene += `<rect x="${(width * 0.16).toFixed(0)}" y="${(deskY - height * 0.06).toFixed(0)}" width="${(width * 0.1).toFixed(0)}" height="${(height * 0.06).toFixed(0)}" rx="4" fill="${dark}" opacity="0.9"/>`;
    scene += `<ellipse cx="${(width * 0.21).toFixed(0)}" cy="${(deskY - height * 0.06).toFixed(0)}" rx="${(width * 0.05).toFixed(0)}" ry="${(height * 0.012).toFixed(0)}" fill="${accent}" opacity="0.75"/>`;
    scene += `<path d="M ${(width * 0.62).toFixed(0)} ${deskY.toFixed(0)} q ${(width * 0.02).toFixed(0)} ${(-height * 0.14).toFixed(0)} ${(width * 0.06).toFixed(0)} 0 Z" fill="${dark}" opacity="0.9"/>`;
    scene += `<path d="M ${(width * 0.68).toFixed(0)} ${deskY.toFixed(0)} q ${(width * 0.03).toFixed(0)} ${(-height * 0.1).toFixed(0)} ${(width * 0.05).toFixed(0)} 0 Z" fill="${dark}" opacity="0.75"/>`;
  } else if (composition === 'abstract') {
    const cx = width * (0.3 + rng() * 0.4);
    const cy = height * (0.3 + rng() * 0.4);
    const base = Math.min(width, height) * 0.34;
    const ink = lightMode ? dark : light;
    for (let i = 4; i >= 0; i -= 1) {
      const r = base * (0.4 + i * 0.32);
      const colour = i % 2 === 0 ? accent : ink;
      scene += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="none" stroke="${colour}" stroke-width="${(6 + i * 2).toFixed(0)}" opacity="${(0.5 - i * 0.07).toFixed(2)}"/>`;
    }
    scene += `<path d="M 0 ${(height * 0.72).toFixed(0)} Q ${(width * 0.3).toFixed(0)} ${(height * 0.52).toFixed(0)} ${(width * 0.58).toFixed(0)} ${(height * 0.72).toFixed(0)} T ${width} ${(height * 0.66).toFixed(0)} L ${width} ${height} L 0 ${height} Z" fill="${dark}" opacity="0.92"/>`;
    scene += `<circle cx="${(width * 0.78).toFixed(0)}" cy="${(height * 0.26).toFixed(0)}" r="${(base * 0.3).toFixed(0)}" fill="${accent}" opacity="0.55" filter="url(#soft)"/>`;
  } else {
    // macro
    const cx = width * (0.3 + rng() * 0.4);
    const cy = height * (0.42 + rng() * 0.2);
    scene += `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(width * 0.36).toFixed(0)}" ry="${(height * 0.3).toFixed(0)}" fill="${deep}" opacity="0.95"/>`;
    scene += `<ellipse cx="${(cx - width * 0.06).toFixed(0)}" cy="${(cy - height * 0.06).toFixed(0)}" rx="${(width * 0.2).toFixed(0)}" ry="${(height * 0.16).toFixed(0)}" fill="${glow}" opacity="0.2" filter="url(#soft)"/>`;
    scene += `<path d="M ${(cx - width * 0.3).toFixed(0)} ${(cy + height * 0.1).toFixed(0)} q ${(width * 0.3).toFixed(0)} ${(-height * 0.12).toFixed(0)} ${(width * 0.6).toFixed(0)} ${(height * 0.02).toFixed(0)}" stroke="${accent}" stroke-width="5" fill="none" opacity="0.55"/>`;
    for (let i = 0; i < 16; i += 1) {
      const dx = cx + (rng() - 0.5) * width * 0.6;
      const dy = cy + (rng() - 0.5) * height * 0.4;
      const r = 3 + rng() * 14;
      scene += `<circle cx="${dx.toFixed(0)}" cy="${dy.toFixed(0)}" r="${r.toFixed(0)}" fill="${glow}" opacity="${(0.12 + rng() * 0.3).toFixed(2)}"/>`;
    }
  }

  const grain = Math.round(style.grain * 100);
  extraDefs += `
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${Math.round(Math.min(width, height) * 0.032)}"/></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${hashString(seed) % 900}"/><feColorMatrix type="saturate" values="0"/></filter>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lightMode ? glow : deep}"/><stop offset="55%" stop-color="${bg}"/><stop offset="100%" stop-color="${dark}"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/><stop offset="100%" stop-color="${dark}" stop-opacity="0.9"/></linearGradient>
    <radialGradient id="vig" cx="50%" cy="45%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="${lightMode ? '0.32' : '0.62'}"/></radialGradient>`;

  const caption = spec.caption
    ? `
  <g>
    <rect x="${(width * 0.06).toFixed(0)}" y="${(height * 0.86).toFixed(0)}" width="${(width * 0.88).toFixed(0)}" height="${(captionSize * 2.1).toFixed(0)}" rx="${(captionSize * 0.5).toFixed(0)}" fill="#050505" opacity="0.55"/>
    <text x="${(width * 0.5).toFixed(0)}" y="${(height * 0.86 + captionSize * 1.35).toFixed(0)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${captionSize}" font-weight="600" fill="#ffffff">${esc(spec.caption.slice(0, 68))}</text>
  </g>`
    : '';

  const kicker = spec.kicker
    ? `
  <g>
    <rect x="${(width * 0.06).toFixed(0)}" y="${(height * 0.07).toFixed(0)}" width="${(spec.kicker.length * captionSize * 0.62 + 48).toFixed(0)}" height="${(captionSize * 1.9).toFixed(0)}" rx="${(captionSize * 0.95).toFixed(0)}" fill="#0b0b0f" opacity="0.6"/>
    <text x="${(width * 0.06 + 24).toFixed(0)}" y="${(height * 0.07 + captionSize * 1.28).toFixed(0)}" font-family="Inter, system-ui, sans-serif" font-size="${(captionSize * 0.78).toFixed(0)}" font-weight="700" letter-spacing="1.5" fill="${accent}">${esc(spec.kicker.toUpperCase())}</text>
  </g>`
    : '';

  const chapter = spec.chapter
    ? `<text x="${(width * 0.94).toFixed(0)}" y="${(height * 0.09 + captionSize).toFixed(0)}" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="${(captionSize * 1.1).toFixed(0)}" font-weight="700" fill="#ffffff" opacity="0.7">${String(spec.chapter).padStart(2, '0')}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${extraDefs}</defs>
  <rect width="${width}" height="${height}" fill="url(#sky)"/>
  ${scene}
  <rect width="${width}" height="${height}" fill="url(#vig)"/>
  <rect x="0" y="${(height * 0.42).toFixed(0)}" width="${width}" height="${Math.max(2, height * 0.06).toFixed(0)}" fill="${lightMode ? dark : light}" opacity="0.05" filter="url(#soft)"/>
  <rect width="${width}" height="${height}" filter="url(#grain)" opacity="${(grain / 100).toFixed(2)}" style="mix-blend-mode:overlay"/>
  ${kicker}
  ${chapter}
  ${caption}
</svg>`;
}

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

export function localePick(text: LocaleText, language: Language): string {
  return text[language] ?? text.en;
}
