export type Language = 'id' | 'en';

export type LocaleText = Record<Language, string>;

export type ProviderId = 'demo' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'elevenlabs';

export interface ProviderSettings {
  /** Which provider powers text/briefs/scripts. */
  llm: ProviderId;
  /** Which provider powers image generation. */
  image: ProviderId;
  /** Which provider powers text-to-speech. `demo` uses the browser voice engine. */
  tts: ProviderId;
  /** Which provider powers speech-to-text (transcription). */
  asr: ProviderId;
  openai: { apiKey: string; baseUrl: string; chatModel: string; imageModel: string; ttsModel: string; ttsVoice: string; asrModel: string };
  anthropic: { apiKey: string; model: string };
  gemini: { apiKey: string; model: string };
  ollama: { baseUrl: string; model: string };
  elevenlabs: { apiKey: string; model: string; voiceId: string };
}

export interface AppConfig {
  language: Language;
  theme: 'dark' | 'light';
  accent: string;
  authorName: string;
  providers: ProviderSettings;
}

export type ProjectStatus = 'draft' | 'running' | 'ready' | 'failed';

export interface Shot {
  id: string;
  index: number;
  title: LocaleText;
  description: LocaleText;
  imagePrompt: string;
  caption: LocaleText;
  narration: LocaleText;
  durationSeconds: number;
  imageAssetId?: string;
  motion: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
}

export interface Project {
  id: string;
  title: string;
  prompt: string;
  mode: StudioMode;
  hookId?: string;
  templateId?: string;
  styleId: string;
  aspect: string;
  durationSeconds: number;
  language: Language;
  targetLanguage: Language;
  status: ProjectStatus;
  summary: LocaleText;
  shots: Shot[];
  versions: ProjectVersion[];
  voiceEnabled: boolean;
  voiceAssetId?: string;
  createdAt: string;
  updatedAt: string;
  coverAssetId?: string;
}

export interface ProjectVersion {
  id: string;
  label: LocaleText;
  createdAt: string;
  snapshot: { shots: Shot[]; styleId: string; aspect: string; durationSeconds: number };
}

export type StudioMode = 'cinematic' | 'social' | 'commercial' | 'freeform';

export type AssetKind = 'image' | 'audio' | 'video' | 'subtitle' | 'document';

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  mimeType: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  meta?: Record<string, string | number | boolean | null>;
  origin: 'demo' | 'provider' | 'upload' | 'browser' | 'render';
}

export interface JobStep {
  id: string;
  label: LocaleText;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed';
  detail?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface Job {
  id: string;
  kind: 'studio-create' | 'studio-render' | 'translate' | 'dub' | 'image' | 'write' | 'import' | 'agent';
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'awaiting-approval';
  title: string;
  projectId?: string;
  steps: JobStep[];
  result?: Record<string, unknown>;
  error?: string;
  log: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

export interface AgentThread {
  id: string;
  title: string;
  projectId?: string;
  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  title: string;
  detail: string;
  jobId?: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface SubtitleCue {
  index: number;
  start: number;
  end: number;
  text: string;
  translation?: string;
}

export interface TranslationDoc {
  id: string;
  sourceName: string;
  sourceAssetId?: string;
  sourceLanguage: Language | 'auto';
  targetLanguage: Language;
  cues: SubtitleCue[];
  mode: 'demo' | 'provider';
  createdAt: string;
  jobId?: string;
}

export interface RunRecord {
  id: string;
  kind: string;
  label: string;
  status: 'running' | 'done' | 'failed' | 'awaiting-approval';
  projectId?: string;
  createdAt: string;
  detail?: string;
}

export interface Database {
  projects: Project[];
  assets: Asset[];
  jobs: Job[];
  threads: AgentThread[];
  approvals: Approval[];
  translations: TranslationDoc[];
  runs: RunRecord[];
  skills: { enabled: string[] };
}
