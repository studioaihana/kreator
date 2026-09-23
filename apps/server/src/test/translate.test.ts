import { describe, expect, it } from 'vitest';
import {
  buildMarkdownTranscript,
  buildSrt,
  demoTranslateText,
  formatTimestamp,
  splitIntoCues,
} from '../creator/translate.js';

describe('subtitle segmentation', () => {
  it('splits long text into readable cues with monotonic timing', () => {
    const text =
      'Halo semuanya, hari ini kita membahas sesuatu yang sering bikin proses kreatif jadi lambat. Masalahnya bukan kurang ide, tapi alurnya belum rapi dari awal.';
    const cues = splitIntoCues(text, { totalSeconds: 24, language: 'id' });
    expect(cues.length).toBeGreaterThan(1);
    for (const cue of cues) {
      expect(cue.text.length).toBeLessThanOrEqual(70);
      expect(cue.end).toBeGreaterThan(cue.start);
    }
    const first = cues[0]!;
    const last = cues.at(-1)!;
    expect(first.start).toBe(0);
    expect(last.end).toBeLessThanOrEqual(26);
    for (let index = 1; index < cues.length; index += 1) {
      expect(cues[index]!.start).toBeGreaterThanOrEqual(cues[index - 1]!.start);
    }
  });

  it('returns an empty list for empty input', () => {
    expect(splitIntoCues('   ')).toEqual([]);
  });
});

describe('srt export', () => {
  it('formats timestamps and bilingual bodies', () => {
    expect(formatTimestamp(62.4)).toBe('00:01:02,400');
    const srt = buildSrt(
      [
        { index: 1, start: 0, end: 2.5, text: 'Halo semuanya.', translation: 'Hey everyone.' },
        { index: 2, start: 2.5, end: 5, text: 'Selamat datang.', translation: 'Welcome back.' },
      ],
      { bilingual: true },
    );
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500\nHalo semuanya.\nHey everyone.');
    expect(srt).toContain('2\n00:00:02,500 --> 00:00:05,000');
    expect(srt.endsWith('\n')).toBe(true);
  });

  it('exports a markdown transcript table', () => {
    const markdown = buildMarkdownTranscript(
      [{ index: 1, start: 0, end: 2, text: 'Halo.', translation: 'Hello.' }],
      { bilingual: true, title: 'Transkrip uji' },
    );
    expect(markdown).toContain('| # | Waktu | Teks | Terjemahan |');
    expect(markdown).toContain('| 1 | 00:00:00 | Halo. | Hello. |');
  });
});

describe('demo translation engine', () => {
  it('translates known phrases into natural English', () => {
    expect(demoTranslateText('Semua dimulai dari satu momen sederhana.', 'en')).toBe('It all starts with one simple moment.');
    expect(demoTranslateText('Klik keranjangnya sekarang, stoknya cepat habis.', 'en')).toBe('Tap the cart now — it sells fast.');
  });

  it('translates back into Indonesian', () => {
    expect(demoTranslateText('Hey everyone, welcome back to the channel.', 'id')).toBe('Halo semuanya, selamat datang kembali di kanal ini.');
  });

  it('keeps glossary terms untouched', () => {
    const output = demoTranslateText('Buat brief dan storyboard dulu.', 'en', [{ id: 'g1', source: 'brief', target: 'brief' }]);
    expect(output).toContain('brief');
    expect(output).toContain('storyboard');
  });

  it('leaves empty input empty', () => {
    expect(demoTranslateText('', 'en')).toBe('');
  });
});
