/**
 * Deterministic demo engine.
 *
 * When no external model is configured (or a provider call fails), the workspace
 * still produces a complete, coherent and reproducible creative package:
 * storyboard, scripts, captions, image prompts and narration lines.
 */
import { clamp, createRng, pick, truncate } from '../util.js';
import type { Language, LocaleText, StudioMode, Shot } from '../types.js';
import { PROPS, ROLES, type StylePreset, styleById } from './catalog.js';
import { COMPOSITIONS, type Composition } from './scene.js';

interface Beat {
  id: string;
  title: LocaleText;
  shot: LocaleText;
  caption: LocaleText;
  narration: LocaleText;
  imagePrompt: string;
  compositions: Composition[];
}

const CINEMATIC_BEATS: Beat[] = [
  {
    id: 'establish',
    title: { id: 'Pembuka', en: 'Establishing' },
    shot: {
      id: 'Wide shot membuka adegan tentang {topic}. Kamera mendorong masuk perlahan saat cahaya pagi menyapu latar.',
      en: 'A wide opening shot of {topic}. The camera pushes in slowly as morning light sweeps across the frame.',
    },
    caption: { id: 'Semua dimulai dari satu momen sederhana.', en: 'It all starts with one simple moment.' },
    narration: { id: 'Semua dimulai dari satu momen sederhana, saat dunia masih diam.', en: 'It all starts with one simple moment, while the world is still quiet.' },
    imagePrompt: 'wide establishing shot of {topic}, {style}, atmospheric haze, cinematic composition',
    compositions: ['landscape', 'city'],
  },
  {
    id: 'texture',
    title: { id: 'Detail Tekstur', en: 'Texture Detail' },
    shot: {
      id: 'Close-up makro pada {prop}. Tekstur kecil terasa taktil dan penting.',
      en: 'Macro close-up on {prop}. Small textures feel tactile and deliberate.',
    },
    caption: { id: 'Ternyata yang kecil yang paling menentukan.', en: 'It turns out the smallest details decide everything.' },
    narration: { id: 'Detail kecil inilah yang membuatnya terasa hidup.', en: 'These small details are what make it feel alive.' },
    imagePrompt: 'extreme macro insert of {prop}, {style}, shallow depth of field, texture detail',
    compositions: ['macro', 'product'],
  },
  {
    id: 'action',
    title: { id: 'Aksi Utama', en: 'Main Action' },
    shot: {
      id: 'Aksi utama: {topic} bergerak cepat, kamera mengikuti dengan handheld halus.',
      en: 'The main action: {topic} moves fast while the camera tracks with a gentle handheld feel.',
    },
    caption: { id: 'Lalu semuanya bergerak sekaligus.', en: 'Then everything moves at once.' },
    narration: { id: 'Semua bergerak, dan tidak ada yang ingin berhenti.', en: 'Everything moves, and nothing wants to stop.' },
    imagePrompt: 'dynamic tracking shot of {topic}, {style}, motion blur, energy',
    compositions: ['city', 'portrait'],
  },
  {
    id: 'turn',
    title: { id: 'Titik Balik', en: 'The Turn' },
    shot: {
      id: 'Titik balik: tempo melambat, satu momen hening sebelum perubahan besar.',
      en: 'The turn: pacing slows into a single quiet beat before the big change.',
    },
    caption: { id: 'Satu tarikan napas sebelum semuanya berubah.', en: 'One breath before everything changes.' },
    narration: { id: 'Kadang kita cuma butuh berhenti sebentar untuk melihat jelas.', en: 'Sometimes we only need to pause to see clearly.' },
    imagePrompt: 'quiet contemplative shot of {topic}, {style}, soft single light source',
    compositions: ['portrait', 'interior'],
  },
  {
    id: 'resolve',
    title: { id: 'Resolusi', en: 'Resolution' },
    shot: {
      id: 'Resolusi: kamera mundur memperlihatkan hasil akhir {topic} secara utuh.',
      en: 'Resolution: the camera pulls back to reveal the finished result of {topic}.',
    },
    caption: { id: 'Dan hasilnya terasa pantas untuk didapat.', en: 'And the result feels earned.' },
    narration: { id: 'Hasil akhirnya terasa pantas untuk didapat.', en: 'The final result feels earned.' },
    imagePrompt: 'wide reveal of the finished result of {topic}, {style}, warm rim light',
    compositions: ['landscape', 'abstract'],
  },
  {
    id: 'tag',
    title: { id: 'Penutup Merek', en: 'Brand Tag' },
    shot: {
      id: 'Tag penutup: logo dan tagline muncul di atas latar yang tenang.',
      en: 'Closing tag: the logo and tagline land on a calm, near-empty backdrop.',
    },
    caption: { id: 'Untuk kamu yang bergerak setiap hari.', en: 'For those who keep moving every day.' },
    narration: { id: 'Untuk kamu yang bergerak setiap hari.', en: 'For those who keep moving every day.' },
    imagePrompt: 'minimal end card with negative space for a logo, {style}',
    compositions: ['abstract'],
  },
];

