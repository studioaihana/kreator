import { store } from '../store.js';
import { newId, nowIso } from '../util.js';
import type { Job, JobStep, LocaleText } from '../types.js';

export type JobSeed = {
  kind: Job['kind'];
  title: string;
  projectId?: string;
  steps: { id: string; label: LocaleText }[];
};

const cancellations = new Set<string>();

export async function createJob(seed: JobSeed): Promise<Job> {
  const job: Job = {
    id: newId('job'),
    kind: seed.kind,
    status: 'queued',
    title: seed.title,
    projectId: seed.projectId,
    steps: seed.steps.map((step) => ({ ...step, status: 'pending' })),
    log: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await store.update((db) => {
    db.jobs.unshift(job);
    db.jobs = db.jobs.slice(0, 200);
    return job;
  });
  return job;
}

export async function patchJob(id: string, patch: Partial<Job>): Promise<Job | undefined> {
  let updated: Job | undefined;
  await store.update((db) => {
    const job = db.jobs.find((item) => item.id === id);
    if (!job) return undefined;
    Object.assign(job, patch, { updatedAt: nowIso() });
    updated = job;
    return job;
  });
  return updated;
}

export async function stepUpdate(
  id: string,
  stepId: string,
  status: JobStep['status'],
  detail?: string,
): Promise<void> {
  await store.update((db) => {
    const job = db.jobs.find((item) => item.id === id);
    if (!job) return undefined;
    const step = job.steps.find((item) => item.id === stepId);
    if (step) {
      step.status = status;
      if (detail) step.detail = detail;
      if (status === 'running') step.startedAt = nowIso();
      if (status === 'done' || status === 'failed') step.finishedAt = nowIso();
    }
    job.updatedAt = nowIso();
    return job;
  });
}

export async function appendLog(id: string, line: string): Promise<void> {
  await store.update((db) => {
    const job = db.jobs.find((item) => item.id === id);
    if (!job) return undefined;
    job.log = [...job.log, `[${new Date().toISOString().slice(11, 19)}] ${line}`].slice(-120);
    job.updatedAt = nowIso();
    return job;
  });
}

export function cancelJob(id: string): void {
  cancellations.add(id);
}

export function isCancelled(id: string): boolean {
  return cancellations.has(id);
}

export function clearCancellation(id: string): void {
  cancellations.delete(id);
}

export function jobById(id: string): Job | undefined {
  return store.data().jobs.find((job) => job.id === id);
}

/**
 * Runs a job in the background: marks it running, executes the callback and
 * persists the terminal state. Failures never crash the server.
 */
export function runJobInBackground(
  job: Job,
  executor: (context: {
    job: Job;
    step: (stepId: string, status: JobStep['status'], detail?: string) => Promise<void>;
    log: (line: string) => Promise<void>;
    cancelled: () => boolean;
    wait: (ms: number) => Promise<void>;
  }) => Promise<Record<string, unknown> | void>,
): void {
  const context = {
    job,
    step: (stepId: string, status: JobStep['status'], detail?: string) => stepUpdate(job.id, stepId, status, detail),
    log: (line: string) => appendLog(job.id, line),
    cancelled: () => isCancelled(job.id),
    wait: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  };

  void (async () => {
    await patchJob(job.id, { status: 'running' });
    try {
      const result = await executor(context);
      if (isCancelled(job.id)) {
        await patchJob(job.id, { status: 'cancelled', error: 'Dibatalkan oleh pengguna.' });
        clearCancellation(job.id);
        return;
      }
      await patchJob(job.id, { status: 'done', result: result ?? undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown failure';
      await appendLog(job.id, `ERROR: ${message}`);
      await patchJob(job.id, { status: 'failed', error: message });
    } finally {
      clearCancellation(job.id);
    }
  })();
}
