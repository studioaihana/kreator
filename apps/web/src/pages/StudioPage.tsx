import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { Field, JobCard, Pill, StatusPill } from '../components/ui';
import { useApp } from '../state/AppState';
import { navigate, useRoute } from '../lib/router';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import type { HookPreset, StudioMode, TemplatePreset } from '../lib/types';

const CATEGORY_LABEL: Record<string, { id: string; en: string }> = {
  all: { id: 'Semua', en: 'All' },
  brand: { id: 'Brand Marketing', en: 'Brand Marketing' },
  product: { id: 'E-commerce', en: 'E-commerce' },
  film: { id: 'Film', en: 'Film' },
  entertainment: { id: 'Hiburan', en: 'Entertainment' },
};

export function StudioPage() {
  const { t, language, catalog, projects, jobs, reloadProjects, reloadJobs, setError } = useApp();
  const route = useRoute();
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<StudioMode>('cinematic');
  const [styleId, setStyleId] = useState('cinematic-golden');
  const [aspect, setAspect] = useState('16:9');
  const [duration, setDuration] = useState(30);
  const [roleId, setRoleId] = useState('');
  const [propId, setPropId] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hookId, setHookId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const hooks = catalog?.hooks ?? [];
  const templates = catalog?.templates ?? [];
  const styles = catalog?.styles ?? [];
  const activeHook = hooks.find((hook) => hook.id === hookId);

  // Deep links from the home galleries: /studio?seed=<hookId> or ?template=<id>
  useEffect(() => {
    const seed = route.query.get('seed');
    const template = route.query.get('template');
    if (seed) applyHook(hooks.find((hook) => hook.id === seed));
    if (template) applyTemplate(templates.find((item) => item.id === template));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, route.path]);

  const filteredHooks = useMemo(
    () => (category === 'all' ? hooks : hooks.filter((hook) => hook.category === category)),
    [hooks, category],
  );

  function applyHook(hook?: HookPreset) {
    if (!hook) return;
    setHookId(hook.id);
    setTemplateId(null);
    setPrompt(hook.prompt);
    setMode(hook.mode);
    setStyleId(hook.styleId);
    setAspect(hook.aspect);
    setDuration(hook.durationSeconds);
  }

  function applyTemplate(template?: TemplatePreset) {
    if (!template) return;
    setTemplateId(template.id);
    setHookId(null);
    setPrompt(template.prompt);
    setStyleId(template.styleId);
    setAspect(template.aspect);
    setDuration(template.durationSeconds);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 4)) {
        const asset = await api.uploadAsset(file);
        setAttachments((current) => [...current, asset.id]);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload gagal');
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      const { jobId, projectId } = await api.createProject({
        prompt,
        mode,
        styleId,
        aspect,
        durationSeconds: duration,
        language,
        targetLanguage: language === 'id' ? 'en' : 'id',
        hookId: hookId ?? undefined,
        templateId: templateId ?? undefined,
        roleId: roleId || undefined,
        propId: propId || undefined,
        voiceEnabled,
      });
      setActiveJobId(jobId);
      await reloadJobs();
      await reloadProjects();
      window.setTimeout(() => navigate(`/projects/${projectId}`), 1800);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal membuat proyek');
    } finally {
      setBusy(false);
    }
  }

  const activeJob = jobs.find((job) => job.id === activeJobId);
  const engineLabel = styles.find((style) => style.id === styleId)?.name[language] ?? styleId;

  return (
    <AppLayout
      title={t('studio.title')}
      subtitle={t('studio.brief')}
      actions={
        <button className="btn btn-sm" onClick={() => void reloadProjects()}>
          <Icon name="refresh" size={14} /> {t('common.reload')}
        </button>
      }
    >
      <div className="studio-layout">
        <div className="stack" style={{ gap: 18 }}>
          <section className="card composer">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <Icon name="wand" size={18} />
              <span className="card-title">{t('studio.title')}</span>
              <span className="card-spacer" />
              <Pill tone="accent">{t('studio.engine')}: {engineLabel}</Pill>
            </div>

            <textarea
              className="textarea"
              style={{ minHeight: 120 }}
              placeholder={t('studio.briefPlaceholder')}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />

            <div className="chip-row">
              {(catalog?.modes ?? (['cinematic', 'social', 'commercial', 'freeform'] as StudioMode[])).map((item) => (
                <button key={item} className={`chip ${mode === item ? 'active' : ''}`} onClick={() => setMode(item)}>
                  {t(`mode.${item}`)}
                </button>
              ))}
            </div>

            <div className="composer-row">
              <Field label={t('studio.role')}>
                <select className="select" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
                  <option value="">{t('common.all')}</option>
                  {(catalog?.roles ?? []).map((role) => (
                    <option key={role.id} value={role.id}>{role.label[language] ?? role.label.en}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('studio.prop')}>
                <select className="select" value={propId} onChange={(event) => setPropId(event.target.value)}>
                  <option value="">{t('common.all')}</option>
                  {(catalog?.props ?? []).map((prop) => (
                    <option key={prop.id} value={prop.id}>{prop.label[language] ?? prop.label.en}</option>
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
              <Field label={`${t('studio.duration')} (${t('common.seconds')})`}>
                <select className="select" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                  {(catalog?.durations ?? [15, 30, 60]).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label={t('studio.style')}>
              <select className="select" value={styleId} onChange={(event) => setStyleId(event.target.value)}>
                {styles.map((style) => (
                  <option key={style.id} value={style.id}>{style.name[language] ?? style.name.en}</option>
                ))}
              </select>
            </Field>

            <div className="composer-actions">
              <button className={`chip ${voiceEnabled ? 'active' : ''}`} onClick={() => setVoiceEnabled((value) => !value)}>
                <Icon name="volume" size={13} /> {t('studio.voice')}: {voiceEnabled ? t('studio.voiceOn') : t('studio.voiceOff')}
              </button>
              <label className="chip" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <Icon name="upload" size={13} /> {uploading ? t('common.generating') : t('studio.addAsset')}
                <input type="file" hidden multiple onChange={(event) => void handleUpload(event.target.files)} />
              </label>
              {attachments.length > 0 ? (
                <Pill tone="success">
                  <Icon name="check" size={12} /> {attachments.length} {t('common.assets')}
                </Pill>
              ) : null}
              <span className="spacer" />
              <button className="btn btn-primary" disabled={busy || !prompt.trim()} onClick={() => void handleGenerate()}>
                {busy ? <span className="spinner" /> : <Icon name="sparkles" size={16} />}
                {busy ? t('studio.generating') : t('studio.generate')}
              </button>
            </div>

            {activeJob ? (
              <JobCard
                job={activeJob}
                language={language}
                t={t}
                onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
              />
            ) : null}
          </section>

          <section className="section">
            <div className="section-head">
              <span className="section-title">{t('studio.directorSeeds')}</span>
              <span className="section-sub">{t('studio.seedsHint')}</span>
            </div>
            <div className="chip-row">
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <button key={key} className={`chip ${category === key ? 'active' : ''}`} onClick={() => setCategory(key)}>
                  {label[language]}
                </button>
              ))}
            </div>
            <div className="grid cols-3">
              {filteredHooks.map((hook) => (
                <button
                  key={hook.id}
                  className={`seed-card ${hookId === hook.id ? 'active' : ''}`}
                  onClick={() => applyHook(hook)}
                >
                  <div className="seed-media">
                    <img src={`/api/catalog/preview/hook/${hook.id}`} alt="" loading="lazy" />
                    <span className="overlay-tag">{t('studio.oneClick')}</span>
                    <span className="overlay-tag right">{hook.durationSeconds}s</span>
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
                <button
                  key={template.id}
                  className={`seed-card ${templateId === template.id ? 'active' : ''}`}
                  onClick={() => applyTemplate(template)}
                >
                  <div className="seed-media">
                    <img src={`/api/catalog/preview/template/${template.id}`} alt="" loading="lazy" />
                    <span className="overlay-tag">{template.kind.toUpperCase()}</span>
                  </div>
                  <div className="seed-body">
                    <div className="seed-title">{template.title[language] ?? template.title.en}</div>
                    <div className="seed-desc">{template.description[language] ?? template.description.en}</div>
                    <div className="seed-tags">
                      {template.steps.map((step) => (
                        <span className="tag" key={step.en}>{step[language] ?? step.en}</span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          {activeHook ? (
            <section className="card tight">
              <div className="card-header">
                <Icon name="film" size={16} />
                <span className="card-title">{t('studio.selectedSeed')}</span>
                <span className="card-spacer" />
                <button className="btn btn-ghost btn-sm" onClick={() => setHookId(null)}>{t('studio.clearSeed')}</button>
              </div>
              <div className="seed-media" style={{ borderRadius: 12, marginBottom: 10 }}>
                <img src={`/api/catalog/preview/hook/${activeHook.id}`} alt="" />
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <div className="seed-title">{activeHook.title[language] ?? activeHook.title.en}</div>
                <div className="card-sub">{activeHook.description[language] ?? activeHook.description.en}</div>
                <div className="row tight">
                  <Pill>{activeHook.aspect}</Pill>
                  <Pill>{activeHook.durationSeconds}s</Pill>
                  <Pill tone="accent">{t(`mode.${activeHook.mode}`)}</Pill>
                </div>
              </div>
            </section>
          ) : null}

          <section className="card tight">
            <div className="card-header">
              <Icon name="film" size={16} />
              <span className="card-title">{t('studio.recent')}</span>
              <span className="card-spacer" />
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>{t('common.viewAll')}</button>
            </div>
            {projects.length === 0 ? (
              <div className="card-sub">{t('projects.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {projects.slice(0, 5).map((project) => (
                  <button
                    key={project.id}
                    className="thread-item"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    style={{ display: 'flex', gap: 10, alignItems: 'center' }}
                  >
                    <div className="media-thumb" style={{ width: 64, height: 40, borderRadius: 8, aspectRatio: 'auto' }}>
                      {project.coverAssetId ? <img src={`/api/assets/${project.coverAssetId}/file`} alt="" loading="lazy" /> : null}
                    </div>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="thread-title" style={{ display: 'block' }}>{project.title}</span>
                      <span className="thread-meta">
                        {project.shots.length} {t('common.shots')} · {relativeTime(project.updatedAt, language)}
                      </span>
                    </span>
                    <StatusPill status={project.status} language={language} />
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
            <div className="stack" style={{ gap: 10 }}>
              {jobs.slice(0, 3).map((job) => (
                <JobCard key={job.id} job={job} language={language} t={t} showLog={false} onOpenProject={(projectId) => navigate(`/projects/${projectId}`)} />
              ))}
              {jobs.length === 0 ? <div className="card-sub">{t('jobs.empty')}</div> : null}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
