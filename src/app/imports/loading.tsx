import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import PageContainer from '@/components/bento/PageContainer';

export default function ImportsLoading() {
  return (
    <div className="min-h-screen bg-[#F1F4F2] text-[#17211B] pb-24 md:pb-14">
      <div className="h-16 w-full bg-white border-b border-[#DCE4DE]" />

      <PageContainer>
        <div className="space-y-6">
          <div className="space-y-1.5 pb-4 border-b border-[#D5DED7]">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>

          <div className="skeleton-card p-8 text-center space-y-4">
            <Skeleton variant="circle" className="h-12 w-12 mx-auto" />
            <Skeleton className="h-5 w-64 mx-auto" />
            <Skeleton className="h-4 w-96 mx-auto" />
            <Skeleton className="h-10 w-44 mx-auto rounded-xl" />
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
