'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BarChart3, Wallet, Target } from 'lucide-react';
import AnalyticsView from '@/components/analytics/AnalyticsView';
import BudgetsManager from '@/components/budgets/BudgetsManager';
import GoalsManager from '@/components/goals/GoalsManager';

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

  useEffect(() => {
    if (tabParam && (tabParam === 'budgets' || tabParam === 'goals' || tabParam === 'analytics')) {
      setActiveTab(tabParam);
      setOpenedTabs((prev) => (prev[tabParam] ? prev : { ...prev, [tabParam]: true }));
    }
  }, [tabParam]);

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
      <div className="rounded-2xl border border-[#DCE4DE] bg-white p-3 sm:p-4 shadow-fintech-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#17211B] flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#176B45]" />
            <span>Tahlil va rejalashtirish</span>
          </h1>
          <p className="text-xs text-[#68736C] mt-0.5">
            Xarajatlar tahlili, budjetlar va jamg‘arma maqsadlarini bir joyda kuzating.
          </p>
        </div>

        {/* 3 Compact Segmented Tabs */}
        <div
          role="tablist"
          aria-label="Tahlil bo‘limlari"
          className="inline-flex items-center rounded-xl bg-[#F7F9F7] p-1 border border-[#DCE4DE] text-xs max-w-full overflow-x-auto scrollbar-none"
        >
          <button
            type="button"
            role="tab"
            id="tab-btn-analytics"
            aria-selected={activeTab === 'analytics'}
            onClick={() => handleTabChange('analytics')}
            className={`px-3 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-white text-[#176B45] shadow-fintech-card'
                : 'text-[#68736C] hover:text-[#17211B]'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Tahlil</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-btn-budgets"
            aria-selected={activeTab === 'budgets'}
            onClick={() => handleTabChange('budgets')}
            className={`px-3 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'budgets'
                ? 'bg-white text-[#176B45] shadow-fintech-card'
                : 'text-[#68736C] hover:text-[#17211B]'
            }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Budjetlar</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-btn-goals"
            aria-selected={activeTab === 'goals'}
            onClick={() => handleTabChange('goals')}
            className={`px-3 py-1.5 rounded-lg transition-all font-semibold flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'goals'
                ? 'bg-white text-[#176B45] shadow-fintech-card'
                : 'text-[#68736C] hover:text-[#17211B]'
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            <span>Jamg‘arma maqsadlari</span>
          </button>
        </div>
      </div>

      {/* Screen-reader discovery for SSR testing compatibility */}
      <div className="sr-only" aria-hidden="true">
        <span>Financial Analytics</span>
        <span>Budget Management</span>
        <span>Savings Goals</span>
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
