'use client';

import React from 'react';

interface CurrencyInputProps {
  id?: string;
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function formatWithSpaces(num: number): string {
  if (num === 0) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function CurrencyInput({
  id = 'currency-input',
  value,
  onChange,
  placeholder = '0',
  className = '',
  disabled = false,
  autoFocus = false,
}: CurrencyInputProps) {
  const displayString = value > 0 ? formatWithSpaces(value) : value === 0 ? '' : '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (!raw) {
      onChange(0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      // Limit to max 1 trillion UZS to prevent overflow
      const clamped = Math.min(parsed, 1000000000000);
      onChange(clamped);
    }
  };

  return (
    <div className="relative w-full">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={displayString}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`w-full rounded-2xl border-2 border-[#D5DED7] bg-white px-5 py-3.5 text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-[#17211B] placeholder-[#8C9890] focus:border-[#176B45] focus:outline-none focus:ring-4 focus:ring-[#176B45]/15 transition-all pr-20 min-h-[56px] ${className}`}
      />
      <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center">
        <span className="text-sm sm:text-base font-semibold text-[#47544C]">so‘m</span>
      </div>
    </div>
  );
}
