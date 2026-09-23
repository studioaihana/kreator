import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { EmptyState, JobCard, Pill, StatusPill } from '../components/ui';
import { useApp } from '../state/AppState';
import { navigate } from '../lib/router';
import { api } from '../lib/api';
import { formatBytes, relativeTime } from '../lib/format';
import { localeText } from '../lib/i18n';
import type { Asset } from '../lib/types';

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const { t, language, projects, jobs, assets, reloadProjects, reloadJobs, reloadAssets, setError, catalog } = useApp();
  const project = projects.find((item) => item.id === projectId);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!project) void reloadProjects();
  }, [project, reloadProjects]);

  useEffect(() => {
    void reloadAssets({ projectId });
  }, [projectId, reloadAssets]);

  const projectJobs = useMemo(() => jobs.filter((job) => job.projectId === projectId), [jobs, projectId]);
  const projectAssets = useMemo(() => assets.filter((asset) => asset.meta?.projectId === projectId), [assets, projectId]);
  const style = catalog?.styles.find((item) => item.id === project?.styleId);

  const shots = project?.shots ?? [];

  // Simple storyboard player: advances a frame per shot duration.
  useEffect(() => {
    if (!playing || shots.length === 0) {
      if (timer.current) window.clearTimeout(timer.current);
      return undefined;
    }
    const current = shots[frame] ?? shots[0]!;
    timer.current = window.setTimeout(() => {
      setFrame((value) => (value + 1) % shots.length);
    }, Math.max(900, current.durationSeconds * 420));
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [playing, frame, shots]);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  function speak() {
    if (!project || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const script = shots
      .map((shot) => localeText(shot.narration, project.targetLanguage) || localeText(shot.narration, language))
      .filter(Boolean)
      .join(' ');
    if (!script) return;
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = project.targetLanguage === 'id' ? 'id-ID' : 'en-US';
    utterance.rate = 0.98;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  async function runRender() {
    if (!project) return;
    setBusy('render');
    try {
      await api.renderProject(project.id, { translate: true, bilingual: true });
      await reloadJobs();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Render gagal');
    } finally {
      setBusy(null);
    }
  }

  async function runDub() {
    if (!project) return;
    setBusy('dub');
    try {
      await api.dubProject(project.id, { language: project.targetLanguage, presetId: 'warm-narrator' });
      await reloadJobs();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Dubbing gagal');
    } finally {
      setBusy(null);
    }
  }

  if (!project) {
    return (
      <AppLayout title={t('project.storyboard')}>
        <EmptyState action={<button className="btn" onClick={() => navigate('/projects')}>{t('common.back')}</button>}>
          {t('common.loading')}
        </EmptyState>
      </AppLayout>
    );
  }

  const currentShot = shots[frame] ?? shots[0];
  const exportAssets = projectAssets.filter((asset) => ['subtitle', 'document', 'audio'].includes(asset.kind));
  const frameAssets = shots
    .map((shot) => ({ shot, asset: projectAssets.find((asset) => asset.id === shot.imageAssetId) }))
    .filter((entry) => entry.asset);

  return (
    <AppLayout
      title={project.title}
      subtitle={`${t(`mode.${project.mode}`)} · ${project.aspect} · ${project.durationSeconds}s · ${style?.name[language] ?? project.styleId}`}
      actions={
        <>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/projects')}>
            <Icon name="chevron-left" size={14} /> {t('common.back')}
          </button>
          <button className="btn btn-sm" disabled={busy !== null} onClick={() => void runDub()}>
            {busy === 'dub' ? <span className="spinner" /> : <Icon name="volume" size={14} />} {t('project.dub')}
          </button>
          <button className="btn btn-sm btn-primary" disabled={busy !== null} onClick={() => void runRender()}>
            {busy === 'render' ? <span className="spinner" /> : <Icon name="play" size={14} />} {t('project.render')}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 360px)', gap: 18, alignItems: 'start', width: '100%' }}>
        <div className="stack" style={{ gap: 18 }}>
          <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="shot-frame" style={{ aspectRatio: project.aspect.replace(':', ' / ') }}>
              {currentShot?.imageAssetId ? (
                <img src={`/api/assets/${currentShot.imageAssetId}/file`} alt={localeText(currentShot.title, language)} />
              ) : (
                <div className="placeholder">
                  {project.status === 'running' ? <span className="spinner" /> : t('player.frames')}
                </div>
              )}
              {currentShot ? (
                <>
                  <span className="overlay-tag">
                    {t('project.shot')} {currentShot.index}/{shots.length} · {currentShot.durationSeconds}s
                  </span>
                  <span className="overlay-tag right">{currentShot.motion}</span>
                </>
              ) : null}
            </div>
            <div style={{ padding: 14 }} className="stack">
              <div className="row">
                <button
                  className="btn btn-sm"
                  onClick={() => setFrame((value) => (value - 1 + shots.length) % Math.max(1, shots.length))}
                  disabled={shots.length === 0}
                >
                  <Icon name="chevron-left" size={14} />
                </button>
                <button className="btn btn-sm btn-primary" onClick={() => setPlaying((value) => !value)} disabled={shots.length === 0}>
                  <Icon name={playing ? 'stop' : 'play'} size={14} /> {playing ? t('player.pause') : t('player.play')}
                </button>
                <button className="btn btn-sm" onClick={() => setFrame((value) => (value + 1) % Math.max(1, shots.length))} disabled={shots.length === 0}>
                  <Icon name="chevron-right" size={14} />
                </button>
                {currentShot?.caption ? (
                  <span className="pill accent">{localeText(currentShot.caption, language)}</span>
                ) : null}
              </div>
              {shots.length > 0 ? (
                <div className="chip-row">
                  {shots.map((shot, index) => (
                    <button
                      key={shot.id}
                      className={`chip ${index === frame ? 'active' : ''}`}
                      onClick={() => setFrame(index)}
                      title={localeText(shot.title, language)}
                    >
                      {shot.index}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <span className="section-title">{t('project.storyboard')}</span>
              <span className="section-sub">{shots.length} {t('common.shots')}</span>
            </div>
            {shots.length === 0 ? (
              <EmptyState>{project.status === 'running' ? t('common.generating') : t('common.empty')}</EmptyState>
            ) : (
              <div className="shot-grid">
                {shots.map((shot) => (
                  <article className="shot-card" key={shot.id}>
                    <div className="shot-frame">
                      {shot.imageAssetId ? (
                        <img src={`/api/assets/${shot.imageAssetId}/file`} alt="" loading="lazy" />
                      ) : (
                        <div className="placeholder">{t('common.generating')}</div>
                      )}
                      <span className="overlay-tag">{shot.index} · {shot.durationSeconds}s</span>
                    </div>
                    <div className="shot-info">
                      <div className="shot-title">
                        {localeText(shot.title, language)}
                        <Pill>{shot.motion}</Pill>
                      </div>
                      <div className="shot-desc">{localeText(shot.description, language)}</div>
                      <div className="shot-caption">“{localeText(shot.caption, language)}”</div>
                      <div className="shot-narration">{localeText(shot.narration, language)}</div>
                      <div className="code-line" title={shot.imagePrompt}>{shot.imagePrompt}</div>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => void navigator.clipboard?.writeText(shot.imagePrompt)}
                      >
                        <Icon name="copy" size={12} /> {t('common.copy')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <div className="section-head">
              <span className="section-title">{t('project.export')}</span>
              <span className="section-sub">{projectAssets.length} {t('common.assets')}</span>
            </div>
            {exportAssets.length === 0 ? (
              <EmptyState>{t('assets.empty')}</EmptyState>
            ) : (
              <div className="card tight">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('common.open')}</th>
                      <th>{t('assets.origin')}</th>
                      <th>{t('assets.size')}</th>
                      <th>{t('assets.created')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {exportAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="truncate" style={{ maxWidth: 260 }}>
                          <span className="row tight">
                            <Icon name={asset.kind === 'audio' ? 'volume' : asset.kind === 'subtitle' ? 'translate' : 'pen'} size={13} />
                            {asset.name}
                          </span>
                        </td>
                        <td><Pill>{asset.origin}</Pill></td>
                        <td>{formatBytes(asset.sizeBytes)}</td>
                        <td>{relativeTime(asset.createdAt, language)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <a className="btn btn-sm btn-ghost" href={api.assetDownloadUrl(asset.id)}>
                            <Icon name="download" size={13} /> {t('common.download')}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card tight">
            <div className="card-header">
              <Icon name="sparkles" size={16} />
              <span className="card-title">{t('project.summary')}</span>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row tight">
                <StatusPill status={project.status} language={language} />
                <Pill tone="accent">{t(`mode.${project.mode}`)}</Pill>
                <Pill>{project.aspect}</Pill>
              </div>
              <p className="card-sub" style={{ margin: 0 }}>{localeText(project.summary, language)}</p>
              <div className="code-line">{project.prompt}</div>
              <div className="row tight">
                <Pill>ID {project.language.toUpperCase()} → {project.targetLanguage.toUpperCase()}</Pill>
                <Pill>{t('project.voiceScript')}: {project.voiceEnabled ? t('studio.voiceOn') : t('studio.voiceOff')}</Pill>
              </div>
              <div className="row tight">
                <button className="btn btn-sm" onClick={speak} disabled={!window.speechSynthesis}>
                  <Icon name={speaking ? 'stop' : 'volume'} size={13} /> {speaking ? t('project.stopVoice') : t('project.playVoice')}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    await api.duplicateProject(project.id);
                    await reloadProjects();
                  }}
                >
                  <Icon name="copy" size={13} /> {t('project.duplicate')}
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={async () => {
                    if (!window.confirm(t('project.deleteConfirm'))) return;
                    await api.deleteProject(project.id);
                    await reloadProjects();
                    navigate('/projects');
                  }}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
              {!window.speechSynthesis ? <div className="hint">{t('player.voiceUnsupported')}</div> : null}
            </div>
          </section>

          <section className="card tight">
            <div className="card-header">
              <Icon name="layers" size={16} />
              <span className="card-title">{t('project.versions')}</span>
              <span className="card-spacer" />
              <Pill>{project.versions.length}</Pill>
            </div>
            {project.versions.length === 0 ? (
              <div className="card-sub">{t('common.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {project.versions.map((version) => (
                  <div key={version.id} className="row tight" style={{ fontSize: 12.5 }}>
                    <Icon name="clock" size={13} />
                    <span style={{ flex: 1 }}>{localeText(version.label, language)}</span>
                    <span className="card-sub">{relativeTime(version.createdAt, language)}</span>
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
            {projectJobs.length === 0 ? (
              <div className="card-sub">{t('jobs.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {projectJobs.slice(0, 4).map((job) => (
                  <JobCard key={job.id} job={job} language={language} t={t} />
                ))}
              </div>
            )}
          </section>

          {frameAssets.length > 0 ? (
            <section className="card tight">
              <div className="card-header">
                <Icon name="image" size={16} />
                <span className="card-title">{t('player.frames')}</span>
              </div>
              <div className="media-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {frameAssets.map(({ shot, asset }) => (
                  <button
                    key={asset?.id}
                    className="media-item"
                    onClick={() => setFrame(shot.index - 1)}
                    style={{ padding: 0, border: '1px solid var(--border)', background: 'none' }}
                  >
                    <div className="media-thumb" style={{ aspectRatio: '1 / 1' }}>
                      <img src={`/api/assets/${asset?.id}/file`} alt="" loading="lazy" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <AssetPanel assets={projectAssets.filter((asset) => asset.kind === 'image')} t={t} />
        </div>
      </div>
    </AppLayout>
  );
}

function AssetPanel({ assets, t }: { assets: Asset[]; t: (key: string) => string }) {
  return (
    <section className="card tight">
      <div className="card-header">
        <Icon name="folder" size={16} />
        <span className="card-title">{t('assets.preview')}</span>
      </div>
      <div className="row tight" style={{ justifyContent: 'space-between' }}>
        <span className="card-sub">{assets.length} {t('assets.title').toLowerCase()}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/assets')}>{t('common.viewAll')}</button>
      </div>
    </section>
  );
}
