'use client';

import React from 'react';
import SpendSenseLogo from '@/components/brand/SpendSenseLogo';

interface OnboardingProgressProps {
  currentStep: number; // 0 to 6
  totalSteps?: number; // 6
  onLogoClick?: () => void;
}

export default function OnboardingProgress({
  currentStep,
  totalSteps = 6,
}: OnboardingProgressProps) {
  const percentage = currentStep === 0 ? 0 : Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full space-y-4">
      {/* Brand Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <SpendSenseLogo variant="icon" size="md" />
          <div className="flex flex-col">
            <span className="text-base font-semibold tracking-tight text-[#17211B]">
              SpendSense
            </span>
            <span className="text-xs text-[#5A675F] font-medium">
              Moliyaviy rejalashtirish
            </span>
          </div>
        </div>

        {currentStep > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#176B45] bg-[#DDF3E5] px-3 py-1 rounded-full border border-[#176B45]/15">
              Qadam {currentStep} / {totalSteps}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar (Visible from Step 1 onwards) */}
      {currentStep > 0 && (
        <div className="w-full space-y-1.5">
          <div className="h-2 w-full bg-[#E5EBE6] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#176B45] to-[#218653] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
