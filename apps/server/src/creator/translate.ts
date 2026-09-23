/**
 * Translation engine for the Video Translation workflow.
 *
 * - Provider mode: sends cue-by-cue context to the configured LLM and asks for JSON.
 * - Demo mode: a deterministic bilingual phrase engine (ID <-> EN) with a glossary,
 *   so subtitle drafts, SRT export and dubbing scripts work with zero API keys.
 */
import { chatJson } from '../providers/llm.js';
import type { Language, SubtitleCue } from '../types.js';
import { clamp } from '../util.js';

export interface GlossaryTerm {
  id: string;
  source: string;
  target: string;
  note?: string;
}

export const DEFAULT_GLOSSARY: GlossaryTerm[] = [
  { id: 'g1', source: 'brief', target: 'brief', note: 'Jangan diterjemahkan' },
  { id: 'g2', source: 'storyboard', target: 'storyboard' },
  { id: 'g3', source: 'voice-over', target: 'voice-over' },
  { id: 'g4', source: 'hook', target: 'hook', note: 'Istilah konten' },
  { id: 'g5', source: 'call to action', target: 'call to action' },
  { id: 'g6', source: 'feed', target: 'feed' },
  { id: 'g7', source: 'keranjang kuning', target: 'yellow cart' },
];

/** Full sentence pairs used by the demo engine for natural sounding output. */
const PHRASEBOOK: [string, string][] = [
  ['Semua dimulai dari satu momen sederhana.', 'It all starts with one simple moment.'],
  ['Semua dimulai dari satu momen sederhana, saat dunia masih diam.', 'It all starts with one simple moment, while the world is still quiet.'],
  ['Ternyata yang kecil yang paling menentukan.', 'It turns out the smallest details decide everything.'],
  ['Detail kecil inilah yang membuatnya terasa hidup.', 'These small details are what make it feel alive.'],
  ['Lalu semuanya bergerak sekaligus.', 'Then everything moves at once.'],
  ['Semua bergerak, dan tidak ada yang ingin berhenti.', 'Everything moves, and nothing wants to stop.'],
  ['Satu tarikan napas sebelum semuanya berubah.', 'One breath before everything changes.'],
  ['Kadang kita cuma butuh berhenti sebentar untuk melihat jelas.', 'Sometimes we only need to pause to see clearly.'],
  ['Dan hasilnya terasa pantas untuk didapat.', 'And the result feels earned.'],
  ['Hasil akhirnya terasa pantas untuk didapat.', 'The final result feels earned.'],
  ['Untuk kamu yang bergerak setiap hari.', 'For those who keep moving every day.'],
  ['Jangan skip dulu, ini penting.', 'Do not scroll yet — this matters.'],
  ['Stop dulu, aku baru nemu ini.', 'Hold on, I just found this.'],
  ['Masalahnya bukan kamu, tapi caranya.', 'The problem was never you — it was the method.'],
  ['Dulu aku juga capek ngulang hal yang sama tiap hari.', 'I used to dread repeating the same thing every day.'],
  ['Lihat bedanya setelah sekali pakai.', 'Look at the difference after one use.'],
  ['Satu kali pakai, bedanya langsung kelihatan.', 'One use, and the difference is obvious.'],
  ['Ribuan orang sudah pindah.', 'Thousands already switched.'],
  ['Ribuan orang sudah mencoba dan balik lagi.', 'Thousands tried it and came back.'],
  ['Ambil sekarang sebelum harganya balik.', 'Grab it before the price goes back.'],
  ['Klik keranjangnya sekarang, stoknya cepat habis.', 'Tap the cart now — it sells fast.'],
  ['Satu produk, satu masalah selesai.', 'One product, one problem solved.'],
  ['Cukup satu gerakan, selesai.', 'One motion and you are done.'],
  ['Cukup satu gerakan, semua beres.', 'One motion and everything is handled.'],
  ['Detailnya yang bikin beda.', 'The details are what make it different.'],
  ['Setiap detailnya dibuat dengan sengaja.', 'Every detail is made deliberately.'],
  ['Rating 4,9 dari pembeli nyata.', 'Rated 4.9 by real buyers.'],
  ['Ratingnya 4,9 dari pembeli nyata.', 'Rated 4.9 by real buyers.'],
  ['Gratis ongkir dan garansi 30 hari.', 'Free shipping and a 30 day guarantee.'],
  ['Gratis ongkir dan garansi tiga puluh hari.', 'Free shipping and a thirty day guarantee.'],
  ['Kita mulai dari nol.', 'We start from scratch.'],
  ['Kita mulai dari nol, tanpa naskah.', 'We start from scratch, no script.'],
  ['Ada banyak cara melihatnya.', 'There are many ways to see it.'],
  ['Ada banyak cara untuk melihat hal yang sama.', 'There are many ways to see the same thing.'],
  ['Bandingkan sendiri hasilnya.', 'Compare the result yourself.'],
  ['Coba bandingkan sendiri hasilnya.', 'Try comparing the result yourself.'],
  ['Kadang diam lebih jelas dari penjelasan.', 'Sometimes silence explains more.'],
  ['Sisanya terserah kamu.', 'The rest is up to you.'],
];

