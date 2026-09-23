import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = path.join(os.tmpdir(), `kreator-test-${Date.now()}`);
process.env.KREATOR_DATA_DIR = dataDir;

// Imported dynamically so the store picks up the temporary data directory.
const { store } = await import('../store.js');
const { createProjectJob, renderProjectJob, dubJob, translateJob, imageJob, writerJob } = await import('../creator/studio.js');
const { createThread, sendMessage, decideApproval } = await import('../creator/agent.js');
const { jobById } = await import('../services/jobs.js');

async function waitForJob(jobId: string, timeoutMs = 25_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = jobById(jobId);
    if (job && ['done', 'failed', 'cancelled'].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Job ${jobId} did not finish in time`);
}

beforeAll(async () => {
  await store.init();
});

afterAll(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('creator pipeline', () => {
  it('creates a project, renders it and exports subtitles', async () => {
    const { job, projectId } = await createProjectJob({
      prompt: 'perjalanan pagi dari ladang kopi sampai cangkir pertama',
      language: 'id',
      targetLanguage: 'en',
      mode: 'cinematic',
      styleId: 'cinematic-golden',
      aspect: '16:9',
      durationSeconds: 30,
      voiceEnabled: true,
    });

    const createJob = await waitForJob(job.id);
    expect(createJob.status).toBe('done');

    const project = store.data().projects.find((item) => item.id === projectId);
    expect(project).toBeTruthy();
    expect(project?.shots.length).toBeGreaterThanOrEqual(3);
    expect(project?.status).toBe('draft');
    expect(project?.versions.length).toBe(1);
    expect(project?.coverAssetId).toBeTruthy();

    const { job: renderJob } = await renderProjectJob({ projectId, translate: true, bilingual: true });
    const rendered = await waitForJob(renderJob.id);
    expect(rendered.status).toBe('done');

    const refreshed = store.data().projects.find((item) => item.id === projectId)!;
    expect(refreshed.status).toBe('ready');
    expect(refreshed.shots.every((shot) => Boolean(shot.imageAssetId))).toBe(true);
    expect(refreshed.versions.length).toBeGreaterThanOrEqual(2);

    const projectAssets = store.data().assets.filter((asset) => asset.meta?.projectId === projectId);
    const subtitle = projectAssets.find((asset) => asset.kind === 'subtitle');
    const storyboard = projectAssets.find((asset) => asset.kind === 'document' && asset.name.startsWith('storyboard'));
    const frames = projectAssets.filter((asset) => asset.kind === 'image');
    expect(subtitle).toBeTruthy();
    expect(storyboard).toBeTruthy();
    expect(frames.length).toBeGreaterThanOrEqual(refreshed.shots.length);

    const srt = await fs.readFile(subtitle!.path, 'utf8');
    expect(srt).toMatch(/^1\n\d{2}:\d{2}:\d{2},\d{3} --> /);
    expect(srt.split('\n\n').length).toBeGreaterThan(2);

    const markdown = await fs.readFile(storyboard!.path, 'utf8');
    expect(markdown).toContain('# ');
    expect(markdown).toContain('Image prompt');
  }, 60_000);

  it('runs the dubbing job and produces a script plus timing data', async () => {
    const project = store.data().projects[0]!;
    const { job } = await dubJob({ projectId: project.id, language: 'en', presetId: 'warm-narrator' });
    const finished = await waitForJob(job.id);
    expect(finished.status).toBe('done');
    const result = finished.result as { scriptAssetId: string; timingAssetId: string; clientSideTts: boolean };
    expect(result.scriptAssetId).toBeTruthy();
    expect(result.clientSideTts).toBe(true);
    const timing = JSON.parse(await fs.readFile(store.data().assets.find((asset) => asset.id === result.timingAssetId)!.path, 'utf8'));
    expect(timing.timing.length).toBeGreaterThan(0);
    expect(timing.language).toBe('en');
  }, 40_000);

  it('translates raw text into bilingual cues', async () => {
    const { job } = await translateJob({
      text: 'Halo semuanya, hari ini kita membahas cara menjaga konsistensi. Semua dimulai dari satu momen sederhana.',
      sourceName: 'catatan.md',
      sourceLanguage: 'id',
      targetLanguage: 'en',
      bilingual: true,
      totalSeconds: 20,
    });
    const finished = await waitForJob(job.id);
    expect(finished.status).toBe('done');
    const doc = store.data().translations[0]!;
    expect(doc.cues.length).toBeGreaterThan(0);
    expect(doc.cues[0]!.translation).toBeTruthy();
    expect(doc.targetLanguage).toBe('en');
  }, 40_000);

  it('generates images and written drafts', async () => {
    const imageTask = await imageJob({ prompt: 'key art kopi lokal', aspect: '16:9', count: 2, language: 'id' });
    const imageFinished = await waitForJob(imageTask.job.id);
    expect(imageFinished.status).toBe('done');
    expect((imageFinished.result as { assetIds: string[] }).assetIds).toHaveLength(2);

    const writeTask = await writerJob({ kind: 'script', topic: 'konsistensi produksi konten', language: 'id', durationSeconds: 30 });
    const writeFinished = await waitForJob(writeTask.job.id);
    expect(writeFinished.status).toBe('done');
    const content = (writeFinished.result as { content: string }).content;
    expect(content).toContain('# Skrip Short Video');
  }, 40_000);
});

describe('agent plan approval', () => {
  it('plans work and materialises it after approval', async () => {
    const thread = await createThread({});
    expect(thread.messages.length).toBe(1);

    const { thread: withMessages, approvals } = await sendMessage(thread.id, 'Buat video 30 detik tentang kopi lokal untuk feed vertikal', { language: 'id' });
    expect(withMessages?.messages.length).toBe(3);
    expect(approvals).toHaveLength(1);
    const actions = approvals[0]!.payload.actions as { kind: string }[];
    expect(actions.map((action) => action.kind)).toEqual(['project', 'render']);

    const decided = await decideApproval(approvals[0]!.id, 'approve');
    expect(decided.approval?.status).toBe('approved');
    expect(decided.outcomes?.some((outcome) => outcome.kind === 'project' && outcome.status === 'done')).toBe(true);
    expect(decided.outcomes?.some((outcome) => outcome.kind === 'render' && outcome.status === 'done')).toBe(true);

    // The tool message is appended to the conversation after the plan runs.
    const stored = store.data().threads.find((item) => item.id === thread.id)!;
    expect(stored.messages.some((message) => message.role === 'tool')).toBe(true);
    expect(store.data().runs.length).toBeGreaterThan(0);
  }, 90_000);

  it('rejects a plan without executing it', async () => {
    const thread = await createThread({ title: 'Rencana ditolak' });
    const { approvals } = await sendMessage(thread.id, 'Tulis artikel tentang kebiasaan pagi', { language: 'id' });
    const projectsBefore = store.data().projects.length;
    const decided = await decideApproval(approvals[0]!.id, 'reject');
    expect(decided.approval?.status).toBe('rejected');
    expect(decided.outcomes).toBeUndefined();
    expect(store.data().projects.length).toBe(projectsBefore);
  }, 40_000);
});
