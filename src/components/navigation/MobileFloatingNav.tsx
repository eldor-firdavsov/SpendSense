'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Receipt,
  ChartNoAxesCombined,
  Brain,
  Plus,
} from 'lucide-react';
import { warmCache } from '@/lib/cache/clientCache';

export interface MobileFloatingNavProps {
  onOpenAddTransaction: () => void;
}

// Exactly four navigation items in specified order
const NAV_ITEMS = [
  {
    href: '/dashboard',
    name: 'Bosh sahifa',
    icon: Home,
    matcher: (path: string) => path === '/dashboard' || path === '/',
    apiToWarm: '/api/transactions?page=1&pageSize=12&sortBy=date&sortDirection=desc',
    id: 'mobile-nav-dashboard-link',
  },
  {
    href: '/transactions',
    name: 'Faoliyat',
    icon: Receipt,
    matcher: (path: string) =>
      path.startsWith('/transactions') ||
      path.startsWith('/categories') ||
      path.startsWith('/imports'),
    apiToWarm: '/api/transactions?page=1&pageSize=12&sortBy=date&sortDirection=desc',
    id: 'mobile-nav-transactions-link',
  },
  {
    href: '/analytics',
    name: 'Tahlil',
    icon: ChartNoAxesCombined,
    matcher: (path: string) =>
      path.startsWith('/analytics') ||
      path.startsWith('/budgets') ||
      path.startsWith('/goals') ||
      path.startsWith('/insights'),
    apiToWarm: '/api/analytics?startDate=2026-09-01&endDate=2026-10-31&currency=UZS&interval=month',
    id: 'mobile-nav-analytics-link',
  },
  {
    href: '/advisor',
    name: 'AI yordamchi',
    icon: Brain,
    matcher: (path: string) => path.startsWith('/advisor'),
    apiToWarm: '/api/ai/conversations',
    id: 'mobile-nav-advisor-link',
  },
];

export default function MobileFloatingNav({ onOpenAddTransaction }: MobileFloatingNavProps) {
  const pathname = usePathname();

  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-2 px-2.5 sm:px-3"
      style={{
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
      aria-label="Mobil navigatsiya paneli"
    >
      <div className="flex items-center justify-center gap-2 sm:gap-2.5 max-w-[360px] w-full mx-auto">
        {/* A. Navigation Pill (Blurred Light White) */}
        <nav
          className="pointer-events-auto flex items-center justify-between h-[58px] sm:h-[62px] px-1.5 py-1.5 rounded-full bg-white/85 backdrop-blur-2xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] flex-1 max-w-[264px] min-w-0"
          aria-label="Mobil navigatsiya"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = item.matcher(pathname);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                id={item.id}
                prefetch={true}
                onMouseEnter={() => item.apiToWarm && warmCache(item.apiToWarm)}
                onTouchStart={() => item.apiToWarm && warmCache(item.apiToWarm)}
                aria-label={item.name}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-center rounded-full transition-all duration-200 h-[44px] w-[44px] sm:h-[48px] sm:w-[48px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] ${
                  isActive
                    ? 'bg-[#176B45] text-white shadow-xs'
                    : 'text-[#5A675F] hover:text-[#17211B] hover:bg-black/5 active:scale-95'
                }`}
              >
                <Icon className="h-5 w-5 stroke-[2]" aria-hidden="true" />
              </Link>
            );
          })}
        </nav>

        {/* B. Separate Add Transaction FAB */}
        <button
          type="button"
          id="mobile-fab-add-transaction"
          onClick={onOpenAddTransaction}
          className="pointer-events-auto h-[54px] w-[54px] sm:h-[58px] sm:w-[58px] rounded-full bg-[#176B45] hover:bg-[#125536] text-white shadow-[0_8px_25px_rgba(23,107,69,0.38)] flex items-center justify-center shrink-0 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:ring-offset-2"
          aria-label="Tranzaksiya qo‘shish"
        >
          <Plus className="h-6 w-6 stroke-[2.5]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
