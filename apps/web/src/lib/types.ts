export type Language = 'id' | 'en';
export type LocaleText = Record<Language, string>;
export type StudioMode = 'cinematic' | 'social' | 'commercial' | 'freeform';
export type ProviderId = 'demo' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'elevenlabs';

export interface ProviderSettings {
  llm: ProviderId;
  image: ProviderId;
  tts: ProviderId;
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
  composition?: string;
}

export interface ProjectVersion {
  id: string;
  label: LocaleText;
  createdAt: string;
  snapshot: { shots: Shot[]; styleId: string; aspect: string; durationSeconds: number };
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
  status: 'draft' | 'running' | 'ready' | 'failed';
  summary: LocaleText;
  shots: Shot[];
  versions: ProjectVersion[];
  voiceEnabled: boolean;
  voiceAssetId?: string;
  coverAssetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  kind: 'image' | 'audio' | 'video' | 'subtitle' | 'document';
  name: string;
  mimeType: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  origin: 'demo' | 'provider' | 'upload' | 'browser' | 'render';
  meta?: Record<string, string | number | boolean | null>;
}

export interface JobStep {
  id: string;
  label: LocaleText;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed';
  detail?: string;
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

export interface StylePreset {
  id: string;
  name: LocaleText;
  family: StudioMode;
  palette: string[];
  prompt: string;
  grain: number;
}

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

export interface Catalog {
  styles: StylePreset[];
  hooks: HookPreset[];
  templates: TemplatePreset[];
  roles: { id: string; label: LocaleText }[];
  props: { id: string; label: LocaleText }[];
  skills: { id: string; title: LocaleText; summary: LocaleText; kind: 'agent' | 'workflow' }[];
  voices: { id: string; label: LocaleText; hint: LocaleText }[];
  glossary: { id: string; source: string; target: string; note?: string }[];
  aspects: string[];
  durations: number[];
  modes: StudioMode[];
}

export interface SystemInfo {
  uptimeSeconds: number;
  counts: { projects: number; assets: number; jobs: number; threads: number; translations: number };
  providers: { llm: ProviderId; image: ProviderId; tts: ProviderId; asr: ProviderId };
  dataDir: string;
  time: string;
}
