import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { EmptyState, Field, JobCard, Pill } from '../components/ui';
import { useApp } from '../state/AppState';
import { api } from '../lib/api';
import { renderMarkdown } from '../lib/markdown';
import { relativeTime } from '../lib/format';

type Kind = 'script' | 'article' | 'social';

export function WritePage() {
  const { t, language, catalog, jobs, assets, reloadAssets, reloadJobs, setError } = useApp();
  const [kind, setKind] = useState<Kind>('script');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('social');
  const [duration, setDuration] = useState(30);
  const [styleId, setStyleId] = useState('cinematic-golden');
  const [busy, setBusy] = useState(false);
  const [markdown, setMarkdown] = useState('');

  const documents = useMemo(() => assets.filter((asset) => asset.kind === 'document'), [assets]);
  const writeJobs = jobs.filter((job) => job.kind === 'write').slice(0, 4);

  useEffect(() => {
    void reloadAssets({ kind: 'document' });
  }, [reloadAssets]);

  async function handleGenerate() {
    if (!topic.trim() || busy) return;
    setBusy(true);
    try {
      const { jobId } = await api.write({ kind, topic, language, mode, durationSeconds: duration, styleId });
      await reloadJobs();
      setMarkdown('');
      // Poll the job until content arrives, then render it.
      let attempts = 0;
      const tick = window.setInterval(async () => {
        attempts += 1;
        try {
          const job = await api.job(jobId);
          await reloadJobs();
          if (job.status === 'done' && typeof job.result?.content === 'string') {
            setMarkdown(job.result.content as string);
            window.clearInterval(tick);
            void reloadAssets({ kind: 'document' });
          }
          if (['failed', 'cancelled'].includes(job.status)) window.clearInterval(tick);
        } catch {
          /* keep polling */
        }
        if (attempts > 40) window.clearInterval(tick);
      }, 1200);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal menulis draf');
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(id: string) {
    try {
      const response = await fetch(`/api/assets/${id}/file`);
      setMarkdown(await response.text());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal membuka dokumen');
    }
  }

  return (
    <AppLayout title={t('write.title')} subtitle={t('write.subtitle')}>
      <div className="split">
        <div className="stack" style={{ gap: 18 }}>
          <section className="card stack">
            <div className="chip-row">
              {(['script', 'article', 'social'] as Kind[]).map((item) => (
                <button key={item} className={`chip ${kind === item ? 'active' : ''}`} onClick={() => setKind(item)}>
                  {item === 'script' ? t('write.kindScript') : item === 'article' ? t('write.kindArticle') : t('write.kindSocial')}
                </button>
              ))}
            </div>
            <Field label={t('write.topic')}>
              <textarea
                className="textarea"
                placeholder={t('write.topicPlaceholder')}
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
              />
            </Field>
            {kind === 'script' ? (
              <div className="composer-row">
                <Field label={t('studio.mode')}>
                  <select className="select" value={mode} onChange={(event) => setMode(event.target.value)}>
                    {(catalog?.modes ?? ['cinematic', 'social', 'commercial', 'freeform']).map((item) => (
                      <option key={item} value={item}>{t(`mode.${item}`)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={`${t('studio.duration')} (${t('common.seconds')})`}>
                  <select className="select" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                    {(catalog?.durations ?? [15, 30, 60]).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('studio.style')}>
                  <select className="select" value={styleId} onChange={(event) => setStyleId(event.target.value)}>
                    {(catalog?.styles ?? []).map((style) => (
                      <option key={style.id} value={style.id}>{style.name[language] ?? style.name.en}</option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : null}
            <div className="row">
              <span className="spacer" />
              <button className="btn btn-primary" onClick={() => void handleGenerate()} disabled={busy || !topic.trim()}>
                {busy ? <span className="spinner" /> : <Icon name="pen" size={15} />} {t('write.generate')}
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <Icon name="pen" size={16} />
              <span className="card-title">{t('write.output')}</span>
              <span className="card-spacer" />
              {markdown ? (
                <button className="btn btn-sm btn-ghost" onClick={() => void navigator.clipboard?.writeText(markdown)}>
                  <Icon name="copy" size={13} /> {t('common.copy')}
                </button>
              ) : null}
            </div>
            {markdown ? (
              <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
            ) : (
              <EmptyState>{t('write.empty')}</EmptyState>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card tight">
            <div className="card-header">
              <Icon name="folder" size={16} />
              <span className="card-title">{t('assets.title')}</span>
              <span className="card-spacer" />
              <Pill>{documents.length}</Pill>
            </div>
            {documents.length === 0 ? (
              <div className="card-sub">{t('assets.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                {documents.slice(0, 10).map((asset) => (
                  <div className="row tight" key={asset.id}>
                    <button className="thread-item" style={{ flex: 1 }} onClick={() => void openDocument(asset.id)}>
                      <span className="thread-title" style={{ display: 'block' }}>{asset.name}</span>
                      <span className="thread-meta">{relativeTime(asset.createdAt, language)}</span>
                    </button>
                    <a className="btn btn-sm btn-ghost" href={api.assetDownloadUrl(asset.id)}>
                      <Icon name="download" size={13} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card tight">
            <div className="card-header">
              <Icon name="sparkles" size={16} />
              <span className="card-title">{t('jobs.title')}</span>
            </div>
            {writeJobs.length === 0 ? (
              <div className="card-sub">{t('jobs.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {writeJobs.map((job) => (
                  <JobCard key={job.id} job={job} language={language} t={t} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
