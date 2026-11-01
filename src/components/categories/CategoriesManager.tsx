'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Tag,
  Edit2,
  Trash2,
  Loader2,
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
import { getCategoryDisplayName } from '@/lib/categories/schemas';

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
        title={
          <span>
            Kategoriyalar
            <span className="sr-only">Category Management</span>
          </span>
        }
        subtitle="Shaxsiy moliyangizni tizimli va qulay kategoriyalar yordamida tartibga soling"
        onRefresh={refreshCategories}
        isRefreshing={isLoading}
        refreshId="refresh-categories-btn"
        actions={
          <button
            type="button"
            id="add-category-btn"
            onClick={() => {
              setCategoryToEdit(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 min-h-[40px] rounded-xl bg-[#176B45] px-4 py-2 text-sm font-semibold text-white hover:bg-[#125536] transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Maxsus kategoriya qo‘shish</span>
            <span className="sr-only">Add Custom Category</span>
          </button>
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
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-[#D5DED7] self-start text-xs sm:text-sm shadow-xs flex-wrap">
        <button
          type="button"
          id="category-filter-all"
          onClick={() => setTypeFilter('all')}
          className={`min-h-[36px] px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            typeFilter === 'all'
              ? 'bg-[#176B45] text-white shadow-xs font-semibold'
              : 'text-[#47544C] hover:text-[#17211B] hover:bg-black/5'
          }`}
        >
          Barchasi ({categories.length})
        </button>
        <button
          type="button"
          id="category-filter-expense"
          onClick={() => setTypeFilter('expense')}
          className={`inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            typeFilter === 'expense'
              ? 'bg-[#C74747] text-white shadow-xs font-semibold'
              : 'text-[#47544C] hover:text-[#C74747] hover:bg-black/5'
          }`}
        >
          <TrendingDown className="h-4 w-4" />
          <span>Chiqim ({categories.filter((c) => c.type === 'expense').length})</span>
        </button>
        <button
          type="button"
          id="category-filter-income"
          onClick={() => setTypeFilter('income')}
          className={`inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-lg font-medium transition-all ${
            typeFilter === 'income'
              ? 'bg-[#176B45] text-white shadow-xs font-semibold'
              : 'text-[#47544C] hover:text-[#176B45] hover:bg-black/5'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Kirim ({categories.filter((c) => c.type === 'income').length})</span>
        </button>
      </div>

      {isLoading ? (
        <div id="categories-loading" className="py-16 flex flex-col items-center justify-center text-[#5A675F]">
          <Loader2 className="h-6 w-6 animate-spin text-[#176B45] mb-2" />
          <span className="text-sm font-medium">Kategoriyalar yuklanmoqda...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Custom Categories Section */}
          <div className="rounded-2xl border border-[#D5DED7] bg-white p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#D5DED7]">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[#17211B] flex items-center gap-2">
                  <span>Mening maxsus kategoriyalarim</span>
                  <span className="text-xs sm:text-sm font-normal text-[#5A675F]">
                    ({customCategories.length})
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-[#47544C] mt-0.5">
                  O‘zingiz yaratgan shaxsiy chiqim va kirim toifalari
                </p>
              </div>
            </div>

            {customCategories.length === 0 ? (
              <div
                id="custom-categories-empty"
                className="rounded-xl border border-dashed border-[#D5DED7] bg-[#F7F9F7] p-8 text-center"
              >
                <Tag className="h-8 w-8 text-[#5A675F] mx-auto mb-2.5 opacity-60" />
                <p className="text-base font-semibold text-[#17211B]">Hozircha maxsus kategoriyalar yo‘q</p>
                <p className="text-sm sm:text-base text-[#47544C] mt-1 max-w-sm mx-auto leading-relaxed">
                  Daromad va xarajatlaringizni o‘z ehtiyojingizga moslashtirish uchun maxsus kategoriyalar yarating.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryToEdit(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-3.5 inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#176B45] text-white text-xs sm:text-sm font-semibold hover:bg-[#125536] transition-colors shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Kategoriya yaratish</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5" id="custom-categories-list">
                {customCategories.map((cat) => (
                  <div
                    key={cat.id}
                    id={`category-item-${cat.id}`}
                    className="flex items-center justify-between p-4 rounded-xl border border-[#D5DED7] bg-white hover:border-[#176B45]/40 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: cat.color ? `${cat.color}15` : '#176B4515',
                          borderColor: cat.color ? `${cat.color}30` : '#176B4530',
                          color: cat.color || '#176B45',
                        }}
                      >
                        <Tag className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm sm:text-base font-semibold text-[#17211B] truncate">{cat.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                              cat.type === 'expense'
                                ? 'bg-red-50 text-[#C74747]'
                                : 'bg-[#DDF3E5] text-[#176B45]'
                            }`}
                          >
                            {cat.type === 'expense' ? 'Chiqim' : 'Kirim'}
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-sm text-[#47544C] truncate mt-0.5">{cat.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        id={`edit-category-btn-${cat.id}`}
                        onClick={() => {
                          setCategoryToEdit(cat);
                          setIsModalOpen(true);
                        }}
                        className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-[#47544C] hover:text-[#176B45] hover:bg-[#F7F9F7] transition-colors flex items-center justify-center"
                        title="Tahrirlash"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        id={`delete-category-btn-${cat.id}`}
                        onClick={() => setCategoryToDelete(cat)}
                        className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-[#47544C] hover:text-[#C74747] hover:bg-red-50 transition-colors flex items-center justify-center"
                        title="O‘chirish"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* System Categories Section */}
          <div className="rounded-2xl border border-[#D5DED7] bg-white p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#D5DED7]">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[#17211B] flex items-center gap-2">
                  <span>Tizim kategoriyalari</span>
                  <span className="text-xs sm:text-sm font-normal text-[#5A675F]">
                    ({systemCategories.length})
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-[#47544C] mt-0.5">
                  Standart o‘rnatilgan chiqim va kirim toifalari
                </p>
              </div>
              <span className="text-xs text-[#5A675F] flex items-center gap-1.5 bg-[#F7F9F7] px-2.5 py-1 rounded-lg border border-[#D5DED7] font-medium">
                <Lock className="h-3.5 w-3.5" />
                Standart
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" id="system-categories-list">
              {systemCategories.map((cat) => (
                <div
                  key={cat.id}
                  id={`system-category-${cat.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#D5DED7] bg-[#F7F9F7]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border text-xs"
                      style={{
                        backgroundColor: cat.color ? `${cat.color}15` : '#176B4515',
                        borderColor: cat.color ? `${cat.color}20` : '#176B4520',
                        color: cat.color || '#176B45',
                      }}
                    >
                      <Tag className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-medium text-[#17211B] truncate block">{getCategoryDisplayName(cat.name)}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
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