const SOCIAL_BEATS: Beat[] = [
  {
    id: 'hook',
    title: { id: 'Hook 3 Detik', en: 'Three Second Hook' },
    shot: {
      id: 'Selfie vertikal: {prop} diangkat ke kamera dalam dua detik pertama.',
      en: 'Vertical selfie: {prop} is lifted straight to camera within the first two seconds.',
    },
    caption: { id: 'Jangan skip dulu, ini penting.', en: 'Do not scroll yet — this matters.' },
    narration: { id: 'Stop dulu, aku baru nemu ini.', en: 'Hold on, I just found this.' },
    imagePrompt: 'vertical selfie hook holding {prop}, {style}, natural light, authentic',
    compositions: ['portrait'],
  },
  {
    id: 'problem',
    title: { id: 'Masalah', en: 'The Problem' },
    shot: {
      id: 'Tunjukkan masalah sehari-hari yang bikin frustrasi, diambil cepat dengan satu tangan.',
      en: 'Show the everyday frustration, captured fast with one hand.',
    },
    caption: { id: 'Masalahnya bukan kamu, tapi caranya.', en: 'The problem was never you — it was the method.' },
    narration: { id: 'Dulu aku juga capek ngulang hal yang sama tiap hari.', en: 'I used to dread repeating the same thing every day.' },
    imagePrompt: 'candid shot of the daily frustration around {topic}, {style}, handheld',
    compositions: ['interior'],
  },
  {
    id: 'demo',
    title: { id: 'Demo Produk', en: 'Product Demo' },
    shot: {
      id: '{prop} dipakai langsung dan hasilnya terlihat dalam satu klip tanpa cut.',
      en: '{prop} is used on camera and the result appears in a single unbroken clip.',
    },
    caption: { id: 'Lihat bedanya setelah sekali pakai.', en: 'Look at the difference after one use.' },
    narration: { id: 'Satu kali pakai, bedanya langsung kelihatan.', en: 'One use, and the difference is obvious.' },
    imagePrompt: 'product demo close-up of {prop}, {style}, clean hands-on action',
    compositions: ['macro', 'product'],
  },
  {
    id: 'proof',
    title: { id: 'Bukti Sosial', en: 'Social Proof' },
    shot: {
      id: 'Split screen testimoni pelanggan dengan angka hasil yang besar.',
      en: 'Split screen with customer testimonials next to big result numbers.',
    },
    caption: { id: 'Ribuan orang sudah pindah.', en: 'Thousands already switched.' },
    narration: { id: 'Ribuan orang sudah mencoba dan balik lagi.', en: 'Thousands tried it and came back.' },
    imagePrompt: 'social proof montage for {topic}, {style}, bold numbers on screen',
    compositions: ['abstract', 'portrait'],
  },
  {
    id: 'cta',
    title: { id: 'Ajakan Bertindak', en: 'Call To Action' },
    shot: {
      id: 'Penutup langsung ke kamera: harga, bundling, dan arahan klik keranjang.',
      en: 'Direct-to-camera close: price, bundle and where to tap the cart.',
    },
    caption: { id: 'Ambil sekarang sebelum harganya balik.', en: 'Grab it before the price goes back.' },
    narration: { id: 'Klik keranjangnya sekarang, stoknya cepat habis.', en: 'Tap the cart now — it sells out fast.' },
    imagePrompt: 'clean end frame with offer details for {topic}, {style}',
    compositions: ['product', 'abstract'],
  },
];

