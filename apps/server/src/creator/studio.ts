import { store } from '../store.js';
import { chatJson } from '../providers/llm.js';
import { generateImages } from '../providers/image.js';
import { synthesizeSpeech } from '../providers/speech.js';
import { saveAsset, saveTextAsset } from '../services/assets.js';
import { appendLog, createJob, patchJob, runJobInBackground, type JobSeed } from '../services/jobs.js';
import { clamp, newId, nowIso, truncate } from '../util.js';
import type {
  Job,
  Language,
  LocaleText,
  Project,
  ProjectVersion,
  Shot,
  StudioMode,
  SubtitleCue,
  TranslationDoc,
} from '../types.js';
import { hookById, styleById, templateById, VOICE_PRESETS } from './catalog.js';
import { generateStoryboard, MODE_LABEL, narrationForLanguage, type StoryboardShot } from './demo.js';
import { buildMarkdownTranscript, buildSrt, DEFAULT_GLOSSARY, splitIntoCues, translateCues } from './translate.js';
import type { Composition } from './scene.js';

export interface CreateProjectInput {
  prompt: string;
  mode?: StudioMode;
  styleId?: string;
  aspect?: string;
  durationSeconds?: number;
  language?: Language;
  targetLanguage?: Language;
  hookId?: string;
  templateId?: string;
  roleId?: string;
  propId?: string;
  title?: string;
  voiceEnabled?: boolean;
  shotCount?: number;
}

interface LlmStoryboard {
  title?: string;
  summary?: { id?: string; en?: string } | string;
  shots?: {
    title?: string;
    description?: string;
    imagePrompt?: string;
    caption?: string;
    narration?: string;
    durationSeconds?: number;
    composition?: string;
  }[];
}

function titleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Proyek Baru';
  const words = clean.split(' ').slice(0, 6).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1, 60);
}

/** Build shot objects from a model response, keeping the demo engine as fallback. */
function shotsFromLlm(data: LlmStoryboard, language: Language, fallback: StoryboardShot[]): StoryboardShot[] {
  if (!Array.isArray(data.shots) || data.shots.length === 0) return fallback;
  const compositions: Composition[] = ['landscape', 'city', 'portrait', 'product', 'interior', 'abstract', 'macro'];
  return data.shots.slice(0, 6).map((shot, index) => {
    const template = fallback[index % fallback.length]!;
    const text = (value?: string) => ({
      id: value ?? template.title.id,
      en: value ?? template.title.en,
    } as LocaleText);
    return {
      beatId: template.beatId,
      index: index + 1,
      title: shot.title ? text(shot.title) : template.title,
      description: shot.description
        ? { id: shot.description, en: shot.description }
        : template.description,
      imagePrompt: shot.imagePrompt ?? template.imagePrompt,
      caption: shot.caption ? { id: shot.caption, en: shot.caption } : template.caption,
      narration: shot.narration ? { id: shot.narration, en: shot.narration } : template.narration,
      durationSeconds: clamp(Number(shot.durationSeconds) || template.durationSeconds, 2, 20),
      motion: template.motion,
      composition: compositions.includes(shot.composition as Composition) ? (shot.composition as Composition) : template.composition,
    };
  });
}

