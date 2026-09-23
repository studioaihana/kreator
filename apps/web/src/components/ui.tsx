import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { relativeTime, statusLabel, statusTone, stepSummary } from '../lib/format';
import { localeText } from '../lib/i18n';
import type { Job, Language } from '../lib/types';

export function Pill({ tone = 'neutral', children, className = '' }: { tone?: string; children: ReactNode; className?: string }) {
  const toneClass = tone === 'neutral' ? '' : tone;
  return <span className={`pill ${toneClass} ${className}`.trim()}>{children}</span>;
}

export function StatusPill({ status, language }: { status: string; language: Language }) {
  const tone = statusTone[status] ?? 'neutral';
  return (
    <Pill tone={tone}>
      {status === 'running' ? <span className="spinner" /> : null}
      {statusLabel(status, language)}
    </Pill>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div style={{ marginBottom: action ? 12 : 0 }}>{children}</div>
      {action}
    </div>
  );
}

export function JobProgress({ job }: { job: Job }) {
  const done = job.steps.filter((step) => step.status === 'done').length;
  const failed = job.steps.some((step) => step.status === 'failed');
  const percent = job.steps.length === 0 ? 0 : Math.round((done / job.steps.length) * 100);
  const tone = failed ? 'var(--danger)' : job.status === 'done' ? 'var(--success)' : undefined;
  return <div className="progress"><i style={{ width: `${job.status === 'done' ? 100 : percent}%`, background: tone }} /></div>;
}

export interface StepRunnerProps {
  job: Job;
  language: Language;
}

export function StepRunner({ job, language }: StepRunnerProps) {
  return (
    <div className="steps">
      {job.steps.map((step) => (
        <div key={step.id} className={`step ${step.status}`}>
          <span className="step-icon">
            {step.status === 'done' ? <Icon name="check" size={9} strokeWidth={3} /> : step.status === 'failed' ? <Icon name="x" size={9} strokeWidth={3} /> : null}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block' }}>{localeText(step.label, language)}</span>
            {step.detail ? <span className="step-detail">{step.detail}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export function JobCard({
  job,
  language,
  t,
  onCancel,
  showLog = true,
  onOpenProject,
}: {
  job: Job;
  language: Language;
  t: (key: string) => string;
  onCancel?: (id: string) => void;
  showLog?: boolean;
  onOpenProject?: (projectId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const running = job.status === 'running' || job.status === 'queued';
  return (
    <div className="job-card">
      <div className="job-head">
        <StatusPill status={job.status} language={language} />
        <span className="job-title" title={job.title}>{job.title}</span>
        {job.projectId && onOpenProject ? (
          <button className="btn btn-ghost btn-sm" onClick={() => onOpenProject(job.projectId as string)}>
            {t('common.open')}
          </button>
        ) : null}
        {running && onCancel ? (
          <button className="btn btn-ghost btn-sm" onClick={() => onCancel(job.id)} title={t('jobs.cancel')}>
            <Icon name="stop" size={13} />
          </button>
        ) : null}
      </div>
      <JobProgress job={job} />
      <div className="row" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        <Icon name="clock" size={13} />
        <span>{relativeTime(job.updatedAt, language)}</span>
        <span>·</span>
        <span>{stepSummary(job.steps, language)}</span>
        {showLog ? (
          <>
            <span className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen((value) => !value)}>
              {open ? t('common.close') : t('jobs.log')}
            </button>
          </>
        ) : null}
      </div>
      {open ? (
        <>
          <StepRunner job={job} language={language} />
          {job.error ? (
            <div className="pill danger" style={{ alignSelf: 'flex-start' }}>
              <Icon name="alert" size={13} /> {job.error}
            </div>
          ) : null}
          {job.log.length > 0 ? <div className="log-box">{job.log.join('\n')}</div> : null}
        </>
      ) : null}
    </div>
  );
}

export function JobRail({
  jobs,
  language,
  t,
  onCancel,
  onOpenProject,
  limit = 4,
  title,
}: {
  jobs: Job[];
  language: Language;
  t: (key: string) => string;
  onCancel?: (id: string) => void;
  onOpenProject?: (projectId: string) => void;
  limit?: number;
  title?: string;
}) {
  const visible = jobs.filter((job) => ['running', 'queued'].includes(job.status)).slice(0, limit);
  const recent = visible.length > 0 ? visible : jobs.slice(0, limit);
  return (
    <div className="section">
      <div className="section-head">
        <Icon name="sparkles" size={16} />
        <span className="section-title">{title ?? t('jobs.title')}</span>
      </div>
      {recent.length === 0 ? (
        <EmptyState>{t('jobs.empty')}</EmptyState>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {recent.map((job) => (
            <JobCard key={job.id} job={job} language={language} t={t} onCancel={onCancel} onOpenProject={onOpenProject} />
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- toasts
interface ToastItem {
  id: number;
  message: string;
  tone: 'neutral' | 'success' | 'danger';
}

interface ToastContextValue {
  push: (message: string, tone?: ToastItem['tone']) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastItem['tone'] = 'neutral') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.tone}`}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function Skeleton({ height = 120 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} />;
}
