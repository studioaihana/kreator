import { localeText, translate } from './i18n';
import type { JobStep, Language } from './types';

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function relativeTime(iso: string, language: Language): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  const id = language === 'id';
  if (Number.isNaN(then)) return '—';
  if (minutes < 1) return id ? 'baru saja' : 'just now';
  if (minutes < 60) return id ? `${minutes} menit lalu` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return id ? `${hours} jam lalu` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return id ? `${days} hari lalu` : `${days} d ago`;
  return new Date(iso).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatTimecode(seconds: number): string {
  const whole = Math.max(0, seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = Math.floor(whole % 60);
  const ms = Math.round((whole - Math.floor(whole)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export const statusTone: Record<string, string> = {
  draft: 'neutral',
  queued: 'neutral',
  running: 'info',
  ready: 'success',
  done: 'success',
  approved: 'success',
  failed: 'danger',
  cancelled: 'warning',
  'awaiting-approval': 'warning',
  pending: 'warning',
  rejected: 'danger',
};

export function statusLabel(status: string, language: Language): string {
  const key = `status.${status}`;
  const value = translate(language, key);
  return value === key ? status : value;
}

export function stepSummary(steps: JobStep[], language: Language): string {
  const running = steps.find((step) => step.status === 'running');
  if (running) return localeText(running.label, language);
  const done = steps.filter((step) => step.status === 'done').length;
  return `${done}/${steps.length}`;
}

export function jsonPreview(value: unknown, limit = 480): string {
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
  } catch {
    return String(value);
  }
}
