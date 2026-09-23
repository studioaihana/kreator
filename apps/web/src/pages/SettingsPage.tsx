import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { Field, Pill } from '../components/ui';
import { useApp } from '../state/AppState';
import { useToast } from '../components/ui';
import type { AppConfig, ProviderId } from '../lib/types';

const ACCENTS = ['#ffd166', '#7dd3fc', '#a78bfa', '#f472b6', '#4ade80', '#fb923c'];
const PROVIDER_OPTIONS: { id: ProviderId; label: string }[] = [
  { id: 'demo', label: 'Local demo' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'ollama', label: 'Ollama (local)' },
  { id: 'elevenlabs', label: 'ElevenLabs' },
];

export function SettingsPage() {
  const { t, language, config, catalog, system, patchConfig, seedDemoData, reloadSystem } = useApp();
  const { push } = useToast();
  const [draft, setDraft] = useState<AppConfig | null>(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    void reloadSystem();
  }, [reloadSystem]);

  const uptime = useMemo(() => {
    const seconds = system?.uptimeSeconds ?? 0;
    const minutes = Math.floor(seconds / 60);
    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }, [system?.uptimeSeconds]);

  if (!draft) {
    return (
      <AppLayout title={t('settings.title')}>
        <div className="skeleton" style={{ height: 260 }} />
      </AppLayout>
    );
  }

  function update(patch: Partial<AppConfig>) {
    setDraft((current) => (current ? { ...current, ...patch, providers: { ...current.providers, ...(patch.providers ?? {}) } } : current));
  }

  function updateProvider<K extends keyof AppConfig['providers']>(key: K, value: AppConfig['providers'][K]) {
    setDraft((current) => (current ? { ...current, providers: { ...current.providers, [key]: value } } : current));
  }

  async function save() {
    if (!draft) return;
    await patchConfig(draft);
    push(t('common.saved'), 'success');
  }

  const ttsOrAsrNeedsKey = draft.providers.tts === 'openai' || draft.providers.asr === 'openai' || draft.providers.image === 'openai' || draft.providers.llm === 'openai';

  return (
    <AppLayout
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      actions={
        <>
          <button className="btn btn-sm" onClick={() => setDraft(config)}>
            <Icon name="refresh" size={14} /> {t('common.reset')}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => void save()}>
            <Icon name="check" size={14} /> {t('common.save')}
          </button>
        </>
      }
    >
      <div className="split">
        <div className="stack" style={{ gap: 18 }}>
          <section className="card stack">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <Icon name="sun" size={16} />
              <span className="card-title">{t('settings.appearance')}</span>
            </div>
            <Field label={t('settings.language')}>
              <div className="chip-row">
                {(['id', 'en'] as const).map((item) => (
                  <button key={item} className={`chip ${draft.language === item ? 'active' : ''}`} onClick={() => update({ language: item })}>
                    {item === 'id' ? 'Bahasa Indonesia' : 'English'}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('settings.theme')}>
              <div className="chip-row">
                {(['dark', 'light'] as const).map((item) => (
                  <button key={item} className={`chip ${draft.theme === item ? 'active' : ''}`} onClick={() => update({ theme: item })}>
                    <Icon name={item === 'dark' ? 'moon' : 'sun'} size={13} /> {item === 'dark' ? t('settings.dark') : t('settings.light')}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('settings.accent')}>
              <div className="chip-row">
                {ACCENTS.map((colour) => (
                  <button
                    key={colour}
                    className={`chip ${draft.accent === colour ? 'active' : ''}`}
                    style={{ background: colour, borderColor: 'transparent', width: 34, height: 30, padding: 0 }}
                    onClick={() => update({ accent: colour })}
                    aria-label={colour}
                  />
                ))}
              </div>
            </Field>
            <Field label={t('settings.author')}>
              <input className="input" value={draft.authorName} onChange={(event) => update({ authorName: event.target.value })} />
            </Field>
          </section>

          <section className="card stack">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <Icon name="sparkles" size={16} />
              <span className="card-title">{t('settings.providers')}</span>
              <span className="card-spacer" />
              <Pill tone="accent">{t('settings.demo')}</Pill>
            </div>
            <div className="card-sub">{t('settings.providersHint')}</div>
            <div className="composer-row">
              <Field label={t('settings.llm')}>
                <select className="select" value={draft.providers.llm} onChange={(event) => updateProvider('llm', event.target.value as ProviderId)}>
                  {PROVIDER_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('settings.image')}>
                <select className="select" value={draft.providers.image} onChange={(event) => updateProvider('image', event.target.value as ProviderId)}>
                  <option value="demo">Local demo</option>
                  <option value="openai">OpenAI (gpt-image-1)</option>
                </select>
              </Field>
              <Field label={t('settings.tts')}>
                <select className="select" value={draft.providers.tts} onChange={(event) => updateProvider('tts', event.target.value as ProviderId)}>
                  <option value="demo">Browser speech</option>
                  <option value="openai">OpenAI</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
              </Field>
              <Field label={t('settings.asr')}>
                <select className="select" value={draft.providers.asr} onChange={(event) => updateProvider('asr', event.target.value as ProviderId)}>
                  <option value="demo">Local demo</option>
                  <option value="openai">OpenAI (whisper)</option>
                  <option value="ollama">Whisper CLI lokal</option>
                </select>
              </Field>
            </div>

            {ttsOrAsrNeedsKey ? (
              <div className="stack" style={{ gap: 10 }}>
                <Field label={`${t('settings.apiKey')} (OpenAI)`}>
                  <input
                    className="input"
                    type="password"
                    placeholder="sk-..."
                    value={draft.providers.openai.apiKey}
                    onChange={(event) =>
                      updateProvider('openai', { ...draft.providers.openai, apiKey: event.target.value })
                    }
                  />
                </Field>
                <div className="composer-row">
                  <Field label={`${t('settings.baseUrl')} (OpenAI)`}>
                    <input
                      className="input"
                      value={draft.providers.openai.baseUrl}
                      onChange={(event) => updateProvider('openai', { ...draft.providers.openai, baseUrl: event.target.value })}
                    />
                  </Field>
                  <Field label={t('settings.model')}>
                    <input
                      className="input"
                      value={draft.providers.openai.chatModel}
                      onChange={(event) => updateProvider('openai', { ...draft.providers.openai, chatModel: event.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {draft.providers.llm === 'anthropic' ? (
              <div className="composer-row">
                <Field label={`${t('settings.apiKey')} (Anthropic)`}>
                  <input
                    className="input"
                    type="password"
                    value={draft.providers.anthropic.apiKey}
                    onChange={(event) => updateProvider('anthropic', { ...draft.providers.anthropic, apiKey: event.target.value })}
                  />
                </Field>
                <Field label={t('settings.model')}>
                  <input
                    className="input"
                    value={draft.providers.anthropic.model}
                    onChange={(event) => updateProvider('anthropic', { ...draft.providers.anthropic, model: event.target.value })}
                  />
                </Field>
              </div>
            ) : null}

            {draft.providers.llm === 'gemini' ? (
              <div className="composer-row">
                <Field label={`${t('settings.apiKey')} (Gemini)`}>
                  <input
                    className="input"
                    type="password"
                    value={draft.providers.gemini.apiKey}
                    onChange={(event) => updateProvider('gemini', { ...draft.providers.gemini, apiKey: event.target.value })}
                  />
                </Field>
                <Field label={t('settings.model')}>
                  <input
                    className="input"
                    value={draft.providers.gemini.model}
                    onChange={(event) => updateProvider('gemini', { ...draft.providers.gemini, model: event.target.value })}
                  />
                </Field>
              </div>
            ) : null}

            {draft.providers.llm === 'ollama' ? (
              <div className="composer-row">
                <Field label={t('settings.baseUrl')}>
                  <input
                    className="input"
                    value={draft.providers.ollama.baseUrl}
                    onChange={(event) => updateProvider('ollama', { ...draft.providers.ollama, baseUrl: event.target.value })}
                  />
                </Field>
                <Field label={t('settings.model')}>
                  <input
                    className="input"
                    value={draft.providers.ollama.model}
                    onChange={(event) => updateProvider('ollama', { ...draft.providers.ollama, model: event.target.value })}
                  />
                </Field>
              </div>
            ) : null}

            {draft.providers.tts === 'elevenlabs' ? (
              <div className="composer-row">
                <Field label={`${t('settings.apiKey')} (ElevenLabs)`}>
                  <input
                    className="input"
                    type="password"
                    value={draft.providers.elevenlabs.apiKey}
                    onChange={(event) => updateProvider('elevenlabs', { ...draft.providers.elevenlabs, apiKey: event.target.value })}
                  />
                </Field>
                <Field label="Voice ID">
                  <input
                    className="input"
                    value={draft.providers.elevenlabs.voiceId}
                    onChange={(event) => updateProvider('elevenlabs', { ...draft.providers.elevenlabs, voiceId: event.target.value })}
                  />
                </Field>
              </div>
            ) : null}

            <div className="hint">{t('settings.keysHint')}</div>
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card tight">
            <div className="card-header">
              <Icon name="folder" size={16} />
              <span className="card-title">{t('settings.data')}</span>
            </div>
            <dl className="kv">
              <dt>{t('settings.dataDir')}</dt>
              <dd className="mono truncate" title={system?.dataDir}>{system?.dataDir ?? '—'}</dd>
              <dt>{t('settings.uptime')}</dt>
              <dd>{uptime}</dd>
              <dt>{t('nav.projects')}</dt>
              <dd>{system?.counts.projects ?? 0}</dd>
              <dt>{t('common.assets')}</dt>
              <dd>{system?.counts.assets ?? 0}</dd>
              <dt>{t('nav.approvals')}</dt>
              <dd>{system?.counts.threads ?? 0} threads</dd>
            </dl>
            <button
              className="btn btn-sm"
              style={{ marginTop: 12 }}
              onClick={async () => {
                await seedDemoData();
                push(t('settings.seeded'), 'success');
              }}
            >
              <Icon name="plus" size={13} /> {t('settings.seed')}
            </button>
          </section>

          <section className="card tight">
            <div className="card-header">
              <Icon name="bot" size={16} />
              <span className="card-title">{t('settings.skills')}</span>
            </div>
            <div className="card-sub" style={{ marginBottom: 10 }}>{t('settings.skillsHint')}</div>
            <div className="stack" style={{ gap: 8 }}>
              {(catalog?.skills ?? []).map((skill) => (
                <div className="row tight" key={skill.id}>
                  <Icon name={skill.kind === 'workflow' ? 'layers' : 'bot'} size={14} />
                  <span style={{ flex: 1, fontSize: 12.5 }}>{skill.title[language] ?? skill.title.en}</span>
                  <Pill tone="success">{t('common.yes')}</Pill>
                </div>
              ))}
            </div>
          </section>

          <section className="card tight">
            <div className="card-header">
              <Icon name="shield" size={16} />
              <span className="card-title">{t('settings.systemStatus')}</span>
            </div>
            <div className="stack" style={{ gap: 8, fontSize: 12.5 }}>
              {Object.entries(system?.providers ?? {}).map(([key, value]) => (
                <div className="row tight" key={key}>
                  <span style={{ flex: 1, color: 'var(--text-dim)' }}>{key.toUpperCase()}</span>
                  <Pill tone={value === 'demo' ? 'warning' : 'success'}>{value}</Pill>
                </div>
              ))}
              <div className="row tight">
                <span style={{ flex: 1, color: 'var(--text-dim)' }}>API</span>
                <Pill tone="success">/api</Pill>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
