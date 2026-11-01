import React from 'react';
import { Skeleton, TransactionRowSkeleton } from '@/components/ui/Skeleton';
import PageContainer from '@/components/bento/PageContainer';

export default function TransactionsLoading() {
  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-24 md:pb-14">
      {/* Header Placeholder */}
      <div className="h-16 w-full bg-white border-b border-[#DCE4DE]" />

      <PageContainer>
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-4 w-24" />
          <span className="text-[#D5DED7]">•</span>
          <Skeleton className="h-4 w-16" />
        </div>

        <div className="space-y-6">
          {/* Header & Action Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-36 rounded-xl" />
            </div>
          </div>

          {/* Filters Bar Skeleton */}
          <div className="skeleton-card p-4 space-y-3.5">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Search input skeleton */}
              <Skeleton className="h-10 w-full md:w-80 rounded-xl" />

              {/* Type toggle buttons */}
              <div className="inline-flex items-center gap-1 p-1 bg-[#F7F9F7] rounded-xl border border-[#D5DED7]">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>

              {/* Category dropdown skeleton */}
              <Skeleton className="h-10 w-44 rounded-xl" />
            </div>
          </div>

          {/* Transactions Table Skeleton */}
          <div className="skeleton-card overflow-hidden">
            {/* Table Header */}
            <div className="bg-[#F7F9F7] border-b border-[#D5DED7] px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-3.5 w-20" />
            </div>

            {/* Date Group 1 */}
            <div className="bg-[#F7F9F7]/70 px-5 py-2 border-b border-[#D5DED7]">
              <Skeleton className="h-3.5 w-36" />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <TransactionRowSkeleton key={i} />
            ))}

            {/* Date Group 2 */}
            <div className="bg-[#F7F9F7]/70 px-5 py-2 border-b border-[#D5DED7]">
              <Skeleton className="h-3.5 w-32" />
            </div>
            {[5, 6, 7].map((i) => (
              <TransactionRowSkeleton key={i} />
            ))}

            {/* Pagination Footer Skeleton */}
            <div className="bg-[#F7F9F7] px-5 py-3.5 border-t border-[#D5DED7] flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
