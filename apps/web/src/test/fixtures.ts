import type { Catalog, Job, Project, SystemInfo } from '../lib/types';

export const systemFixture: SystemInfo = {
  uptimeSeconds: 120,
  counts: { projects: 1, assets: 3, jobs: 1, threads: 1, translations: 1 },
  providers: { llm: 'demo', image: 'demo', tts: 'demo', asr: 'demo' },
  dataDir: '/tmp/kreator/.kreator-data/assets',
  time: new Date().toISOString(),
};

export const catalogFixture: Catalog = {
  styles: [
    {
      id: 'cinematic-golden',
      name: { id: 'Cinematic Golden Hour', en: 'Cinematic Golden Hour' },
      family: 'cinematic',
      palette: ['#0d1526', '#f5b544'],
      prompt: 'golden hour',
      grain: 0.2,
    },
  ],
  hooks: [
    {
      id: 'cinematic-brand-short',
      title: { id: 'Short Video Brand', en: 'Film-Style Brand Short' },
      description: { id: 'Deskripsi', en: 'Description' },
      category: 'brand',
      tags: [{ id: 'Iklan', en: 'Ads' }],
      styleId: 'cinematic-golden',
      mode: 'cinematic',
      aspect: '16:9',
      durationSeconds: 30,
      prompt: 'brand short',
    },
  ],
  templates: [
    {
      id: 'ugc-ads-high-converting',
      title: { id: 'UGC Ads', en: 'UGC Ads' },
      description: { id: 'Deskripsi', en: 'Description' },
      category: 'ads',
      kind: 'video',
      styleId: 'cinematic-golden',
      aspect: '9:16',
      durationSeconds: 15,
      prompt: 'ugc ad',
      steps: [{ id: 'Hook', en: 'Hook' }],
    },
  ],
  roles: [{ id: 'founder', label: { id: 'Founder', en: 'Founder' } }],
  props: [{ id: 'coffee', label: { id: 'Kopi', en: 'Coffee cup' } }],
  skills: [{ id: 'video-translation', title: { id: 'Terjemahan', en: 'Translation' }, summary: { id: 'Ringkasan', en: 'Summary' }, kind: 'workflow' }],
  voices: [{ id: 'warm-narrator', label: { id: 'Narator', en: 'Narrator' }, hint: { id: 'Tenang', en: 'Calm' } }],
  glossary: [{ id: 'g1', source: 'brief', target: 'brief' }],
  aspects: ['16:9', '9:16', '1:1'],
  durations: [15, 30, 60],
  modes: ['cinematic', 'social', 'commercial', 'freeform'],
};

