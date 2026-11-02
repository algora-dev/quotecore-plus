'use client';

import { useState } from 'react';
import type { PlanData, AnnouncementConfig, CronStatusData, DemoControlData } from './actions';
import { PlanManagementTab } from './PlanManagementTab';
import { CronStatusTab } from './CronStatusTab';
import { AnnouncementTab } from './AnnouncementTab';
import { DemoSwitchesTab } from './DemoSwitchesTab';

type Tab = 'plans' | 'crons' | 'announcement' | 'walkthrough';

const TABS: { key: Tab; label: string }[] = [
  { key: 'plans', label: 'Plans' },
  { key: 'crons', label: 'Cron Jobs' },
  { key: 'announcement', label: 'Announcement' },
  { key: 'walkthrough', label: 'Walkthrough' },
];

export function SettingsPanel({
  plans,
  announcement,
  cronStatus,
  demoControl,
}: {
  plans: PlanData[];
  announcement: AnnouncementConfig;
  cronStatus: CronStatusData;
  demoControl: DemoControlData;
}) {
  const [tab, setTab] = useState<Tab>('plans');

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              tab === t.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plans' && <PlanManagementTab plans={plans} />}
      {tab === 'crons' && <CronStatusTab cronStatus={cronStatus} />}
      {tab === 'announcement' && <AnnouncementTab initialConfig={announcement} />}
      {tab === 'walkthrough' && <DemoSwitchesTab initial={demoControl} />}
    </div>
  );
}
