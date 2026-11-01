import React from 'react';
import { Skeleton, MetricCardSkeleton, GoalCardSkeleton } from '@/components/ui/Skeleton';
import PageContainer from '@/components/bento/PageContainer';

export default function GoalsLoading() {
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

          {/* Sub Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center gap-1 p-1 bg-[#F7F9F7] rounded-xl border border-[#D5DED7]">
                <Skeleton className="h-7 w-16 rounded-lg" />
                <Skeleton className="h-7 w-16 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-10 w-36 rounded-xl" />
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>

          {/* Goals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <GoalCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
