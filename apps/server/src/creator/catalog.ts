import type { LocaleText, StudioMode } from '../types.js';

export interface StylePreset {
  id: string;
  name: LocaleText;
  family: StudioMode;
  palette: string[];
  prompt: string;
  grain: number;
}

export const STYLES: StylePreset[] = [
  {
    id: 'cinematic-golden',
    name: { id: 'Cinematic Golden Hour', en: 'Cinematic Golden Hour' },
    family: 'cinematic',
    palette: ['#0d1526', '#f5b544', '#ffe6b8', '#1d2333'],
    prompt: 'golden hour backlight, anamorphic lens flare, 35mm film grain, shallow depth of field',
    grain: 0.22,
  },
  {
    id: 'neon-night',
    name: { id: 'Neon Night', en: 'Neon Night' },
    family: 'cinematic',
    palette: ['#05070f', '#38bdf8', '#f472b6', '#111a2e'],
    prompt: 'cyberpunk neon night, wet asphalt reflections, teal and magenta grade, volumetric haze',
    grain: 0.3,
  },
  {
    id: 'plush-stop-motion',
    name: { id: 'Plush Stop-Motion', en: 'Plush Stop-Motion' },
    family: 'social',
    palette: ['#fbeedd', '#e39a63', '#fff8f0', '#8a5a44'],
    prompt: 'stop-motion felt diorama, miniature set, warm Tyndall light, tactile texture',
    grain: 0.18,
  },
  {
    id: 'wheat-nostalgia',
    name: { id: 'Wheat Field Nostalgia', en: 'Wheat Field Nostalgia' },
    family: 'cinematic',
    palette: ['#dfe9e3', '#8fae9b', '#efdfb6', '#5f6f66'],
    prompt: 'nostalgic youth film look, muted cyan-green grade, soft Kodak grain, overexposed sky',
    grain: 0.26,
  },
  {
    id: 'solarpunk-wuxia',
    name: { id: 'Solarpunk Wuxia', en: 'Solarpunk Wuxia' },
    family: 'freeform',
    palette: ['#0f2a1f', '#9be38a', '#ecdcae', '#20402f'],
    prompt: 'wuxia solarpunk, industrial ruins reclaimed by nature, volumetric god rays, epic scale',
    grain: 0.2,
  },
  {
    id: 'studio-clean',
    name: { id: 'Studio Clean', en: 'Studio Clean' },
    family: 'commercial',
    palette: ['#f7f8fb', '#ffd166', '#ffffff', '#c9d2e3'],
    prompt: 'clean commercial studio, softbox lighting, seamless backdrop, product hero framing',
    grain: 0.06,
  },
  {
    id: 'retro-print',
    name: { id: 'Retro Print', en: 'Retro Print' },
    family: 'social',
    palette: ['#f4e5c6', '#d4552d', '#fdf7ea', '#20303f'],
    prompt: 'retro risograph print, halftone texture, bold flat colour shapes, poster composition',
    grain: 0.34,
  },
  {
    id: 'noir-mono',
    name: { id: 'Noir Monochrome', en: 'Noir Monochrome' },
    family: 'cinematic',
    palette: ['#08090b', '#e2e2e2', '#8d8d8d', '#1b1d21'],
    prompt: 'high contrast black and white noir, hard key light, deep shadows, smoke haze',
    grain: 0.32,
  },
];

export const styleById = (id: string): StylePreset => STYLES.find((style) => style.id === id) ?? (STYLES[0] as StylePreset);

export interface HookPreset {
  id: string;
  title: LocaleText;
  description: LocaleText;
  category: 'brand' | 'product' | 'film' | 'entertainment';
  tags: LocaleText[];
  styleId: string;
  mode: StudioMode;
  aspect: string;
  durationSeconds: number;
  prompt: string;
}

