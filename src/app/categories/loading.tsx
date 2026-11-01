import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import PageContainer from '@/components/bento/PageContainer';

export default function CategoriesLoading() {
  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-24 md:pb-14">
      <div className="h-16 w-full bg-white border-b border-[#DCE4DE]" />

      <PageContainer>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-44 rounded-xl" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circle" className="h-9 w-9" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