/** Multi-word patterns applied before the word level pass (longest first). */
const PHRASES: [string, string][] = [
  ['halo semuanya', 'hey everyone'],
  ['selamat datang kembali di kanal ini', 'welcome back to the channel'],
  ['selamat datang kembali', 'welcome back'],
  ['di kanal ini', 'to the channel'],
  ['ke kanal', 'to the channel'],
  ['selamat datang', 'welcome'],
  ['terima kasih', 'thank you'],
  ['hari ini', 'today'],
  ['setiap hari', 'every day'],
  ['kemarin', 'yesterday'],
  ['besok', 'tomorrow'],
  ['cara menjaga', 'how to keep'],
  ['cara membuat', 'how to make'],
  ['cara paling cepat', 'the fastest way'],
  ['cara paling mudah', 'the easiest way'],
  ['untuk kamu', 'for you'],
  ['untuk kalian', 'for you'],
  ['ini penting', 'this matters'],
  ['sangat penting', 'very important'],
  ['lebih baik', 'better'],
  ['paling sering', 'most often'],
  ['bukan sekadar', 'not just'],
  ['tidak ada', 'there is no'],
  ['kita akan', 'we will'],
  ['kita bisa', 'we can'],
  ['aku biasanya', 'I usually'],
  ['aku mulai', 'I start'],
  ['aku baru', 'I just'],
  ['kamu mau', 'you want'],
  ['kalau kamu mau', 'if you want'],
  ['jadi aku', 'so I'],
  ['padahal', 'even though'],
  ['supaya', 'so that'],
  ['dengan begitu', 'that way'],
  ['sebelum itu', 'before that'],
  ['setelah itu', 'after that'],
  ['dari awal', 'from the start'],
  ['langkah demi langkah', 'step by step'],
  ['satu per satu', 'one by one'],
  ['gratis ongkir', 'free shipping'],
  ['keranjang kuning', 'yellow cart'],
];

