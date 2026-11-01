'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BarChart3, Wallet, Target } from 'lucide-react';
import AnalyticsView from '@/components/analytics/AnalyticsView';
import BudgetsManager from '@/components/budgets/BudgetsManager';
import GoalsManager from '@/components/goals/GoalsManager';
import { warmCache } from '@/lib/cache/clientCache';

export type TahlilTab = 'analytics' | 'budgets' | 'goals';

interface TahlilHubProps {
  initialTab?: TahlilTab;
}

export default function TahlilHub({ initialTab = 'analytics' }: TahlilHubProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as TahlilTab | null;

  const [activeTab, setActiveTab] = useState<TahlilTab>(() => {
    if (tabParam === 'budgets' || tabParam === 'goals' || tabParam === 'analytics') {
      return tabParam;
    }
    return initialTab;
  });

  // Track which tabs have been opened to lazy-mount on first visit, then preserve in DOM for 0ms switching
  const [openedTabs, setOpenedTabs] = useState<Record<TahlilTab, boolean>>(() => {
    const current = (tabParam === 'budgets' || tabParam === 'goals' || tabParam === 'analytics') ? tabParam : initialTab;
    return {
      analytics: current === 'analytics',
      budgets: current === 'budgets',
      goals: current === 'goals',
    };
  });

  const [prevTabParam, setPrevTabParam] = useState(tabParam);
  if (tabParam !== prevTabParam) {
    setPrevTabParam(tabParam);
    if (tabParam === 'budgets' || tabParam === 'goals' || tabParam === 'analytics') {
      setActiveTab(tabParam);
      setOpenedTabs((prev) => (prev[tabParam] ? prev : { ...prev, [tabParam]: true }));
    }
  }

  const handleTabChange = (newTab: TahlilTab) => {
    setActiveTab(newTab);
    setOpenedTabs((prev) => (prev[newTab] ? prev : { ...prev, [newTab]: true }));
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.replace(`/analytics?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      {/* Unified Compact Segmented Control Bar */}
      <div className="rounded-2xl border border-[#D5DED7] bg-white p-4 sm:p-5 shadow-fintech-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#17211B] flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-[#176B45]" />
            <span>Tahlil va rejalashtirish</span>
          </h1>
        </div>

        {/* 3 Compact Segmented Tabs - fully responsive on mobile (grid) and desktop (inline-flex) */}
        <div
          role="tablist"
          aria-label="Tahlil bo‘limlari"
          className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex items-center rounded-xl bg-[#F7F9F7] p-1 border border-[#D5DED7] text-xs sm:text-sm shrink-0"
        >
          <button
            type="button"
            role="tab"
            id="tab-btn-analytics"
            aria-selected={activeTab === 'analytics'}
            onClick={() => handleTabChange('analytics')}
            onMouseEnter={() => warmCache('/api/analytics?startDate=2026-09-01&endDate=2026-10-31&currency=UZS&interval=month')}
            onFocus={() => warmCache('/api/analytics?startDate=2026-09-01&endDate=2026-10-31&currency=UZS&interval=month')}
            onTouchStart={() => warmCache('/api/analytics?startDate=2026-09-01&endDate=2026-10-31&currency=UZS&interval=month')}
            className={`px-2 sm:px-4 py-2 min-h-[40px] rounded-lg transition-all font-semibold flex items-center justify-center gap-1.5 sm:gap-2 text-center text-xs sm:text-sm ${
              activeTab === 'analytics'
                ? 'bg-[#176B45] text-white shadow-xs'
                : 'text-[#47544C] hover:text-[#17211B] hover:bg-black/5'
            }`}
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="truncate">Tahlil</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-btn-budgets"
            aria-selected={activeTab === 'budgets'}
            onClick={() => handleTabChange('budgets')}
            onMouseEnter={() => warmCache('/api/budgets?currency=UZS')}
            onFocus={() => warmCache('/api/budgets?currency=UZS')}
            onTouchStart={() => warmCache('/api/budgets?currency=UZS')}
            className={`px-2 sm:px-4 py-2 min-h-[40px] rounded-lg transition-all font-semibold flex items-center justify-center gap-1.5 sm:gap-2 text-center text-xs sm:text-sm ${
              activeTab === 'budgets'
                ? 'bg-[#176B45] text-white shadow-xs'
                : 'text-[#47544C] hover:text-[#17211B] hover:bg-black/5'
            }`}
          >
            <Wallet className="h-4 w-4 shrink-0" />
            <span className="truncate">Budjetlar</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-btn-goals"
            aria-selected={activeTab === 'goals'}
            onClick={() => handleTabChange('goals')}
            onMouseEnter={() => warmCache('/api/goals?currency=UZS')}
            onFocus={() => warmCache('/api/goals?currency=UZS')}
            onTouchStart={() => warmCache('/api/goals?currency=UZS')}
            className={`px-2 sm:px-4 py-2 min-h-[40px] rounded-lg transition-all font-semibold flex items-center justify-center gap-1.5 sm:gap-2 text-center text-xs sm:text-sm ${
              activeTab === 'goals'
                ? 'bg-[#176B45] text-white shadow-xs'
                : 'text-[#47544C] hover:text-[#17211B] hover:bg-black/5'
            }`}
          >
            <Target className="h-4 w-4 shrink-0" />
            <span className="sr-only">Jamg‘arma maqsadlari</span>
            <span className="truncate sm:hidden" aria-hidden="true">Jamg‘arma</span>
            <span className="truncate hidden sm:inline" aria-hidden="true">Jamg‘arma maqsadlari</span>
          </button>
        </div>
      </div>

      {/* Render Active Sub-section with DOM state preservation for 0ms instant switching */}
      <div>
        <div className={activeTab === 'analytics' ? 'block' : 'hidden'}>
          {openedTabs.analytics && <AnalyticsView />}
        </div>
        <div className={activeTab === 'budgets' ? 'block' : 'hidden'}>
          {openedTabs.budgets && <BudgetsManager />}
        </div>
        <div className={activeTab === 'goals' ? 'block' : 'hidden'}>
          {openedTabs.goals && <GoalsManager />}
        </div>
      </div>
    </div>
  );
}