export const HOOKS: HookPreset[] = [
  {
    id: 'cinematic-brand-short',
    title: { id: 'Short Video Brand Sinematik', en: 'Film-Style Brand Short' },
    description: {
      id: 'Memanfaatkan estetika healing sinematik dengan padang rumput musim panas dan cahaya punggung keemasan untuk membangun suasana puitis yang premium.',
      en: 'A healing cinematic aesthetic with summer meadows and golden backlight, built for a poetic premium brand mood.',
    },
    category: 'brand',
    tags: [{ id: 'Iklan Produk', en: 'Product Ads' }, { id: 'Brand Marketing', en: 'Brand Marketing' }],
    styleId: 'cinematic-golden',
    mode: 'cinematic',
    aspect: '16:9',
    durationSeconds: 30,
    prompt: 'Film-style brand short: a golden hour meadow product story with poetic pacing and a luxury finish.',
  },
  {
    id: 'plush-stop-motion',
    title: { id: 'Animasi Stop-Motion Rajut', en: 'Plush Stop-Motion Animation' },
    description: {
      id: 'Gaya animasi stop-motion yang menghadirkan diorama rajut mini dengan pencahayaan hangat dan tekstur lembut, cocok untuk cerita handmade.',
      en: 'Stop-motion dioramas of miniature plush sets with warm Tyndall lighting, ideal for handmade storytelling.',
    },
    category: 'film',
    tags: [{ id: 'Gaya Visual', en: 'Visual Style' }, { id: 'Cerita Pendek', en: 'Narrative Short' }],
    styleId: 'plush-stop-motion',
    mode: 'cinematic',
    aspect: '9:16',
    durationSeconds: 24,
    prompt: 'Plush stop-motion animation: a tiny felted diorama where a small hero learns to make morning coffee.',
  },
  {
    id: 'wheat-nostalgia',
    title: { id: 'Nostalgia Ladang Gandum', en: 'Wheat Field Nostalgia' },
    description: {
      id: 'Estetika anak muda yang melankolis dengan tone cyan-keabuan dan tekstur film Kodak untuk suasana artistik yang jauh dan kosong.',
      en: 'A broken-youth aesthetic with cool cyan-grey tones and Kodak texture, delivering a distant, lyrical mood.',
    },
    category: 'film',
    tags: [{ id: 'Gaya Visual', en: 'Visual Style' }, { id: 'Film & TV', en: 'Film & TV' }],
    styleId: 'wheat-nostalgia',
    mode: 'cinematic',
    aspect: '16:9',
    durationSeconds: 30,
    prompt: 'Wheat field nostalgia: three friends cycle home at dusk while a summer storm rolls in.',
  },
  {
    id: 'neon-city-runner',
    title: { id: 'Pelari Kota Neon', en: 'Neon City Runner' },
    description: {
      id: 'Pengejaran malam di kota bercahaya neon dengan refleksi aspal basah dan grading teal-magenta yang tegang.',
      en: 'A neon-drenched night chase with wet asphalt reflections and a tense teal-magenta grade.',
    },
    category: 'entertainment',
    tags: [{ id: 'Cerita Pendek', en: 'Narrative Short' }, { id: 'Sci-Fi', en: 'Sci-Fi' }],
    styleId: 'neon-night',
    mode: 'cinematic',
    aspect: '16:9',
    durationSeconds: 30,
    prompt: 'Neon city runner: a courier sprints through a rain-soaked cyberpunk street to deliver a glowing package.',
  },
  {
    id: 'wuxia-solarpunk',
    title: { id: 'Wuxia Solarpunk', en: 'Wuxia Solarpunk' },
    description: {
      id: 'Menggabungkan citra wuxia tradisional dengan estetika solarpunk pasca-apokaliptik untuk trailer konsep yang epik.',
      en: 'Blends traditional wuxia imagery with post-apocalyptic solarpunk for an epic concept trailer.',
    },
    category: 'film',
    tags: [{ id: 'Gaya Visual', en: 'Visual Style' }, { id: 'Trailer', en: 'Trailer' }],
    styleId: 'solarpunk-wuxia',
    mode: 'freeform',
    aspect: '16:9',
    durationSeconds: 30,
    prompt: 'Wuxia solarpunk: a swordswoman walks through solar-punk ruins where nature has reclaimed the machines.',
  },
  {
    id: 'ugc-testimonial',
    title: { id: 'UGC Testimoni Cepat', en: 'Fast UGC Testimonial' },
    description: {
      id: 'Format selfie vertikal dengan hook 3 detik, demo produk, dan penutup ajakan yang menempel di feed.',
      en: 'A vertical selfie format with a three second hook, a quick product demo and a punchy CTA.',
    },
    category: 'product',
    tags: [{ id: 'Social Seeding', en: 'Social Seeding' }, { id: 'Iklan Produk', en: 'Product Ads' }],
    styleId: 'retro-print',
    mode: 'social',
    aspect: '9:16',
    durationSeconds: 15,
    prompt: 'UGC testimonial: a creator films a fast, honest review of a daily-use product in one take.',
  },
  {
    id: 'product-hero-spot',
    title: { id: 'Spot Hero Produk', en: 'Product Hero Spot' },
    description: {
      id: 'Framing hero produk dengan pencahayaan softbox, makro tekstur, dan call-to-action yang jelas.',
      en: 'Hero product framing with softbox lights, macro textures and a crisp call to action.',
    },
    category: 'product',
    tags: [{ id: 'Iklan Produk', en: 'Product Ads' }, { id: 'E-commerce', en: 'E-commerce' }],
    styleId: 'studio-clean',
    mode: 'commercial',
    aspect: '1:1',
    durationSeconds: 15,
    prompt: 'Product hero spot: macro shots of a minimal skincare bottle rotating on a seamless studio set.',
  },
  {
    id: 'giant-product-flex',
    title: { id: 'Produk Raksasa', en: 'Giant Product Flex' },
    description: {
      id: 'Perspektif paksa dan gestur tangan berlebihan membuat produk terlihat raksasa dan langsung menarik perhatian.',
      en: 'Forced perspective and exaggerated hand gestures make the product look gigantic in frame.',
    },
    category: 'product',
    tags: [{ id: 'Social Seeding', en: 'Social Seeding' }, { id: 'Gaya Visual', en: 'Visual Style' }],
    styleId: 'studio-clean',
    mode: 'commercial',
    aspect: '9:16',
    durationSeconds: 15,
    prompt: 'Giant product flex: a forced-perspective hook where hands hold an oversized product box to camera.',
  },
  {
    id: 'late-night-startup',
    title: { id: 'Sitkom Startup Tengah Malam', en: 'Late Night Startup Sitcom' },
    description: {
      id: 'Sitkom kantor dengan tone biru dingin dan dialog datar komedi tentang pitch yang makin absurd.',
      en: 'A workplace sitcom look with cold blue tones and deadpan dialogue about increasingly absurd pitches.',
    },
    category: 'entertainment',
    tags: [{ id: 'Cerita Pendek', en: 'Narrative Short' }, { id: 'Komedi', en: 'Comedy' }],
    styleId: 'noir-mono',
    mode: 'cinematic',
    aspect: '16:9',
    durationSeconds: 30,
    prompt: 'Late night startup sitcom: a founder pitches an absurd idea to a very tired engineering team.',
  },
  {
    id: 'bed-selfie',
    title: { id: 'Selfie Pagi Autentik', en: 'Authentic Morning Selfie' },
    description: {
      id: 'Hook lifestyle dari sudut pandang ponsel dengan cahaya alami untuk membuat produk terasa dekat dan relatable.',
      en: 'A phone-first lifestyle hook with natural light that makes the product feel intimate and relatable.',
    },
    category: 'brand',
    tags: [{ id: 'Social Seeding', en: 'Social Seeding' }, { id: 'Lifestyle', en: 'Lifestyle' }],
      styleId: 'plush-stop-motion',
    mode: 'social',
    aspect: '9:16',
    durationSeconds: 15,
    prompt: 'Authentic morning selfie: an unhurried morning routine shot handheld in soft window light.',
  },
  {
    id: 'digital-tree-planting',
    title: { id: 'Menanam Pohon Digital', en: 'Digital Tree Planting' },
    description: {
      id: 'Teknik kreatif di mana produk jatuh ke tanah dan tumbuh menjadi pohon yang berbuah produk identik.',
      en: 'A creative technique where the product falls to earth and grows into a tree bearing identical products.',
    },
    category: 'brand',
    tags: [{ id: 'Iklan Produk', en: 'Product Ads' }, { id: 'Keberlanjutan', en: 'Sustainability' }],
    styleId: 'solarpunk-wuxia',
    mode: 'commercial',
    aspect: '1:1',
    durationSeconds: 15,
    prompt: 'Digital tree planting: a product drops into an urban green belt and grows into a mature brand tree.',
  },
  {
    id: 'cat-boss-drama',
    title: { id: 'Drama Bos Kucing', en: 'Cat Boss Drama' },
    description: {
      id: 'Narasi sinematik kepala kucing tubuh manusia untuk membangun citra brand yang premium dan intens.',
      en: 'A cinematic cat-head-human-body narrative that builds a premium, high-tension brand image.',
    },
    category: 'entertainment',
    tags: [{ id: 'Cerita Pendek', en: 'Narrative Short' }, { id: 'Hewan Lucu', en: 'Cute Pets' }],
    styleId: 'cinematic-golden',
    mode: 'cinematic',
    aspect: '16:9',
    durationSeconds: 30,
    prompt: 'Cat boss drama: a suit-wearing cat executive holds a tense boardroom meeting at dawn.',
  },
];

