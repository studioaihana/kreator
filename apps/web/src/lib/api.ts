import type {
  AgentThread,
  AppConfig,
  Approval,
  Asset,
  Catalog,
  Job,
  Project,
  RunRecord,
  SystemInfo,
  TranslationDoc,
} from './types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: init?.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return (await response.json()) as T;
  return (await response.text()) as unknown as T;
}

export const api = {
  getConfig: () => request<AppConfig>('/config'),
  saveConfig: (patch: Partial<AppConfig>) => request<{ ok: boolean }>('/config', { method: 'PUT', body: JSON.stringify(patch) }),
  catalog: () => request<Catalog>('/catalog'),
  system: () => request<SystemInfo>('/system'),
  seed: () => request<{ seeded: boolean; projectId?: string }>('/system/seed', { method: 'POST' }),

  projects: () => request<Project[]>('/projects'),
  project: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (input: Record<string, unknown>) =>
    request<{ jobId: string; projectId: string }>('/projects', { method: 'POST', body: JSON.stringify(input) }),
  updateProject: (id: string, patch: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteProject: (id: string) => request<{ removed: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  duplicateProject: (id: string) => request<Project>(`/projects/${id}/duplicate`, { method: 'POST' }),
  renderProject: (id: string, options: { translate?: boolean; bilingual?: boolean } = {}) =>
    request<{ jobId: string }>(`/projects/${id}/render`, { method: 'POST', body: JSON.stringify(options) }),
  dubProject: (id: string, options: { language?: string; presetId?: string } = {}) =>
    request<{ jobId: string }>(`/projects/${id}/dub`, { method: 'POST', body: JSON.stringify(options) }),

  jobs: () => request<Job[]>('/jobs'),
  job: (id: string) => request<Job>(`/jobs/${id}`),
  cancelJob: (id: string) => request<{ ok: boolean }>(`/jobs/${id}/cancel`, { method: 'POST' }),

  assets: (query: { kind?: string; projectId?: string } = {}) => {
    const params = new URLSearchParams();
    if (query.kind) params.set('kind', query.kind);
    if (query.projectId) params.set('projectId', query.projectId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return request<Asset[]>(`/assets${suffix}`);
  },
  assetUrl: (id: string) => `${BASE}/assets/${id}/file`,
  assetDownloadUrl: (id: string) => `${BASE}/assets/${id}/download`,
  deleteAsset: (id: string) => request<{ removed: boolean }>(`/assets/${id}`, { method: 'DELETE' }),
  uploadAsset: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<Asset>('/assets/upload', { method: 'POST', body: form });
  },

  translate: (input: Record<string, unknown>) =>
    request<{ jobId: string }>('/translate', { method: 'POST', body: JSON.stringify(input) }),
  translatePreview: (text: string, targetLanguage: string) =>
    request<{ translation: string; glossary: Catalog['glossary'] }>('/translate/preview', {
      method: 'POST',
      body: JSON.stringify({ text, targetLanguage }),
    }),
  translations: () => request<TranslationDoc[]>('/translations'),
  transcribe: (assetId: string, language: string) =>
    request<{ jobId: string }>('/transcribe', { method: 'POST', body: JSON.stringify({ assetId, language }) }),

  images: (input: Record<string, unknown>) =>
    request<{ jobId: string }>('/images', { method: 'POST', body: JSON.stringify(input) }),
  write: (input: Record<string, unknown>) =>
    request<{ jobId: string }>('/write', { method: 'POST', body: JSON.stringify(input) }),

  threads: () => request<AgentThread[]>('/threads'),
  thread: (id: string) => request<AgentThread>(`/threads/${id}`),
  createThread: (input: Record<string, unknown> = {}) =>
    request<AgentThread>('/threads', { method: 'POST', body: JSON.stringify(input) }),
  sendMessage: (id: string, content: string, language: string) =>
    request<{ thread: AgentThread; approvals: Approval[] }>(`/threads/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, language }),
    }),
  approvals: () => request<Approval[]>('/approvals'),
  decideApproval: (id: string, decision: 'approve' | 'reject') =>
    request<{ approval: Approval; outcomes?: unknown[] }>(`/approvals/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  runs: () => request<RunRecord[]>('/runs'),
};

export interface StreamEvent {
  type: 'snapshot' | 'job.update' | 'thread.update' | 'approval.update';
  data: unknown;
}

/** Subscribes to the server sent event stream; returns an unsubscribe function. */
export function subscribeEvents(onEvent: (event: StreamEvent) => void, onError?: () => void): () => void {
  const source = new EventSource(`${BASE}/events`);
  const handle = (type: StreamEvent['type']) => (event: MessageEvent) => {
    try {
      onEvent({ type, data: JSON.parse(event.data) });
    } catch {
      /* ignore malformed frames */
    }
  };
  source.addEventListener('snapshot', handle('snapshot'));
  source.addEventListener('job.update', handle('job.update'));
  source.addEventListener('thread.update', handle('thread.update'));
  source.addEventListener('approval.update', handle('approval.update'));
  source.onerror = () => onError?.();
  return () => source.close();
}
