'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  RefreshCw,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  X,
} from 'lucide-react';
import type { TransactionWithCategory, Category, TransactionType } from '@/types/database';
import TransactionModal from './TransactionModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { PageHeader } from '@/components/bento';
import { cachedFetch, peekCache, invalidateCache, invalidateAllFinancialCaches, CACHE_TTL } from '@/lib/cache/clientCache';
import { getCategoryDisplayName } from '@/lib/categories/schemas';
import { TransactionRowSkeleton } from '@/components/ui/Skeleton';

const DEFAULT_TX_URL = '/api/transactions?page=1&pageSize=12&sortBy=date&sortDirection=desc';

export default function TransactionsManager() {
  const initialCachedTx = peekCache<{
    transactions: TransactionWithCategory[];
    totalCount: number;
    totalPages: number;
  }>(DEFAULT_TX_URL);

  const initialCachedCats = peekCache<{ categories: Category[] }>('/api/categories');

  const [transactions, setTransactions] = useState<TransactionWithCategory[]>(() => initialCachedTx?.transactions || []);
  const [categories, setCategories] = useState<Category[]>(() => initialCachedCats?.categories || []);
  const [totalCount, setTotalCount] = useState(() => initialCachedTx?.totalCount || 0);
  const [totalPages, setTotalPages] = useState(() => initialCachedTx?.totalPages || 1);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const formatTxAmount = (amount: number | string, curr: string) => {
    const num = Number(amount) || 0;
    if (curr === 'UZS' || !curr) {
      return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(num))} soʻm`;
    }
    return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(num))} ${curr}`;
  };

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [availableMonths, setAvailableMonths] = useState<Array<{ key: string; labelUz: string; startDate: string; endDate: string }>>([]);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // UI state: if we have cached data, isLoading starts as false for 0ms navigation!
  const [isLoading, setIsLoading] = useState(() => !initialCachedTx);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<TransactionWithCategory | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithCategory | null>(null);
  const [selectedTxDetail, setSelectedTxDetail] = useState<TransactionWithCategory | null>(null);

  // Fetch categories once with cache
  useEffect(() => {
    let active = true;
    async function loadCategories() {
      try {
        const data = await cachedFetch<{ categories: Category[] }>(
          '/api/categories',
          undefined,
          CACHE_TTL.CATEGORIES
        );
        if (active && data.categories) {
          setCategories(data.categories);
        }
      } catch (err) {
        console.error('Kategoriyalarni yuklashda xatolik:', err);
      }
    }
    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  // Fetch user-specific available months timeline
  useEffect(() => {
    let active = true;
    async function loadTimeline() {
      try {
        const data = await cachedFetch<{ availableMonths: Array<{ key: string; labelUz: string; startDate: string; endDate: string }> }>(
          '/api/timeline/available-months',
          undefined,
          CACHE_TTL.TRANSACTIONS
        );
        if (active && data?.availableMonths) {
          setAvailableMonths(data.availableMonths);
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadTimeline();
    return () => {
      active = false;
    };
  }, [reloadTrigger]);

  // Fetch transactions with applied filters
  useEffect(() => {
    let isCancelled = false;

    async function loadTransactions() {
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
        if (search.trim()) params.set('search', search.trim());
        if (typeFilter !== 'all') params.set('type', typeFilter);
        if (categoryFilter !== 'all') params.set('categoryId', categoryFilter);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        params.set('sortBy', sortBy);
        params.set('sortDirection', sortDirection);

        const targetUrl = `/api/transactions?${params.toString()}`;
        const cached = peekCache<{
          transactions: TransactionWithCategory[];
          totalCount: number;
          totalPages: number;
        }>(targetUrl);

        if (reloadTrigger > 0) {
          invalidateCache('/api/transactions');
        } else if (cached) {
          // If cached data exists for these exact filters, display immediately
          setTransactions(cached.transactions || []);
          setTotalCount(cached.totalCount || 0);
          setTotalPages(cached.totalPages || 1);
          setIsLoading(false);
          setIsRevalidating(true);
        } else {
          // Only show skeleton if no data is available
          setIsLoading(true);
        }

        const data = await cachedFetch<{
          transactions: TransactionWithCategory[];
          totalCount: number;
          totalPages: number;
        }>(targetUrl, undefined, CACHE_TTL.TRANSACTIONS);

        if (!isCancelled) {
          setTransactions(data.transactions || []);
          setTotalCount(data.totalCount || 0);
          setTotalPages(data.totalPages || 1);
          setIsLoading(false);
          setIsRevalidating(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : 'Tranzaksiyalarni yuklashda xatolik';
          setNotification({ type: 'error', message });
          setIsLoading(false);
          setIsRevalidating(false);
        }
      }
    }

    loadTransactions();

    return () => {
      isCancelled = true;
    };
  }, [page, pageSize, search, typeFilter, categoryFilter, startDate, endDate, sortBy, sortDirection, reloadTrigger]);

  // Handle Save (Create or Update)
  const handleSaveTransaction = async (payload: {
    description: string;
    amount: number;
    currency: string;
    type: TransactionType;
    transaction_date: string;
    category_id: string | null;
    merchant?: string | null;
    notes?: string | null;
  }) => {
    setIsSaving(true);
    try {
      if (transactionToEdit) {
        const res = await fetch(`/api/transactions/${transactionToEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          return { error: data.error || 'Tranzaksiyani yangilab bo‘lmadi' };
        }

        setNotification({ type: 'success', message: 'Tranzaksiya muvaffaqiyatli yangilandi.' });
      } else {
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          return { error: data.error || 'Tranzaksiyani yaratib bo‘lmadi' };
        }

        setNotification({ type: 'success', message: 'Tranzaksiya muvaffaqiyatli saqlandi.' });
      }

      setIsModalOpen(false);
      setTransactionToEdit(null);
      invalidateAllFinancialCaches();
      setIsLoading(true);
      setReloadTrigger((t) => t + 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Tranzaksiyani saqlashda xatolik yuz berdi';
      return { error: message };
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/transactions/${transactionToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Tranzaksiyani o‘chirib bo‘lmadi');
      }

      setNotification({ type: 'success', message: 'Tranzaksiya muvaffaqiyatli o‘chirildi.' });
      setTransactionToDelete(null);
      if (selectedTxDetail?.id === transactionToDelete.id) {
        setSelectedTxDetail(null);
      }
      invalidateAllFinancialCaches();
      setIsLoading(true);
      setReloadTrigger((t) => t + 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Tranzaksiyani o‘chirishda xatolik yuz berdi';
      setNotification({ type: 'error', message });
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setSelectedMonth('all');
    setStartDate('');
    setEndDate('');
    setSortBy('date');
    setSortDirection('desc');
    setPage(1);
    setIsLoading(true);
    setReloadTrigger((t) => t + 1);
  };


  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [date: string]: TransactionWithCategory[] } = {};
    for (const tx of transactions) {
      const d = tx.transaction_date || 'Noma’lum sana';
      if (!groups[d]) {
        groups[d] = [];
      }
      groups[d].push(tx);
    }
    return groups;
  }, [transactions]);

  const formatDateHeader = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      const today = new Date();
      const isToday =
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();

      const monthsUz = [
        'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
        'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
      ];
      const formatted = `${d.getDate()}-${monthsUz[d.getMonth()]}, ${d.getFullYear()}`;
      return isToday ? `Bugun — ${formatted}` : formatted;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <ArrowUpDown className="h-5 w-5 text-[#176B45]" />
            <span>Faoliyat</span>
            <span className="sr-only">Transactions</span>
          </div>
        }
        subtitle="Daromad va xarajatlaringizni kuzating."
        onRefresh={() => {
          setIsLoading(true);
          setReloadTrigger((t) => t + 1);
        }}
        isRefreshing={isLoading || isRevalidating}
        refreshId="refresh-transactions-btn"
        actions={
          <button
            id="add-transaction-btn"
            type="button"
            onClick={() => {
              setTransactionToEdit(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#176B45] text-white font-semibold text-sm hover:bg-[#125536] transition-colors shadow-fintech-card cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tranzaksiya qo‘shish</span>
            <span className="sr-only">Add Transaction</span>
          </button>
        }
      />

      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl text-sm font-medium flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-[#DDF3E5] border-[#176B45]/20 text-[#176B45]'
              : 'bg-rose-50 border-rose-200 text-[#C74747]'
          }`}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 hover:opacity-75 transition-opacity"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="rounded-2xl border border-[#D5DED7] bg-white p-4 sm:p-5 space-y-4 shadow-fintech-card">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A675F]">
              <Search className="h-4 w-4" />
            </span>
            <input
              id="search-input"
              type="text"
              placeholder="Qidirish (tavsif yoki savdo nuqtasi)..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                setIsLoading(true);
              }}
              className="w-full min-h-[44px] rounded-xl border border-[#D5DED7] bg-white pl-10 pr-3.5 py-2 text-sm text-[#17211B] placeholder-[#5A675F] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="md:col-span-3">
            <div className="flex rounded-xl border border-[#D5DED7] p-1 bg-[#F7F9F7] text-sm">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setPage(1);
                  setIsLoading(true);
                }}
                className={`flex-1 py-1.5 sm:py-2 rounded-lg text-center transition-all ${
                  typeFilter === 'all'
                    ? 'bg-[#176B45] text-white shadow-xs font-semibold'
                    : 'text-[#47544C] font-medium hover:text-[#17211B] hover:bg-black/5'
                }`}
              >
                Barchasi
              </button>
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('income');
                  setPage(1);
                  setIsLoading(true);
                }}
                className={`flex-1 py-1.5 sm:py-2 rounded-lg text-center transition-all ${
                  typeFilter === 'income'
                    ? 'bg-[#176B45] text-white shadow-xs font-semibold'
                    : 'text-[#47544C] font-medium hover:text-[#17211B] hover:bg-black/5'
                }`}
              >
                Daromad
              </button>
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('expense');
                  setPage(1);
                  setIsLoading(true);
                }}
                className={`flex-1 py-1.5 sm:py-2 rounded-lg text-center transition-all ${
                  typeFilter === 'expense'
                    ? 'bg-[#C74747] text-white shadow-xs font-semibold'
                    : 'text-[#47544C] font-medium hover:text-[#17211B] hover:bg-black/5'
                }`}
              >
                Xarajat
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3">
            <select
              id="filter-category-select"
              aria-label="Kategoriya bo‘yicha filtr"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
                setIsLoading(true);
              }}
              className="w-full min-h-[44px] rounded-xl border border-[#D5DED7] bg-white px-3 py-2 text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            >
              <option value="all">Barcha kategoriyalar</option>
              <option value="uncategorized">(Kategoriyasiz)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {getCategoryDisplayName(c.name)} ({c.type === 'income' ? 'Kirim' : 'Chiqim'})
                </option>
              ))}
            </select>
          </div>

          {/* Sort Control */}
          <div className="md:col-span-2 flex items-center gap-2">
            <select
              id="sort-by-select"
              aria-label="Saralash tartibi"
              value={`${sortBy}-${sortDirection}`}
              onChange={(e) => {
                const [sb, sd] = e.target.value.split('-');
                setSortBy(sb as 'date' | 'amount');
                setSortDirection(sd as 'asc' | 'desc');
                setPage(1);
                setIsLoading(true);
              }}
              className="w-full min-h-[44px] rounded-xl border border-[#D5DED7] bg-white px-3 py-2 text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
            >
              <option value="date-desc">Eng yangi</option>
              <option value="date-asc">Eng eski</option>
              <option value="amount-desc">Katta summa</option>
              <option value="amount-asc">Kichik summa</option>
            </select>

            <button
              type="button"
              id="reset-filters-btn"
              onClick={handleResetFilters}
              title="Filtrlarni tozalash"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#D5DED7] bg-white p-2.5 text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Date Range & Month Filter Row */}
        <div className="space-y-2.5 pt-3 border-t border-[#D5DED7] text-sm text-[#47544C]">
          {availableMonths.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-xs font-medium text-[#17211B] shrink-0 mr-1">Oylar:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth('all');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                  setIsLoading(true);
                }}
                className={`px-2.5 py-1 text-xs rounded-lg transition-all shrink-0 ${
                  selectedMonth === 'all'
                    ? 'bg-[#176B45] text-white font-semibold shadow-xs'
                    : 'bg-[#F7F9F7] text-[#47544C] hover:bg-[#EAEFEA] font-medium'
                }`}
              >
                Barchasi
              </button>
              {availableMonths.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setSelectedMonth(m.key);
                    setStartDate(m.startDate);
                    setEndDate(m.endDate);
                    setPage(1);
                    setIsLoading(true);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-all shrink-0 ${
                    selectedMonth === m.key
                      ? 'bg-[#176B45] text-white font-semibold shadow-xs'
                      : 'bg-[#F7F9F7] text-[#47544C] hover:bg-[#EAEFEA] font-medium'
                  }`}
                >
                  {m.labelUz}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <span className="flex items-center gap-1.5 font-medium text-[#17211B] text-xs sm:text-sm shrink-0">
              <Calendar className="h-4 w-4 text-[#176B45]" /> Maxsus sana:
            </span>
            <div className="flex flex-1 sm:flex-initial items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              <input
                id="filter-start-date"
                aria-label="Boshlanish sanasi"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setSelectedMonth('custom');
                  setStartDate(e.target.value);
                  setPage(1);
                  setIsLoading(true);
                }}
                className="flex-1 sm:flex-initial min-h-[38px] w-full sm:w-36 rounded-xl border border-[#D5DED7] bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
              />
              <span className="text-[#5A675F] shrink-0 text-xs">—</span>
              <input
                id="filter-end-date"
                aria-label="Tugash sanasi"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setSelectedMonth('custom');
                  setEndDate(e.target.value);
                  setPage(1);
                  setIsLoading(true);
                }}
                className="flex-1 sm:flex-initial min-h-[38px] w-full sm:w-36 rounded-xl border border-[#D5DED7] bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 transition-all"
              />
            </div>
            {(startDate || endDate || search || typeFilter !== 'all' || categoryFilter !== 'all') && (
              <span className="text-[#176B45] text-xs sm:text-sm font-medium w-full sm:w-auto sm:ml-auto">
                Topildi: {totalCount} ta mos yozuv
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area: Grouped List (Desktop & Mobile) */}
      <div className="rounded-2xl border border-[#D5DED7] bg-white overflow-hidden shadow-fintech-card">
        {isLoading && transactions.length === 0 ? (
          <div id="transactions-loading" className="divide-y divide-[#D5DED7]">
            <div className="bg-[#F7F9F7] px-5 py-3 border-b border-[#D5DED7]">
              <div className="h-4 w-36 skeleton-shimmer rounded" />
            </div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div id="transactions-empty-state" className="py-20 text-center px-4">
            <div className="h-12 w-12 rounded-full bg-[#F7F9F7] flex items-center justify-center mx-auto text-[#5A675F] mb-3 border border-[#D5DED7]">
              <ArrowUpDown className="h-6 w-6" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-[#17211B]">Tranzaksiyalar hali yo‘q.</h3>
            <p className="text-sm sm:text-base text-[#47544C] mt-1.5 max-w-sm mx-auto">
              {search || typeFilter !== 'all' || categoryFilter !== 'all' || startDate || endDate
                ? 'Tanlangan filtrlarga mos keluvchi tranzaksiyalar topilmadi.'
                : 'Birinchi daromad yoki xarajatingizni qo‘shing.'}
            </p>
          </div>
        ) : (
          <div id="transactions-table" className="divide-y divide-[#D5DED7]">
            {Object.entries(groupedTransactions).map(([date, dateTxList]) => (
              <div key={date}>
                {/* Date Group Header */}
                <div className="px-5 py-2.5 bg-[#F7F9F7] border-y border-[#D5DED7] first:border-t-0 flex items-center justify-between text-xs font-semibold text-[#47544C]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-[#176B45]" />
                    <span>{formatDateHeader(date)}</span>
                  </div>
                  <span className="text-xs text-[#5A675F] font-mono">
                    {dateTxList.length} ta tranzaksiya
                  </span>
                </div>

                {/* Transaction Items in beloved modern fintech style */}
                <div className="divide-y divide-[#D5DED7]/60">
                  {dateTxList.map((tx) => {
                    const isIncome = tx.type === 'income';
                    const rawAmount = Math.abs(Number(tx.amount) || 0);
                    const cat = tx.categories;
                    const catName = getCategoryDisplayName(cat?.name) || (isIncome ? 'Kirim' : 'Boshqa xarajat');

                    return (
                      <div
                        key={tx.id}
                        id={`transaction-row-${tx.id}`}
                        onClick={() => setSelectedTxDetail(tx)}
                        className="px-3.5 sm:px-5 py-3 sm:py-4 flex items-center justify-between hover:bg-[#F7F9F7] transition-all cursor-pointer group gap-2.5 sm:gap-4"
                      >
                        {/* Left: Direction Icon + Title + Metadata */}
                        <div className="flex-1 min-w-0 flex items-center gap-2.5 sm:gap-3.5">
                          <div
                            className={`h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105 ${
                              isIncome ? 'bg-[#DDF3E5] text-[#176B45]' : 'bg-[#FEE2E2] text-[#C74747]'
                            }`}
                          >
                            {isIncome ? (
                              <ArrowDownLeft className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                            ) : (
                              <ArrowUpRight className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm sm:text-base text-[#17211B] truncate group-hover:text-[#176B45] transition-colors leading-tight">
                              {tx.description}
                            </div>
                            <div className="text-xs text-[#5A675F] flex items-center gap-1.5 mt-1 whitespace-nowrap overflow-hidden">
                              <span className="px-2 py-0.5 bg-[#F1F4F2] border border-[#D5DED7] rounded-md text-[#17211B] font-medium text-[11px] truncate max-w-[120px] sm:max-w-[160px] shrink-0">
                                {catName}
                              </span>
                              <span className="text-[#D5DED7] shrink-0">•</span>
                              <span className="font-mono text-[11px] text-[#5A675F] shrink-0">
                                {tx.transaction_date}
                              </span>
                              {tx.merchant && tx.merchant !== tx.description && (
                                <>
                                  <span className="hidden sm:inline text-[#D5DED7]">•</span>
                                  <span className="hidden sm:inline truncate max-w-[160px] text-[#47544C] text-[11px]">
                                    {tx.merchant}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount + Actions */}
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 shrink-0 pl-1">
                          <div
                            className={`font-mono font-bold text-sm sm:text-base whitespace-nowrap tabular-nums ${
                              isIncome ? 'text-[#176B45]' : 'text-[#C74747]'
                            }`}
                          >
                            {isIncome ? '+' : '-'}
                            {formatTxAmount(rawAmount, tx.currency)}
                          </div>

                          {/* Quick Action Buttons */}
                          <div
                            className="flex items-center gap-0.5 sm:gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              id={`edit-tx-${tx.id}`}
                              onClick={() => {
                                setTransactionToEdit(tx);
                                setIsModalOpen(true);
                              }}
                              title="Tahrirlash"
                              aria-label="Tahrirlash"
                              className="min-h-[28px] min-w-[28px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center p-1 sm:p-2 text-[#5A675F] hover:text-[#176B45] hover:bg-[#DDF3E5] rounded-lg sm:rounded-xl transition-all active:scale-95"
                            >
                              <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                            <button
                              type="button"
                              id={`delete-tx-${tx.id}`}
                              onClick={() => setTransactionToDelete(tx)}
                              title="O‘chirish"
                              aria-label="O‘chirish"
                              className="min-h-[28px] min-w-[28px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center p-1 sm:p-2 text-[#5A675F] hover:text-[#C74747] hover:bg-rose-50 rounded-lg sm:rounded-xl transition-all active:scale-95"
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && totalCount > 0 && (
          <div className="p-4 bg-[#F7F9F7] border-t border-[#D5DED7] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[#47544C]">
            <div>
              Ko‘rsatilmoqda:{' '}
              <span className="text-[#17211B] font-semibold">{(page - 1) * pageSize + 1}</span> dan{' '}
              <span className="text-[#17211B] font-semibold">{Math.min(page * pageSize, totalCount)}</span> gacha, jami:{' '}
              <span className="text-[#17211B] font-semibold">{totalCount}</span> ta
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="pagination-prev-btn"
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  setIsLoading(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5DED7] bg-white px-3 py-1.5 text-sm text-[#17211B] hover:bg-[#F7F9F7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[38px]"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Oldingi</span>
              </button>

              <span className="px-3 text-[#17211B] font-mono font-medium text-sm tabular-nums">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                id="pagination-next-btn"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  setIsLoading(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5DED7] bg-white px-3 py-1.5 text-sm text-[#17211B] hover:bg-[#F7F9F7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[38px]"
              >
                <span>Keyingi</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail View Modal */}
      {selectedTxDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#D5DED7] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#D5DED7]">
              <h3 className="text-lg font-semibold text-[#17211B]">Tranzaksiya tafsilotlari</h3>
              <button
                type="button"
                onClick={() => setSelectedTxDetail(null)}
                className="rounded-xl p-2 text-[#5A675F] hover:text-[#17211B] hover:bg-[#F7F9F7] min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Yopish"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-[#D5DED7]/60">
                <span className="text-[#47544C]">Tavsif</span>
                <span className="font-medium text-[#17211B] text-right">{selectedTxDetail.description}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#D5DED7]/60">
                <span className="text-[#47544C]">Turi</span>
                <span
                  className={`font-semibold ${
                    selectedTxDetail.type === 'expense' ? 'text-[#C74747]' : 'text-[#176B45]'
                  }`}
                >
                  {selectedTxDetail.type === 'expense' ? 'Chiqim (Xarajat)' : 'Kirim (Daromad)'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#D5DED7]/60">
                <span className="text-[#47544C]">Summa</span>
                <span
                  className={`font-mono font-bold tabular-nums text-base ${
                    selectedTxDetail.type === 'expense' ? 'text-[#C74747]' : 'text-[#176B45]'
                  }`}
                >
                  {selectedTxDetail.type === 'expense' ? '-' : '+'}
                  {formatTxAmount(selectedTxDetail.amount, selectedTxDetail.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#D5DED7]/60">
                <span className="text-[#47544C]">Sana</span>
                <span className="font-mono text-[#17211B]">{selectedTxDetail.transaction_date}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#D5DED7]/60">
                <span className="text-[#47544C]">Kategoriya</span>
                <span className="font-medium text-[#17211B]">
                  {selectedTxDetail.categories ? getCategoryDisplayName(selectedTxDetail.categories.name) : 'Kategoriyasiz'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#D5DED7]/60">
                <span className="text-[#47544C]">Savdo nuqtasi</span>
                <span className="text-[#17211B]">{selectedTxDetail.merchant || '—'}</span>
              </div>
              {selectedTxDetail.notes && (
                <div className="py-1.5">
                  <span className="text-[#47544C] block mb-1.5 font-medium">Izoh</span>
                  <p className="bg-[#F7F9F7] p-3.5 rounded-xl border border-[#D5DED7] text-sm sm:text-base text-[#17211B] leading-relaxed">{selectedTxDetail.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#D5DED7] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const tx = selectedTxDetail;
                  setSelectedTxDetail(null);
                  setTransactionToEdit(tx);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D5DED7] bg-white px-4 py-2 min-h-[44px] text-sm font-semibold text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
              >
                <Edit2 className="h-4 w-4" />
                <span>Tahrirlash</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTxDetail(null)}
                className="rounded-xl bg-[#176B45] px-5 py-2 min-h-[44px] text-sm font-semibold text-white hover:bg-[#125536] shadow-fintech-card transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <TransactionModal
        isOpen={isModalOpen}
        isSaving={isSaving}
        transactionToEdit={transactionToEdit}
        categories={categories}
        onClose={() => {
          setIsModalOpen(false);
          setTransactionToEdit(null);
        }}
        onSave={handleSaveTransaction}
      />

      <DeleteConfirmModal
        isOpen={Boolean(transactionToDelete)}
        isDeleting={isDeleting}
        transactionDescription={transactionToDelete?.description || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setTransactionToDelete(null)}
      />
    </div>
  );
}
