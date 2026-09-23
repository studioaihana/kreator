import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { EmptyState, Field, JobCard, Pill } from '../components/ui';
import { useApp } from '../state/AppState';
import { api } from '../lib/api';
import { formatBytes, formatTimecode, relativeTime } from '../lib/format';
import type { Asset, TranslationDoc } from '../lib/types';

type Tab = 'file' | 'text';

export function TranslatePage() {
  const { t, language, jobs, translations, reloadJobs, reloadTranslations, assets, reloadAssets, setError } = useApp();
  const [tab, setTab] = useState<Tab>('file');
  const [uploaded, setUploaded] = useState<Asset | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState<'auto' | 'id' | 'en'>('auto');
  const [targetLanguage, setTargetLanguage] = useState(language === 'id' ? 'en' : 'id');
  const [bilingual, setBilingual] = useState(true);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoLoaded = useRef(false);

  const mediaAssets = useMemo(() => assets.filter((asset) => asset.kind === 'video' || asset.kind === 'audio'), [assets]);
  const activeDoc = translations.find((doc) => doc.id === selected) ?? translations[0] ?? null;
  const translateJobs = jobs.filter((job) => job.kind === 'translate' || job.kind === 'import');

  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    void reloadAssets();
    void reloadTranslations();
  }, [reloadAssets, reloadTranslations]);

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const asset = await api.uploadAsset(file);
      setUploaded(asset);
      await reloadAssets();
      await reloadJobs();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload gagal');
    } finally {
      setBusy(false);
    }
  }

  async function handleTranscribe() {
    if (!uploaded) return;
    setBusy(true);
    try {
      await api.transcribe(uploaded.id, sourceLanguage === 'auto' ? language : sourceLanguage);
      await reloadJobs();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Transkripsi gagal');
    } finally {
      setBusy(false);
    }
  }

  async function handleTranslateText() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.translate({
        text,
        sourceName: 'teks-manual',
        sourceLanguage,
        targetLanguage,
        bilingual,
        totalSeconds: Math.max(20, text.length / 14),
      });
      await reloadJobs();
      window.setTimeout(() => void reloadTranslations(), 2500);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Terjemahan gagal');
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview() {
    if (!text.trim()) return;
    try {
      const result = await api.translatePreview(text, targetLanguage);
      setPreview(result.translation);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Pratinjau gagal');
    }
  }

  async function translateExisting() {
    if (!activeDoc) return;
    setBusy(true);
    try {
      await api.translate({
        text: activeDoc.cues.map((cue) => cue.text).join(' '),
        sourceName: activeDoc.sourceName,
        sourceLanguage: activeDoc.sourceLanguage,
        targetLanguage: activeDoc.targetLanguage === 'id' ? 'en' : 'id',
        bilingual,
        totalSeconds: activeDoc.cues.at(-1)?.end ?? 60,
      });
      await reloadJobs();
      window.setTimeout(() => void reloadTranslations(), 2500);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Terjemahan gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout
      title={t('translate.title')}
      subtitle={t('translate.subtitle')}
      actions={
        <div className="tabs">
          <button className={`tab ${tab === 'file' ? 'active' : ''}`} onClick={() => setTab('file')}>{t('translate.tabFile')}</button>
          <button className={`tab ${tab === 'text' ? 'active' : ''}`} onClick={() => setTab('text')}>{t('translate.tabText')}</button>
        </div>
      }
    >
      <div className="split">
        <div className="stack" style={{ gap: 18 }}>
          {tab === 'file' ? (
            <section className="card stack">
              <div className="card-header" style={{ marginBottom: 0 }}>
                <Icon name="film" size={17} />
                <span className="card-title">{t('translate.upload')}</span>
              </div>
              <div
                className={`dropzone ${dragOver ? 'dragging' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  void handleUpload(event.dataTransfer.files[0]);
                }}
              >
                <Icon name="upload" size={22} />
                <div style={{ fontWeight: 550 }}>{busy ? t('common.generating') : t('translate.upload')}</div>
                <div className="hint">{t('translate.uploadHint')}</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/*,audio/*"
                  hidden
                  onChange={(event) => void handleUpload(event.target.files?.[0])}
                />
              </div>

              {uploaded ? (
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="row tight">
                    <Icon name="check" size={14} />
                    <span>{uploaded.name}</span>
                    <Pill>{formatBytes(uploaded.sizeBytes)}</Pill>
                  </span>
                  <button className="btn btn-sm" onClick={() => void handleTranscribe()} disabled={busy}>
                    {busy ? <span className="spinner" /> : <Icon name="wand" size={13} />} {t('translate.transcribe')}
                  </button>
                </div>
              ) : null}

              {mediaAssets.length > 0 ? (
                <div className="stack" style={{ gap: 8 }}>
                  <span className="field-label">{t('translate.uploaded')}</span>
                  <div className="chip-row">
                    {mediaAssets.slice(0, 8).map((asset) => (
                      <button key={asset.id} className={`chip ${uploaded?.id === asset.id ? 'active' : ''}`} onClick={() => setUploaded(asset)}>
                        {asset.name.length > 26 ? `${asset.name.slice(0, 24)}…` : asset.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="composer-row">
                <Field label={t('translate.sourceLanguage')}>
                  <select className="select" value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value as typeof sourceLanguage)}>
                    <option value="auto">{t('translate.auto')}</option>
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
                  </select>
                </Field>
                <Field label={t('translate.targetLanguage')}>
                  <select className="select" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value as 'id' | 'en')}>
                    <option value="en">English</option>
                    <option value="id">Bahasa Indonesia</option>
                  </select>
                </Field>
              </div>
              <label className={`chip ${bilingual ? 'active' : ''}`} style={{ alignSelf: 'flex-start' }} onClick={() => setBilingual((value) => !value)}>
                <Icon name="check" size={13} /> {t('translate.bilingual')}
              </label>
            </section>
          ) : (
            <section className="card stack">
              <div className="card-header" style={{ marginBottom: 0 }}>
                <Icon name="pen" size={17} />
                <span className="card-title">{t('translate.tabText')}</span>
              </div>
              <textarea
                className="textarea"
                style={{ minHeight: 150 }}
                placeholder="Halo semuanya, hari ini kita akan membahas cara menjaga konsistensi produksi konten."
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              <div className="composer-row">
                <Field label={t('translate.sourceLanguage')}>
                  <select className="select" value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value as typeof sourceLanguage)}>
                    <option value="auto">{t('translate.auto')}</option>
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
                  </select>
                </Field>
                <Field label={t('translate.targetLanguage')}>
                  <select className="select" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value as 'id' | 'en')}>
                    <option value="en">English</option>
                    <option value="id">Bahasa Indonesia</option>
                  </select>
                </Field>
              </div>
              <label className={`chip ${bilingual ? 'active' : ''}`} style={{ alignSelf: 'flex-start' }} onClick={() => setBilingual((value) => !value)}>
                <Icon name="check" size={13} /> {t('translate.bilingual')}
              </label>
              <div className="row">
                <button className="btn btn-ghost" onClick={() => void handlePreview()} disabled={!text.trim()}>
                  <Icon name="wand" size={14} /> {t('translate.preview')}
                </button>
                <span className="spacer" />
                <button className="btn btn-primary" onClick={() => void handleTranslateText()} disabled={busy || !text.trim()}>
                  {busy ? <span className="spinner" /> : <Icon name="translate" size={15} />} {t('translate.run')}
                </button>
              </div>
              {preview ? (
                <div className="stack" style={{ gap: 6 }}>
                  <span className="field-label">{t('translate.preview')}</span>
                  <div className="cue">
                    <span className="cue-source">{text.slice(0, 120)}</span>
                    <span className="cue-target">{preview}</span>
                  </div>
                </div>
              ) : (
                <span className="hint">{t('translate.previewHint')}</span>
              )}
            </section>
          )}

          <section className="card tight">
            <div className="card-header">
              <Icon name="clock" size={16} />
              <span className="card-title">{t('translate.history')}</span>
              <span className="card-spacer" />
              <Pill>{translations.length}</Pill>
            </div>
            {translations.length === 0 ? (
              <div className="card-sub">{t('common.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                {translations.map((doc: TranslationDoc) => (
                  <button
                    key={doc.id}
                    className={`thread-item ${activeDoc?.id === doc.id ? 'active' : ''}`}
                    onClick={() => setSelected(doc.id)}
                  >
                    <span className="thread-title" style={{ display: 'block' }}>{doc.sourceName}</span>
                    <span className="thread-meta">
                      {String(doc.sourceLanguage).toUpperCase()} → {String(doc.targetLanguage).toUpperCase()} · {doc.cues.length} {t('translate.cues')} ·{' '}
                      {relativeTime(doc.createdAt, language)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card tight">
            <div className="card-header">
              <Icon name="layers" size={16} />
              <span className="card-title">{t('jobs.title')}</span>
            </div>
            {translateJobs.length === 0 ? (
              <div className="card-sub">{t('jobs.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {translateJobs.slice(0, 4).map((job) => (
                  <JobCard key={job.id} job={job} language={language} t={t} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card tight">
            <div className="card-header">
              <Icon name="translate" size={16} />
              <span className="card-title">{t('translate.transcript')}</span>
              <span className="card-spacer" />
              {activeDoc ? <Pill tone="accent">{String(activeDoc.targetLanguage).toUpperCase()}</Pill> : null}
            </div>
            {!activeDoc ? (
              <EmptyState>{t('common.empty')}</EmptyState>
            ) : (
              <div className="stack" style={{ gap: 12 }}>
                <div className="row tight">
                  <button className="btn btn-sm btn-primary" onClick={() => void translateExisting()} disabled={busy}>
                    {busy ? <span className="spinner" /> : <Icon name="wand" size={13} />} {t('translate.run')}
                  </button>
                  <a className="btn btn-sm" href={`/api/translations`} onClick={(event) => event.preventDefault()} style={{ display: 'none' }}>
                    {t('translate.downloadSrt')}
                  </a>
                  <span className="spacer" />
                </div>
                <div className="cue-list">
                  {activeDoc.cues.map((cue) => (
                    <div className="cue" key={cue.index}>
                      <span className="cue-time">{formatTimecode(cue.start)} → {formatTimecode(cue.end)}</span>
                      <span className="cue-source">{cue.text}</span>
                      {cue.translation ? <span className="cue-target">{cue.translation}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="card tight">
            <div className="card-header">
              <Icon name="grid" size={16} />
              <span className="card-title">{t('translate.glossary')}</span>
            </div>
            <div className="card-sub" style={{ marginBottom: 10 }}>{t('translate.glossaryHint')}</div>
            <div className="stack" style={{ gap: 6 }}>
              {[
                { source: 'brief', target: 'brief' },
                { source: 'storyboard', target: 'storyboard' },
                { source: 'voice-over', target: 'voice-over' },
                { source: 'hook', target: 'hook' },
                { source: 'keranjang kuning', target: 'yellow cart' },
              ].map((term) => (
                <div className="glossary-item" key={term.source}>
                  <span className="mono">{term.source}</span>
                  <Icon name="chevron-right" size={13} />
                  <span className="mono" style={{ color: 'var(--accent)' }}>{term.target}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
