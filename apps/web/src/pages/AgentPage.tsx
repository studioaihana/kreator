import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { EmptyState, Pill, StatusPill } from '../components/ui';
import { useApp } from '../state/AppState';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import { renderMarkdown } from '../lib/markdown';
import type { AgentThread, Approval } from '../lib/types';

export function AgentPage() {
  const { t, language, threads, approvals, reloadThreads, reloadApprovals, reloadJobs, reloadProjects, setError } = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<AgentThread | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeThread = useMemo(() => threads.find((item) => item.id === activeId) ?? threads[0] ?? null, [threads, activeId]);
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');
  const threadApprovals = pendingApprovals.filter((approval) => approval.payload.threadId === activeThread?.id);

  useEffect(() => {
    void reloadThreads();
    void reloadApprovals();
  }, [reloadApprovals, reloadThreads]);

  useEffect(() => {
    if (!activeThread) {
      setThread(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const fresh = await api.thread(activeThread.id);
        if (!cancelled) setThread(fresh);
      } catch {
        if (!cancelled) setThread(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeThread?.id, activeThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread?.messages.length, sending]);

  async function createThread() {
    const created = await api.createThread({});
    await reloadThreads();
    setActiveId(created.id);
    setThread(created);
  }

  async function send() {
    if (!draft.trim() || sending) return;
    let targetId = activeThread?.id;
    if (!targetId) {
      const created = await api.createThread({});
      targetId = created.id;
      setActiveId(created.id);
    }
    const content = draft;
    setDraft('');
    setSending(true);
    try {
      const result = await api.sendMessage(targetId, content, language);
      setThread(result.thread);
      await reloadThreads();
      await reloadApprovals();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Agent gagal merespons');
    } finally {
      setSending(false);
    }
  }

  async function decide(approval: Approval, decision: 'approve' | 'reject') {
    setRunning(approval.id);
    try {
      const result = await api.decideApproval(approval.id, decision);
      const list = (result.outcomes ?? []) as { label?: Record<string, string>; status?: string; detail?: string }[];
      setOutcomes(
        list.map((outcome) => {
          const label = outcome.label?.[language] ?? outcome.label?.en ?? 'Aksi';
          return `${outcome.status === 'done' ? '✅' : outcome.status === 'skipped' ? '⏭️' : '⚠️'} ${label}${outcome.detail ? ` — ${outcome.detail}` : ''}`;
        }),
      );
      await reloadApprovals();
      await reloadJobs();
      await reloadProjects();
      if (activeThread) {
        const fresh = await api.thread(activeThread.id);
        setThread(fresh);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal menjalankan rencana');
    } finally {
      setRunning(null);
    }
  }

  const target = activeThread;
  return (
    <AppLayout title={t('agent.title')} subtitle={t('agent.subtitle')}>
      <div className="agent-layout">
        <div className="stack" style={{ gap: 14 }}>
          <button className="btn btn-primary" onClick={() => void createThread()}>
            <Icon name="plus" size={15} /> {t('agent.newThread')}
          </button>
          <section className="card tight">
            <div className="card-header">
              <Icon name="bot" size={16} />
              <span className="card-title">{t('agent.threads')}</span>
              <span className="card-spacer" />
              <Pill>{threads.length}</Pill>
            </div>
            <div className="thread-list">
              {threads.length === 0 ? (
                <div className="card-sub">{t('agent.noThread')}</div>
              ) : (
                threads.map((item) => (
                  <button
                    key={item.id}
                    className={`thread-item ${target?.id === item.id ? 'active' : ''}`}
                    onClick={() => setActiveId(item.id)}
                  >
                    <span className="thread-title" style={{ display: 'block' }}>{item.title}</span>
                    <span className="thread-meta">{relativeTime(item.updatedAt, language)}</span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-header">
              <Icon name="bot" size={17} />
              <span className="card-title">{target?.title ?? t('agent.title')}</span>
              <span className="card-spacer" />
              <button className="btn btn-sm btn-ghost" onClick={() => void reloadThreads()}>
                <Icon name="refresh" size={14} />
              </button>
            </div>

            {!target ? (
              <EmptyState
                action={
                  <button className="btn btn-primary" onClick={() => void createThread()}>
                    <Icon name="plus" size={15} /> {t('agent.newThread')}
                  </button>
                }
              >
                {t('agent.noThread')}
              </EmptyState>
            ) : (
              <div className="chat">
                <div className="chat-scroll" ref={scrollRef}>
                  {(thread?.messages ?? []).map((message) => (
                    <div key={message.id} className={`bubble ${message.role}`}>
                      {message.role !== 'user' && message.role !== 'system' ? (
                        <div className="bubble-head">
                          <Icon name={message.role === 'tool' ? 'wand' : 'bot'} size={12} />
                          {message.role === 'tool' ? message.toolName ?? t('agent.toolOutput') : 'agent'}
                          <span>{new Date(message.createdAt).toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ) : null}
                      {message.role === 'assistant' ? (
                        <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
                      ) : (
                        message.content
                      )}
                    </div>
                  ))}
                  {sending ? (
                    <div className="bubble assistant">
                      <span className="row tight">
                        <span className="spinner" /> {t('agent.thinking')}
                      </span>
                    </div>
                  ) : null}
                </div>

                {threadApprovals.length > 0 ? (
                  <div className="stack" style={{ gap: 10 }}>
                    {threadApprovals.map((approval) => {
                      const actions = (approval.payload.actions as { kind: string; label: Record<string, string> }[] | undefined) ?? [];
                      return (
                        <div className="approval-card" key={approval.id}>
                          <div className="row">
                            <Icon name="shield" size={16} />
                            <strong style={{ fontSize: 13.5 }}>{approval.title}</strong>
                            <span className="spacer" />
                            <Pill tone="warning">{t('status.pending')}</Pill>
                          </div>
                          <div className="action-list">
                            {actions.map((action, index) => (
                              <div className="action-item" key={`${approval.id}-${index}`}>
                                <Icon name="chevron-right" size={12} />
                                {action.label?.[language] ?? action.label?.en ?? action.kind}
                              </div>
                            ))}
                          </div>
                          <div className="row">
                            <button className="btn btn-primary btn-sm" disabled={running === approval.id} onClick={() => void decide(approval, 'approve')}>
                              {running === approval.id ? <span className="spinner" /> : <Icon name="check" size={14} />} {t('approvals.approve')}
                            </button>
                            <button className="btn btn-sm" disabled={running === approval.id} onClick={() => void decide(approval, 'reject')}>
                              <Icon name="x" size={14} /> {t('approvals.reject')}
                            </button>
                            {running === approval.id ? <span className="card-sub">{t('approvals.running')}</span> : null}
                          </div>
                          {outcomes.length > 0 && running === null ? (
                            <div className="log-box">{outcomes.join('\n')}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="composer-bar">
                  <textarea
                    className="textarea"
                    placeholder={t('agent.placeholder')}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <button className="btn btn-primary" onClick={() => void send()} disabled={sending || !draft.trim()}>
                    <Icon name="sparkles" size={15} /> {t('agent.send')}
                  </button>
                </div>

                <div className="stack" style={{ gap: 8 }}>
                  <span className="field-label">{t('agent.suggestions')}</span>
                  <div className="chip-row">
                    {['agent.suggestion1', 'agent.suggestion2', 'agent.suggestion3'].map((key) => (
                      <button key={key} className="chip" onClick={() => setDraft(t(key))}>
                        {t(key)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="card tight">
            <div className="card-header">
              <Icon name="shield" size={16} />
              <span className="card-title">{t('approvals.title')}</span>
              <span className="card-spacer" />
              <button className="btn btn-ghost btn-sm" onClick={() => (window.location.hash = '/approvals')}>
                {t('common.viewAll')}
              </button>
            </div>
            {pendingApprovals.length === 0 ? (
              <div className="card-sub">{t('approvals.empty')}</div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {pendingApprovals.slice(0, 3).map((approval) => (
                  <div className="row" key={approval.id}>
                    <StatusPill status={approval.status} language={language} />
                    <span className="truncate" style={{ flex: 1 }}>{approval.title}</span>
                    <span className="card-sub">{relativeTime(approval.createdAt, language)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