export async function createProjectJob(input: CreateProjectInput): Promise<{ job: Job; projectId: string }> {
  const language: Language = input.language ?? store.settings().language;
  const hook = input.hookId ? hookById(input.hookId) : undefined;
  const template = input.templateId ? templateById(input.templateId) : undefined;
  const mode: StudioMode = input.mode ?? hook?.mode ?? (template?.kind === 'image' ? 'commercial' : 'cinematic');
  const styleId = input.styleId ?? hook?.styleId ?? template?.styleId ?? 'cinematic-golden';
  const style = styleById(styleId);
  const aspect = input.aspect ?? hook?.aspect ?? template?.aspect ?? '16:9';
  const durationSeconds = clamp(input.durationSeconds ?? hook?.durationSeconds ?? template?.durationSeconds ?? 30, 5, 120);
  const targetLanguage: Language = input.targetLanguage ?? (language === 'id' ? 'en' : 'id');

  const projectId = newId('proj');
  const seed = {
    id: projectId,
    title: input.title ?? titleFromPrompt(input.prompt),
    prompt: input.prompt,
    mode,
    hookId: input.hookId,
    templateId: input.templateId,
    styleId,
    aspect,
    durationSeconds,
    language,
    targetLanguage,
    status: 'running' as const,
    summary: { id: 'Menyusun brief...', en: 'Drafting the brief...' } as LocaleText,
    shots: [] as Shot[],
    versions: [] as ProjectVersion[],
    voiceEnabled: input.voiceEnabled ?? true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await store.update((db) => {
    db.projects.unshift(seed as Project);
    return seed;
  });

  const seedJob: JobSeed = {
    kind: 'studio-create',
    title: `Studio: ${seed.title}`,
    projectId,
    steps: [
      { id: 'brief', label: { id: 'Menganalisis brief', en: 'Analyse the brief' } },
      { id: 'storyboard', label: { id: 'Menyusun storyboard', en: 'Draft the storyboard' } },
      { id: 'voice', label: { id: 'Menyusun naskah suara', en: 'Prepare voice script' } },
      { id: 'cover', label: { id: 'Membuat cover', en: 'Generate the cover' } },
    ],
  };
  const job = await createJob(seedJob);

  runJobInBackground(job, async ({ step, log, wait }) => {
    await step('brief', 'running');
    await log(`Brief diterima (${mode}, ${aspect}, ${durationSeconds}s).`);
    await wait(250);
    await step('brief', 'done', truncate(input.prompt, 90));

    await step('storyboard', 'running');
    const fallback = generateStoryboard({
      prompt: input.prompt,
      mode,
      styleId,
      aspect,
      durationSeconds,
      language,
      roleId: input.roleId,
      propId: input.propId,
      shotCount: input.shotCount,
    });

    let shots: StoryboardShot[] = fallback.shots;
    let summary = fallback.summary;
    let source: 'provider' | 'demo' = 'demo';

    const llm = await chatJson<LlmStoryboard>([
      {
        role: 'system',
        content: [
          'You are a video director planning a short video storyboard.',
          `Reply in ${language === 'id' ? 'Indonesian' : 'English'}.`,
          'Return strict JSON: {"title":"...","summary":"...","shots":[{"title":"...","description":"camera direction","imagePrompt":"english prompt for an image model","caption":"subtitle line","narration":"voice over line","durationSeconds":6,"composition":"landscape|city|portrait|product|interior|abstract|macro"}]}',
          `Use ${clamp(Math.round(durationSeconds / 5.5), 3, 6)} shots and make the total duration about ${durationSeconds} seconds.`,
          `Visual style: ${style.prompt}.`,
        ].join('\n'),
      },
      { role: 'user', content: input.prompt },
    ]);

    if (llm?.data) {
      source = 'provider';
      shots = shotsFromLlm(llm.data, language, fallback.shots);
      const rawSummary = llm.data.summary;
      if (typeof rawSummary === 'string') summary = { id: rawSummary, en: rawSummary };
      else if (rawSummary) summary = { id: rawSummary.id ?? fallback.summary.id, en: rawSummary.en ?? fallback.summary.en };
      await log(`Storyboard disusun oleh ${llm.model ?? 'model'}.`);
    } else {
      await log('Storyboard disusun mesin demo lokal (deterministik).');
    }

    const materialised: Shot[] = shots.map((shot) => ({ ...shot, id: newId('shot') }));

    await wait(300);
    await step('storyboard', 'done', `${materialised.length} adegan`);
    await step('voice', 'running');
    const narrationLines = materialised
      .map((shot, index) => `${index + 1}. ${narrationForLanguage(shot, language)}`)
      .filter((line) => line.replace(/^\d+\.\s*/, '').trim().length > 0)
      .join('\n');
    const voiceScript = await saveTextAsset(`voiceover-${projectId}.txt`, narrationLines, 'document', 'render', { projectId });
    await wait(200);
    await step('voice', 'done', `${materialised.length} baris narasi`);
    await step('cover', 'running');
    const cover = await generateImages({
      prompt: `cover key art for ${fallback.topic}`,
      aspect: '16:9',
      style,
      seed: `${projectId}-cover`,
      count: 1,
      language,
      kicker: MODE_LABEL[mode][language],
    });
    const coverAsset = await saveAsset({
      name: cover.images[0]!.name,
      mimeType: cover.images[0]!.mimeType,
      buffer: cover.images[0]!.buffer,
      kind: 'image',
      origin: cover.provider === 'openai' ? 'provider' : 'demo',
      meta: { projectId, role: 'cover', prompt: `cover key art for ${fallback.topic}` },
    });
    await step('cover', 'done');

    await store.update((db) => {
      const project = db.projects.find((item) => item.id === projectId);
      if (!project) return undefined;
      project.shots = materialised;
      project.summary = summary;
      project.status = 'draft';
      project.coverAssetId = coverAsset.id;
      project.voiceAssetId = voiceScript.id;
      project.updatedAt = nowIso();
      project.versions = [
        {
          id: newId('ver'),
          label: { id: 'Versi 1 · storyboard awal', en: 'Version 1 · first storyboard' },
          createdAt: nowIso(),
          snapshot: { shots: materialised, styleId, aspect, durationSeconds },
        },
        ...project.versions,
      ];
      return project;
    });

    await log(`Proyek siap. ${materialised.length} adegan menunggu render.`);
    return { projectId, shots: materialised.length, storyboardSource: source, voiceAssetId: voiceScript.id, coverAssetId: coverAsset.id };
  });

  return { job, projectId };
}

export interface RenderInput {
  projectId: string;
  translate?: boolean;
  bilingual?: boolean;
}

export async function renderProjectJob(input: RenderInput) {
  const project = store.data().projects.find((item) => item.id === input.projectId);
  if (!project) throw new Error('Proyek tidak ditemukan / Project not found');

  const style = styleById(project.styleId);
  const seedJob: JobSeed = {
    kind: 'studio-render',
    title: `Render: ${project.title}`,
    projectId: project.id,
    steps: [
      { id: 'prepare', label: { id: 'Menyiapkan aset', en: 'Prepare assets' } },
      { id: 'frames', label: { id: 'Merender adegan', en: 'Render shots' } },
      { id: 'subtitle', label: { id: 'Menyusun subtitle', en: 'Build subtitles' } },
      { id: 'export', label: { id: 'Mengekspor berkas', en: 'Export files' } },
    ],
  };
  const job = await createJob(seedJob);

  runJobInBackground(job, async ({ step, log, wait }) => {
    await step('prepare', 'running');
    await log(`Gaya ${style.name.id} · ${project.aspect} · ${project.durationSeconds}s`);
    await store.update((db) => {
      const target = db.projects.find((item) => item.id === project.id);
      if (target) target.status = 'running';
      return target;
    });
    await wait(150);
    await step('prepare', 'done', `${project.shots.length} adegan`);

    await step('frames', 'running');
    const rendered: { shotId: string; assetId: string }[] = [];
    for (const [index, shot] of project.shots.entries()) {
      const images = await generateImages({
        prompt: shot.imagePrompt,
        aspect: project.aspect,
        style,
        seed: `${project.id}-shot-${index + 1}`,
        count: 1,
        language: project.language,
        composition: (shot as Shot & { composition?: Composition }).composition,
        caption: shot.caption[project.language] ?? shot.caption.en,
        kicker: `Shot ${index + 1}`,
        chapter: index + 1,
      });
      const asset = await saveAsset({
        name: images.images[0]!.name,
        mimeType: images.images[0]!.mimeType,
        buffer: images.images[0]!.buffer,
        kind: 'image',
        origin: images.provider === 'openai' ? 'provider' : 'render',
        meta: { projectId: project.id, shotId: shot.id, prompt: shot.imagePrompt, index: index + 1 },
      });
      rendered.push({ shotId: shot.id, assetId: asset.id });
      await log(`Adegan ${index + 1}/${project.shots.length} selesai (${asset.name}).`);
      await store.update((db) => {
        const target = db.projects.find((item) => item.id === project.id);
        const targetShot = target?.shots.find((item) => item.id === shot.id);
        if (targetShot) targetShot.imageAssetId = asset.id;
        return target;
      });
      await wait(180);
    }
    await step('frames', 'done', `${rendered.length} berkas gambar`);

    await step('subtitle', 'running');
    const cueSource = project.shots
      .map((shot) => shot.caption[project.language] ?? shot.caption.en)
      .filter(Boolean)
      .join(' ');
    let cues: SubtitleCue[] = splitIntoCues(cueSource, { totalSeconds: project.durationSeconds, language: project.language });
    let translationNote = 'Subtitle dibuat pada bahasa sumber.';
    if (input.translate !== false && project.targetLanguage !== project.language) {
      const result = await translateCues(cues, project.language, project.targetLanguage, DEFAULT_GLOSSARY);
      cues = result.cues;
      translationNote = result.note ?? translationNote;
      await log(`Terjemahan ${project.language} → ${project.targetLanguage}: ${result.source}.`);
    }
    const bilingual = input.bilingual ?? true;
    const srt = buildSrt(cues, { bilingual });
    const srtAsset = await saveTextAsset(`subtitle-${project.id}${bilingual ? '-bilingual' : ''}.srt`, srt, 'subtitle', 'render', {
      projectId: project.id,
      language: project.language,
      targetLanguage: project.targetLanguage,
    });
    await step('subtitle', 'done', `${cues.length} baris · ${translationNote}`);

    await step('export', 'running');
    const storyboardMd = [
      `# ${project.title}`,
      '',
      `**Brief:** ${project.prompt}`,
      `**Gaya:** ${style.name.id} · **Rasio:** ${project.aspect} · **Durasi:** ${project.durationSeconds}s`,
      `**Mode:** ${MODE_LABEL[project.mode].id}`,
      '',
      '## Storyboard',
      ...project.shots.flatMap((shot) => [
        `### ${shot.index}. ${shot.title[project.language] ?? shot.title.en} — ${shot.durationSeconds}s`,
        `- Kamera: ${shot.description[project.language] ?? shot.description.en}`,
        `- Narasi: ${narrationForLanguage(shot, project.language) || '—'}`,
        `- Subtitle: ${shot.caption[project.language] ?? shot.caption.en}`,
        `- Image prompt: \`${shot.imagePrompt}\``,
        '',
      ]),
      '## Subtitle (bilingual)',
      '',
      '```srt',
      srt.trim(),
      '```',
      '',
    ].join('\n');
    const storyboardAsset = await saveTextAsset(`storyboard-${project.id}.md`, storyboardMd, 'document', 'render', { projectId: project.id });
    const manifest = {
      project: {
        id: project.id,
        title: project.title,
        prompt: project.prompt,
        mode: project.mode,
        style: style.name,
        aspect: project.aspect,
        durationSeconds: project.durationSeconds,
        language: project.language,
        targetLanguage: project.targetLanguage,
      },
      shots: project.shots.map((shot) => ({
        index: shot.index,
        title: shot.title,
        durationSeconds: shot.durationSeconds,
        motion: shot.motion,
        imageAssetId: shot.imageAssetId,
        imagePrompt: shot.imagePrompt,
        caption: shot.caption,
        narration: shot.narration,
      })),
      subtitles: { assetId: srtAsset.id, bilingual, cues },
      assets: { storyboardMarkdown: storyboardAsset.id, cover: project.coverAssetId ?? null },
      generatedAt: nowIso(),
    };
    const manifestAsset = await saveTextAsset(`manifest-${project.id}.json`, JSON.stringify(manifest, null, 2), 'document', 'render', {
      projectId: project.id,
    });
    await step('export', 'done', 'SRT · storyboard.md · manifest.json');

    await store.update((db) => {
      const target = db.projects.find((item) => item.id === project.id);
      if (!target) return undefined;
      target.status = 'ready';
      target.updatedAt = nowIso();
      target.versions = [
        {
          id: newId('ver'),
          label: { id: `Versi ${target.versions.length + 1} · render final`, en: `Version ${target.versions.length + 1} · final render` },
          createdAt: nowIso(),
          snapshot: { shots: target.shots, styleId: target.styleId, aspect: target.aspect, durationSeconds: target.durationSeconds },
        },
        ...target.versions,
      ].slice(0, 8);
      return target;
    });

    await log('Render selesai. Semua berkas tersimpan di perpustakaan aset.');
    return {
      projectId: project.id,
      frames: rendered,
      subtitleAssetId: srtAsset.id,
      storyboardAssetId: storyboardAsset.id,
      manifestAssetId: manifestAsset.id,
    };
  });

  return { job };
}

export interface TranslateInput {
  text?: string;
  assetId?: string;
  sourceName?: string;
  sourceLanguage?: Language | 'auto';
  targetLanguage: Language;
  bilingual?: boolean;
  totalSeconds?: number;
}

export async function translateJob(input: TranslateInput) {
  const project = store.data();
  const asset = input.assetId ? project.assets.find((item) => item.id === input.assetId) : undefined;
  let text = input.text ?? '';
  if (!text && asset) {
    const { promises: fs } = await import('node:fs');
    text = await fs.readFile(asset.path, 'utf8');
  }
  if (!text.trim()) throw new Error('Tidak ada teks untuk diterjemahkan / No text to translate');

  const sourceLanguage: Language | 'auto' = input.sourceLanguage ?? 'auto';
  const detected: Language = sourceLanguage === 'auto'
    ? (/[a-z]/.test(text) && /\b(the|and|with|this|that|you|for)\b/i.test(text) ? 'en' : 'id')
    : sourceLanguage;

  const job = await createJob({
    kind: 'translate',
    title: `Terjemahan → ${input.targetLanguage === 'id' ? 'Indonesia' : 'English'}`,
    steps: [
      { id: 'segment', label: { id: 'Segmentasi cue', en: 'Segment into cues' } },
      { id: 'translate', label: { id: 'Terjemahkan dengan konteks', en: 'Translate with context' } },
      { id: 'export', label: { id: 'Ekspor SRT & transkrip', en: 'Export SRT & transcript' } },
    ],
  });

  runJobInBackground(job, async ({ step, log, wait }) => {
    await step('segment', 'running');
    const cues = splitIntoCues(text, {
      totalSeconds: input.totalSeconds ?? Math.max(20, text.length / 14),
      language: detected,
    });
    await wait(200);
    await step('segment', 'done', `${cues.length} cue · sumber terdeteksi: ${detected}`);

    await step('translate', 'running');
    const result = await translateCues(cues, detected, input.targetLanguage, DEFAULT_GLOSSARY);
    await log(result.note ?? 'Terjemahan selesai.');
    await step('translate', 'done', result.source === 'provider' ? 'model' : 'mesin frasa lokal');

    await step('export', 'running');
    const bilingual = input.bilingual ?? true;
    const srt = buildSrt(result.cues, { bilingual });
    const sourceName = input.sourceName ?? asset?.name ?? 'teks';
    const baseName = sourceName.replace(/\.[^.]+$/, '');
    const srtAsset = await saveTextAsset(`${baseName}-${input.targetLanguage}.srt`, srt, 'subtitle', 'render', {
      language: detected,
      targetLanguage: input.targetLanguage,
    });
    const transcriptAsset = await saveTextAsset(
      `${baseName}-transcript.md`,
      buildMarkdownTranscript(result.cues, { bilingual, title: `Transkrip · ${sourceName}` }),
      'document',
      'render',
      { language: detected, targetLanguage: input.targetLanguage },
    );

    const doc: TranslationDoc = {
      id: newId('tr'),
      sourceName,
      sourceAssetId: asset?.id,
      sourceLanguage: detected,
      targetLanguage: input.targetLanguage,
      cues: result.cues,
      mode: result.source,
      createdAt: nowIso(),
      jobId: job.id,
    };
    await store.update((db) => {
      db.translations.unshift(doc);
      db.translations = db.translations.slice(0, 60);
      db.runs.unshift({
        id: newId('run'),
        kind: 'translate',
        label: `Terjemahan ${sourceName}`,
        status: 'done',
        createdAt: nowIso(),
        detail: `${result.cues.length} cue → ${input.targetLanguage}`,
      });
      return doc;
    });
    await step('export', 'done', 'SRT + transkrip Markdown');

    return { translationId: doc.id, srtAssetId: srtAsset.id, transcriptAssetId: transcriptAsset.id, cues: result.cues.length };
  });

  return { job };
}

export interface DubInput {
  projectId?: string;
  translationId?: string;
  language?: Language;
  presetId?: string;
}

export async function dubJob(input: DubInput) {
  const project = input.projectId ? store.data().projects.find((item) => item.id === input.projectId) : undefined;
  const translation = input.translationId ? store.data().translations.find((item) => item.id === input.translationId) : undefined;

  const language = input.language ?? project?.targetLanguage ?? translation?.targetLanguage ?? 'en';
  const preset = VOICE_PRESETS.find((item) => item.id === input.presetId) ?? VOICE_PRESETS[0]!;
  const lines = project
    ? project.shots.map((shot) => shot.narration[language] ?? shot.narration.en ?? shot.narration.id).filter(Boolean)
    : (translation?.cues ?? []).map((cue) => cue.translation ?? cue.text);

  if (lines.length === 0) throw new Error('Tidak ada naskah untuk dubbing / No script available for dubbing');

  const job = await createJob({
    kind: 'dub',
    title: `Dubbing: ${project?.title ?? translation?.sourceName ?? 'naskah'}`,
    projectId: project?.id,
    steps: [
      { id: 'script', label: { id: 'Menyusun naskah dubbing', en: 'Prepare dubbing script' } },
      { id: 'voice', label: { id: 'Render suara', en: 'Render speech' } },
      { id: 'sync', label: { id: 'Penyelarasan waktu', en: 'Timing alignment' } },
    ],
  });

  runJobInBackground(job, async ({ step, log, wait }) => {
    await step('script', 'running');
    const script = lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
    const scriptAsset = await saveTextAsset(
      `dubbing-${project?.id ?? translation?.id ?? job.id}-${language}.txt`,
      script,
      'document',
      'render',
      { language, preset: preset.id },
    );
    await wait(200);
    await step('script', 'done', `${lines.length} baris · ${preset.label.id}`);

    await step('voice', 'running');
    const speech = await synthesizeSpeech({ text: lines.join(' '), language, presetId: preset.id });
    await log(speech.note);
    let audioAssetId: string | null = null;
    if (speech.buffer) {
      const asset = await saveAsset({
        name: `voiceover-${job.id}.${speech.mimeType.includes('mpeg') ? 'mp3' : 'wav'}`,
        mimeType: speech.mimeType,
        buffer: speech.buffer,
        kind: 'audio',
        origin: speech.provider === 'demo' ? 'demo' : 'provider',
        meta: { language, preset: preset.id, lines: lines.length },
      });
      audioAssetId = asset.id;
    }
    await step('voice', 'done', speech.clientSide ? 'Dibacakan di browser' : `Berkas audio siap`);

    await step('sync', 'running');
    const perLine = Math.max(1.6, (project?.durationSeconds ?? 30) / Math.max(1, lines.length));
    const timing = lines.map((line, index) => ({
      index: index + 1,
      text: line,
      start: Number((index * perLine).toFixed(2)),
      end: Number(((index + 1) * perLine - 0.2).toFixed(2)),
    }));
    const timingAsset = await saveTextAsset(
      `dubbing-timing-${job.id}.json`,
      JSON.stringify({ language, preset: preset.id, timing }, null, 2),
      'document',
      'render',
      { language },
    );
    await wait(150);
    await step('sync', 'done', `${timing.length} blok waktu`);

    if (project) {
      await store.update((db) => {
        const target = db.projects.find((item) => item.id === project.id);
        if (target) {
          target.voiceEnabled = true;
          target.updatedAt = nowIso();
        }
        return target;
      });
    }

    return {
      scriptAssetId: scriptAsset.id,
      audioAssetId,
      timingAssetId: timingAsset.id,
      clientSideTts: Boolean(speech.clientSide),
      lines,
      language,
      presetId: preset.id,
    };
  });

  return { job };
}

export interface ImageRequestInput {
  prompt: string;
  aspect?: string;
  count?: number;
  styleId?: string;
  language?: Language;
}

export async function imageJob(input: ImageRequestInput) {
  const language = input.language ?? store.settings().language;
  const style = styleById(input.styleId ?? 'cinematic-golden');
  const job = await createJob({
    kind: 'image',
    title: `Gambar: ${truncate(input.prompt, 48)}`,
    steps: [
      { id: 'prompt', label: { id: 'Menyusun prompt', en: 'Compose prompt' } },
      { id: 'generate', label: { id: 'Membuat gambar', en: 'Generate images' } },
      { id: 'store', label: { id: 'Menyimpan ke pustaka', en: 'Save to library' } },
    ],
  });

  runJobInBackground(job, async ({ step, log, wait }) => {
    await step('prompt', 'running');
    const prompt = `${input.prompt}. ${style.prompt}.`;
    await wait(200);
    await step('prompt', 'done', truncate(prompt, 80));
    await step('generate', 'running');
    const result = await generateImages({
      prompt: input.prompt,
      aspect: input.aspect ?? '1:1',
      style,
      seed: `${job.id}-image`,
      count: input.count ?? 2,
      language,
    });
    await log(result.note);
    await step('generate', 'done', `${result.images.length} gambar (${result.provider})`);
    await step('store', 'running');
    const assets = [];
    for (const image of result.images) {
      assets.push(
        await saveAsset({
          name: image.name,
          mimeType: image.mimeType,
          buffer: image.buffer,
          kind: 'image',
          origin: image.provider === 'openai' ? 'provider' : 'demo',
          meta: { prompt: input.prompt, provider: image.provider, style: style.id },
        }),
      );
    }
    await step('store', 'done', `${assets.length} aset`);
    return { assetIds: assets.map((asset) => asset.id), provider: result.provider, note: result.note };
  });

  return { job };
}

export interface WriterInput {
  kind: 'script' | 'article' | 'social';
  topic: string;
  language?: Language;
  mode?: StudioMode;
  styleId?: string;
  durationSeconds?: number;
}

export async function writerJob(input: WriterInput) {
  const language = input.language ?? store.settings().language;
  const style = styleById(input.styleId ?? 'cinematic-golden');
  const mode = input.mode ?? 'social';
  const job = await createJob({
    kind: 'write',
    title: `${input.kind === 'script' ? 'Skrip' : input.kind === 'article' ? 'Artikel' : 'Post'}: ${truncate(input.topic, 40)}`,
    steps: [
      { id: 'outline', label: { id: 'Menyusun kerangka', en: 'Outline' } },
      { id: 'draft', label: { id: 'Menulis draf', en: 'Write draft' } },
      { id: 'save', label: { id: 'Menyimpan dokumen', en: 'Save document' } },
    ],
  });

  runJobInBackground(job, async ({ step, log, wait }) => {
    await step('outline', 'running');
    await wait(180);
    await step('outline', 'done', input.kind);
    await step('draft', 'running');

    const { demoArticle, demoScript, demoSocialPost } = await import('./demo.js');
    let content = '';
    const llm = await chatJson<{ markdown?: string }>([
      {
        role: 'system',
        content: [
          `You are an expert content writer working in ${language === 'id' ? 'Indonesian' : 'English'}.`,
          input.kind === 'script'
            ? `Write a short video script with hook, beats, subtitles and image prompts for a ${input.durationSeconds ?? 30} second ${mode} video.`
            : input.kind === 'article'
              ? 'Write a practical article in markdown with headings, concrete steps and a conclusion.'
              : 'Write a short social post with a hook, three body points, a CTA and hashtags.',
          'Return strict JSON: {"markdown":"..."}',
        ].join('\n'),
      },
      { role: 'user', content: input.topic },
    ]);
    if (llm?.data?.markdown) {
      content = llm.data.markdown;
      await log(`Draf ditulis oleh ${llm.model ?? 'model'}.`);
    } else {
      content = input.kind === 'script'
        ? demoScript({ topic: input.topic, durationSeconds: input.durationSeconds ?? 30, language, style, mode })
        : input.kind === 'article'
          ? demoArticle({ topic: input.topic, language })
          : demoSocialPost({ topic: input.topic, language });
      await log('Draf ditulis mesin demo lokal.');
    }
    await step('draft', 'done', `${content.length} karakter`);
    await step('save', 'running');
    const asset = await saveTextAsset(
      `${input.kind}-${truncate(input.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 32)}.md`,
      content,
      'document',
      'render',
      { kind: input.kind },
    );
    await step('save', 'done', asset.name);
    return { assetId: asset.id, content };
  });

  return { job };
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<Project | undefined> {
  return store.update((db) => {
    const project = db.projects.find((item) => item.id === id);
    if (!project) return undefined;
    Object.assign(project, patch, { updatedAt: nowIso() });
    return project;
  });
}

export async function deleteProject(id: string): Promise<boolean> {
  return store.update((db) => {
    const before = db.projects.length;
    db.projects = db.projects.filter((item) => item.id !== id);
    return db.projects.length !== before;
  });
}

export async function duplicateProject(id: string): Promise<Project | undefined> {
  const source = store.data().projects.find((item) => item.id === id);
  if (!source) return undefined;
  const clone: Project = {
    ...source,
    id: newId('proj'),
    title: `${source.title} (copy)`,
    status: 'draft',
    shots: source.shots.map((shot) => ({ ...shot, id: newId('shot') })),
    versions: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await store.update((db) => {
    db.projects.unshift(clone);
    return clone;
  });
  return clone;
}
