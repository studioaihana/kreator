import { describe, expect, it } from 'vitest';
import { generateStoryboard, cleanTopic, demoScript, demoArticle, demoSocialPost } from '../creator/demo.js';
import { renderSceneSvg, sizeForAspect } from '../creator/scene.js';
import { STYLES, HOOKS, TEMPLATES } from '../creator/catalog.js';

describe('brief handling', () => {
  it('trims command words but keeps the interesting part of the brief', () => {
    expect(cleanTopic('Buat video 30 detik tentang kopi lokal untuk feed vertikal')).toBe(
      'video 30 detik tentang kopi lokal untuk feed vertikal',
    );
    expect(cleanTopic('buatkan')).toBe('buatkan');
    expect(cleanTopic('   ')).toBe('cerita baru');
  });
});

describe('storyboard generation', () => {
  it('is deterministic for the same input', () => {
    const input = {
      prompt: 'perjalanan pagi dari ladang kopi sampai cangkir pertama',
      mode: 'cinematic' as const,
      styleId: 'cinematic-golden',
      aspect: '16:9',
      durationSeconds: 30,
      language: 'id' as const,
    };
    const first = generateStoryboard(input);
    const second = generateStoryboard(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('produces between three and six shots with a matching runtime', () => {
    const result = generateStoryboard({
      prompt: 'iklan skincare premium',
      mode: 'commercial',
      styleId: 'studio-clean',
      aspect: '9:16',
      durationSeconds: 24,
      language: 'id',
    });
    expect(result.shots.length).toBeGreaterThanOrEqual(3);
    expect(result.shots.length).toBeLessThanOrEqual(6);
    const total = result.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
    expect(total).toBeGreaterThanOrEqual(18);
    expect(total).toBeLessThanOrEqual(30);
    for (const shot of result.shots) {
      expect(shot.imagePrompt.length).toBeGreaterThan(10);
      expect(shot.caption.id.length).toBeGreaterThan(0);
      expect(shot.caption.en.length).toBeGreaterThan(0);
    }
  });

  it('adapts the arc per mode', () => {
    const social = generateStoryboard({ prompt: 'review produk', mode: 'social', styleId: 'retro-print', aspect: '9:16', durationSeconds: 15, language: 'id' });
    const freeform = generateStoryboard({ prompt: 'eksperimen visual', mode: 'freeform', styleId: 'noir-mono', aspect: '1:1', durationSeconds: 15, language: 'id' });
    expect(social.shots[0]!.beatId).toBe('hook');
    expect(freeform.shots[0]!.beatId).toBe('opening');
  });
});

describe('writer output', () => {
  it('writes a script with beats and image prompts', () => {
    const script = demoScript({ topic: 'kopi lokal', durationSeconds: 30, language: 'id', style: STYLES[0]!, mode: 'cinematic' });
    expect(script.startsWith('# Skrip Short Video')).toBe(true);
    expect(script).toContain('Prompt gambar');
    expect(script.split('## ').length).toBeGreaterThan(3);
  });

  it('writes articles and social posts in both languages', () => {
    expect(demoArticle({ topic: 'alur kerja kreatif', language: 'id' })).toContain('## Kesimpulan');
    expect(demoArticle({ topic: 'creative workflow', language: 'en' })).toContain('## Takeaway');
    expect(demoSocialPost({ topic: 'menabung', language: 'id' })).toContain('**Hook:**');
    expect(demoSocialPost({ topic: 'saving', language: 'en' })).toContain('#creator');
  });
});

describe('scene renderer', () => {
  it('renders deterministic svg frames with the requested aspect', () => {
    const [width, height] = sizeForAspect('9:16');
    expect([width, height]).toEqual([720, 1280]);
    const svg = renderSceneSvg({ style: STYLES[1]!, composition: 'city', seed: 'abc', aspect: '9:16', caption: 'Halo' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain('Halo');
    expect(renderSceneSvg({ style: STYLES[1]!, composition: 'city', seed: 'abc', aspect: '9:16', caption: 'Halo' })).toBe(svg);
  });

  it('escapes caption text', () => {
    const svg = renderSceneSvg({ style: STYLES[0]!, composition: 'landscape', seed: 'x', aspect: '16:9', caption: '<script>alert(1)</script>' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});

describe('catalog integrity', () => {
  it('links every hook and template to a real style', () => {
    const ids = new Set(STYLES.map((style) => style.id));
    for (const hook of HOOKS) expect(ids.has(hook.styleId)).toBe(true);
    for (const template of TEMPLATES) expect(ids.has(template.styleId)).toBe(true);
  });

  it('has bilingual copy everywhere', () => {
    for (const hook of [...HOOKS, ...TEMPLATES]) {
      expect(hook.title.id.length).toBeGreaterThan(0);
      expect(hook.title.en.length).toBeGreaterThan(0);
      expect(hook.description.id.length).toBeGreaterThan(0);
      expect(hook.description.en.length).toBeGreaterThan(0);
    }
  });
});
