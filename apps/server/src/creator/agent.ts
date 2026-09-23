import { store } from '../store.js';
import { chatJson } from '../providers/llm.js';
import { createJob, jobById } from '../services/jobs.js';
import { newId, nowIso, truncate } from '../util.js';
import type { AgentMessage, AgentThread, Approval, Language, LocaleText, StudioMode } from '../types.js';
import { AGENT_SKILLS, styleById } from './catalog.js';
import { cleanTopic, demoAgentReply } from './demo.js';
import { createProjectJob, dubJob, imageJob, renderProjectJob, translateJob, writerJob } from './studio.js';

export interface PlannedAction {
  kind: 'project' | 'render' | 'translate' | 'dub' | 'image' | 'write';
  label: LocaleText;
  payload: Record<string, unknown>;
}

interface LlmPlan {
  reply?: string;
  actions?: { kind?: string; prompt?: string }[];
}

const ACTION_LABEL: Record<PlannedAction['kind'], LocaleText> = {
  project: { id: 'Buat proyek & storyboard', en: 'Create project & storyboard' },
  render: { id: 'Render adegan ke berkas', en: 'Render shots to files' },
  translate: { id: 'Terjemahkan subtitle', en: 'Translate subtitles' },
  dub: { id: 'Render dubbing', en: 'Render dubbing' },
  image: { id: 'Buat gambar', en: 'Generate images' },
  write: { id: 'Tulis naskah/dokumen', en: 'Write script/document' },
};

export function listThreads(): AgentThread[] {
  return store.data().threads;
}

