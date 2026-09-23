import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { EmptyState, StatusPill } from '../components/ui';
import { useApp } from '../state/AppState';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { relativeTime } from '../lib/format';
import type { Approval } from '../lib/types';

interface Outcome {
  kind: string;
  status: string;
  detail?: string;
  projectId?: string;
  label: Record<string, string>;
}

export function ApprovalsPage() {
  const { t, language, approvals, reloadApprovals, reloadJobs, reloadProjects, setError } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Outcome[]>>({});

  const pending = useMemo(() => approvals.filter((approval) => approval.status === 'pending'), [approvals]);
  const history = useMemo(() => approvals.filter((approval) => approval.status !== 'pending'), [approvals]);

  useEffect(() => {
    void reloadApprovals();
  }, [reloadApprovals]);

  async function decide(approval: Approval, decision: 'approve' | 'reject') {
    setBusy(approval.id);
    try {
      const result = await api.decideApproval(approval.id, decision);
      setResults((current) => ({ ...current, [approval.id]: (result.outcomes ?? []) as Outcome[] }));
      await reloadApprovals();
      await reloadJobs();
      await reloadProjects();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Gagal memproses persetujuan');
    } finally {
      setBusy(null);
    }
  }

  function renderApproval(approval: Approval) {
    const actions = (approval.payload.actions as { kind: string; label: Record<string, string>; payload?: Record<string, unknown> }[] | undefined) ?? [];
    const outcomes = results[approval.id];
    return (
      <div className="approval-card" key={approval.id}>
        <div className="row">
          <Icon name="shield" size={16} />
          <strong style={{ fontSize: 14 }}>{approval.title}</strong>
          <span className="spacer" />
          <StatusPill status={approval.status} language={language} />
          <span className="card-sub">{relativeTime(approval.createdAt, language)}</span>
        </div>
        <div className="action-list">
          {actions.map((action, index) => (
            <div className="action-item" key={`${approval.id}-${index}`}>
              <Icon name="chevron-right" size={12} />
              <span>{action.label?.[language] ?? action.label?.en ?? action.kind}</span>
              {action.payload?.prompt ? (
                <span className="truncate card-sub" style={{ maxWidth: 340 }}>
                  {String(action.payload.prompt)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {approval.status === 'pending' ? (
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={busy === approval.id} onClick={() => void decide(approval, 'approve')}>
              {busy === approval.id ? <span className="spinner" /> : <Icon name="check" size={14} />} {t('approvals.approve')}
            </button>
            <button className="btn btn-sm" disabled={busy === approval.id} onClick={() => void decide(approval, 'reject')}>
              <Icon name="x" size={14} /> {t('approvals.reject')}
            </button>
            {busy === approval.id ? <span className="card-sub">{t('approvals.running')}</span> : null}
          </div>
        ) : null}
        {outcomes && outcomes.length > 0 ? (
          <div className="stack" style={{ gap: 6 }}>
            {outcomes.map((outcome, index) => (
              <div className="row tight" key={`${approval.id}-outcome-${index}`} style={{ fontSize: 12.5 }}>
                <Icon name={outcome.status === 'done' ? 'check' : outcome.status === 'skipped' ? 'alert' : 'x'} size={13} />
                <span>{outcome.label?.[language] ?? outcome.label?.en ?? outcome.kind}</span>
                {outcome.detail ? <span className="card-sub">— {outcome.detail}</span> : null}
                {outcome.projectId ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/projects/${outcome.projectId}`)}>
                    {t('common.open')}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <AppLayout
      title={t('approvals.title')}
      subtitle={t('approvals.subtitle')}
      actions={
        <button className="btn btn-sm" onClick={() => void reloadApprovals()}>
          <Icon name="refresh" size={14} /> {t('common.reload')}
        </button>
      }
    >
      <section className="section">
        <div className="section-head">
          <span className="section-title">{t('approvals.pending')}</span>
          <span className="section-sub">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <EmptyState
            action={
              <button className="btn btn-primary" onClick={() => navigate('/agent')}>
                <Icon name="bot" size={15} /> {t('agent.title')}
              </button>
            }
          >
            {t('approvals.empty')}
          </EmptyState>
        ) : (
          <div className="stack" style={{ gap: 12 }}>{pending.map(renderApproval)}</div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <span className="section-title">{t('approvals.history')}</span>
          <span className="section-sub">{history.length}</span>
        </div>
        {history.length === 0 ? (
          <div className="card-sub">{t('common.empty')}</div>
        ) : (
          <div className="stack" style={{ gap: 12 }}>{history.slice(0, 12).map(renderApproval)}</div>
        )}
      </section>
    </AppLayout>
  );
}