const WORDBOOK: Record<string, string> = {
  // function words
  dan: 'and', atau: 'or', dengan: 'with', untuk: 'for', dari: 'from', ke: 'to', di: 'in', pada: 'at', ini: 'this', itu: 'that',
  aku: 'I', saya: 'I', kamu: 'you', kita: 'we', kami: 'we', mereka: 'they', dia: 'she', anda: 'you',
  yang: 'that', adalah: 'is', akan: 'will', sudah: 'already', belum: 'not yet', masih: 'still', juga: 'also',
  tidak: 'not', bukan: 'not', bisa: 'can', harus: 'must', perlu: 'need', ingin: 'want', mau: 'want',
  karena: 'because', jadi: 'so', tapi: 'but', namun: 'however', kalau: 'if', jika: 'if', saat: 'when',
  agar: 'so that', hingga: 'until', sampai: 'until', sangat: 'very', paling: 'most', lebih: 'more', kurang: 'less',
  semua: 'everything', setiap: 'every', banyak: 'many', sedikit: 'a little', beberapa: 'several', satu: 'one', dua: 'two', tiga: 'three',
  pertama: 'first', terakhir: 'last', berikutnya: 'next', sekarang: 'now', nanti: 'later', selalu: 'always',
  kadang: 'sometimes', sering: 'often', biasanya: 'usually', lagi: 'again', sini: 'here', sana: 'there',
  // creative vocabulary
  video: 'video', produk: 'product', cerita: 'story', konten: 'content', kreator: 'creator', penonton: 'audience',
  pelanggan: 'customer', pembeli: 'buyer', merek: 'brand', brand: 'brand', iklan: 'ad', gaya: 'style', warna: 'colour',
  cahaya: 'light', tekstur: 'texture', suara: 'sound', musik: 'music', narasi: 'narration', naskah: 'script',
  alur: 'flow', rencana: 'plan', langkah: 'step', proses: 'process', hasil: 'result', versi: 'version',
  subtitle: 'subtitles', terjemahan: 'translation', bahasa: 'language', durasi: 'duration', rasio: 'aspect ratio',
  adegan: 'shot', bingkai: 'frame', kamera: 'camera', gerakan: 'movement', tempo: 'pacing', ritme: 'rhythm',
  // everyday vocabulary
  pagi: 'morning', siang: 'afternoon', sore: 'evening', malam: 'night', kota: 'city', desa: 'village', jalan: 'street',
  rumah: 'home', kantor: 'office', kopi: 'coffee', teh: 'tea', makanan: 'food', minuman: 'drink', air: 'water',
  kerja: 'work', usaha: 'business', uang: 'money', harga: 'price', diskon: 'discount', gratis: 'free',
  beli: 'buy', jual: 'sell', hemat: 'saving', untung: 'profit', pasar: 'market', toko: 'shop',
  kecil: 'small', besar: 'big', baru: 'new', lama: 'old', cepat: 'fast', lambat: 'slow', mudah: 'easy', sulit: 'hard',
  bagus: 'good', buruk: 'bad', indah: 'beautiful', cantik: 'pretty', tenang: 'calm', ramai: 'busy', bersih: 'clean',
  penting: 'important', sederhana: 'simple', jelas: 'clear', terbaik: 'best', populer: 'popular',
  hidup: 'life', cinta: 'love', mimpi: 'dream', ide: 'idea', masalah: 'problem', solusi: 'solution', cara: 'way', pindah: 'switched', orang: 'people', ribuan: 'thousands',
  menjaga: 'keep', membuat: 'make', membahas: 'discuss', membangun: 'build', menulis: 'write', memilih: 'choose',
  mencoba: 'try', melihat: 'see', menonton: 'watch', merekam: 'record', mengedit: 'edit', menghemat: 'save',
  konsisten: 'consistent', konsistensi: 'consistency', produktif: 'productive', produktivitas: 'productivity',
  menabung: 'save money', kebiasaan: 'habit', waktu: 'time', hari: 'day', minggu: 'week', bulan: 'month', tahun: 'year',
  kanal: 'channel', channel: 'channel',
  produksi: 'production', bergerak: 'move', gerak: 'move', dimulai: 'begins', mulai: 'start', momen: 'moment',
  dunia: 'world', diam: 'quiet', terasa: 'feels', pantas: 'deserved', cukup: 'enough', lihat: 'see', bedanya: 'the difference',
  setelah: 'after', sebelum: 'before', sekali: 'once', pakai: 'use', stoknya: 'stock', habis: 'runs out', ambil: 'grab',
  keranjang: 'cart', klik: 'tap', pilih: 'choose', simpan: 'save', buka: 'open', tutup: 'close', kirim: 'send',
  layak: 'worth', sesuai: 'matching', lengkap: 'complete', rapi: 'tidy', aman: 'safe', nyaman: 'comfortable',
  tumbuh: 'grow', belajar: 'learn', mengajar: 'teach', berbagi: 'share', dengar: 'listen', 
  berhenti: 'stop', lanjut: 'continue', ulang: 'repeat', ganti: 'change', tambah: 'add', hapus: 'remove',
};

function phraseLookup(text: string, target: Language): string | null {
  const normalised = text.trim();
  for (const [id, en] of PHRASEBOOK) {
    if (target === 'en' && normalised === id) return en;
    if (target === 'id' && normalised === en) return id;
  }
  return null;
}

function applyGlossary(text: string, glossary: GlossaryTerm[], target: Language): string {
  let output = text;
  for (const term of glossary) {
    if (!term.source || !term.target) continue;
    const from = target === 'en' ? term.source : term.target;
    const to = target === 'en' ? term.target : term.source;
    if (!from) continue;
    output = output.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), to);
  }
  return output;
}