export const hookById = (id: string): HookPreset | undefined => HOOKS.find((hook) => hook.id === id);

export interface TemplatePreset {
  id: string;
  title: LocaleText;
  description: LocaleText;
  category: 'featured' | 'ads' | 'ecommerce' | 'digital-human' | 'story';
  kind: 'video' | 'image';
  styleId: string;
  aspect: string;
  durationSeconds: number;
  prompt: string;
  steps: LocaleText[];
}

export const TEMPLATES: TemplatePreset[] = [
  {
    id: 'ugc-ads-high-converting',
    title: { id: 'High-Converting UGC Ads', en: 'High-Converting UGC Ads' },
    description: {
      id: 'Struktur iklan UGC: hook 3 detik, masalah, demo produk, bukti sosial, lalu CTA.',
      en: 'UGC ad structure: three second hook, problem, demo, social proof, then CTA.',
    },
    category: 'ads',
    kind: 'video',
    styleId: 'retro-print',
    aspect: '9:16',
    durationSeconds: 15,
    prompt: 'High-converting UGC ad for a daily-use product, filmed handheld with an honest testimonial tone.',
    steps: [
      { id: 'Hook retensi 3 detik', en: 'Three second retention hook' },
      { id: 'Tunjukkan masalah', en: 'Show the problem' },
      { id: 'Demo produk', en: 'Product demo' },
      { id: 'Bukti sosial', en: 'Social proof' },
      { id: 'Ajakan bertindak', en: 'Call to action' },
    ],
  },
  {
    id: 'product-ad-macro',
    title: { id: 'Product Ad Makro', en: 'Macro Product Ad' },
    description: {
      id: 'Spot produk dengan makro tekstur, rotasi meja putar, dan tagline yang tegas.',
      en: 'A product spot with macro textures, turntable rotation and a confident tagline.',
    },
    category: 'ecommerce',
    kind: 'video',
    styleId: 'studio-clean',
    aspect: '1:1',
    durationSeconds: 15,
    prompt: 'Macro product ad with turntable rotation, water droplets and a crisp brand tagline.',
    steps: [
      { id: 'Framing hero', en: 'Hero framing' },
      { id: 'Makro tekstur', en: 'Macro texture' },
      { id: 'Rotasi meja putar', en: 'Turntable rotation' },
      { id: 'Tagline', en: 'Tagline close' },
    ],
  },
  {
    id: 'digital-human-presenter',
    title: { id: 'Presenter Digital Human', en: 'Digital Human Presenter' },
    description: {
      id: 'Presenter virtual yang membaca skrip dengan bibir tersinkron dan gestur natural.',
      en: 'A virtual presenter reading a script with lip sync and natural gestures.',
    },
    category: 'digital-human',
    kind: 'video',
    styleId: 'noir-mono',
    aspect: '9:16',
    durationSeconds: 30,
    prompt: 'Digital human presenter delivering a script to camera with lip sync and soft studio lighting.',
    steps: [
      { id: 'Pilih avatar', en: 'Choose avatar' },
      { id: 'Tulis skrip', en: 'Write script' },
      { id: 'Sinkron bibir', en: 'Lip sync' },
      { id: 'Render akhir', en: 'Final render' },
    ],
  },
  {
    id: 'travel-vlog-cinematic',
    title: { id: 'Travel Vlog Sinematik', en: 'Cinematic Travel Vlog' },
    description: {
      id: 'Rangkaian travel vlog dengan transisi match-cut dan narasi reflektif.',
      en: 'A travel vlog sequence with match-cut transitions and reflective narration.',
    },
    category: 'story',
    kind: 'video',
    styleId: 'cinematic-golden',
    aspect: '16:9',
    durationSeconds: 30,
    prompt: 'Cinematic travel vlog across markets, trains and mountains with reflective narration.',
    steps: [
      { id: 'Pembuka perjalanan', en: 'Journey opener' },
      { id: 'Lokasi ikonik', en: 'Signature locations' },
      { id: 'Momen intim', en: 'Intimate moments' },
      { id: 'Penutup reflektif', en: 'Reflective closer' },
    ],
  },
  {
    id: 'explainer-stickman',
    title: { id: 'Explainer Stickman', en: 'Stickman Explainer' },
    description: {
      id: 'Animasi stickman untuk menjelaskan alur produk dalam 30 detik.',
      en: 'Stick-figure animation explaining a product flow in thirty seconds.',
    },
    category: 'featured',
    kind: 'video',
    styleId: 'retro-print',
    aspect: '16:9',
    durationSeconds: 30,
    prompt: 'Stickman explainer animation with clear beats that teach one simple idea per scene.',
    steps: [
      { id: 'Pertanyaan pembuka', en: 'Opening question' },
      { id: 'Tiga langkah', en: 'Three steps' },
      { id: 'Hasil akhir', en: 'Final result' },
    ],
  },
  {
    id: 'thumbnail-contrast',
    title: { id: 'Thumbnail Kontras Tinggi', en: 'High Contrast Thumbnail' },
    description: {
      id: 'Thumbnail dengan subjek besar, ekspresi kuat, dan latar kontras untuk CTR tinggi.',
      en: 'A thumbnail with a big subject, strong expression and high-contrast backdrop for CTR.',
    },
    category: 'featured',
    kind: 'image',
    styleId: 'noir-mono',
    aspect: '16:9',
    durationSeconds: 1,
    prompt: 'High contrast thumbnail with a bold subject, rim light and negative space for the headline.',
    steps: [
      { id: 'Tentukan topik', en: 'Set the topic' },
      { id: 'Susun subjek', en: 'Compose the subject' },
      { id: 'Buat 4 varian', en: 'Generate four variants' },
    ],
  },
];

