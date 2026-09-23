import { promises as fs } from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response, type Router } from 'express';
import multer from 'multer';
import { ASSETS_DIR, store } from '../store.js';
import { appendLog, createJob, jobById, runJobInBackground } from '../services/jobs.js';
import { assetById, saveAsset } from '../services/assets.js';
import { cancelJob } from '../services/jobs.js';
import {
  createThread,
  decideApproval,
  getThread,
  listThreads,
  sendMessage,
} from '../creator/agent.js';
import {
  createProjectJob,
  deleteProject,
  dubJob,
  duplicateProject,
  imageJob,
  renderProjectJob,
  translateJob,
  updateProject,
  writerJob,
} from '../creator/studio.js';
import { ASPECTS, DURATIONS, HOOKS, MODES, PROPS, ROLES, STYLES, TEMPLATES, AGENT_SKILLS, VOICE_PRESETS } from '../creator/catalog.js';
import { DEFAULT_GLOSSARY, demoTranslateText } from '../creator/translate.js';
import { transcribeAsset } from '../providers/asr.js';
import { store as settingsStore } from '../store.js';
import { createRng, newId, nowIso } from '../util.js';
import { renderSceneSvg, type Composition } from '../creator/scene.js';
import type { AppConfig, Language, Project } from '../types.js';
import { eventsHandler } from './events.js';

const upload = multer({ dest: ASSETS_DIR, limits: { fileSize: 512 * 1024 * 1024 } });

function asLanguage(value: unknown, fallback: Language = 'id'): Language {
  return value === 'en' ? 'en' : value === 'id' ? 'id' : fallback;
}

