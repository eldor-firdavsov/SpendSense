import React from 'react';
import { Skeleton, MessageBubbleSkeleton } from '@/components/ui/Skeleton';

export default function AdvisorLoading() {
  return (
    <div className="h-dvh max-h-dvh bg-[#F1F4F2] text-[#17211B] flex flex-col overflow-hidden">
      {/* Top Header Placeholder */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#E5E7EB]/80 h-16 w-full" />

      <main className="w-full max-w-[1760px] mx-auto px-2.5 sm:px-6 lg:px-8 xl:px-10 py-2 sm:py-4 flex-1 flex flex-col min-h-0 pb-20 md:pb-4 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white border border-[#D5DED7] rounded-2xl sm:rounded-3xl shadow-fintech-card overflow-hidden">
          {/* Advisor Chat Header */}
          <div className="px-5 py-3.5 border-b border-[#D5DED7] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton variant="circle" className="h-8 w-8 shrink-0 rounded-xl" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-xl" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
          </div>

          {/* Quick Prompts Skeleton (3 Columns) */}
          <div className="p-3 sm:p-6 border-b border-[#D5DED7] bg-[#F7F9F7]/50">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-3xl mx-auto">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl sm:rounded-3xl p-2.5 sm:p-5 border border-[#D5DED7] space-y-2">
                  <Skeleton className="h-8 w-8 rounded-lg sm:rounded-xl" />
                  <Skeleton className="h-3.5 w-full rounded" />
                  <Skeleton className="h-2.5 w-3/4 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Messages Area Skeleton */}
          <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto">
            <MessageBubbleSkeleton isUser={false} />
            <MessageBubbleSkeleton isUser={true} />
            <MessageBubbleSkeleton isUser={false} />
          </div>

          {/* Bottom Chat Composer Skeleton */}
          <div className="p-3 sm:p-4 border-t border-[#D5DED7] bg-white flex items-center gap-2 sm:gap-3">
            <Skeleton className="h-11 sm:h-12 flex-1 rounded-full sm:rounded-2xl" />
            <Skeleton className="h-11 w-11 sm:h-12 sm:w-12 rounded-full sm:rounded-2xl shrink-0" />
          </div>
        </div>
      </main>
    </div>
  );
}