export async function createThread(input: { title?: string; projectId?: string } = {}): Promise<AgentThread> {
  const thread: AgentThread = {
    id: newId('thread'),
    title: input.title ?? 'Percakapan baru',
    projectId: input.projectId,
    messages: [
      {
        id: newId('msg'),
        role: 'system',
        content:
          'Agent siap. Tulis brief apa pun — agent akan menyusun storyboard, aset, dan langkah produksi. / Agent ready. Describe any brief and it will plan the storyboard, assets and production steps.',
        createdAt: nowIso(),
      },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await store.update((db) => {
    db.threads.unshift(thread);
    return thread;
  });
  return thread;
}

export function getThread(id: string): AgentThread | undefined {
  return store.data().threads.find((thread) => thread.id === id);
}

async function appendMessage(threadId: string, message: AgentMessage): Promise<AgentThread | undefined> {
  return store.update((db) => {
    const thread = db.threads.find((item) => item.id === threadId);
    if (!thread) return undefined;
    thread.messages = [...thread.messages, message];
    thread.updatedAt = nowIso();
    if (thread.title === 'Percakapan baru' && message.role === 'user') {
      thread.title = truncate(message.content.replace(/\s+/g, ' '), 48);
    }
    return thread;
  });
}

function detectActions(message: string, language: Language, prompt: string): PlannedAction[] {
  const text = message.toLowerCase();
  const actions: PlannedAction[] = [];
  const has = (...keys: string[]) => keys.some((key) => text.includes(key));

  const wantsImage = has('gambar', 'image', 'thumbnail', 'poster', 'ilustrasi', 'visual');
  const wantsWrite = has('skrip', 'script', 'artikel', 'article', 'caption', 'post', 'tulisan', 'naskah');
  const wantsTranslate = has('terjemah', 'translate', 'subtitle', 'dubbing', 'dub', 'bahasa inggris', 'english');

  if (wantsImage) {
    actions.push({
      kind: 'image',
      label: ACTION_LABEL.image,
      payload: { prompt, aspect: '16:9', count: 2, styleId: 'cinematic-golden', language },
    });
  }

  if (wantsWrite && !wantsImage) {
    actions.push({
      kind: 'write',
      label: ACTION_LABEL.write,
      payload: {
        kind: has('artikel', 'article') ? 'article' : has('post', 'caption') ? 'social' : 'script',
        topic: prompt,
        language,
        mode: 'social',
        durationSeconds: 30,
      },
    });
  }

  if (!wantsImage && !wantsWrite) {
    actions.push({
      kind: 'project',
      label: ACTION_LABEL.project,
      payload: { prompt, language, voiceEnabled: true, targetLanguage: language === 'id' ? 'en' : 'id' },
    });
    actions.push({
      kind: 'render',
      label: ACTION_LABEL.render,
      payload: { chainedAfter: 'project', translate: true, bilingual: true },
    });
  }

  if (wantsTranslate) {
    actions.push({
      kind: 'translate',
      label: ACTION_LABEL.translate,
      payload: { chainedAfter: 'project', targetLanguage: language === 'id' ? 'en' : 'id', bilingual: true },
    });
  }

  return actions.slice(0, 4);
}

export async function sendMessage(threadId: string, content: string, options: { language?: Language } = {}): Promise<{
  thread: AgentThread | undefined;
  approvals: Approval[];
}> {
  const language = options.language ?? store.settings().language;
  const thread = getThread(threadId);
  if (!thread) return { thread: undefined, approvals: [] };

  await appendMessage(threadId, { id: newId('msg'), role: 'user', content, createdAt: nowIso() });

  const prompt = cleanTopic(content);
  const llm = await chatJson<LlmPlan>([
    {
      role: 'system',
      content: [
        'You are the OpenCreator-style agent inside a local creator workspace.',
        `Answer in ${language === 'id' ? 'Indonesian' : 'English'} and keep the reply under 140 words.`,
        'Available skills: ' + AGENT_SKILLS.map((skill) => skill.id).join(', ') + '.',
        'Return strict JSON: {"reply":"...","actions":[{"kind":"project|render|translate|dub|image|write","prompt":"refined brief"}]}',
        'Choose at most 3 actions. Prefer project + render for video work.',
      ].join('\n'),
    },
    { role: 'user', content },
  ]);

  let reply = llm?.data?.reply ?? '';
  let actions: PlannedAction[] = [];

  if (llm?.data?.actions?.length) {
    actions = llm.data.actions
      .map((action) => {
        const kind = action.kind as PlannedAction['kind'];
        if (!ACTION_LABEL[kind]) return null;
        const actionPrompt = action.prompt ?? prompt;
        const payload: Record<string, unknown> = kind === 'project'
          ? { prompt: actionPrompt, language, voiceEnabled: true, targetLanguage: language === 'id' ? 'en' : 'id' }
          : kind === 'render'
            ? { chainedAfter: 'project', translate: true, bilingual: true }
            : kind === 'translate'
              ? { chainedAfter: 'project', targetLanguage: language === 'id' ? 'en' : 'id', bilingual: true }
              : kind === 'write'
                ? { kind: 'script', topic: actionPrompt, language, mode: 'social', durationSeconds: 30 }
                : kind === 'image'
                  ? { prompt: actionPrompt, aspect: '16:9', count: 2, language }
                  : { chainedAfter: 'project', language };
        return { kind, label: ACTION_LABEL[kind], payload } satisfies PlannedAction;
      })
      .filter((action): action is PlannedAction => Boolean(action));
  }

  if (actions.length === 0) actions = detectActions(content, language, prompt);
  if (!reply) reply = demoAgentReply({ message: content, language });

  await appendMessage(threadId, {
    id: newId('msg'),
    role: 'assistant',
    content: reply,
    createdAt: nowIso(),
  });

  const approval: Approval = {
    id: newId('appr'),
    title: language === 'id' ? 'Jalankan rencana produksi' : 'Run the production plan',
    detail: actions.map((action) => action.label[language] ?? action.label.en).join(' · '),
    payload: { threadId, actions, language, prompt },
    status: 'pending',
    createdAt: nowIso(),
  };

  await store.update((db) => {
    db.approvals.unshift(approval);
    db.approvals = db.approvals.slice(0, 40);
    return approval;
  });

  return { thread: getThread(threadId), approvals: [approval] };
}

async function waitForJob(jobId: string, timeoutMs = 60_000): Promise<{ status: string; projectId?: string; result?: Record<string, unknown> }> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = jobById(jobId);
    if (job && ['done', 'failed', 'cancelled'].includes(job.status)) {
      return { status: job.status, projectId: job.projectId, result: job.result };
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return { status: 'timeout' };
}

export interface ActionOutcome {
  kind: PlannedAction['kind'];
  label: LocaleText;
  status: 'done' | 'failed' | 'skipped';
  jobId?: string;
  projectId?: string;
  detail?: string;
  assetIds?: string[];
}

/** Executes the approved plan, chaining render/translate/dub after project creation. */
export async function executeActions(approval: Approval): Promise<ActionOutcome[]> {
  const actions = (approval.payload.actions as PlannedAction[] | undefined) ?? [];
  const language = (approval.payload.language as Language | undefined) ?? store.settings().language;
  const outcomes: ActionOutcome[] = [];
  let projectId: string | undefined;

  for (const action of actions) {
    try {
      if (action.kind === 'project') {
        const prompt = String(action.payload.prompt ?? approval.payload.prompt ?? 'proyek baru');
        const { job, projectId: created } = await createProjectJob({
          prompt,
          language,
          mode: (action.payload.mode as StudioMode | undefined) ?? undefined,
          styleId: action.payload.styleId ? String(action.payload.styleId) : undefined,
          aspect: action.payload.aspect ? String(action.payload.aspect) : undefined,
          durationSeconds: action.payload.durationSeconds ? Number(action.payload.durationSeconds) : undefined,
          targetLanguage: (action.payload.targetLanguage as Language | undefined) ?? undefined,
          voiceEnabled: Boolean(action.payload.voiceEnabled ?? true),
        });
        projectId = created;
        outcomes.push({ kind: 'project', label: action.label, status: 'done', jobId: job.id, projectId: created });
        await waitForJob(job.id);
        continue;
      }

      if (action.payload.chainedAfter === 'project' && !projectId) {
        outcomes.push({ kind: action.kind, label: action.label, status: 'skipped', detail: 'Tidak ada proyek untuk diproses.' });
        continue;
      }

      if (action.kind === 'render' && projectId) {
        const { job } = await renderProjectJob({
          projectId,
          translate: action.payload.translate !== false,
          bilingual: action.payload.bilingual !== false,
        });
        outcomes.push({ kind: 'render', label: action.label, status: 'done', jobId: job.id, projectId });
      } else if (action.kind === 'translate' && projectId) {
        const project = store.data().projects.find((item) => item.id === projectId);
        const cuesText = (project?.shots ?? []).map((shot) => shot.caption[project?.language ?? language] ?? shot.caption.en).join(' ');
        if (!cuesText.trim()) {
          outcomes.push({ kind: 'translate', label: action.label, status: 'skipped', detail: 'Storyboard belum siap.' });
        } else {
          const { job } = await translateJob({
            text: cuesText,
            sourceName: project?.title ?? 'storyboard',
            sourceLanguage: project?.language ?? language,
            targetLanguage: (action.payload.targetLanguage as Language | undefined) ?? (language === 'id' ? 'en' : 'id'),
            bilingual: action.payload.bilingual !== false,
            totalSeconds: project?.durationSeconds,
          });
          outcomes.push({ kind: 'translate', label: action.label, status: 'done', jobId: job.id, projectId });
        }
      } else if (action.kind === 'dub') {
        const { job } = await dubJob({
          projectId,
          language: (action.payload.language as Language | undefined) ?? (language === 'id' ? 'en' : 'id'),
          presetId: action.payload.presetId ? String(action.payload.presetId) : 'warm-narrator',
        });
        outcomes.push({ kind: 'dub', label: action.label, status: 'done', jobId: job.id, projectId });
      } else if (action.kind === 'image') {
        const { job } = await imageJob({
          prompt: String(action.payload.prompt ?? approval.payload.prompt ?? 'gambar baru'),
          aspect: action.payload.aspect ? String(action.payload.aspect) : '16:9',
          count: action.payload.count ? Number(action.payload.count) : 2,
          styleId: action.payload.styleId ? String(action.payload.styleId) : 'cinematic-golden',
          language,
        });
        outcomes.push({ kind: 'image', label: action.label, status: 'done', jobId: job.id });
      } else if (action.kind === 'write') {
        const { job } = await writerJob({
          kind: (action.payload.kind as 'script' | 'article' | 'social' | undefined) ?? 'script',
          topic: String(action.payload.topic ?? approval.payload.prompt ?? 'topik baru'),
          language,
          durationSeconds: action.payload.durationSeconds ? Number(action.payload.durationSeconds) : 30,
        });
        outcomes.push({ kind: 'write', label: action.label, status: 'done', jobId: job.id });
      }
    } catch (error) {
      outcomes.push({
        kind: action.kind,
        label: action.label,
        status: 'failed',
        detail: error instanceof Error ? error.message : 'Unknown failure',
      });
    }
  }

  const threadId = approval.payload.threadId as string | undefined;
  if (threadId) {
    await appendMessage(threadId, {
      id: newId('msg'),
      role: 'tool',
      toolName: 'plan.execute',
      toolInput: { approvalId: approval.id },
      content: outcomes
        .map((outcome) => `${outcome.status === 'done' ? '✅' : outcome.status === 'skipped' ? '⏭️' : '⚠️'} ${outcome.label[language] ?? outcome.label.en}${outcome.detail ? ` — ${outcome.detail}` : ''}`)
        .join('\n'),
      createdAt: nowIso(),
    });
  }

  await store.update((db) => {
    db.runs.unshift({
      id: newId('run'),
      kind: 'agent-plan',
      label: approval.title,
      status: outcomes.some((outcome) => outcome.status === 'failed') ? 'failed' : 'done',
      projectId,
      createdAt: nowIso(),
      detail: outcomes.map((outcome) => `${outcome.label.id}: ${outcome.status}`).join(' · '),
    });
    db.runs = db.runs.slice(0, 60);
    return outcomes;
  });

  return outcomes;
}

export async function decideApproval(id: string, decision: 'approve' | 'reject'): Promise<{ approval?: Approval; outcomes?: ActionOutcome[] }> {
  const approval = store.data().approvals.find((item) => item.id === id);
  if (!approval) return {};
  approval.status = decision === 'approve' ? 'approved' : 'rejected';
  await store.update((db) => {
    const target = db.approvals.find((item) => item.id === id);
    if (target) target.status = approval.status;
    return target;
  });
  if (decision === 'reject') return { approval };
  const outcomes = await executeActions(approval);
  return { approval, outcomes };
}

export function startThreadTitle(message: string): string {
  return truncate(message.replace(/\s+/g, ' '), 48);
}

export { createJob, styleById };
