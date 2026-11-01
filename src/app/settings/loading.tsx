import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import PageContainer from '@/components/bento/PageContainer';

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-24 md:pb-14">
      {/* Header Placeholder */}
      <div className="h-16 w-full bg-white border-b border-[#DCE4DE]" />

      <PageContainer>
        <div className="space-y-6">
          <div className="space-y-1.5 pb-4 border-b border-[#D5DED7]">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="skeleton-card p-6 space-y-4">
              <Skeleton className="h-5 w-36" />
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>

            <div className="skeleton-card p-6 space-y-4">
              <Skeleton className="h-5 w-40" />
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-32 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
