'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import FastTransactionModal from '@/components/transactions/FastTransactionModal';

export default function DashboardHeaderAction() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        id="dashboard-add-transaction-btn"
        onClick={() => setIsOpen(true)}
        className="sm:hidden inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white text-xs font-semibold transition-all shadow-xs active:scale-98"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Tranzaksiya</span>
        <span className="sr-only">+ Tranzaksiya</span>
      </button>

      <FastTransactionModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
