'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import FastTransactionModal from '@/components/transactions/FastTransactionModal';
import SpendSenseLogo from '@/components/brand/SpendSenseLogo';
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Sparkles,
  Settings,
  ChevronDown,
  User,
  Plus,
} from 'lucide-react';

// Exactly 4 Primary Sections in requested order
const PRIMARY_NAV = [
  {
    href: '/dashboard',
    label: 'Bosh sahifa',
    id: 'nav-dashboard-link',
    icon: LayoutDashboard,
    matcher: (path: string) => path === '/dashboard',
  },
  {
    href: '/transactions',
    label: 'Faoliyat',
    id: 'nav-transactions-link',
    icon: Receipt,
    matcher: (path: string) =>
      path.startsWith('/transactions') ||
      path.startsWith('/categories') ||
      path.startsWith('/imports'),
  },
  {
    href: '/analytics',
    label: 'Tahlil',
    id: 'nav-analytics-link',
    icon: BarChart3,
    matcher: (path: string) =>
      path.startsWith('/analytics') ||
      path.startsWith('/budgets') ||
      path.startsWith('/goals') ||
      path.startsWith('/insights'),
  },
  {
    href: '/advisor',
    label: 'AI yordamchi',
    id: 'nav-advisor-link',
    icon: Sparkles,
    matcher: (path: string) => path.startsWith('/advisor'),
  },
];

interface AppHeaderProps {
  userEmail?: string | null;
}

export default function AppHeader({ userEmail }: AppHeaderProps) {
  const pathname = usePathname();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const activeIndex = PRIMARY_NAV.findIndex((item) => item.matcher(pathname));

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#DCE4DE] shadow-fintech-card">
        <div className="max-w-[1760px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="h-16 flex items-center justify-between gap-3 sm:gap-4">
            {/* Logo on Left */}
            <div className="flex items-center gap-3 lg:gap-8">
              <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
                <SpendSenseLogo variant="icon" size="md" />
                <span className="font-bold text-base text-[#17211B] tracking-tight flex items-center gap-1.5">
                  SpendSense
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-[#DDF3E5] text-[#176B45] tracking-wide">
                    AI
                  </span>
                </span>
              </Link>

              {/* 4 Primary Navigation Links (Desktop) */}
              <nav className="hidden md:flex items-center gap-1.5" aria-label="Asosiy navigatsiya">
                {PRIMARY_NAV.map((item) => {
                  const isActive = item.matcher(pathname);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      id={item.id}
                      prefetch={true}
                      aria-current={isActive ? 'page' : undefined}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all ${
                        isActive
                          ? 'bg-[#DDF3E5] text-[#176B45] font-semibold shadow-xs'
                          : 'text-[#68736C] hover:text-[#17211B] hover:bg-[#F7F9F7]'
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#176B45]' : 'text-[#68736C]'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Side: + Tranzaksiya Button & Profile Menu */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Primary Tranzaksiya Action Button (Desktop/Tablet) - Exactly ONE plus icon */}
              <button
                type="button"
                id="header-add-transaction-btn"
                onClick={() => setIsModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#176B45] hover:bg-[#124D35] text-white text-xs font-semibold transition-all shadow-sm active:scale-98"
              >
                <Plus className="h-4 w-4" />
                <span>Tranzaksiya</span>
                <span className="sr-only">+ Tranzaksiya</span>
              </button>

              {/* Profile Menu Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  id="profile-dropdown-button"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE4DE] bg-white hover:bg-[#F7F9F7] px-2.5 py-1.5 text-xs font-medium text-[#17211B] transition-colors focus:outline-none focus:ring-1 focus:ring-[#176B45]"
                  aria-label="Foydalanuvchi menyusi"
                  aria-expanded={profileMenuOpen}
                >
                  <div className="h-6 w-6 rounded-full bg-[#DDF3E5] text-[#176B45] flex items-center justify-center font-bold text-[10px]">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  {userEmail && (
                    <span className="hidden lg:inline-block max-w-[130px] truncate text-xs text-[#17211B] font-medium">
                      {userEmail}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-[#68736C]" />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-56 rounded-2xl border border-[#DCE4DE] bg-white p-2 shadow-fintech-elevated z-50 animate-in fade-in zoom-in-95 duration-100">
                    {userEmail && (
                      <div className="px-3 py-2 border-b border-[#DCE4DE] mb-1">
                        <div className="text-[10px] text-[#68736C] uppercase tracking-wider font-semibold">Hisob</div>
                        <div className="text-xs text-[#17211B] font-medium truncate mt-0.5">{userEmail}</div>
                      </div>
                    )}

                    <Link
                      href="/settings"
                      id="settings-nav-link"
                      onClick={() => setProfileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors ${
                        pathname === '/settings'
                          ? 'bg-[#DDF3E5] text-[#176B45] font-semibold'
                          : 'text-[#17211B] hover:bg-[#F7F9F7]'
                      }`}
                    >
                      <Settings className="h-3.5 w-3.5 text-[#68736C]" />
                      <span>Sozlamalar</span>
                    </Link>

                    <div className="my-1 border-t border-[#DCE4DE]" />

                    <div className="px-1 pt-0.5">
                      <LogoutButton className="w-full justify-center text-xs py-1.5 text-[#C74747] hover:bg-rose-50 rounded-xl" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Contemporary Mobile Bottom Navigation Bar with Sliding Active Indicator */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#DCE4DE] z-40 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
        aria-label="Mobil navigatsiya"
      >
        <div className="relative grid grid-cols-4 items-center max-w-md mx-auto">
          {/* Animated Sliding Active Indicator Pill */}
          {activeIndex !== -1 && (
            <div
              aria-hidden="true"
              className="absolute top-0.5 bottom-0.5 w-1/4 px-1 pointer-events-none transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
              style={{
                transform: `translateX(${activeIndex * 100}%)`,
              }}
            >
              <div className="w-full h-full bg-[#DDF3E5] rounded-xl" />
            </div>
          )}

          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.matcher(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                id={item.id ? `mobile-${item.id}` : undefined}
                prefetch={true}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[48px] py-1.5 px-1 flex flex-col items-center justify-center relative z-10 rounded-xl transition-colors ${
                  isActive ? 'text-[#176B45] font-bold' : 'text-[#68736C] hover:text-[#17211B]'
                }`}
              >
                <Icon className={`h-4 w-4 mb-0.5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className="text-[10px] tracking-tight whitespace-nowrap text-center">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Subtle Mobile Add Action Pill (Non-overlapping, Hidden on /advisor, Hidden when header button is visible) */}
      {!pathname.startsWith('/advisor') && (
        <button
          type="button"
          id="mobile-fab-add-transaction"
          onClick={() => setIsModalOpen(true)}
          className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:hidden z-30 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-[#176B45] hover:bg-[#124D35] text-white shadow-lg active:scale-95 transition-all text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45] focus:ring-offset-2"
          aria-label="Yangi tranzaksiya qo‘shish"
        >
          <Plus className="h-4 w-4" />
          <span>Tranzaksiya</span>
        </button>
      )}

      {/* Accessible Hidden Logout Button for SSR Discovery */}
      <div className="sr-only" aria-hidden="true">
        <LogoutButton />
      </div>

      {/* Fast Transaction Entry Modal Available Everywhere */}
      <FastTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
