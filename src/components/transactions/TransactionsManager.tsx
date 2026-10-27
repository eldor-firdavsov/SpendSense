'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Calendar,
  Info,
  X,
} from 'lucide-react';
import type { TransactionWithCategory, Category, TransactionType } from '@/types/database';
import TransactionModal from './TransactionModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { PageHeader } from '@/components/bento';
import { cachedFetch, invalidateCache, invalidateAllFinancialCaches, CACHE_TTL } from '@/lib/cache/clientCache';

export default function TransactionsManager() {
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
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
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<TransactionWithCategory | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithCategory | null>(null);
  const [selectedTxDetail, setSelectedTxDetail] = useState<TransactionWithCategory | null>(null);

  // Fetch categories once
  useEffect(() => {
    let active = true;
    async function loadCategories() {
      try {
        const data = await cachedFetch<{ categories: Category[] }>(
          '/api/categories',
          undefined,
          CACHE_TTL.CATEGORIES
        );
        if (active) {
          setCategories(data.categories || []);
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

        if (reloadTrigger > 0) {
          invalidateCache('/api/transactions');
        }

        const data = await cachedFetch<{
          transactions: TransactionWithCategory[];
          totalCount: number;
          totalPages: number;
        }>(`/api/transactions?${params.toString()}`, undefined, CACHE_TTL.TRANSACTIONS);

        if (!isCancelled) {
          setTransactions(data.transactions || []);
          setTotalCount(data.totalCount || 0);
          setTotalPages(data.totalPages || 1);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : 'Tranzaksiyalarni yuklashda xatolik';
          setNotification({ type: 'error', message });
          setIsLoading(false);
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
    setStartDate('');
    setEndDate('');
    setSortBy('date');
    setSortDirection('desc');
    setPage(1);
    setIsLoading(true);
    setReloadTrigger((t) => t + 1);
  };

  // Computed summary over currently displayed transactions
  const { totalIncome, totalExpenses, netFlow } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const tx of transactions) {
      const val = Number(tx.amount) || 0;
      if (tx.type === 'income') inc += val;
      if (tx.type === 'expense') exp += val;
    }
    return { totalIncome: inc, totalExpenses: exp, netFlow: inc - exp };
  }, [transactions]);

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
          </div>
        }
        subtitle="Daromad va xarajatlaringizni kuzating."
        srOnlyFallback="Activity"
        actions={
          <div className="flex items-center gap-2">
            <button
              id="refresh-transactions-btn"
              type="button"
              onClick={() => {
                setIsLoading(true);
                setReloadTrigger((t) => t + 1);
              }}
              className="p-2 rounded-xl bg-white border border-[#DCE4DE] text-[#68736C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-all shadow-fintech-card"
              title="Yangilash"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#176B45]' : ''}`} />
            </button>
            <button
              id="create-transaction-btn"
              type="button"
              onClick={() => {
                setTransactionToEdit(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#176B45] text-white font-semibold text-xs hover:bg-[#125536] transition-colors shadow-fintech-card"
            >
              <Plus className="h-4 w-4" />
              <span>Tranzaksiya</span>
              <span className="sr-only">+ Tranzaksiya Add Transaction</span>
            </button>
          </div>
        }
      />

      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
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
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="rounded-2xl border border-[#DCE4DE] bg-white p-4 space-y-3 shadow-fintech-card">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#68736C]">
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
              className="w-full rounded-xl border border-[#DCE4DE] bg-white pl-9 pr-3 py-2 text-xs text-[#17211B] placeholder-[#68736C] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45] transition-all"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="md:col-span-3">
            <div className="flex rounded-xl border border-[#DCE4DE] p-0.5 bg-[#F7F9F7] text-xs">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setPage(1);
                  setIsLoading(true);
                }}
                className={`flex-1 py-1.5 rounded-lg font-medium text-center transition-all ${
                  typeFilter === 'all'
                    ? 'bg-white text-[#17211B] shadow-fintech-card font-semibold'
                    : 'text-[#68736C] hover:text-[#17211B]'
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
                className={`flex-1 py-1.5 rounded-lg font-medium text-center transition-all ${
                  typeFilter === 'income'
                    ? 'bg-white text-[#176B45] shadow-fintech-card font-semibold'
                    : 'text-[#68736C] hover:text-[#17211B]'
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
                className={`flex-1 py-1.5 rounded-lg font-medium text-center transition-all ${
                  typeFilter === 'expense'
                    ? 'bg-white text-amber-900 shadow-fintech-card font-semibold'
                    : 'text-[#68736C] hover:text-[#17211B]'
                }`}
              >
                Xarajat
              </button>
            </div>
            {/* Hidden select for backwards compatibility */}
            <select
              id="filter-type-select"
              aria-label="Tranzaksiya turi"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as 'all' | 'income' | 'expense');
                setPage(1);
                setIsLoading(true);
              }}
              className="sr-only"
            >
              <option value="all">Barcha turlar</option>
              <option value="expense">Faqat xarajatlar</option>
              <option value="income">Faqat daromadlar</option>
            </select>
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
              className="w-full rounded-xl border border-[#DCE4DE] bg-white px-3 py-2 text-xs text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45] transition-all"
            >
              <option value="all">Barcha kategoriyalar</option>
              <option value="uncategorized">(Kategoriyasiz)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === 'income' ? 'Kirim' : 'Chiqim'})
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
              className="w-full rounded-xl border border-[#DCE4DE] bg-white px-3 py-2 text-xs text-[#17211B] focus:border-[#176B45] focus:outline-none focus:ring-1 focus:ring-[#176B45] transition-all"
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
              className="rounded-xl border border-[#DCE4DE] bg-white p-2 text-[#68736C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-[#DCE4DE] text-xs text-[#68736C]">
          <span className="flex items-center gap-1 font-medium text-[#17211B]">
            <Calendar className="h-3.5 w-3.5 text-[#176B45]" /> Sana oralig‘i:
          </span>
          <div className="flex items-center gap-2">
            <input
              id="filter-start-date"
              aria-label="Boshlanish sanasi"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
                setIsLoading(true);
              }}
              className="rounded-xl border border-[#DCE4DE] bg-white px-2.5 py-1 text-xs text-[#17211B] focus:border-[#176B45] focus:outline-none transition-all"
            />
            <span>—</span>
            <input
              id="filter-end-date"
              aria-label="Tugash sanasi"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
                setIsLoading(true);
              }}
              className="rounded-xl border border-[#DCE4DE] bg-white px-2.5 py-1 text-xs text-[#17211B] focus:border-[#176B45] focus:outline-none transition-all"
            />
          </div>
          {(startDate || endDate || search || typeFilter !== 'all' || categoryFilter !== 'all') && (
            <span className="text-[#176B45] text-xs font-medium ml-auto">
              Topildi: {totalCount} ta mos yozuv
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area: Grouped List (Desktop & Mobile) */}
      <div className="rounded-2xl border border-[#DCE4DE] bg-white overflow-hidden shadow-fintech-card">
        {isLoading ? (
          <div id="transactions-loading" className="py-16 flex flex-col items-center justify-center text-[#68736C]">
            <Loader2 className="h-6 w-6 animate-spin text-[#176B45] mb-2" />
            <span className="text-xs">Tranzaksiyalar yuklanmoqda...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div id="transactions-empty-state" className="py-16 text-center px-4">
            <div className="h-10 w-10 rounded-full bg-[#F7F9F7] flex items-center justify-center mx-auto text-[#68736C] mb-2.5 border border-[#DCE4DE]">
              <ArrowUpDown className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#17211B]">Tranzaksiyalar hali yo‘q.</h3>
            <p className="text-xs text-[#68736C] mt-1 max-w-sm mx-auto">
              {search || typeFilter !== 'all' || categoryFilter !== 'all' || startDate || endDate
                ? 'Tanlangan filtrlarga mos keluvchi tranzaksiyalar topilmadi.'
                : 'Birinchi daromad yoki xarajatingizni qo‘shing.'}
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table id="transactions-table" className="w-full text-left text-xs">
                <thead className="bg-[#F7F9F7] border-b border-[#DCE4DE] text-[#68736C] font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Sana</th>
                    <th className="py-2.5 px-4">Tavsif</th>
                    <th className="py-2.5 px-4">Kategoriya</th>
                    <th className="py-2.5 px-4 text-right">Summa</th>
                    <th className="py-2.5 px-4 text-right">Amal yoki batafsil ko‘rish</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4DE]">
                  {Object.entries(groupedTransactions).map(([date, dateTxList]) => (
                    <React.Fragment key={date}>
                      {/* Date Group Header */}
                      <tr className="bg-[#F7F9F7]/70">
                        <td colSpan={6} className="py-1.5 px-4 text-[11px] font-semibold text-[#68736C]">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-[#176B45]" />
                            {formatDateHeader(date)}
                          </span>
                        </td>
                      </tr>

                      {dateTxList.map((tx) => {
                        const isIncome = tx.type === 'income';
                        const isExpense = tx.type === 'expense';
                        const rawAmount = Math.abs(Number(tx.amount) || 0);

                        return (
                          <tr
                            key={tx.id}
                            id={`transaction-row-${tx.id}`}
                            className="hover:bg-[#F7F9F7]/60 transition-colors group"
                          >
                            <td className="py-3 px-4 font-mono text-xs text-[#68736C] whitespace-nowrap">
                              {tx.transaction_date}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => setSelectedTxDetail(tx)}
                                className="text-left font-medium text-[#17211B] hover:text-[#176B45] transition-colors"
                              >
                                {tx.description}
                              </button>
                              {(tx.merchant || tx.notes) && (
                                <div className="text-[11px] text-[#68736C] mt-0.5 line-clamp-1">
                                  {tx.merchant && <span className="font-medium mr-1.5">{tx.merchant}</span>}
                                  {tx.notes && <span>{tx.notes}</span>}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {tx.categories ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-[#F7F9F7] border border-[#DCE4DE] px-2 py-0.5 text-[11px] font-medium text-[#17211B]">
                                  {tx.categories.name}
                                </span>
                              ) : (
                                <span className="text-[11px] text-[#68736C] italic">Kategoriyasiz</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-semibold">
                              <div className="inline-flex items-center justify-end gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                    isIncome
                                      ? 'bg-[#DDF3E5] text-[#176B45] border-[#176B45]/20'
                                      : isExpense
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-[#F7F9F7] text-[#68736C] border-[#DCE4DE]'
                                  }`}
                                >
                                  {isIncome ? 'Daromad' : isExpense ? 'Xarajat' : 'Noma’lum'}
                                </span>
                                <span
                                  className={`font-mono font-semibold text-xs ${
                                    isIncome ? 'text-[#176B45]' : isExpense ? 'text-[#17211B]' : 'text-[#68736C]'
                                  }`}
                                >
                                  {isIncome ? '+ ' : isExpense ? '− ' : ''}
                                  {formatTxAmount(rawAmount, tx.currency)}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTxDetail(tx)}
                                  title="Batafsil ko‘rish"
                                  className="p-1.5 text-[#68736C] hover:text-[#17211B] hover:bg-[#F7F9F7] rounded-lg transition-colors inline-flex items-center gap-1"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                  <span className="sr-only">Batafsil</span>
                                </button>
                                <button
                                  type="button"
                                  id={`edit-tx-${tx.id}`}
                                  onClick={() => {
                                    setTransactionToEdit(tx);
                                    setIsModalOpen(true);
                                  }}
                                  title="Tahrirlash"
                                  className="p-1.5 text-[#68736C] hover:text-[#176B45] hover:bg-[#DDF3E5] rounded-lg transition-colors"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  id={`delete-tx-${tx.id}`}
                                  onClick={() => setTransactionToDelete(tx)}
                                  title="O‘chirish"
                                  className="p-1.5 text-[#68736C] hover:text-[#C74747] hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Readable List Grouped by Date */}
            <div className="block sm:hidden divide-y divide-[#DCE4DE]">
              {Object.entries(groupedTransactions).map(([date, dateTxList]) => (
                <div key={date} className="p-3">
                  <div className="text-[11px] font-semibold text-[#68736C] pb-2 flex items-center gap-1.5 border-b border-[#DCE4DE]">
                    <Calendar className="h-3 w-3 text-[#176B45]" />
                    {formatDateHeader(date)}
                  </div>
                  <div className="divide-y divide-[#DCE4DE]/60">
                    {dateTxList.map((tx) => {
                      const isIncome = tx.type === 'income';
                      const isExpense = tx.type === 'expense';
                      const rawAmount = Math.abs(Number(tx.amount) || 0);

                      return (
                        <div
                          key={tx.id}
                          className="py-2.5 flex items-start justify-between gap-3"
                        >
                          <div
                            className="flex-1 cursor-pointer"
                            onClick={() => setSelectedTxDetail(tx)}
                          >
                            <div className="font-semibold text-xs text-[#17211B]">
                              {tx.description}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#68736C]">
                              {tx.categories ? (
                                <span className="text-[#176B45] font-medium">{tx.categories.name}</span>
                              ) : (
                                <span>Kategoriyasiz</span>
                              )}
                              {tx.merchant && <span>• {tx.merchant}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="flex items-center justify-end gap-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                  isIncome
                                    ? 'bg-[#DDF3E5] text-[#176B45] border-[#176B45]/20'
                                    : isExpense
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-[#F7F9F7] text-[#68736C] border-[#DCE4DE]'
                                }`}
                              >
                                {isIncome ? 'Daromad' : isExpense ? 'Xarajat' : 'Noma’lum'}
                              </span>
                              <span
                                className={`text-xs font-mono font-bold ${
                                  isIncome ? 'text-[#176B45]' : isExpense ? 'text-[#17211B]' : 'text-[#68736C]'
                                }`}
                              >
                                {isIncome ? '+ ' : isExpense ? '− ' : ''}
                                {formatTxAmount(rawAmount, tx.currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => setSelectedTxDetail(tx)}
                                className="text-[11px] text-[#68736C] hover:text-[#17211B]"
                              >
                                Batafsil
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTransactionToEdit(tx);
                                  setIsModalOpen(true);
                                }}
                                className="text-[11px] text-[#68736C] hover:text-[#176B45]"
                              >
                                Tahrirlash
                              </button>
                              <button
                                type="button"
                                onClick={() => setTransactionToDelete(tx)}
                                className="text-[11px] text-[#C74747]"
                              >
                                O‘chirish
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
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && totalCount > 0 && (
          <div className="p-3.5 bg-[#F7F9F7] border-t border-[#DCE4DE] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#68736C]">
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
                className="inline-flex items-center gap-1 rounded-xl border border-[#DCE4DE] bg-white px-2.5 py-1 text-xs text-[#17211B] hover:bg-[#F7F9F7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Oldingi</span>
              </button>

              <span className="px-2 text-[#17211B] font-mono font-medium text-xs">
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
                className="inline-flex items-center gap-1 rounded-xl border border-[#DCE4DE] bg-white px-2.5 py-1 text-xs text-[#17211B] hover:bg-[#F7F9F7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Keyingi</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail View Modal */}
      {selectedTxDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#DCE4DE] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DE]">
              <h3 className="text-base font-bold text-[#17211B]">Tranzaksiya tafsilotlari</h3>
              <button
                type="button"
                onClick={() => setSelectedTxDetail(null)}
                className="rounded-xl p-1 text-[#68736C] hover:text-[#17211B] hover:bg-[#F7F9F7]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#DCE4DE]/60">
                <span className="text-[#68736C]">Tavsif</span>
                <span className="font-semibold text-[#17211B]">{selectedTxDetail.description}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DCE4DE]/60">
                <span className="text-[#68736C]">Turi</span>
                <span
                  className={`font-semibold ${
                    selectedTxDetail.type === 'expense' ? 'text-[#C74747]' : 'text-[#176B45]'
                  }`}
                >
                  {selectedTxDetail.type === 'expense' ? 'Chiqim (Xarajat)' : 'Kirim (Daromad)'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DCE4DE]/60">
                <span className="text-[#68736C]">Summa</span>
                <span className="font-mono font-bold text-sm text-[#17211B]">
                  {formatTxAmount(selectedTxDetail.amount, selectedTxDetail.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DCE4DE]/60">
                <span className="text-[#68736C]">Sana</span>
                <span className="font-mono text-[#17211B]">{selectedTxDetail.transaction_date}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DCE4DE]/60">
                <span className="text-[#68736C]">Kategoriya</span>
                <span className="font-medium text-[#17211B]">
                  {selectedTxDetail.categories?.name || 'Kategoriyasiz'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DCE4DE]/60">
                <span className="text-[#68736C]">Savdo nuqtasi</span>
                <span className="text-[#17211B]">{selectedTxDetail.merchant || '—'}</span>
              </div>
              {selectedTxDetail.notes && (
                <div className="py-1">
                  <span className="text-[#68736C] block mb-1">Izoh</span>
                  <p className="bg-[#F7F9F7] p-2.5 rounded-xl border border-[#DCE4DE] text-[#17211B]">{selectedTxDetail.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#DCE4DE] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const tx = selectedTxDetail;
                  setSelectedTxDetail(null);
                  setTransactionToEdit(tx);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE4DE] bg-white px-3 py-1.5 text-xs font-semibold text-[#17211B] hover:bg-[#F7F9F7]"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Tahrirlash</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTxDetail(null)}
                className="rounded-xl bg-[#176B45] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#125536] shadow-fintech-card"
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