export const projectFixture: Project = {
  id: 'proj_test',
  title: 'Video brand kopi lokal',
  prompt: 'Video brand kopi lokal, sinematik hangat.',
  mode: 'cinematic',
  styleId: 'cinematic-golden',
  aspect: '16:9',
  durationSeconds: 30,
  language: 'id',
  targetLanguage: 'en',
  status: 'ready',
  summary: { id: 'Ringkasan proyek', en: 'Project summary' },
  shots: [
    {
      id: 'shot_1',
      index: 1,
      title: { id: 'Pembuka', en: 'Establishing' },
      description: { id: 'Wide shot ladang kopi.', en: 'Wide shot of the coffee field.' },
      imagePrompt: 'wide shot of a coffee field',
      caption: { id: 'Semua dimulai dari satu momen.', en: 'It all starts with one moment.' },
      narration: { id: 'Semua dimulai dari satu momen sederhana.', en: 'It all starts with one simple moment.' },
      durationSeconds: 6,
      imageAssetId: 'asset_1',
      motion: 'zoom-in',
    },
  ],
  versions: [{ id: 'ver_1', label: { id: 'Versi 1', en: 'Version 1' }, createdAt: new Date().toISOString(), snapshot: { shots: [], styleId: 'cinematic-golden', aspect: '16:9', durationSeconds: 30 } }],
  voiceEnabled: true,
  voiceAssetId: 'asset_2',
  coverAssetId: 'asset_1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const jobFixture: Job = {
  id: 'job_test',
  kind: 'studio-render',
  status: 'running',
  title: 'Render: Video brand kopi lokal',
  projectId: 'proj_test',
  steps: [
    { id: 'prepare', label: { id: 'Menyiapkan aset', en: 'Prepare assets' }, status: 'done' },
    { id: 'frames', label: { id: 'Merender adegan', en: 'Render shots' }, status: 'running' },
  ],
  log: ['[10:00:00] Mulai render.'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const assetFixtures = [
  {
    id: 'asset_1',
    kind: 'image' as const,
    name: 'cover.svg',
    mimeType: 'image/svg+xml',
    path: '/tmp/cover.svg',
    sizeBytes: 2048,
    createdAt: new Date().toISOString(),
    origin: 'demo' as const,
    meta: { projectId: 'proj_test' },
  },
  {
    id: 'asset_2',
    kind: 'document' as const,
    name: 'subtitle.srt',
    mimeType: 'application/x-subrip',
    path: '/tmp/subtitle.srt',
    sizeBytes: 512,
    createdAt: new Date().toISOString(),
    origin: 'render' as const,
    meta: { projectId: 'proj_test' },
  },
];

export const translationFixture = {
  id: 'tr_test',
  sourceName: 'teks-manual',
  sourceLanguage: 'id' as const,
  targetLanguage: 'en' as const,
  mode: 'demo' as const,
  createdAt: new Date().toISOString(),
  cues: [
    { index: 1, start: 0, end: 2.4, text: 'Halo semuanya.', translation: 'Hey everyone.' },
    { index: 2, start: 2.4, end: 5.1, text: 'Selamat datang kembali.', translation: 'Welcome back.' },
  ],
};

export const configFixture = {
  language: 'id' as const,
  theme: 'dark' as const,
  accent: '#ffd166',
  authorName: 'Kreator Studio',
  providers: {
    llm: 'demo' as const,
    image: 'demo' as const,
    tts: 'demo' as const,
    asr: 'demo' as const,
    openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', chatModel: 'gpt-4o-mini', imageModel: 'gpt-image-1', ttsModel: 'tts-1', ttsVoice: 'alloy', asrModel: 'whisper-1' },
    anthropic: { apiKey: '', model: 'claude' },
    gemini: { apiKey: '', model: 'gemini' },
    ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.1' },
    elevenlabs: { apiKey: '', model: 'eleven_multilingual_v2', voiceId: 'abc' },
  },
};

export const threadFixture = {
  id: 'thread_test',
  title: 'Percakapan baru',
  messages: [
    { id: 'msg_1', role: 'system' as const, content: 'Agent siap.', createdAt: new Date().toISOString() },
    { id: 'msg_2', role: 'user' as const, content: 'Buat video kopi lokal', createdAt: new Date().toISOString() },
    { id: 'msg_3', role: 'assistant' as const, content: 'Siap, aku pecah jadi rencana produksi.', createdAt: new Date().toISOString() },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const approvalFixture = {
  id: 'appr_test',
  title: 'Jalankan rencana produksi',
  detail: 'Buat proyek & storyboard · Render adegan ke berkas',
  payload: {
    threadId: 'thread_test',
    language: 'id',
    prompt: 'video kopi lokal',
    actions: [
      { kind: 'project', label: { id: 'Buat proyek & storyboard', en: 'Create project' }, payload: { prompt: 'video kopi lokal' } },
      { kind: 'render', label: { id: 'Render adegan ke berkas', en: 'Render shots' }, payload: {} },
    ],
  },
  status: 'pending' as const,
  createdAt: new Date().toISOString(),
};

/** Installs a fetch mock that answers every workspace endpoint with fixtures. */
export function installFetchMock(): void {
  const handlers: Record<string, unknown> = {
    '/api/config': configFixture,
    '/api/catalog': catalogFixture,
    '/api/system': systemFixture,
    '/api/projects': [projectFixture],
    '/api/projects/proj_test': projectFixture,
    '/api/jobs': [jobFixture],
    '/api/jobs/job_test': jobFixture,
    '/api/assets': assetFixtures,
    '/api/translations': [translationFixture],
    '/api/threads': [threadFixture],
    '/api/threads/thread_test': threadFixture,
    '/api/approvals': [approvalFixture],
    '/api/runs': [{ id: 'run_1', kind: 'translate', label: 'Terjemahan', status: 'done', createdAt: new Date().toISOString() }],
    '/api/health': { ok: true },
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const path = url.split('?')[0] ?? url;
    if (init?.method && init.method !== 'GET') {
      return new Response(JSON.stringify({ ok: true, jobId: 'job_test', projectId: 'proj_test', translation: 'Hey everyone.' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const payload = handlers[path];
    if (payload === undefined) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}
