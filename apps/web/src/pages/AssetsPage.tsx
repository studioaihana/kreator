import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { EmptyState, Pill } from '../components/ui';
import { useApp } from '../state/AppState';
import { api } from '../lib/api';
import { formatBytes, relativeTime } from '../lib/format';
import type { Asset } from '../lib/types';

const KINDS = ['all', 'image', 'video', 'audio', 'subtitle', 'document'] as const;

export function AssetsPage() {
  const { t, language, assets, reloadAssets, setError } = useApp();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('all');
  const [query, setQuery] = useState('');
  const [lightbox, setLightbox] = useState<Asset | null>(null);
  const [textPreview, setTextPreview] = useState<{ asset: Asset; content: string } | null>(null);

  useEffect(() => {
    void reloadAssets(kind === 'all' ? {} : { kind });
  }, [kind, reloadAssets]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return assets.filter((asset) => (search ? asset.name.toLowerCase().includes(search) : true));
  }, [assets, query]);

  async function openAsset(asset: Asset) {
    if (asset.kind === 'image') {
      setLightbox(asset);
      return;
    }
    if (['document', 'subtitle'].includes(asset.kind)) {
      try {
        const response = await fetch(api.assetUrl(asset.id));
        setTextPreview({ asset, content: await response.text() });
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Gagal membuka aset');
      }
      return;
    }
    window.open(api.assetUrl(asset.id), '_blank');
  }

  async function remove(asset: Asset) {
    try {
      await api.deleteAsset(asset.id);
      await reloadAssets(kind === 'all' ? {} : { kind });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal menghapus aset');
    }
  }

  return (
    <AppLayout
      title={t('assets.title')}
      subtitle={t('assets.subtitle')}
      actions={
        <button className="btn btn-sm" onClick={() => void reloadAssets(kind === 'all' ? {} : { kind })}>
          <Icon name="refresh" size={14} /> {t('common.reload')}
        </button>
      }
    >
      <section className="card tight">
        <div className="row">
          <div className="chip-row">
            {KINDS.map((item) => (
              <button key={item} className={`chip ${kind === item ? 'active' : ''}`} onClick={() => setKind(item)}>
                {item === 'all' ? t('common.all') : item}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <label className="row tight" style={{ minWidth: 200 }}>
            <Icon name="search" size={15} />
            <input className="input" placeholder={t('common.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Pill>{filtered.length}</Pill>
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState>{t('assets.empty')}</EmptyState>
      ) : (
        <div className="media-grid">
          {filtered.map((asset) => (
            <figure className="media-item" key={asset.id} style={{ margin: 0 }}>
              <button
                className="media-thumb"
                style={{ border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
                onClick={() => void openAsset(asset)}
              >
                {asset.kind === 'image' ? (
                  <img src={api.assetUrl(asset.id)} alt={asset.name} loading="lazy" />
                ) : (
                  <span className="row tight" style={{ color: 'var(--text-dim)' }}>
                    <Icon name={asset.kind === 'audio' ? 'volume' : asset.kind === 'video' ? 'film' : asset.kind === 'subtitle' ? 'translate' : 'pen'} size={22} />
                    <span style={{ fontSize: 11.5 }}>{asset.kind.toUpperCase()}</span>
                  </span>
                )}
              </button>
              <figcaption className="media-body">
                <span className="media-name" title={asset.name}>{asset.name}</span>
                <span className="row tight">
                  <Pill>{asset.origin}</Pill>
                  <span className="card-sub">{formatBytes(asset.sizeBytes)}</span>
                </span>
                <span className="card-sub">{relativeTime(asset.createdAt, language)}</span>
                <span className="row tight">
                  <a className="btn btn-sm btn-ghost" href={api.assetDownloadUrl(asset.id)}>
                    <Icon name="download" size={13} /> {t('common.download')}
                  </a>
                  <button className="btn btn-sm btn-ghost" onClick={() => void remove(asset)}>
                    <Icon name="trash" size={13} />
                  </button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

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
          <img
            src={api.assetUrl(lightbox.id)}
            alt={lightbox.name}
            style={{ maxWidth: 'min(92vw, 1080px)', maxHeight: '84vh', borderRadius: 14, boxShadow: 'var(--shadow)' }}
          />
        </div>
      ) : null}

      {textPreview ? (
        <div className="card" style={{ position: 'fixed', inset: '8vh 8vw', zIndex: 95, overflow: 'auto', boxShadow: 'var(--shadow)' }}>
          <div className="card-header">
            <Icon name="pen" size={16} />
            <span className="card-title truncate">{textPreview.asset.name}</span>
            <span className="card-spacer" />
            <button className="btn btn-sm btn-ghost" onClick={() => void navigator.clipboard?.writeText(textPreview.content)}>
              <Icon name="copy" size={13} /> {t('common.copy')}
            </button>
            <a className="btn btn-sm" href={api.assetDownloadUrl(textPreview.asset.id)}>
              <Icon name="download" size={13} /> {t('common.download')}
            </a>
            <button className="btn btn-sm btn-ghost" onClick={() => setTextPreview(null)}>
              <Icon name="x" size={14} />
            </button>
          </div>
          <pre className="log-box" style={{ maxHeight: '62vh', whiteSpace: 'pre-wrap' }}>{textPreview.content}</pre>
        </div>
      ) : null}
    </AppLayout>
  );
}
