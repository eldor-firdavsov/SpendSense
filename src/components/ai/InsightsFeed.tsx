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
            setError(data.error || 'Failed to fetch insights');
          } else {
            setInsights(data.insights || []);
            setError(null);
          }
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Error loading insights');
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
        throw new Error(data.error || 'Failed to generate insights');
      }
      refreshInsights();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
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
        srOnlyFallback="Financial Insights AI Insights"
        breadcrumbs={[
          { label: 'Bosh sahifa', href: '/dashboard' },
          { label: 'Xulosalar' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-white border border-[#DCE4DE] p-0.5 shadow-fintech-card text-xs">
              {(['all', 'new', 'resolved'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg transition-all text-xs ${
                    statusFilter === s
                      ? 'bg-[#176B45] text-white font-semibold'
                      : 'text-[#68736C] hover:text-[#17211B]'
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
              className="p-2 rounded-xl bg-white border border-[#DCE4DE] text-[#68736C] hover:text-[#17211B] hover:bg-[#F7F9F7] transition-all shadow-fintech-card disabled:opacity-50"
              title="Yangilash"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-[#176B45]' : ''}`} />
            </button>

            <button
              id="generate-insights-btn"
              type="button"
              onClick={handleGenerateFresh}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#176B45] text-white font-semibold text-xs hover:bg-[#125536] transition-colors shadow-fintech-card disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Tahlil qilinmoqda...</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  <span>Yangi tahlil</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-[#DC2626] text-xs flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Xulosalarni yuklab bo‘lmadi</p>
            <p className="text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-12 text-center text-[#6B7280] flex flex-col items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-[#176B45]" />
          <p className="text-xs">Algoritmik va AI moliyaviy xulosalari yuklanmoqda...</p>
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#17211B] font-semibold text-xs hover:bg-[#F7F9F7] border border-[#DCE4DE] transition-colors shadow-fintech-card"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#8664D8]" />
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
                className="space-y-3.5 flex flex-col justify-between"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${severityBadge}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm text-[#222222]">{item.title}</h3>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${severityBadge}`}
                        >
                          {item.severity === 'critical' ? 'Jiddiy' : item.severity === 'warning' ? 'Ogohlantirish' : 'Ma’lumot'}
                        </span>
                        <span className="text-[11px] text-[#6B7280] flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3 text-[#9CA3AF]" />
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#6B7280] leading-relaxed max-w-2xl">
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
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F9FAFB] hover:bg-gray-100 text-xs font-medium text-[#176B45] border border-[#E8EAE8] transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Hal qilindi</span>
                      </button>
                    )}
                    {item.status !== 'dismissed' && (
                      <button
                        type="button"
                        onClick={() => updateStatus(item.id, 'dismissed')}
                        className="p-1 rounded-lg text-[#6B7280] hover:text-[#222222] hover:bg-[#F9FAFB] transition-colors"
                        title="Yashirish"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Grounding Evidence / Context if present */}
                {item.evidence && Object.keys(item.evidence).length > 0 && (
                  <div className="pt-2.5 border-t border-[#E8EAE8] flex flex-wrap gap-4 text-[11px] text-[#6B7280]">
                    {item.evidence.category_name != null && (
                      <span>
                        Kategoriya: <strong className="text-[#222222]">{String(item.evidence.category_name)}</strong>
                      </span>
                    )}
                    {item.evidence.spike_factor != null && (
                      <span>
                        Karra: <strong className="text-[#DC2626] font-mono">{String(item.evidence.spike_factor)}x barobar ko‘p</strong>
                      </span>
                    )}
                    {item.evidence.merchant != null && (
                      <span>
                        Savdo nuqtasi: <strong className="text-[#222222]">{String(item.evidence.merchant)}</strong>
                      </span>
                    )}
                    {item.evidence.amount != null && (
                      <span>
                        Summa: <strong className="text-[#222222] font-mono">{Number(item.evidence.amount).toLocaleString('uz-UZ')} soʻm</strong>
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
