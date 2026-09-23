import { Icon } from '../components/Icon';
import { AppLayout } from '../components/AppLayout';
import { EmptyState } from '../components/ui';
import { useApp } from '../state/AppState';
import { navigate } from '../lib/router';

export function NotFoundPage() {
  const { t } = useApp();
  return (
    <AppLayout title="404">
      <EmptyState
        action={
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            <Icon name="home" size={15} /> {t('nav.home')}
          </button>
        }
      >
        {t('common.empty')}
      </EmptyState>
    </AppLayout>
  );
}
