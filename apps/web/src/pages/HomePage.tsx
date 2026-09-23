import { useMemo } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { EmptyState, Pill, StatusPill } from '../components/ui';
import { useApp } from '../state/AppState';
import { navigate } from '../lib/router';
import { relativeTime } from '../lib/format';
import type { HookPreset, Language, Project } from '../lib/types';

function ProjectCard({ project, language, t }: { project: Project; language: Language; t: (key: string) => string }) {
  return (
    <article className="project-card" onClick={() => navigate(`/projects/${project.id}`)}>
      <div className="project-cover">
        {project.coverAssetId ? (
          <img src={`/api/assets/${project.coverAssetId}/file`} alt={project.title} loading="lazy" />
        ) : (
          <div className="cover-empty">{t('common.loading')}</div>
        )}
        <span className="overlay-tag">
          <Icon name="film" size={12} /> {project.shots.length} {t('common.shots')}
        </span>
        <span className="overlay-tag right">{project.aspect} · {project.durationSeconds}s</span>
      </div>
      <div className="project-body">
        <div className="project-title truncate" title={project.title}>{project.title}</div>
        <div className="project-meta">
          <StatusPill status={project.status} language={language} />
          <span>{t(`mode.${project.mode}`)}</span>
          <span>·</span>
          <span>{relativeTime(project.updatedAt, language)}</span>
        </div>
      </div>
    </article>
  );
}

