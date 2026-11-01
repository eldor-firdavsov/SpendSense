'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { invalidateCache } from '@/lib/cache/clientCache';

export default function DashboardRefreshButton() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    invalidateCache('/api/transactions');
    invalidateCache('/api/analytics');
    invalidateCache('/api/budgets');
    invalidateCache('/api/goals');
    router.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <button
      type="button"
      id="dashboard-refresh-btn"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="min-h-[38px] min-w-[38px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center p-2 rounded-xl bg-white border border-[#D5DED7] text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-all shadow-fintech-card shrink-0 cursor-pointer disabled:opacity-50"
      title="Bosh sahifani yangilash"
      aria-label="Bosh sahifani yangilash"
    >
      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#176B45]' : ''}`} />
    </button>
  );
}