export const templateById = (id: string): TemplatePreset | undefined => TEMPLATES.find((template) => template.id === id);

export const ROLES: { id: string; label: LocaleText }[] = [
  { id: 'founder', label: { id: 'Founder', en: 'Founder' } },
  { id: 'chef', label: { id: 'Chef', en: 'Chef' } },
  { id: 'athlete', label: { id: 'Atlet', en: 'Athlete' } },
  { id: 'artist', label: { id: 'Seniman', en: 'Artist' } },
  { id: 'engineer', label: { id: 'Insinyur', en: 'Engineer' } },
  { id: 'teacher', label: { id: 'Guru', en: 'Teacher' } },
  { id: 'traveler', label: { id: 'Pelancong', en: 'Traveller' } },
];

export const PROPS: { id: string; label: LocaleText }[] = [
  { id: 'coffee', label: { id: 'Cangkir kopi', en: 'Coffee cup' } },
  { id: 'sneakers', label: { id: 'Sepatu sneakers', en: 'Sneakers' } },
  { id: 'skincare', label: { id: 'Botol skincare', en: 'Skincare bottle' } },
  { id: 'headphones', label: { id: 'Headphone', en: 'Headphones' } },
  { id: 'camera', label: { id: 'Kamera', en: 'Camera' } },
  { id: 'plant', label: { id: 'Tanaman', en: 'Plant' } },
];