const COMMERCIAL_BEATS: Beat[] = [
  {
    id: 'hook',
    title: { id: 'Hook Visual', en: 'Visual Hook' },
    shot: {
      id: 'Produk masuk frame dengan perspektif paksa dan langsung jadi pusat perhatian.',
      en: 'The product enters frame with forced perspective and instantly owns the shot.',
    },
    caption: { id: 'Satu produk, satu masalah selesai.', en: 'One product, one problem solved.' },
    narration: { id: 'Ini cara paling cepat menyelesaikan {topic}.', en: 'This is the fastest way to handle {topic}.' },
    imagePrompt: 'hero product entrance for {topic}, {style}, forced perspective',
    compositions: ['product'],
  },
  {
    id: 'benefit',
    title: { id: 'Manfaat Utama', en: 'Core Benefit' },
    shot: {
      id: 'Peragakan manfaat utama {topic} dalam satu gerakan sederhana.',
      en: 'Demonstrate the core benefit of {topic} in one simple motion.',
    },
    caption: { id: 'Cukup satu gerakan, selesai.', en: 'One motion and you are done.' },
    narration: { id: 'Cukup satu gerakan, semua beres.', en: 'One motion and everything is handled.' },
    imagePrompt: 'benefit demonstration of {topic}, {style}, clean studio set',
    compositions: ['interior', 'product'],
  },
  {
    id: 'macro',
    title: { id: 'Detail Premium', en: 'Premium Detail' },
    shot: {
      id: 'Makro kemasan dan tekstur {prop}, sorot kilau dan sambungan presisi.',
      en: 'Macro on the packaging and texture of {prop}, catching highlights and precise joins.',
    },
    caption: { id: 'Detailnya yang bikin beda.', en: 'The details are what make it different.' },
    narration: { id: 'Setiap detailnya dibuat dengan sengaja.', en: 'Every detail is made deliberately.' },
    imagePrompt: 'premium macro detail of {prop}, {style}, glossy highlights',
    compositions: ['macro'],
  },
  {
    id: 'proof',
    title: { id: 'Bukti & Ulasan', en: 'Proof & Reviews' },
    shot: {
      id: 'Bukti sosial: rating bintang, ulasan singkat, dan perbandingan sebelum-sesudah.',
      en: 'Social proof: star ratings, short reviews and a before-after comparison.',
    },
    caption: { id: 'Rating 4,9 dari pembeli nyata.', en: 'Rated 4.9 by real buyers.' },
    narration: { id: 'Ratingnya 4,9 dari pembeli nyata.', en: 'Rated 4.9 by real buyers.' },
    imagePrompt: 'review and rating montage for {topic}, {style}, editorial layout',
    compositions: ['abstract'],
  },
  {
    id: 'offer',
    title: { id: 'Penawaran', en: 'The Offer' },
    shot: {
      id: 'Penawaran: bundling, garansi, dan CTA yang jelas di frame terakhir.',
      en: 'The offer: bundle, guarantee and a clear CTA in the final frame.',
    },
    caption: { id: 'Gratis ongkir dan garansi 30 hari.', en: 'Free shipping and a 30 day guarantee.' },
    narration: { id: 'Gratis ongkir dan garansi tiga puluh hari.', en: 'Free shipping and a thirty day guarantee.' },
    imagePrompt: 'final offer card for {topic}, {style}, strong call to action',
    compositions: ['abstract', 'product'],
  },
];