/** Deterministic word-level fallback translation (keeps unknown words intact). */
export function demoTranslateText(text: string, target: Language, glossary: GlossaryTerm[] = DEFAULT_GLOSSARY): string {
  const direct = phraseLookup(text, target);
  if (direct) return applyGlossary(direct, glossary, target);

  if (!text.trim()) return '';

  const toEnglish = target === 'en';
  let preprocessed = text;
  for (const [indonesian, english] of PHRASES) {
    const pattern = toEnglish ? indonesian : english;
    const replacement = toEnglish ? english : indonesian;
    if (!pattern) continue;
    preprocessed = preprocessed.replace(
      new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
      (match) => (match[0] === match[0]?.toUpperCase() ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement),
    );
  }

  const translated = preprocessed
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token)) return token;
      const match = token.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}-]+)([^\p{L}\p{N}]*)$/u);
      if (!match) return token;
      const [, prefix = '', word = '', suffix = ''] = match;
      const lower = word.toLowerCase();
      const base = lower.replace(/(nya|lah|kah|pun)$/u, '');
      const replacement =
        target === 'en'
          ? WORDBOOK[lower] ?? (base !== lower ? WORDBOOK[base] : undefined)
          : Object.entries(WORDBOOK).find(([, value]) => value === lower || value === base)?.[0];
      if (!replacement) return `${prefix}${word}${suffix}`;
      const cased = word[0] === word[0]?.toUpperCase() && word.length > 1
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement;
      return `${prefix}${cased}${suffix}`;
    })
    .join('');

  return applyGlossary(translated, glossary, target);
}

export interface CueOptions {
  totalSeconds?: number;
  maxCharsPerCue?: number;
  language?: Language;
}

export function splitIntoCues(text: string, options: CueOptions = {}): SubtitleCue[] {
  const language = options.language ?? 'id';
  const maxChars = options.maxCharsPerCue ?? (language === 'id' ? 62 : 58);
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const rawSegments = clean
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const segments: string[] = [];
  for (const segment of rawSegments) {
    if (segment.length <= maxChars) {
      segments.push(segment);
      continue;
    }
    const words = segment.split(' ');
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars && current) {
        segments.push(`${current.trim()}${/[.!?,;]$/.test(current.trim()) ? '' : ','}`);
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }
    if (current.trim()) segments.push(current.trim());
  }

  // Characters per second heuristics keep the subtitle timing believable.
  const charsPerSecond = language === 'id' ? 14 : 15;
  const totalChars = segments.reduce((sum, segment) => sum + segment.length, 0) || 1;
  const totalSeconds = options.totalSeconds ?? Math.max(segments.length * 2.4, totalChars / charsPerSecond);

  let cursor = 0;
  return segments.map((segment, index) => {
    const duration = clamp((segment.length / totalChars) * totalSeconds, 1.2, 8);
    const start = cursor;
    cursor += duration;
    const gap = index === segments.length - 1 ? 0 : Math.min(0.35, duration * 0.12);
    return {
      index: index + 1,
      start: Number(start.toFixed(2)),
      end: Number(Math.max(start + 1.1, cursor - gap).toFixed(2)),
      text: segment,
    };
  });
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function buildSrt(cues: SubtitleCue[], options: { bilingual?: boolean } = {}): string {
  return cues
    .map((cue) => {
      const body = options.bilingual && cue.translation ? `${cue.text}\n${cue.translation}` : `${cue.translation ?? cue.text}`;
      return `${cue.index}\n${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${body}`;
    })
    .join('\n\n')
    .concat('\n');
}

export function buildMarkdownTranscript(cues: SubtitleCue[], options: { bilingual?: boolean; title?: string } = {}): string {
  const header = `# ${options.title ?? 'Transkrip'}\n\n| # | Waktu | Teks${options.bilingual ? ' | Terjemahan' : ''} |\n| --- | --- | --- |${options.bilingual ? ' --- |' : ''}\n`;
  const rows = cues
    .map((cue) => `| ${cue.index} | ${formatTimestamp(cue.start).slice(0, 8)} | ${cue.text}${options.bilingual ? ` | ${cue.translation ?? ''}` : ''} |`)
    .join('\n');
  return `${header}${rows}\n`;
}

interface LlmTranslationPayload {
  cues?: { index?: number; translation?: string }[];
}