export const AGENT_SKILLS: { id: string; title: LocaleText; summary: LocaleText; kind: 'agent' | 'workflow' }[] = [
  {
    id: 'video-translation',
    title: { id: 'Video Translation', en: 'Video Translation' },
    summary: {
      id: 'Transkrip, segmentasi, terjemahan konteks, subtitle bilingual, dan dubbing.',
      en: 'Transcription, segmentation, context-aware translation, bilingual subtitles and dubbing.',
    },
    kind: 'workflow',
  },
  {
    id: 'short-video-script',
    title: { id: 'Short Video Script', en: 'Short Video Script' },
    summary: {
      id: 'Skrip short video lengkap dengan hook, beat, dan CTA.',
      en: 'A complete short-video script with hook, beats and CTA.',
    },
    kind: 'agent',
  },
  {
    id: 'thumbnail-generator',
    title: { id: 'Thumbnail Generator', en: 'Thumbnail Generator' },
    summary: {
      id: 'Buat beberapa varian thumbnail untuk dibandingkan.',
      en: 'Generate several thumbnail variants to compare side by side.',
    },
    kind: 'agent',
  },
  {
    id: 'image-generation',
    title: { id: 'Image Generation', en: 'Image Generation' },
    summary: {
      id: 'Prompt ke gambar dengan rasio dan jumlah keluaran yang diatur.',
      en: 'Prompt to image with configurable aspect ratio and output count.',
    },
    kind: 'agent',
  },
  {
    id: 'smart-dubbing',
    title: { id: 'Smart Dubbing', en: 'Smart Dubbing' },
    summary: {
      id: 'Voice-over multi-bahasa dengan pilihan suara dan tempo.',
      en: 'Multi-language voice-over with voice presets and pacing control.',
    },
    kind: 'agent',
  },
  {
    id: 'article-writer',
    title: { id: 'Article Writer', en: 'Article Writer' },
    summary: {
      id: 'Tulisan panjang, post sosial, dan skrip dari satu brief.',
      en: 'Long-form articles, social posts and scripts from one brief.',
    },
    kind: 'agent',
  },
];

export const VOICE_PRESETS: { id: string; label: LocaleText; hint: LocaleText }[] = [
  { id: 'warm-narrator', label: { id: 'Narator Hangat', en: 'Warm Narrator' }, hint: { id: 'Dokumenter, tempo tenang', en: 'Documentary, calm pacing' } },
  { id: 'energetic-host', label: { id: 'Host Enerjik', en: 'Energetic Host' }, hint: { id: 'Iklan, tempo cepat', en: 'Ads, upbeat pacing' } },
  { id: 'soft-storyteller', label: { id: 'Pendongeng Lembut', en: 'Soft Storyteller' }, hint: { id: 'Cerita, tempo lambat', en: 'Narrative, slow pacing' } },
  { id: 'clear-corporate', label: { id: 'Korporat Jelas', en: 'Clear Corporate' }, hint: { id: 'Presentasi, netral', en: 'Presentation, neutral' } },
];

export const ASPECTS = ['16:9', '9:16', '1:1', '4:5'] as const;
export const DURATIONS = [15, 24, 30, 45, 60] as const;
export const MODES: StudioMode[] = ['cinematic', 'social', 'commercial', 'freeform'];