const FREEFORM_BEATS: Beat[] = [
  {
    id: 'opening',
    title: { id: 'Pembuka Bebas', en: 'Open Frame' },
    shot: {
      id: 'Frame pembuka tanpa aturan: {topic} diperkenalkan dengan gerak kamera yang tenang.',
      en: 'A rule-free opener: {topic} introduced with a slow, deliberate camera move.',
    },
    caption: { id: 'Kita mulai dari nol.', en: 'We start from scratch.' },
    narration: { id: 'Kita mulai dari nol, tanpa naskah.', en: 'We start from scratch, no script.' },
    imagePrompt: 'open-ended establishing frame of {topic}, {style}',
    compositions: ['landscape', 'abstract'],
  },
  {
    id: 'exploration',
    title: { id: 'Eksplorasi', en: 'Exploration' },
    shot: {
      id: 'Eksplorasi ide: tiga sudut berbeda dari {topic} dalam satu tarikan napas.',
      en: 'Idea exploration: three different angles on {topic} in a single breath.',
    },
    caption: { id: 'Ada banyak cara melihatnya.', en: 'There are many ways to see it.' },
    narration: { id: 'Ada banyak cara untuk melihat hal yang sama.', en: 'There are many ways to see the same thing.' },
    imagePrompt: 'multi-angle exploration of {topic}, {style}, collage energy',
    compositions: ['city', 'macro'],
  },
  {
    id: 'contrast',
    title: { id: 'Kontras', en: 'Contrast' },
    shot: {
      id: 'Kontras keras: sebelum dan sesudah {topic} ditumpuk dalam split screen.',
      en: 'Hard contrast: before and after {topic} stacked in split screen.',
    },
    caption: { id: 'Bandingkan sendiri hasilnya.', en: 'Compare the result yourself.' },
    narration: { id: 'Coba bandingkan sendiri hasilnya.', en: 'Try comparing the result yourself.' },
    imagePrompt: 'before and after contrast for {topic}, {style}, split screen',
    compositions: ['abstract', 'product'],
  },
  {
    id: 'quiet',
    title: { id: 'Momen Hening', en: 'Quiet Moment' },
    shot: {
      id: 'Momen hening: detail kecil dari {prop}, tanpa dialog, hanya ambience.',
      en: 'A quiet moment: a small detail of {prop}, no dialogue, just ambience.',
    },
    caption: { id: 'Kadang diam lebih jelas dari penjelasan.', en: 'Sometimes silence explains more.' },
    narration: { id: '', en: '' },
    imagePrompt: 'quiet ambient insert of {prop}, {style}, minimal',
    compositions: ['macro', 'interior'],
  },
  {
    id: 'close',
    title: { id: 'Penutup', en: 'Close Frame' },
    shot: {
      id: 'Penutup terbuka: kamera berhenti dan membiarkan penonton menafsirkan.',
      en: 'An open ending: the camera holds still and lets the audience decide.',
    },
    caption: { id: 'Sisanya terserah kamu.', en: 'The rest is up to you.' },
    narration: { id: 'Sisanya terserah kamu.', en: 'The rest is up to you.' },
    imagePrompt: 'open closing frame for {topic}, {style}, negative space',
    compositions: ['landscape', 'abstract'],
  },
];

export const BEATS: Record<StudioMode, Beat[]> = {
  cinematic: CINEMATIC_BEATS,
  social: SOCIAL_BEATS,
  commercial: COMMERCIAL_BEATS,
  freeform: FREEFORM_BEATS,
};