export function HomePage() {
  const { t, language, projects, catalog, jobs, runs, assets, reloadProjects, error } = useApp();
  const recent = projects.slice(0, 4);
  const hooks = useMemo(() => (catalog?.hooks ?? []).slice(0, 8), [catalog]);
  const templates = useMemo(() => (catalog?.templates ?? []).slice(0, 6), [catalog]);
  const activeJobs = jobs.filter((job) => ['running', 'queued'].includes(job.status));
  const recentRuns = runs.slice(0, 5);
  const imageAssets = assets.filter((asset) => asset.kind === 'image').slice(0, 6);

  return (
    <AppLayout
      title={t('app.name')}
      subtitle={t('app.tagline')}
      actions={
        <>
          <button className="btn btn-sm" onClick={() => void reloadProjects()}>
            <Icon name="refresh" size={14} /> {t('common.reload')}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => navigate('/studio')}>
            <Icon name="sparkles" size={14} /> {t('home.newProject')}
          </button>
        </>
      }
    >
      <section className="hero">
        <Pill tone="accent">{t('app.beta')} · open source</Pill>
        <h1 style={{ marginTop: 12 }}>{t('app.hero.title')}</h1>
        <p>{t('app.hero.subtitle')}</p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => navigate('/studio')}>
            <Icon name="wand" size={16} /> {t('home.startNow')}
          </button>
          <button className="btn" onClick={() => navigate('/agent')}>
            <Icon name="bot" size={16} /> {t('agent.title')}
          </button>
          <button className="btn" onClick={() => navigate('/translate')}>
            <Icon name="translate" size={16} /> {t('translate.title')}
          </button>
        </div>
      </section>

      {error ? (
        <div className="pill danger" style={{ alignSelf: 'flex-start' }}>
          <Icon name="alert" size={14} /> {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: 18, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 22 }}>
          <section className="section">
            <div className="section-head">
              <span className="section-title">{t('home.continue')}</span>
              <span className="section-sub">{projects.length} {t('nav.projects').toLowerCase()}</span>
              <span className="spacer" />
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>
                {t('common.viewAll')} <Icon name="chevron-right" size={14} />
              </button>
            </div>
            {recent.length === 0 ? (
              <EmptyState
                action={
                  <button className="btn btn-primary" onClick={() => navigate('/studio')}>
                    <Icon name="sparkles" size={15} /> {t('home.newProject')}
                  </button>
                }
              >
                {t('home.noProjects')}
              </EmptyState>
            ) : (
              <div className="grid cols-2">
                {recent.map((project) => (
                  <ProjectCard key={project.id} project={project} language={language} t={t} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <div className="section-head">
              <span className="section-title">{t('studio.directorSeeds')}</span>
              <span className="section-sub">{t('studio.seedsHint')}</span>
              <span className="spacer" />
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/studio')}>
                {t('common.viewAll')} <Icon name="chevron-right" size={14} />
              </button>
            </div>
            <div className="grid cols-3">
              {hooks.map((hook: HookPreset) => (
                <button
                  key={hook.id}
                  className="seed-card"
                  onClick={() => navigate(`/studio?seed=${hook.id}`)}
                  title={t('studio.oneClick')}
                >
                  <div className="seed-media">
                    <img src={`/api/catalog/preview/hook/${hook.id}`} alt="" loading="lazy" />
                    <span className="overlay-tag">{t('studio.oneClick')}</span>
                  </div>
                  <div className="seed-body">
                    <div className="seed-title">{hook.title[language] ?? hook.title.en}</div>
                    <div className="seed-desc">{hook.description[language] ?? hook.description.en}</div>
                    <div className="seed-tags">
                      {hook.tags.map((tag) => (
                        <span className="tag" key={tag.en}>{tag[language] ?? tag.en}</span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <span className="section-title">{t('studio.templates')}</span>
              <span className="section-sub">{t('studio.templatesHint')}</span>
            </div>
            <div className="grid cols-3">
              {templates.map((template) => (
                <button key={template.id} className="seed-card" onClick={() => navigate(`/studio?template=${template.id}`)}>
                  <div className="seed-media">
                    <img src={`/api/catalog/preview/template/${template.id}`} alt="" loading="lazy" />
                    <span className="overlay-tag">{template.kind}</span>
                  </div>
                  <div className="seed-body">
                    <div className="seed-title">{template.title[language] ?? template.title.en}</div>
                    <div className="seed-desc">{template.description[language] ?? template.description.en}</div>
                    <div className="seed-tags">
                      <span className="tag">{template.aspect}</span>
                      <span className="tag">{template.durationSeconds}s</span>
                      <span className="tag">{template.steps.length} {t('jobs.steps').toLowerCase()}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card tight">
            <div className="card-header">
              <Icon name="sparkles" size={16} />
              <span className="card-title">{t('jobs.title')}</span>
            </div>
            {activeJobs.length === 0 ? (
              <div className="card-sub">{t('jobs.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {activeJobs.slice(0, 3).map((job) => (
                  <div key={job.id} className="stack" style={{ gap: 6 }}>
                    <div className="row tight">
                      <StatusPill status={job.status} language={language} />
                      <span className="truncate" style={{ fontSize: 12.5 }}>{job.title}</span>
                    </div>
                    <div className="progress">
                      <i style={{ width: `${Math.round((job.steps.filter((step) => step.status === 'done').length / Math.max(1, job.steps.length)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card tight">
            <div className="card-header">
              <Icon name="layers" size={16} />
              <span className="card-title">{t('home.runs')}</span>
            </div>
            {recentRuns.length === 0 ? (
              <div className="card-sub">{t('common.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 9 }}>
                {recentRuns.map((run) => (
                  <div key={run.id} className="row tight" style={{ fontSize: 12.5 }}>
                    <StatusPill status={run.status} language={language} />
                    <span className="truncate" style={{ flex: 1 }} title={run.label}>{run.label}</span>
                    <span className="card-sub">{relativeTime(run.createdAt, language)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card tight">
            <div className="card-header">
              <Icon name="image" size={16} />
              <span className="card-title">{t('assets.title')}</span>
              <span className="card-spacer" />
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/assets')}>{t('common.open')}</button>
            </div>
            {imageAssets.length === 0 ? (
              <div className="card-sub">{t('assets.empty')}</div>
            ) : (
              <div className="media-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {imageAssets.map((asset) => (
                  <div className="media-item" key={asset.id}>
                    <div className="media-thumb" style={{ aspectRatio: '1 / 1' }}>
                      <img src={`/api/assets/${asset.id}/file`} alt={asset.name} loading="lazy" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card tight">
            <div className="card-header">
              <Icon name="clock" size={16} />
              <span className="card-title">{t('home.quick')}</span>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <button className="btn" onClick={() => navigate('/studio')}>
                <Icon name="sparkles" size={15} /> {t('studio.generate')}
              </button>
              <button className="btn" onClick={() => navigate('/images')}>
                <Icon name="image" size={15} /> {t('images.generate')}
              </button>
              <button className="btn" onClick={() => navigate('/translate')}>
                <Icon name="translate" size={15} /> {t('translate.run')}
              </button>
              <button className="btn" onClick={() => navigate('/write')}>
                <Icon name="pen" size={15} /> {t('write.generate')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
