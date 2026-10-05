import React from 'react';
import { useAuth } from '../../components/AuthProvider';
import { CeoDashboardPage } from './CeoDashboardPage';
import { ManagerDashboardPage } from './ManagerDashboardPage';
import { ReportsPage } from './ReportsPage';

export type DashboardTab = 'tong' | 'doingu' | 'ceo';

const TABS: { key: DashboardTab; label: string; ceoOnly?: boolean }[] = [
  { key: 'tong', label: 'Tổng quan kinh doanh' },
  { key: 'doingu', label: 'Điều hành đội ngũ' },
  { key: 'ceo', label: 'Bàn điều hành CEO', ceoOnly: true },
];

/** Một Dashboard kinh doanh chung: gộp báo cáo kinh doanh, điều hành đội ngũ và bàn điều hành CEO thành 3 tab. */
export function DashboardPage({ initial = 'tong' }: { initial?: DashboardTab }) {
  const { me } = useAuth();
  const isCeo = me?.user.role === 'CEO';
  const tabs = TABS.filter((t) => !t.ceoOnly || isCeo);
  const [tab, setTab] = React.useState<DashboardTab>(initial);
  React.useEffect(() => setTab(initial), [initial]);
  const active = tabs.some((t) => t.key === tab) ? tab : 'tong';

  return (
    <div className="stack">
      <div className="dash-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={t.key === active ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {active === 'tong' && <ReportsPage />}
      {active === 'doingu' && <ManagerDashboardPage />}
      {active === 'ceo' && <CeoDashboardPage />}
    </div>
  );
}
