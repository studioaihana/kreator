import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig, Database } from './types.js';

/**
 * Data lives in `<repo>/.kreator-data` by default. Resolving it relative to this
 * module keeps `npm run dev` (src/) and `npm start` (dist/) on the same folder
 * no matter which working directory the process was started from.
 */
export const DATA_DIR = process.env.KREATOR_DATA_DIR
  ? path.resolve(process.env.KREATOR_DATA_DIR)
  : path.resolve(fileURLToPath(new URL('../../../.kreator-data', import.meta.url)));

export const ASSETS_DIR = path.join(DATA_DIR, 'assets');
export const DB_FILE = path.join(DATA_DIR, 'db.json');
export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

export const emptyDatabase = (): Database => ({
  projects: [],
  assets: [],
  jobs: [],
  threads: [],
  approvals: [],
  translations: [],
  runs: [],
  skills: { enabled: ['video-translation', 'short-video-script', 'thumbnail-generator', 'image-generation', 'smart-dubbing', 'agent-composer'] },
});

export const defaultConfig = (): AppConfig => ({
  language: 'id',
  theme: 'dark',
  accent: '#ffd166',
  authorName: 'Kreator Studio',
  providers: {
    llm: 'demo',
    image: 'demo',
    tts: 'demo',
    asr: 'demo',
    openai: {
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      chatModel: 'gpt-4o-mini',
      imageModel: 'gpt-image-1',
      ttsModel: 'gpt-4o-mini-tts',
      ttsVoice: 'alloy',
      asrModel: 'whisper-1',
    },
    anthropic: { apiKey: '', model: 'claude-3-5-sonnet-latest' },
    gemini: { apiKey: '', model: 'gemini-2.0-flash' },
    ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.1' },
    elevenlabs: { apiKey: '', model: 'eleven_multilingual_v2', voiceId: '21m00Tcm4TlvDq8ikWAM' },
  },
});

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

export class Store {
  private db: Database = emptyDatabase();

  private config: AppConfig = defaultConfig();

  private queue: Promise<unknown> = Promise.resolve();

  async init(): Promise<void> {
    await fs.mkdir(ASSETS_DIR, { recursive: true });
    this.db = await readJson<Database>(DB_FILE, emptyDatabase());
    const rawConfig = await readJson<Partial<AppConfig>>(CONFIG_FILE, {});
    const base = defaultConfig();
    this.config = {
      ...base,
      ...rawConfig,
      providers: {
        ...base.providers,
        ...(rawConfig.providers ?? {}),
        openai: { ...base.providers.openai, ...(rawConfig.providers?.openai ?? {}) },
        anthropic: { ...base.providers.anthropic, ...(rawConfig.providers?.anthropic ?? {}) },
        gemini: { ...base.providers.gemini, ...(rawConfig.providers?.gemini ?? {}) },
        ollama: { ...base.providers.ollama, ...(rawConfig.providers?.ollama ?? {}) },
        elevenlabs: { ...base.providers.elevenlabs, ...(rawConfig.providers?.elevenlabs ?? {}) },
      },
    };
  }

  /** Serialises mutations so concurrent requests never clobber the JSON file. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  data(): Database {
    return this.db;
  }

  /** Mutate + persist atomically. */
  update<T>(mutator: (db: Database) => T): Promise<T> {
    return this.enqueue(async () => {
      const result = mutator(this.db);
      await writeJson(DB_FILE, this.db);
      return result;
    });
  }

  settings(): AppConfig {
    return this.config;
  }

  saveConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
    return this.enqueue(async () => {
      const current = this.config;
      this.config = {
        ...current,
        ...patch,
        providers: {
          ...current.providers,
          ...(patch.providers ?? {}),
          openai: { ...current.providers.openai, ...(patch.providers?.openai ?? {}) },
          anthropic: { ...current.providers.anthropic, ...(patch.providers?.anthropic ?? {}) },
          gemini: { ...current.providers.gemini, ...(patch.providers?.gemini ?? {}) },
          ollama: { ...current.providers.ollama, ...(patch.providers?.ollama ?? {}) },
          elevenlabs: { ...current.providers.elevenlabs, ...(patch.providers?.elevenlabs ?? {}) },
        },
      };
      await writeJson(CONFIG_FILE, this.config);
      return this.config;
    });
  }
}

export const store = new Store();