export const MODE_LABEL: Record<StudioMode, LocaleText> = {
  cinematic: { id: 'Sinematik', en: 'Cinematic' },
  social: { id: 'Social Feed', en: 'Social Feed' },
  commercial: { id: 'Iklan', en: 'Commercial' },
  freeform: { id: 'Bebas', en: 'Freeform' },
};

const COMMAND_WORDS = new Set([
  'buatkan', 'buatlah', 'buat', 'bikin', 'tolong', 'coba', 'generate', 'create', 'make', 'please', 'bantu', 'aku', 'saya',
  'ingin', 'mau', 'pengen', 'in', 'a', 'an', 'the', 'of',
]);

/**
 * Keeps the user's phrasing intact and only trims leading command words, so the
 * generated copy still reads like the original brief.
 */
export function cleanTopic(prompt: string): string {
  const normalised = prompt
    .replace(/[\n\r]+/g, ' ')
    .replace(/[„“”"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalised) return 'cerita baru';

  const words = normalised.split(' ');
  let start = 0;
  while (start < words.length - 2 && COMMAND_WORDS.has((words[start] ?? '').toLowerCase())) start += 1;
  let end = words.length;
  while (end - start > 2 && COMMAND_WORDS.has((words[end - 1] ?? '').toLowerCase())) end -= 1;
  return truncate(words.slice(start, end).join(' ').trim(), 110) || 'cerita baru';
}

export interface StoryboardInput {
  prompt: string;
  mode: StudioMode;
  styleId: string;
  aspect: string;
  durationSeconds: number;
  language: Language;
  roleId?: string;
  propId?: string;
  shotCount?: number;
}

export type StoryboardShot = Omit<Shot, 'id' | 'imageAssetId'> & { beatId: string; composition: Composition };

export interface StoryboardOutput {
  topic: string;
  summary: LocaleText;
  shots: StoryboardShot[];
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

export function generateStoryboard(input: StoryboardInput): StoryboardOutput {
  const style = styleById(input.styleId);
  const rng = createRng(`${input.prompt}|${input.mode}|${input.styleId}|${input.aspect}|${input.durationSeconds}|${input.language}`);
  const beats = BEATS[input.mode];
  const target = clamp(input.shotCount ?? Math.round(input.durationSeconds / 5.5), 3, beats.length);
  const chosen = beats.slice(0, target);

  const topic = cleanTopic(input.prompt);
  const prop = PROPS.find((item) => item.id === input.propId) ?? pick(rng, PROPS);
  const role = ROLES.find((item) => item.id === input.roleId) ?? pick(rng, ROLES);
  const values = {
    topic,
    prop: prop.label[input.language] ?? prop.label.en,
    role: role.label[input.language] ?? role.label.en,
    style: style.prompt,
  };

  const weights = chosen.map(() => 0.75 + rng() * 0.6);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const motions: Shot['motion'][] = ['zoom-in', 'pan-left', 'zoom-out', 'pan-right', 'static'];

  const shots = chosen.map((beat, index) => {
    const seconds = Math.max(2, Math.round((weights[index]! / weightTotal) * input.durationSeconds));
    return {
      beatId: beat.id,
      index: index + 1,
      title: { ...beat.title },
      description: {
        id: fill(beat.shot.id, values),
        en: fill(beat.shot.en, values),
      },
      imagePrompt: fill(beat.imagePrompt, values),
      caption: { ...beat.caption },
      narration: { ...beat.narration },
      durationSeconds: seconds,
      motion: motions[(index + Math.floor(rng() * motions.length)) % motions.length]!,
      composition: pick(rng, beat.compositions),
    };
  });

  const modeLabel = MODE_LABEL[input.mode];
  const summary: LocaleText = {
    id: `Video ${input.durationSeconds} detik bergaya ${style.name.id} dengan ${shots.length} adegan mengikuti alur ${modeLabel.id} untuk brief: ${truncate(topic, 80)}.`,
    en: `A ${input.durationSeconds} second ${style.name.en} piece with ${shots.length} shots following a ${modeLabel.en.toLowerCase()} arc for the brief: ${truncate(topic, 80)}.`,
  };

  return { topic, summary, shots };
}

export function demoScript(input: { topic: string; durationSeconds: number; language: Language; style: StylePreset; mode: StudioMode }): string {
  const { topic, language, style } = input;
  const beats = BEATS[input.mode].slice(0, clamp(Math.round(input.durationSeconds / 6), 3, 6));
  const heading = language === 'id' ? '# Skrip Short Video' : '# Short Video Script';
  const meta = language === 'id'
    ? `**Topik:** ${topic}\n**Durasi:** ${input.durationSeconds} detik\n**Gaya visual:** ${style.name[language]}\n**Bahasa:** Indonesia\n`
    : `**Topic:** ${topic}\n**Duration:** ${input.durationSeconds} seconds\n**Visual style:** ${style.name[language]}\n**Language:** English\n`;

  const lines = beats.map((beat, index) => {
    const start = index * (input.durationSeconds / beats.length);
    const end = (index + 1) * (input.durationSeconds / beats.length);
    const seconds = `${start.toFixed(1)}s – ${end.toFixed(1)}s`;
    return [
      `## ${index + 1}. ${beat.title[language]} · ${seconds}`,
      `- ${language === 'id' ? 'Visual' : 'Visual'}: ${fill(beat.shot[language], { topic, prop: PROPS[0]!.label[language], role: ROLES[0]!.label[language], style: style.prompt })}`,
      `- ${language === 'id' ? 'Narasi' : 'Voice-over'}: ${beat.narration[language]}`,
      `- ${language === 'id' ? 'Subtitle' : 'Subtitle'}: ${beat.caption[language]}`,
      `- ${language === 'id' ? 'Prompt gambar' : 'Image prompt'}: ${fill(beat.imagePrompt, { topic, prop: PROPS[0]!.label.en, role: ROLES[0]!.label.en, style: style.prompt })}`,
    ].join('\n');
  });

  const footer = language === 'id'
    ? `\n---\n\n**Catatan produksi**\n- Musik: bed instrumental, naik di 60% durasi.\n- Subtitle: aktifkan gaya bold dengan latar gelap.\n- CTA: sebutkan satu aksi saja agar tidak pecah fokus.\n`
    : `\n---\n\n**Production notes**\n- Music: instrumental bed, lift at 60% of the runtime.\n- Subtitles: use the bold style with a dark plate.\n- CTA: name one action only so focus does not split.\n`;

  return `${heading}\n\n${meta}\n${lines.join('\n\n')}\n${footer}`;
}

export function demoArticle(input: { topic: string; language: Language }): string {
  const { topic, language } = input;
  if (language === 'id') {
    return `# ${topic.charAt(0).toUpperCase()}${topic.slice(1)}

## Kenapa topik ini penting sekarang
${topic} bukan lagi sekadar tren sesaat. Setiap minggu ada alat baru, tapi yang benar-benar bertahan adalah alur kerja yang bisa kamu ulang.

## Tiga hal yang paling sering salah
1. **Mulai dari alat, bukan dari masalah.** Tentukan dulu hasil akhir yang kamu mau, baru pilih perkakasnya.
2. **Terlalu banyak variabel.** Ubah satu hal per iterasi supaya kamu tahu apa yang bekerja.
3. **Tidak menyimpan versi.** Setiap revisi sebaiknya jadi versi baru, bukan menimpa yang lama.

## Alur kerja yang bisa langsung dipakai
- Tulis brief satu paragraf: siapa penontonnya, masalah apa, dan hasil seperti apa.
- Pecah jadi 3–5 adegan atau bagian, masing-masing satu ide.
- Buat versi pertama secepat mungkin, lalu perbaiki bagian terlemahnya.

## Kesimpulan
Konsistensi mengalahkan kesempurnaan. Mulai kecil, ukur, dan ulangi hal yang berhasil.
`;
  }
  return `# ${topic.charAt(0).toUpperCase()}${topic.slice(1)}

## Why this matters right now
${topic} is no longer a passing trend. New tools appear every week, but the ones that last are workflows you can repeat.

## Three mistakes that cost the most time
1. **Starting from the tool instead of the problem.** Decide the outcome first, then pick the instrument.
2. **Changing too many variables.** Move one thing per iteration so you know what worked.
3. **Overwriting versions.** Every revision should become a new version, not a silent replacement.

## A workflow you can use today
- Write a one paragraph brief: audience, problem, desired result.
- Split it into 3–5 beats, one idea each.
- Ship a rough first cut fast, then fix the weakest link.

## Takeaway
Consistency beats perfection. Start small, measure, repeat what works.
`;
}

export function demoSocialPost(input: { topic: string; language: Language }): string {
  const { topic, language } = input;
  if (language === 'id') {
    return `**Hook:** Aku baru sadar ${topic} sebenarnya bisa jauh lebih simpel.

**Isi:**
1. Masalahnya bukan kurang usaha, tapi alurnya belum rapi.
2. Coba mulai dari satu kebiasaan kecil yang bisa diulang tiap hari.
3. Baru setelah itu tambah alat, bukan sebaliknya.

**CTA:** Kalau kamu mau, aku bisa bedah alurnya langkah demi langkah. Komen "MULAI" ya.

#kreator #produktivitas #shortvideo #${topic.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'kreasi'}`;
  }
  return `**Hook:** I just realised ${topic} can be far simpler than it looks.

**Body:**
1. The problem is not effort, it is an unorganised process.
2. Start with one small habit you can repeat daily.
3. Only then add tools — never the other way around.

**CTA:** Want the full breakdown? Comment "START" and I will share the flow.

#creator #workflow #shortvideo #${topic.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'create'}`;
}

export function demoAgentReply(input: { message: string; language: Language; projectTitle?: string }): string {
  const topic = cleanTopic(input.message);
  if (input.language === 'id') {
    return `Siap, aku pecah "${truncate(topic, 60)}" jadi rencana produksi yang bisa langsung dieksekusi.

**Rencana 3 langkah**
1. **Brief** — tentukan penonton, pesan utama, dan durasi. Aku asumsikan 30 detik untuk feed vertikal.
2. **Aset** — 5 adegan bernarasi + 1 kartu penutup, dengan prompt gambar per adegan.
3. **Produksi** — render storyboard, cek ritme, lalu ekspor subtitle bilingual.

**Aksi yang bisa kamu setujui**
- \`studio.create\` — membuat proyek baru dengan ${'5'} adegan dan cover otomatis.
- \`studio.render\` — merender semua adegan jadi berkas gambar + subtitle SRT.
- \`translate.run\` — menyiapkan versi bahasa Inggris dan dubbing.

Tulis "lanjut" dan aku jalankan semuanya berurutan. Semua proses berjalan lokal, jadi tidak ada data yang keluar dari perangkat ini.`;
  }
  return `On it — here is "${truncate(topic, 60)}" broken into an executable production plan.

**Three step plan**
1. **Brief** — lock the audience, the core message and the runtime. I assume a 30 second vertical cut.
2. **Assets** — five narrated shots plus an end card, each with an image prompt.
3. **Production** — render the storyboard, check pacing, export bilingual subtitles.

**Actions you can approve**
- \`studio.create\` — create the project with five shots and an auto cover.
- \`studio.render\` — render every shot to image files plus an SRT.
- \`translate.run\` — prepare the English version and the dub.

Say "go" and I will run them in order. Everything runs locally, so nothing leaves this machine.`;
}

export function narrationForLanguage(shot: { narration: LocaleText }, language: Language): string {
  return shot.narration[language] || shot.narration.en || shot.narration.id;
}

export const DEMO_COMPOSITIONS = COMPOSITIONS;
