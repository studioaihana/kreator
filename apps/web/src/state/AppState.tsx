import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, subscribeEvents, type StreamEvent } from '../lib/api';
import { localeText, translate } from '../lib/i18n';
import type {
  AgentThread,
  AppConfig,
  Approval,
  Asset,
  Catalog,
  Job,
  Language,
  Project,
  RunRecord,
  SystemInfo,
  TranslationDoc,
} from '../lib/types';

interface AppStateValue {
  ready: boolean;
  error: string | null;
  config: AppConfig | null;
  catalog: Catalog | null;
  system: SystemInfo | null;
  projects: Project[];
  jobs: Job[];
  threads: AgentThread[];
  approvals: Approval[];
  assets: Asset[];
  translations: TranslationDoc[];
  runs: RunRecord[];
  language: Language;
  t: (key: string) => string;
  tx: (value: Record<string, string> | undefined) => string;
  patchConfig: (patch: Partial<AppConfig>) => Promise<void>;
  reloadProjects: () => Promise<void>;
  reloadCatalog: () => Promise<void>;
  reloadJobs: () => Promise<void>;
  reloadAssets: (query?: { kind?: string; projectId?: string }) => Promise<Asset[]>;
  reloadThreads: () => Promise<void>;
  reloadApprovals: () => Promise<void>;
  reloadTranslations: () => Promise<void>;
  reloadSystem: () => Promise<void>;
  reloadAll: () => Promise<void>;
  setError: (message: string | null) => void;
  seedDemoData: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [threads, setThreads] = useState<AgentThread[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [translations, setTranslations] = useState<TranslationDoc[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const retryRef = useRef(0);
  const [streamAlive, setStreamAlive] = useState(false);

  const language: Language = config?.language ?? 'id';
  const t = useCallback((key: string) => translate(language, key), [language]);
  const tx = useCallback((value: Record<string, string> | undefined) => localeText(value, language), [language]);

  const reloadProjects = useCallback(async () => {
    try {
      setProjects(await api.projects());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    }
  }, []);

  const reloadCatalog = useCallback(async () => {
    try {
      setCatalog(await api.catalog());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
    }
  }, []);

  const reloadJobs = useCallback(async () => {
    try {
      setJobs(await api.jobs());
    } catch {
      /* ignore transient errors */
    }
  }, []);

  const reloadAssets = useCallback(async (query: { kind?: string; projectId?: string } = {}) => {
    try {
      const result = await api.assets(query);
      setAssets(result);
      return result;
    } catch {
      return [];
    }
  }, []);

  const reloadThreads = useCallback(async () => {
    try {
      setThreads(await api.threads());
    } catch {
      /* ignore */
    }
  }, []);

  const reloadApprovals = useCallback(async () => {
    try {
      setApprovals(await api.approvals());
    } catch {
      /* ignore */
    }
  }, []);

  const reloadTranslations = useCallback(async () => {
    try {
      setTranslations(await api.translations());
    } catch {
      /* ignore */
    }
  }, []);

  const reloadSystem = useCallback(async () => {
    try {
      setSystem(await api.system());
    } catch {
      /* ignore */
    }
  }, []);

  const reloadRuns = useCallback(async () => {
    try {
      setRuns(await api.runs());
    } catch {
      /* ignore */
    }
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([
      reloadProjects(),
      reloadCatalog(),
      reloadJobs(),
      reloadAssets(),
      reloadThreads(),
      reloadApprovals(),
      reloadTranslations(),
      reloadSystem(),
      reloadRuns(),
    ]);
  }, [reloadApprovals, reloadAssets, reloadCatalog, reloadJobs, reloadProjects, reloadRuns, reloadSystem, reloadThreads, reloadTranslations]);

  const patchConfig = useCallback(async (patch: Partial<AppConfig>) => {
    setConfig((current) => (current ? { ...current, ...patch, providers: { ...current.providers, ...(patch.providers ?? {}) } } : current));
    try {
      await api.saveConfig(patch);
      const fresh = await api.getConfig();
      setConfig(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  }, []);

  const seedDemoData = useCallback(async () => {
    try {
      await api.seed();
      await reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed data');
    }
  }, [reloadAll]);

  // Initial bootstrap.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [configResult, catalogResult, systemResult] = await Promise.all([api.getConfig(), api.catalog(), api.system()]);
        if (cancelled) return;
        setConfig(configResult);
        setCatalog(catalogResult);
        setSystem(systemResult);
        await Promise.all([reloadProjects(), reloadJobs(), reloadAssets(), reloadThreads(), reloadApprovals(), reloadTranslations(), reloadRuns()]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to reach the local API');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadApprovals, reloadAssets, reloadJobs, reloadProjects, reloadRuns, reloadThreads, reloadTranslations]);

  // Live updates through server sent events.
  useEffect(() => {
    if (!ready) return undefined;
    let dirtyProjects = false;
    const handle = (event: StreamEvent) => {
      if (event.type === 'snapshot') {
        setStreamAlive(true);
        const data = event.data as { jobs?: Job[]; runs?: RunRecord[]; approvals?: Approval[]; threads?: Partial<AgentThread>[] };
        if (data.jobs) setJobs(data.jobs);
        if (data.runs) setRuns(data.runs);
        if (data.threads) {
          setThreads((current) => {
            const map = new Map(current.map((thread) => [thread.id, thread]));
            for (const summary of data.threads ?? []) {
              const existing = summary.id ? map.get(summary.id) : undefined;
              if (existing) map.set(existing.id, { ...existing, title: summary.title ?? existing.title, updatedAt: summary.updatedAt ?? existing.updatedAt });
            }
            return Array.from(map.values());
          });
        }
      }
      if (event.type === 'job.update') {
        const job = event.data as Job;
        setJobs((current) => {
          const index = current.findIndex((item) => item.id === job.id);
          if (index === -1) return [job, ...current].slice(0, 60);
          const next = [...current];
          next[index] = job;
          return next;
        });
        if (['done', 'failed', 'cancelled'].includes(job.status)) {
          dirtyProjects = true;
          window.setTimeout(() => {
            if (dirtyProjects) {
              dirtyProjects = false;
              void reloadProjects();
              void reloadAssets();
              void reloadRuns();
              void reloadApprovals();
            }
          }, 500);
        }
      }
      if (event.type === 'approval.update') {
        const approval = event.data as Approval;
        setApprovals((current) => {
          const index = current.findIndex((item) => item.id === approval.id);
          if (index === -1) return [approval, ...current];
          const next = [...current];
          next[index] = approval;
          return next;
        });
      }
      if (event.type === 'thread.update') {
        void reloadThreads();
      }
    };
    const unsubscribe = subscribeEvents(handle, () => {
      retryRef.current += 1;
    });
    return () => unsubscribe();
  }, [ready, reloadApprovals, reloadAssets, reloadProjects, reloadRuns, reloadThreads]);

  // Fallback polling when the event stream is unavailable (proxies, offline, etc.).
  useEffect(() => {
    if (!ready || streamAlive) return undefined;
    const interval = window.setInterval(() => {
      void reloadJobs();
      void reloadProjects();
      void reloadApprovals();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [ready, streamAlive, reloadApprovals, reloadJobs, reloadProjects]);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      error,
      config,
      catalog,
      system,
      projects,
      jobs,
      threads,
      approvals,
      assets,
      translations,
      runs,
      language,
      t,
      tx,
      patchConfig,
      reloadProjects,
      reloadCatalog,
      reloadJobs,
      reloadAssets,
      reloadThreads,
      reloadApprovals,
      reloadTranslations,
      reloadSystem,
      reloadAll,
      setError,
      seedDemoData,
    }),
    [
      ready,
      error,
      config,
      catalog,
      system,
      projects,
      jobs,
      threads,
      approvals,
      assets,
      translations,
      runs,
      language,
      t,
      tx,
      patchConfig,
      reloadProjects,
      reloadCatalog,
      reloadJobs,
      reloadAssets,
      reloadThreads,
      reloadApprovals,
      reloadTranslations,
      reloadSystem,
      reloadAll,
      seedDemoData,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp(): AppStateValue {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useApp must be used inside AppStateProvider');
  return context;
}
