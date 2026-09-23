import type { Request, Response } from 'express';
import { store } from '../store.js';

/**
 * Server-sent events stream so the UI shows live job progress.
 * Diffs the in-memory store instead of an event bus, which keeps every module
 * free of cross dependencies.
 */
export function eventsHandler(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const seenJobs = new Map<string, string>();
  const seenThreads = new Map<string, number>();
  const seenApprovals = new Map<string, string>();

  const snapshot = () => {
    const db = store.data();
    send('snapshot', {
      jobs: db.jobs.slice(0, 30),
      runs: db.runs.slice(0, 20),
      threads: db.threads.slice(0, 20).map((thread) => ({ id: thread.id, title: thread.title, updatedAt: thread.updatedAt, projectId: thread.projectId })),
      approvals: db.approvals.filter((approval) => approval.status === 'pending'),
    });
    for (const job of db.jobs) seenJobs.set(job.id, job.updatedAt);
    for (const thread of db.threads) seenThreads.set(thread.id, thread.messages.length);
    for (const approval of db.approvals) seenApprovals.set(approval.id, approval.status);
  };

  snapshot();

  const tick = () => {
    const db = store.data();
    for (const job of db.jobs) {
      if (seenJobs.get(job.id) !== job.updatedAt) {
        seenJobs.set(job.id, job.updatedAt);
        send('job.update', job);
      }
    }
    for (const thread of db.threads) {
      if (seenThreads.get(thread.id) !== thread.messages.length) {
        seenThreads.set(thread.id, thread.messages.length);
        send('thread.update', { id: thread.id, updatedAt: thread.updatedAt, messages: thread.messages.length, title: thread.title });
      }
    }
    for (const approval of db.approvals) {
      if (seenApprovals.get(approval.id) !== approval.status) {
        seenApprovals.set(approval.id, approval.status);
        send('approval.update', approval);
      }
    }
  };

  const interval = setInterval(tick, 800);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 20_000);

  req.on('close', () => {
    clearInterval(interval);
    clearInterval(heartbeat);
    res.end();
  });
}
