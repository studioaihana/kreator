import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { useApp } from '../state/AppState';
import { navigate, useRoute } from '../lib/router';
import { Pill } from './ui';

interface NavEntry {
  path: string;
  labelKey: string;
  icon: IconName;
  count?: number;
}

interface NavGroupShape {
  titleKey: string;
  entries: NavEntry[];
}

export function AppLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t, config, patchConfig, language, jobs, approvals, projects, system } = useApp();
  const route = useRoute();
  const activeJobs = jobs.filter((job) => job.status === 'running' || job.status === 'queued').length;
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending').length;

  const groups: NavGroupShape[] = [
    {
      titleKey: 'nav.group.create',
      entries: [
        { path: '/studio', labelKey: 'nav.studio', icon: 'sparkles' },
        { path: '/images', labelKey: 'nav.images', icon: 'image' },
        { path: '/write', labelKey: 'nav.write', icon: 'pen' },
        { path: '/translate', labelKey: 'nav.translate', icon: 'translate' },
      ],
    },
    {
      titleKey: 'nav.group.work',
      entries: [
        { path: '/', labelKey: 'nav.home', icon: 'home' },
        { path: '/projects', labelKey: 'nav.projects', icon: 'film', count: projects.length },
        { path: '/agent', labelKey: 'nav.agent', icon: 'bot' },
        { path: '/approvals', labelKey: 'nav.approvals', icon: 'shield', count: pendingApprovals },
      ],
    },
    {
      titleKey: 'nav.group.system',
      entries: [
        { path: '/assets', labelKey: 'nav.assets', icon: 'folder' },
        { path: '/settings', labelKey: 'nav.settings', icon: 'settings' },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/') return route.segments.length === 0;
    return route.path === path || route.path.startsWith(`${path}/`);
  };

  const toggleLanguage = () => {
    void patchConfig({ language: language === 'id' ? 'en' : 'id' });
  };

  const toggleTheme = () => {
    void patchConfig({ theme: config?.theme === 'light' ? 'dark' : 'light' });
  };

  const providers = system?.providers;
  const allDemo = providers ? providers.llm === 'demo' && providers.image === 'demo' && providers.tts === 'demo' && providers.asr === 'demo' : true;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">K</div>
          <div className="brand-text">
            <div className="brand-name">{t('app.name')}</div>
            <div className="brand-tag">{t('app.tagline')}</div>
          </div>
          <span className="badge-beta">{t('app.beta')}</span>
        </div>

        {groups.map((group) => (
          <div className="nav-group" key={group.titleKey}>
            <div className="nav-group-title">{t(group.titleKey)}</div>
            {group.entries.map((entry) => (
              <button
                key={entry.path}
                className={`nav-item ${isActive(entry.path) ? 'active' : ''}`}
                onClick={() => navigate(entry.path)}
                title={t(entry.labelKey)}
              >
                <span className="nav-icon">
                  <Icon name={entry.icon} size={17} />
                </span>
                <span className="nav-label">{t(entry.labelKey)}</span>
                {entry.count ? <span className={`nav-count ${entry.path === '/approvals' ? 'accent' : ''}`}>{entry.count}</span> : null}
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <div className="engine-card">
            <div className="engine-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className={`dot ${allDemo ? 'demo' : ''}`} /> {allDemo ? t('common.demo') : t('common.live')}
              </span>
              <span className="mono" style={{ fontSize: 11 }}>{providers?.llm ?? 'demo'}</span>
            </div>
            <div className="engine-row">
              <span>{t('jobs.title')}</span>
              <span>{activeJobs}</span>
            </div>
            <div className="engine-row">
              <span>{t('settings.skills')}</span>
              <span>{system?.counts.assets ?? 0} {t('common.assets')}</span>
            </div>
          </div>
          <button className="nav-item" onClick={toggleTheme} title={t('settings.theme')}>
            <span className="nav-icon">
              <Icon name={config?.theme === 'light' ? 'moon' : 'sun'} size={17} />
            </span>
            <span className="nav-label">{config?.theme === 'light' ? t('settings.dark') : t('settings.light')}</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title">{title}</div>
            {subtitle ? <div className="topbar-sub">{subtitle}</div> : null}
          </div>
          <div className="topbar-spacer" />
          <div className="topbar-actions">
            {activeJobs > 0 ? (
              <Pill tone="info">
                <span className="spinner" /> {activeJobs} {t('jobs.title').toLowerCase()}
              </Pill>
            ) : null}
            {pendingApprovals > 0 ? (
              <button className="btn btn-sm" onClick={() => navigate('/approvals')}>
                <Icon name="shield" size={14} /> {pendingApprovals}
              </button>
            ) : null}
            {actions}
            <button className="btn btn-sm btn-ghost" onClick={toggleLanguage} title="Language">
              <Icon name="globe" size={15} /> {language.toUpperCase()}
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
