import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { EmptyState, Pill, StatusPill } from '../components/ui';
import { useApp } from '../state/AppState';
import { navigate } from '../lib/router';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import type { Project } from '../lib/types';

type SortKey = 'recent' | 'title' | 'shots';

export function ProjectsPage() {
  const { t, language, projects, reloadProjects, setError } = useApp();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | Project['status']>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const list = projects.filter((project) => {
      if (status !== 'all' && project.status !== status) return false;
      if (!search) return true;
      return `${project.title} ${project.prompt}`.toLowerCase().includes(search);
    });
    return list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'shots') return b.shots.length - a.shots.length;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [projects, query, status, sort]);

  async function handleDelete(project: Project) {
    if (!window.confirm(t('project.deleteConfirm'))) return;
    try {
      await api.deleteProject(project.id);
      await reloadProjects();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Delete failed');
    }
  }

  return (
    <AppLayout
      title={t('projects.title')}
      subtitle={t('projects.subtitle')}
      actions={
        <>
          <button className="btn btn-sm" onClick={() => void reloadProjects()}>
            <Icon name="refresh" size={14} /> {t('common.reload')}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => navigate('/studio')}>
            <Icon name="plus" size={15} /> {t('home.newProject')}
          </button>
        </>
      }
    >
      <section className="card tight">
        <div className="row">
          <label className="row tight" style={{ flex: '1 1 240px' }}>
            <Icon name="search" size={15} />
            <input className="input" placeholder={t('common.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select className="select" style={{ maxWidth: 190 }} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="all">{t('common.all')}</option>
            <option value="draft">{t('status.draft')}</option>
            <option value="running">{t('status.running')}</option>
            <option value="ready">{t('status.ready')}</option>
            <option value="failed">{t('status.failed')}</option>
          </select>
          <select className="select" style={{ maxWidth: 180 }} value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="recent">{t('projects.newest')}</option>
            <option value="title">{t('projects.title')}</option>
            <option value="shots">{t('common.shots')}</option>
          </select>
          <span className="spacer" />
          <Pill>{filtered.length} / {projects.length}</Pill>
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState
          action={
            <button className="btn btn-primary" onClick={() => navigate('/studio')}>
              <Icon name="sparkles" size={15} /> {t('studio.generate')}
            </button>
          }
        >
          {projects.length === 0 ? t('projects.empty') : t('common.empty')}
        </EmptyState>
      ) : (
        <div className="grid cols-3">
          {filtered.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-cover" onClick={() => navigate(`/projects/${project.id}`)}>
                {project.coverAssetId ? (
                  <img src={`/api/assets/${project.coverAssetId}/file`} alt={project.title} loading="lazy" />
                ) : (
                  <div className="cover-empty">{t('status.draft')}</div>
                )}
                <span className="overlay-tag">
                  <Icon name="film" size={12} /> {project.shots.length} {t('common.shots')}
                </span>
                <div className="overlay-hover">
                  <button className="btn btn-sm" onClick={(event) => { event.stopPropagation(); void handleDelete(project); }}>
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
              <div className="project-body">
                <div className="project-title truncate" title={project.title}>{project.title}</div>
                <div className="project-meta">
                  <StatusPill status={project.status} language={language} />
                  <span>{t(`mode.${project.mode}`)}</span>
                  <span>·</span>
                  <span>{project.aspect}</span>
                  <span>·</span>
                  <span>{project.durationSeconds}s</span>
                </div>
                <div className="project-meta">
                  <span>{t('projects.updated')} {relativeTime(project.updatedAt, language)}</span>
                </div>
                <div className="project-footer">
                  <button className="btn btn-sm" onClick={() => navigate(`/projects/${project.id}`)}>
                    <Icon name="grid" size={13} /> {t('project.storyboard')}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={async () => {
                      await api.renderProject(project.id, { translate: true, bilingual: true });
                      await reloadProjects();
                    }}
                  >
                    <Icon name="play" size={13} /> {t('project.render')}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