export function createRouter(): Router {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, time: nowIso(), version: '0.1.0' });
  });

  router.get('/config', (_req, res) => {
    const config = store.settings();
    res.json({
      ...config,
      // Never leak keys to the UI; expose only whether they are set.
      providers: {
        ...config.providers,
        openai: { ...config.providers.openai, apiKey: config.providers.openai.apiKey ? '••••••' : '' },
        anthropic: { ...config.providers.anthropic, apiKey: config.providers.anthropic.apiKey ? '••••••' : '' },
        gemini: { ...config.providers.gemini, apiKey: config.providers.gemini.apiKey ? '••••••' : '' },
        elevenlabs: { ...config.providers.elevenlabs, apiKey: config.providers.elevenlabs.apiKey ? '••••••' : '' },
      },
    });
  });

  router.put('/config', async (req: Request, res: Response) => {
    const patch = req.body as Partial<AppConfig>;
    // Ignore masked placeholders coming back from the UI.
    const sanitize = <T extends Record<string, unknown>>(value: T | undefined): T | undefined => {
      if (!value) return undefined;
      const clone = { ...value };
      for (const key of Object.keys(clone)) {
        if (typeof clone[key] === 'string' && clone[key] === '••••••') delete clone[key];
      }
      return clone as T;
    };
    const cleaned: Partial<AppConfig> = {
      ...patch,
      providers: patch.providers
        ? {
            ...patch.providers,
            openai: sanitize(patch.providers.openai),
            anthropic: sanitize(patch.providers.anthropic),
            gemini: sanitize(patch.providers.gemini),
            elevenlabs: sanitize(patch.providers.elevenlabs),
          } as AppConfig['providers']
        : undefined,
    };
    await settingsStore.saveConfig(cleaned);
    res.json({ ok: true });
  });

  router.get('/catalog', (_req, res) => {
    res.json({
      styles: STYLES,
      hooks: HOOKS,
      templates: TEMPLATES,
      roles: ROLES,
      props: PROPS,
      skills: AGENT_SKILLS,
      voices: VOICE_PRESETS,
      glossary: DEFAULT_GLOSSARY,
      aspects: ASPECTS,
      durations: DURATIONS,
      modes: MODES,
    });
  });

  /** Deterministic preview still for hooks, templates and styles (used by the UI galleries). */
  router.get('/catalog/preview/:kind/:id', (req, res) => {
    const { kind, id } = req.params;
    const hook = kind === 'hook' ? HOOKS.find((item) => item.id === id) : undefined;
    const template = kind === 'template' ? TEMPLATES.find((item) => item.id === id) : undefined;
    const style = STYLES.find((item) => item.id === (hook?.styleId ?? template?.styleId ?? id)) ?? STYLES[0]!;
    const aspect = hook?.aspect ?? template?.aspect ?? '16:9';
    const seedRng = createRng(`${kind}:${id}`);
    const compositions: Composition[] = ['landscape', 'city', 'portrait', 'product', 'interior', 'abstract', 'macro'];
    const composition = compositions[Math.floor(seedRng() * compositions.length)] ?? 'landscape';
    const svg = renderSceneSvg({
      style,
      composition,
      seed: `${kind}:${id}`,
      aspect,
      kicker: hook ? hook.tags[0]?.en ?? hook.category : template ? template.kind.toUpperCase() : style.family.toUpperCase(),
      language: store.settings().language,
    });
    res.type('image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(svg);
  });

  // ---------------------------------------------------------------- projects
  router.get('/projects', (_req, res) => {
    res.json(store.data().projects);
  });

  router.get('/projects/:id', (req, res) => {
    const project = store.data().projects.find((item) => item.id === req.params.id);
    if (!project) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    res.json(project);
  });

  router.post('/projects', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const prompt = String(body.prompt ?? '').trim();
    if (!prompt) {
      res.status(400).json({ error: 'prompt-required' });
      return;
    }
    const { job, projectId } = await createProjectJob({
      prompt,
      mode: body.mode as Project['mode'],
      styleId: body.styleId ? String(body.styleId) : undefined,
      aspect: body.aspect ? String(body.aspect) : undefined,
      durationSeconds: body.durationSeconds ? Number(body.durationSeconds) : undefined,
      language: asLanguage(body.language),
      targetLanguage: body.targetLanguage ? asLanguage(body.targetLanguage) : undefined,
      hookId: body.hookId ? String(body.hookId) : undefined,
      templateId: body.templateId ? String(body.templateId) : undefined,
      roleId: body.roleId ? String(body.roleId) : undefined,
      propId: body.propId ? String(body.propId) : undefined,
      title: body.title ? String(body.title) : undefined,
      voiceEnabled: body.voiceEnabled !== false,
      shotCount: body.shotCount ? Number(body.shotCount) : undefined,
    });
    res.status(202).json({ jobId: job.id, projectId });
  });

  router.patch('/projects/:id', async (req, res) => {
    const project = await updateProject(req.params.id, req.body as Partial<Project>);
    if (!project) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    res.json(project);
  });

  router.delete('/projects/:id', async (req, res) => {
    const removed = await deleteProject(req.params.id);
    res.json({ removed });
  });

  router.post('/projects/:id/duplicate', async (req, res) => {
    const clone = await duplicateProject(req.params.id);
    if (!clone) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    res.json(clone);
  });

  router.post('/projects/:id/render', async (req, res) => {
    try {
      const { job } = await renderProjectJob({
        projectId: req.params.id,
        translate: req.body?.translate !== false,
        bilingual: req.body?.bilingual !== false,
      });
      res.status(202).json({ jobId: job.id });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'render-failed' });
    }
  });

  router.post('/projects/:id/dub', async (req, res) => {
    try {
      const { job } = await dubJob({
        projectId: req.params.id,
        language: req.body?.language ? asLanguage(req.body.language) : undefined,
        presetId: req.body?.presetId ? String(req.body.presetId) : undefined,
      });
      res.status(202).json({ jobId: job.id });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'dub-failed' });
    }
  });

  // -------------------------------------------------------------------- jobs
  router.get('/jobs', (_req, res) => {
    res.json(store.data().jobs.slice(0, 60));
  });

  router.get('/jobs/:id', (req, res) => {
    const job = jobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    res.json(job);
  });

  router.post('/jobs/:id/cancel', (req, res) => {
    cancelJob(req.params.id);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------ assets
  router.get('/assets', (req, res) => {
    const kind = req.query.kind as string | undefined;
    const projectId = req.query.projectId as string | undefined;
    let assets = store.data().assets;
    if (kind) assets = assets.filter((asset) => asset.kind === kind);
    if (projectId) assets = assets.filter((asset) => asset.meta?.projectId === projectId);
    res.json(assets);
  });

  router.get('/assets/:id/file', (req, res) => {
    const asset = assetById(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    res.type(asset.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path.resolve(asset.path));
  });

  router.get('/assets/:id/download', (req, res) => {
    const asset = assetById(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    res.download(path.resolve(asset.path), asset.name);
  });

  router.delete('/assets/:id', async (req, res) => {
    const asset = assetById(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    await store.update((db) => {
      db.assets = db.assets.filter((item) => item.id !== asset.id);
      return true;
    });
    res.json({ removed: true });
  });

  router.post('/assets/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'file-required' });
      return;
    }
    const buffer = await fs.readFile(file.path);
    await fs.unlink(file.path).catch(() => undefined);
    const kind = file.mimetype.startsWith('video')
      ? 'video'
      : file.mimetype.startsWith('audio')
        ? 'audio'
        : file.mimetype.startsWith('image')
          ? 'image'
          : 'document';
    const asset = await saveAsset({
      name: file.originalname,
      mimeType: file.mimetype,
      buffer,
      kind,
      origin: 'upload',
      meta: { uploadedAt: nowIso() },
    });
    res.status(201).json(asset);
  });

  // -------------------------------------------------------------- translate
  router.post('/translate', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    try {
      const { job } = await translateJob({
        text: body.text ? String(body.text) : undefined,
        assetId: body.assetId ? String(body.assetId) : undefined,
        sourceName: body.sourceName ? String(body.sourceName) : undefined,
        sourceLanguage: body.sourceLanguage === 'auto' || !body.sourceLanguage ? 'auto' : asLanguage(body.sourceLanguage),
        targetLanguage: asLanguage(body.targetLanguage, 'en'),
        bilingual: body.bilingual !== false,
        totalSeconds: body.totalSeconds ? Number(body.totalSeconds) : undefined,
      });
      res.status(202).json({ jobId: job.id });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'translate-failed' });
    }
  });

  router.post('/translate/preview', (req, res) => {
    const body = req.body as { text?: string; targetLanguage?: string };
    const text = String(body.text ?? '');
    if (!text.trim()) {
      res.status(400).json({ error: 'text-required' });
      return;
    }
    res.json({
      translation: demoTranslateText(text, asLanguage(body.targetLanguage, 'en')),
      glossary: DEFAULT_GLOSSARY,
    });
  });

  router.get('/translations', (_req, res) => {
    res.json(store.data().translations);
  });

  router.post('/transcribe', async (req, res) => {
    const body = req.body as { assetId?: string; language?: string };
    const asset = body.assetId ? assetById(String(body.assetId)) : undefined;
    if (!asset) {
      res.status(400).json({ error: 'asset-required' });
      return;
    }
    const language = asLanguage(body.language);
    const job = await createJob({
      kind: 'import',
      title: `Transkripsi: ${asset.name}`,
      steps: [
        { id: 'probe', label: { id: 'Memeriksa berkas media', en: 'Probe the media file' } },
        { id: 'asr', label: { id: 'Transkripsi otomatis', en: 'Automatic transcription' } },
        { id: 'segment', label: { id: 'Segmentasi cue', en: 'Segment into cues' } },
      ],
    });

    runJobInBackground(job, async ({ step, log, wait }) => {
      await step('probe', 'running');
      await log(`Berkas ${asset.name} (${(asset.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
      await wait(200);
      await step('probe', 'done', asset.mimeType);
      await step('asr', 'running');
      const result = await transcribeAsset(asset.path, asset.name, language);
      await log(result.note);
      await step('asr', 'done', result.provider);
      await step('segment', 'running');
      await wait(150);
      await step('segment', 'done', `${result.cues.length} cue`);
      await store.update((db) => {
        db.translations.unshift({
          id: newId('tr'),
          sourceName: asset.name,
          sourceAssetId: asset.id,
          sourceLanguage: result.detectedLanguage,
          targetLanguage: result.detectedLanguage === 'id' ? 'en' : 'id',
          cues: result.cues,
          mode: result.provider === 'demo' ? 'demo' : 'provider',
          createdAt: nowIso(),
          jobId: job.id,
        });
        db.translations = db.translations.slice(0, 60);
        return true;
      });
      return { text: result.text, cues: result.cues, provider: result.provider, note: result.note };
    });

    res.status(202).json({ jobId: job.id });
  });

  // ----------------------------------------------------------------- others
  router.post('/images', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const prompt = String(body.prompt ?? '').trim();
    if (!prompt) {
      res.status(400).json({ error: 'prompt-required' });
      return;
    }
    const { job } = await imageJob({
      prompt,
      aspect: body.aspect ? String(body.aspect) : '1:1',
      count: body.count ? Number(body.count) : 2,
      styleId: body.styleId ? String(body.styleId) : undefined,
      language: body.language ? asLanguage(body.language) : undefined,
    });
    res.status(202).json({ jobId: job.id });
  });

  router.post('/write', async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const topic = String(body.topic ?? '').trim();
    if (!topic) {
      res.status(400).json({ error: 'topic-required' });
      return;
    }
    const { job } = await writerJob({
      kind: (body.kind as 'script' | 'article' | 'social') ?? 'script',
      topic,
      language: body.language ? asLanguage(body.language) : undefined,
      mode: body.mode as Project['mode'],
      styleId: body.styleId ? String(body.styleId) : undefined,
      durationSeconds: body.durationSeconds ? Number(body.durationSeconds) : undefined,
    });
    res.status(202).json({ jobId: job.id });
  });

  // ------------------------------------------------------------------ agent
  router.get('/threads', (_req, res) => {
    res.json(listThreads());
  });

  router.post('/threads', async (req, res) => {
    const thread = await createThread({
      title: req.body?.title ? String(req.body.title) : undefined,
      projectId: req.body?.projectId ? String(req.body.projectId) : undefined,
    });
    res.status(201).json(thread);
  });

  router.get('/threads/:id', (req, res) => {
    const thread = getThread(req.params.id);
    if (!thread) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    res.json(thread);
  });

  router.post('/threads/:id/messages', async (req, res) => {
    const content = String(req.body?.content ?? '').trim();
    if (!content) {
      res.status(400).json({ error: 'content-required' });
      return;
    }
    const result = await sendMessage(req.params.id, content, {
      language: req.body?.language ? asLanguage(req.body.language) : undefined,
    });
    if (!result.thread) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    res.json({ thread: result.thread, approvals: result.approvals });
  });

  router.get('/approvals', (_req, res) => {
    res.json(store.data().approvals);
  });

  router.post('/approvals/:id/decide', async (req, res) => {
    const decision = req.body?.decision === 'reject' ? 'reject' : 'approve';
    const result = await decideApproval(req.params.id, decision);
    if (!result.approval) {
      res.status(404).json({ error: 'not-found' });
      return;
    }
    res.json(result);
  });

  router.get('/runs', (_req, res) => {
    res.json(store.data().runs);
  });

  router.get('/events', eventsHandler);

  router.get('/system', async (_req, res) => {
    const db = store.data();
    res.json({
      uptimeSeconds: Math.round(process.uptime()),
      counts: {
        projects: db.projects.length,
        assets: db.assets.length,
        jobs: db.jobs.length,
        threads: db.threads.length,
        translations: db.translations.length,
      },
      providers: {
        llm: store.settings().providers.llm,
        image: store.settings().providers.image,
        tts: store.settings().providers.tts,
        asr: store.settings().providers.asr,
      },
      dataDir: ASSETS_DIR,
      time: nowIso(),
    });
  });

  router.post('/system/seed', async (_req, res) => {
    const db = store.data();
    if (db.projects.length > 0) {
      res.json({ seeded: false });
      return;
    }
    const { job, projectId } = await createProjectJob({
      prompt: 'Video brand kopi lokal: perjalanan pagi dari ladang sampai cangkir pertama, gaya sinematik hangat 30 detik.',
      language: 'id',
      targetLanguage: 'en',
      mode: 'cinematic',
      styleId: 'cinematic-golden',
      aspect: '16:9',
      durationSeconds: 30,
      voiceEnabled: true,
    });
    await appendLog(job.id, 'Proyek contoh dibuat dari seed awal.');
    await backgroundRender(projectId);
    res.json({ seeded: true, projectId, jobId: job.id });
  });

  return router;
}

/** Waits for the project storyboard then renders it, used by the seed helper. */
async function backgroundRender(projectId: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    const project = store.data().projects.find((item) => item.id === projectId);
    if (project && project.shots.length > 0) {
      await renderProjectJob({ projectId, translate: true, bilingual: true });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}