/** Translate cues with the configured provider, falling back to the demo engine. */
export async function translateCues(
  cues: SubtitleCue[],
  source: Language,
  target: Language,
  glossary: GlossaryTerm[] = DEFAULT_GLOSSARY,
): Promise<{ cues: SubtitleCue[]; source: 'provider' | 'demo'; note?: string }> {
  if (source === target) {
    return { cues: cues.map((cue) => ({ ...cue, translation: cue.text })), source: 'demo', note: 'Bahasa sumber dan tujuan sama.' };
  }

  const system = [
    'You are a professional subtitle translator for short-form video.',
    `Translate from ${source === 'id' ? 'Indonesian' : 'English'} to ${target === 'id' ? 'Indonesian' : 'English'}.`,
    'Keep each line under 62 characters, preserve tone, keep numbers and brand names unchanged.',
    'Use these glossary terms exactly when they appear:',
    glossary.map((term) => `- ${term.source} => ${term.target}`).join('\n'),
    'Return strict JSON: {"cues":[{"index":1,"translation":"..."}]}.',
  ].join('\n');

  const user = JSON.stringify({ cues: cues.map((cue) => ({ index: cue.index, text: cue.text })) }, null, 2);
  const result = await chatJson<LlmTranslationPayload>([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);

  if (result?.data?.cues?.length) {
    const map = new Map(result.data.cues.map((item) => [Number(item.index), item.translation ?? '']));
    return {
      cues: cues.map((cue) => ({ ...cue, translation: map.get(cue.index) || demoTranslateText(cue.text, target, glossary) })),
      source: 'provider',
      note: `Diterjemahkan oleh ${result.model ?? 'model'}.`,
    };
  }

  return {
    cues: cues.map((cue) => ({ ...cue, translation: demoTranslateText(cue.text, target, glossary) })),
    source: 'demo',
    note: 'Mode demo: terjemahan dihasilkan mesin frasa lokal.',
  };
}

export function demoTranscript(sourceName: string, minutes: number, language: Language): { text: string; cues: SubtitleCue[] } {
  const paragraphs = language === 'id'
    ? [
        'Halo semuanya, selamat datang kembali di kanal ini.',
        'Hari ini kita akan membahas sesuatu yang sering bikin proses kreatif jadi lambat.',
        'Masalahnya bukan kurang ide, tapi alurnya belum rapi dari awal.',
        'Jadi aku mulai dengan menulis brief satu paragraf terlebih dahulu.',
        'Dari brief itu aku pecah jadi lima adegan, masing-masing satu ide saja.',
        'Setelah itu aku baru memilih alat dan gaya visual yang cocok.',
        'Bagian yang paling sering dilewatkan orang adalah mencatat versi.',
        'Padahal dengan mencatat versi, kita bisa membandingkan hasil dengan adil.',
        'Untuk klip pendek, aku biasanya membatasi durasi lima belas sampai tiga puluh detik.',
        'Subtitle aku aktifkan dari awal supaya ritmenya terasa sejak pembuatan.',
        'Kalau ada istilah khusus, aku masukkan ke daftar glosarium.',
        'Dengan begitu terjemahan bahasa Inggrisnya tidak berubah-ubah.',
        'Kalau kamu mau, aku bisa bahas bagian teknisnya di video berikutnya.',
        'Sampai jumpa di klip selanjutnya, dan jangan lupa istirahat.',
      ]
    : [
        'Hey everyone, welcome back to the channel.',
        'Today we are talking about something that quietly slows down the creative process.',
        'The problem is rarely a lack of ideas, it is an unorganised workflow.',
        'So I start by writing a one paragraph brief first.',
        'From that brief I split five shots, one idea per shot.',
        'Only then do I choose the tools and the visual style.',
        'The step most people skip is versioning.',
        'Versioning lets you compare results fairly instead of guessing.',
        'For short clips I keep the runtime between fifteen and thirty seconds.',
        'I turn subtitles on from the start so the rhythm feels right.',
        'If a project has special terms, they go into a glossary.',
        'That way the Indonesian translation stays consistent.',
        'If you want, I can cover the technical side in the next video.',
        'See you in the next clip, and remember to take a break.',
      ];

  const usable = paragraphs.slice(0, clamp(Math.round(minutes * 4), 6, paragraphs.length));
  const text = usable.join(' ');
  return { text, cues: splitIntoCues(text, { totalSeconds: Math.max(30, minutes * 60), language }) };
}
