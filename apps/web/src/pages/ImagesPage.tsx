import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { EmptyState, Field, JobCard, Pill } from '../components/ui';
import { useApp } from '../state/AppState';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import type { Asset } from '../lib/types';

export function ImagesPage() {
  const { t, language, catalog, jobs, assets, reloadAssets, reloadJobs, setError } = useApp();
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState('1:1');
  const [count, setCount] = useState(2);
  const [styleId, setStyleId] = useState('cinematic-golden');
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<Asset | null>(null);

  const imageAssets = useMemo(() => assets.filter((asset) => asset.kind === 'image'), [assets]);
  const imageJobs = jobs.filter((job) => job.kind === 'image');

  useEffect(() => {
    void reloadAssets({ kind: 'image' });
  }, [reloadAssets]);

  async function handleGenerate() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      await api.images({ prompt, aspect, count, styleId, language });
      await reloadJobs();
      window.setTimeout(() => void reloadAssets({ kind: 'image' }), 2200);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal membuat gambar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout title={t('images.title')} subtitle={t('images.subtitle')}>
      <div className="split">
        <div className="stack" style={{ gap: 18 }}>
          <section className="card stack">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <Icon name="image" size={17} />
              <span className="card-title">{t('images.prompt')}</span>
            </div>
            <textarea
              className="textarea"
              placeholder={t('images.promptPlaceholder')}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="composer-row">
              <Field label={t('studio.style')}>
                <select className="select" value={styleId} onChange={(event) => setStyleId(event.target.value)}>
                  {(catalog?.styles ?? []).map((style) => (
                    <option key={style.id} value={style.id}>{style.name[language] ?? style.name.en}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('studio.aspect')}>
                <select className="select" value={aspect} onChange={(event) => setAspect(event.target.value)}>
                  {(catalog?.aspects ?? ['16:9', '9:16', '1:1']).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('images.count')}>
                <select className="select" value={count} onChange={(event) => setCount(Number(event.target.value))}>
                  {[1, 2, 3, 4].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="row">
              <span className="spacer" />
              <button className="btn btn-primary" disabled={busy || !prompt.trim()} onClick={() => void handleGenerate()}>
                {busy ? <span className="spinner" /> : <Icon name="wand" size={15} />} {t('images.generate')}
              </button>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <span className="section-title">{t('images.gallery')}</span>
              <span className="section-sub">{imageAssets.length} {t('common.assets')}</span>
            </div>
            {imageAssets.length === 0 ? (
              <EmptyState>{t('assets.empty')}</EmptyState>
            ) : (
              <div className="media-grid">
                {imageAssets.map((asset) => (
                  <figure className="media-item" key={asset.id} style={{ margin: 0 }}>
                    <button
                      className="media-thumb"
                      style={{ border: 'none', padding: 0, cursor: 'zoom-in', background: 'none' }}
                      onClick={() => setLightbox(asset)}
                    >
                      <img src={`/api/assets/${asset.id}/file`} alt={asset.name} loading="lazy" />
                    </button>
                    <figcaption className="media-body">
                      <span className="media-name" title={asset.name}>{asset.name}</span>
                      <span className="row tight">
                        <Pill>{asset.origin}</Pill>
                        <span className="card-sub">{relativeTime(asset.createdAt, language)}</span>
                      </span>
                      <a className="btn btn-sm btn-ghost" href={api.assetDownloadUrl(asset.id)}>
                        <Icon name="download" size={13} /> {t('common.download')}
                      </a>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card tight">
            <div className="card-header">
              <Icon name="sparkles" size={16} />
              <span className="card-title">{t('images.result')}</span>
            </div>
            {imageJobs.length === 0 ? (
              <div className="card-sub">{t('jobs.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {imageJobs.slice(0, 3).map((job) => (
                  <JobCard key={job.id} job={job} language={language} t={t} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {lightbox ? (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 8, 12, 0.82)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            placeItems: 'center',
            padding: 28,
            zIndex: 90,
            cursor: 'zoom-out',
          }}
        >
          <div style={{ maxWidth: 'min(92vw, 1060px)', maxHeight: '88vh' }}>
            <img
              src={`/api/assets/${lightbox.id}/file`}
              alt={lightbox.name}
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 14, boxShadow: 'var(--shadow)' }}
            />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <span className="mono" style={{ fontSize: 12 }}>{lightbox.name}</span>
              <a className="btn btn-sm" href={api.assetDownloadUrl(lightbox.id)}>
                <Icon name="download" size={13} /> {t('common.download')}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
