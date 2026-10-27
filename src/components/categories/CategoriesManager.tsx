'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Tag,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Category, CategoryType } from '@/types/database';
import CategoryModal from './CategoryModal';
import DeleteCategoryModal from './DeleteCategoryModal';
import { PageHeader, BentoGrid, BentoMetricCard } from '@/components/bento';

export default function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadCategories() {
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Kategoriyalarni yuklab bo‘lmadi');
        }
        const data = await res.json();
        if (active) {
          setCategories(data.categories || []);
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Kategoriyalarni yuklashda xatolik';
          setNotification({ type: 'error', message: msg });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadCategories();
    return () => {
      active = false;
    };
  }, [reloadTrigger]);

  const refreshCategories = () => {
    setIsLoading(true);
    setReloadTrigger((prev) => prev + 1);
  };

  const filteredCategories = categories.filter((c) => {
    if (typeFilter === 'all') return true;
    return c.type === typeFilter;
  });

  const systemCategories = filteredCategories.filter((c) => c.is_system);
  const customCategories = filteredCategories.filter((c) => !c.is_system);

  const handleSaveCategory = async (payload: {
    name: string;
    type: CategoryType;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
  }) => {
    setIsSaving(true);
    try {
      if (categoryToEdit) {
        const res = await fetch(`/api/categories/${categoryToEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: data.error || 'Kategoriyani yangilab bo‘lmadi.' };
        }
        setNotification({ type: 'success', message: 'Kategoriya muvaffaqiyatli yangilandi.' });
      } else {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: data.error || 'Kategoriyani yaratib bo‘lmadi.' };
        }
        setNotification({ type: 'success', message: 'Yangi kategoriya muvaffaqiyatli qo‘shildi.' });
      }

      setIsModalOpen(false);
      setCategoryToEdit(null);
      refreshCategories();
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Tarmoq xatosi.' };
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/categories/${categoryToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setNotification({ type: 'error', message: data.error || 'Kategoriyani o‘chirib bo‘lmadi.' });
      } else {
        setNotification({
          type: 'success',
          message: `“${categoryToDelete.name}” kategoriyasi o‘chirildi. Mavjud tranzaksiyalar kategoriyasiz deb belgilandi.`,
        });
        setCategoryToDelete(null);
        refreshCategories();
      }
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Kategoriyani o‘chirishda tarmoq xatosi.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="categories-container" className="space-y-6">
      {/* Top Banner / Notification */}
      {notification && (
        <div
          id="categories-notification"
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
            notification.type === 'success'
              ? 'bg-[#DDF3E5] border-[#176B45]/20 text-[#176B45]'
              : 'bg-red-50 border-red-200 text-[#C74747]'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#176B45]" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-[#C74747]" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs underline font-medium ml-4 opacity-80 hover:opacity-100"
          >
            Yopish
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Kategoriyalar"
        subtitle="Shaxsiy moliyangizni tizimli va qulay kategoriyalar yordamida tartibga soling"
        srOnlyFallback="Category Management"
        actions={
          <>
            <button
              type="button"
              id="refresh-categories-btn"
              onClick={refreshCategories}
              disabled={isLoading}
              className="p-2 rounded-xl border border-[#DCE4DE] bg-white text-[#68736C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-colors disabled:opacity-50 shadow-fintech-card"
              title="Kategoriyalarni yangilash"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#176B45]' : ''}`} />
            </button>
            <button
              type="button"
              id="add-category-btn"
              onClick={() => {
                setCategoryToEdit(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#176B45] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#125536] transition-colors shadow-fintech-card"
            >
              <Plus className="h-4 w-4" />
              <span>Maxsus kategoriya qo‘shish</span>
              <span className="sr-only">Add Custom Category</span>
            </button>
          </>
        }
      />

      {/* 3 Metric Cards for Categories Breakdown */}
      <BentoGrid cols={3}>
        <BentoMetricCard
          title="Jami kategoriyalar"
          value={categories.length}
          subtext="Mavjud tizim va maxsus toifalar"
          accent="neutral"
          icon={<Tag className="h-4 w-4" />}
        />
        <BentoMetricCard
          title="Chiqim toifalari"
          value={categories.filter((c) => c.type === 'expense').length}
          subtext="Xarajatlar tasnifi uchun"
          accent="red"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <BentoMetricCard
          title="Kirim toifalari"
          value={categories.filter((c) => c.type === 'income').length}
          subtext="Daromadlar tasnifi uchun"
          accent="green"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </BentoGrid>

      {/* Control Bar: Type Filter */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-[#DCE4DE] self-start text-xs shadow-fintech-card">
        <button
          type="button"
          id="category-filter-all"
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            typeFilter === 'all'
              ? 'bg-[#176B45] text-white shadow-fintech-card font-semibold'
              : 'text-[#68736C] hover:text-[#17211B]'
          }`}
        >
          Barchasi ({categories.length})
        </button>
        <button
          type="button"
          id="category-filter-expense"
          onClick={() => setTypeFilter('expense')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            typeFilter === 'expense'
              ? 'bg-[#FCEAEA] text-[#C74747] font-semibold border border-[#C74747]/20'
              : 'text-[#68736C] hover:text-[#C74747]'
          }`}
        >
          <TrendingDown className="h-3.5 w-3.5" />
          <span>Chiqim ({categories.filter((c) => c.type === 'expense').length})</span>
        </button>
        <button
          type="button"
          id="category-filter-income"
          onClick={() => setTypeFilter('income')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            typeFilter === 'income'
              ? 'bg-[#E5F4EA] text-[#176B45] font-semibold border border-[#176B45]/20'
              : 'text-[#68736C] hover:text-[#176B45]'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Kirim ({categories.filter((c) => c.type === 'income').length})</span>
        </button>
      </div>

      {isLoading ? (
        <div id="categories-loading" className="py-16 flex flex-col items-center justify-center text-[#68736C]">
          <Loader2 className="h-6 w-6 animate-spin text-[#176B45] mb-2" />
          <span className="text-xs">Kategoriyalar yuklanmoqda...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Custom Categories Section */}
          <div className="rounded-2xl border border-[#DCE4DE] bg-white p-5 space-y-4 shadow-fintech-card">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DE]">
              <div>
                <h2 className="text-sm font-bold text-[#17211B] flex items-center gap-2">
                  <span>Mening maxsus kategoriyalarim</span>
                  <span className="text-xs font-normal text-[#68736C]">
                    ({customCategories.length})
                  </span>
                </h2>
                <p className="text-xs text-[#68736C] mt-0.5">
                  O‘zingiz yaratgan shaxsiy chiqim va kirim toifalari
                </p>
              </div>
            </div>

            {customCategories.length === 0 ? (
              <div
                id="custom-categories-empty"
                className="rounded-xl border border-dashed border-[#DCE4DE] bg-[#F7F9F7] p-8 text-center"
              >
                <Tag className="h-6 w-6 text-[#68736C] mx-auto mb-2" />
                <p className="text-xs font-semibold text-[#17211B]">Hozircha maxsus kategoriyalar yo‘q</p>
                <p className="text-[11px] text-[#68736C] mt-0.5 max-w-sm mx-auto">
                  Daromad va xarajatlaringizni o‘z ehtiyojingizga moslashtirish uchun maxsus kategoriyalar yarating.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryToEdit(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#176B45] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Kategoriya yaratish</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="custom-categories-list">
                {customCategories.map((cat) => (
                  <div
                    key={cat.id}
                    id={`category-item-${cat.id}`}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-[#DCE4DE] bg-white hover:border-[#176B45]/40 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: cat.color ? `${cat.color}15` : '#176B4515',
                          borderColor: cat.color ? `${cat.color}30` : '#176B4530',
                          color: cat.color || '#176B45',
                        }}
                      >
                        <Tag className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#17211B] truncate">{cat.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              cat.type === 'expense'
                                ? 'bg-red-50 text-[#C74747]'
                                : 'bg-[#DDF3E5] text-[#176B45]'
                            }`}
                          >
                            {cat.type === 'expense' ? 'Chiqim' : 'Kirim'}
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-[11px] text-[#68736C] truncate mt-0.5">{cat.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        id={`edit-category-btn-${cat.id}`}
                        onClick={() => {
                          setCategoryToEdit(cat);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-[#68736C] hover:text-[#176B45] hover:bg-[#F7F9F7] transition-colors"
                        title="Tahrirlash"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        id={`delete-category-btn-${cat.id}`}
                        onClick={() => setCategoryToDelete(cat)}
                        className="p-1.5 rounded-lg text-[#68736C] hover:text-[#C74747] hover:bg-red-50 transition-colors"
                        title="O‘chirish"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* System Categories Section */}
          <div className="rounded-2xl border border-[#DCE4DE] bg-white p-5 space-y-4 shadow-fintech-card">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE4DE]">
              <div>
                <h2 className="text-sm font-bold text-[#17211B] flex items-center gap-2">
                  <span>Tizim kategoriyalari</span>
                  <span className="text-xs font-normal text-[#68736C]">
                    ({systemCategories.length})
                  </span>
                </h2>
                <p className="text-xs text-[#68736C] mt-0.5">
                  Standart o‘rnatilgan chiqim va kirim toifalari
                </p>
              </div>
              <span className="text-[11px] text-[#68736C] flex items-center gap-1 bg-[#F7F9F7] px-2 py-1 rounded-lg border border-[#DCE4DE]">
                <Lock className="h-3 w-3" />
                Standart
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5" id="system-categories-list">
              {systemCategories.map((cat) => (
                <div
                  key={cat.id}
                  id={`system-category-${cat.id}`}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-[#DCE4DE] bg-[#F7F9F7]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 border text-[11px]"
                      style={{
                        backgroundColor: cat.color ? `${cat.color}15` : '#176B4515',
                        borderColor: cat.color ? `${cat.color}20` : '#176B4520',
                        color: cat.color || '#176B45',
                      }}
                    >
                      <Tag className="h-3 w-3" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-[#17211B] truncate block">{cat.name}</span>
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                      cat.type === 'expense'
                        ? 'bg-red-50 text-[#C74747]'
                        : 'bg-[#DDF3E5] text-[#176B45]'
                    }`}
                  >
                    {cat.type === 'expense' ? 'Chiqim' : 'Kirim'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category Create/Edit Modal */}
      <CategoryModal
        key={categoryToEdit?.id ?? 'create-category-modal'}
        isOpen={isModalOpen}
        isSaving={isSaving}
        categoryToEdit={categoryToEdit}
        onClose={() => {
          setIsModalOpen(false);
          setCategoryToEdit(null);
        }}
        onSave={handleSaveCategory}
      />

      {/* Delete Confirmation Modal */}
      <DeleteCategoryModal
        isOpen={Boolean(categoryToDelete)}
        isDeleting={isDeleting}
        categoryName={categoryToDelete?.name || ''}
        onConfirm={handleDeleteCategory}
        onCancel={() => setCategoryToDelete(null)}
      />
    </div>
  );
}
