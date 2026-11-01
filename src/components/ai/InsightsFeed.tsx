'use client';

import { useState, useEffect } from 'react';
import {
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import type { InsightStatus } from '@/types/database';
import { PageHeader, BentoGrid, BentoCard, BentoEmptyState } from '@/components/bento';

interface InsightItem {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  status: InsightStatus;
  created_at: string;
}

export default function InsightsFeed() {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | InsightStatus>('all');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadInsights() {
      try {
        const url = statusFilter === 'all' ? '/api/ai/insights' : `/api/ai/insights?status=${statusFilter}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!isCancelled) {
          if (!res.ok) {
            setError(data.error || 'Xulosalarni yuklab bo‘lmadi');
          } else {
            setInsights(data.insights || []);
            setError(null);
          }
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Xulosalarni yuklashda xatolik yuz berdi');
          setLoading(false);
        }
      }
    }

    loadInsights();

    return () => {
      isCancelled = true;
    };
  }, [statusFilter, reloadTrigger]);

  const refreshInsights = () => {
    setLoading(true);
    setReloadTrigger((prev) => prev + 1);
  };

  const handleGenerateFresh = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/insights', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Xulosalarni yaratishda xatolik yuz berdi');
      }
      refreshInsights();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xulosalarni yaratishda xatolik yuz berdi');
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: string, newStatus: InsightStatus) => {
    try {
      const res = await fetch(`/api/ai/insights/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setInsights((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-[#176B45]" />
            <span>Moliyaviy xulosalar</span>
          </div>
        }
        subtitle="AI algoritmlari tomonidan aniqlangan xarajatlar tebranishi, anomaliyalar va optimallashtirish imkoniyatlari."
        breadcrumbs={[
          { label: 'Bosh sahifa', href: '/dashboard' },
          { label: 'Xulosalar' },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-xl bg-white border border-[#D5DED7] p-1 shadow-xs text-xs sm:text-sm">
              {(['all', 'new', 'resolved'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`min-h-[32px] px-3 py-1 rounded-lg transition-all text-xs sm:text-sm ${
                    statusFilter === s
                      ? 'bg-[#176B45] text-white font-semibold'
                      : 'text-[#47544C] hover:text-[#17211B]'
                  }`}
                >
                  {s === 'all' ? 'Barchasi' : s === 'new' ? 'Yangi' : 'Hal qilingan'}
                </button>
              ))}
            </div>

            <button
              id="refresh-insights-btn"
              type="button"
              onClick={refreshInsights}
              disabled={loading || generating}
              className="min-h-[38px] min-w-[38px] p-2 rounded-xl bg-white border border-[#D5DED7] text-[#47544C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-all shadow-xs disabled:opacity-50 flex items-center justify-center"
              title="Yangilash"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-[#176B45]' : ''}`} />
            </button>

            <button
              id="generate-insights-btn"
              type="button"
              onClick={handleGenerateFresh}
              disabled={generating}
              className="inline-flex items-center gap-2 min-h-[38px] px-4 py-2 rounded-xl bg-[#176B45] text-white font-semibold text-xs sm:text-sm hover:bg-[#125536] transition-colors shadow-xs disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Tahlil qilinmoqda...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  <span>Yangi tahlil</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-[#C74747] text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-[#C74747]" />
          <div>
            <p className="font-semibold text-base text-[#17211B]">Xulosalarni yuklab bo‘lmadi</p>
            <p className="text-[#C74747] text-sm mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-12 text-center text-[#5A675F] flex flex-col items-center justify-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-[#176B45]" />
          <p className="text-base font-medium">Algoritmik va AI moliyaviy xulosalari yuklanmoqda...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && insights.length === 0 && (
        <BentoEmptyState
          icon={<CheckCircle2 className="h-6 w-6 text-[#176B45]" />}
          title="Barchasi joyida!"
          description="Hech qanday kutilayotgan moliyaviy xavf yoki anomaliya topilmadi. Xarajatlaringiz me’yorda."
          action={
            <button
              type="button"
              onClick={handleGenerateFresh}
              disabled={generating}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-[#17211B] font-semibold text-sm hover:bg-[#F7F9F7] border border-[#D5DED7] transition-colors shadow-xs"
            >
              <Sparkles className="h-4 w-4 text-[#8664D8]" />
              <span>Qaytadan tahlil qilish</span>
            </button>
          }
        />
      )}

      {/* Insights Bento Cards Grid */}
      {!loading && insights.length > 0 && (
        <BentoGrid cols={12}>
          {insights.map((item) => {
            const isSpike = item.type.includes('spike') || item.type.includes('anomaly');
            const isSub = item.type.includes('recurring') || item.type.includes('subscription');
            const isBudget = item.type.includes('budget');

            const Icon = isSpike ? Zap : isSub ? RefreshCw : isBudget ? AlertTriangle : Sparkles;

            const severityBadge =
              item.severity === 'critical'
                ? 'bg-rose-50 text-[#C74747] border-rose-200'
                : item.severity === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-[#F0EBFF] text-[#8664D8] border-[#8664D8]/20';

            return (
              <BentoCard
                key={item.id}
                span={{ default: 12, lg: 6 }}
                variant={item.severity === 'critical' ? 'danger' : item.severity === 'warning' ? 'amber' : 'default'}
                className="space-y-4 flex flex-col justify-between"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${severityBadge}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base text-[#17211B]">{item.title}</h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider border ${severityBadge}`}
                        >
                          {item.severity === 'critical' ? 'Jiddiy' : item.severity === 'warning' ? 'Ogohlantirish' : 'Ma’lumot'}
                        </span>
                        <span className="text-xs text-[#5A675F] flex items-center gap-1 font-mono tabular-nums">
                          <Calendar className="h-3.5 w-3.5 text-[#5A675F]" />
                          {new Date(item.created_at).toLocaleDateString('uz-UZ')}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm sm:text-base text-[#47544C] leading-relaxed max-w-2xl">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 sm:self-center">
                    {item.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => updateStatus(item.id, 'resolved')}
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F9FAFB] hover:bg-[#F1F4F2] text-xs sm:text-sm font-semibold text-[#176B45] border border-[#D5DED7] transition-colors"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Hal qilindi</span>
                      </button>
                    )}
                    {item.status !== 'dismissed' && (
                      <button
                        type="button"
                        onClick={() => updateStatus(item.id, 'dismissed')}
                        className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-[#5A675F] hover:text-[#17211B] hover:bg-[#F1F4F2] transition-colors flex items-center justify-center"
                        title="Yashirish"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Grounding Evidence / Context if present */}
                {item.evidence && Object.keys(item.evidence).length > 0 && (
                  <div className="pt-3 border-t border-[#D5DED7] flex flex-wrap gap-4 text-xs sm:text-sm text-[#5A675F]">
                    {item.evidence.category_name != null && (
                      <span>
                        Kategoriya: <strong className="text-[#17211B] font-semibold">{String(item.evidence.category_name)}</strong>
                      </span>
                    )}
                    {item.evidence.spike_factor != null && (
                      <span>
                        Karra: <strong className="text-[#C74747] font-mono font-semibold tabular-nums">{String(item.evidence.spike_factor)}x barobar ko‘p</strong>
                      </span>
                    )}
                    {item.evidence.merchant != null && (
                      <span>
                        Savdo nuqtasi: <strong className="text-[#17211B] font-semibold">{String(item.evidence.merchant)}</strong>
                      </span>
                    )}
                    {item.evidence.amount != null && (
                      <span>
                        Summa: <strong className="text-[#17211B] font-mono font-semibold tabular-nums">{Number(item.evidence.amount).toLocaleString('uz-UZ')} soʻm</strong>
                      </span>
                    )}
                  </div>
                )}
              </BentoCard>
            );
          })}
        </BentoGrid>
      )}
    </div>
  );
}
