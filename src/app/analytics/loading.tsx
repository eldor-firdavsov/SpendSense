import React from 'react';
import { Skeleton, MetricCardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton';
import PageContainer from '@/components/bento/PageContainer';

export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-24 md:pb-14">
      {/* Header Placeholder */}
      <div className="h-16 w-full bg-white border-b border-[#DCE4DE]" />

      <PageContainer>
        <div className="space-y-6">
          {/* TahlilHub Segmented Control Bar Skeleton */}
          <div className="skeleton-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-60" />
              <Skeleton className="h-4 w-80" />
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-[#F7F9F7] rounded-xl border border-[#D5DED7]">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-36 rounded-lg" />
            </div>
          </div>

          {/* Date presets & filters */}
          <div className="skeleton-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>

          {/* 3 Bento Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>

          {/* Dynamic Cashflow Chart & Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8">
              <ChartSkeleton height="h-60" />
            </div>

            <div className="lg:col-span-4 skeleton-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D5DED7]">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="space-y-3.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
