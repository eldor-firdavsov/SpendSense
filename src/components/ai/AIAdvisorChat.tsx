'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  User,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sliders,
  RefreshCw,
  History,
  Plus,
  X,
  ArrowUpRight,
  Plane,
  Settings2,
  Link2,
} from 'lucide-react';
import { MessageBubbleSkeleton } from '@/components/ui/Skeleton';
import { cachedFetch, peekCache } from '@/lib/cache/clientCache';

let messageCounter = 0;
function generateId(prefix: string) {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  isError?: boolean;
  retryPrompt?: string;
  evidence?: {
    model_used?: string;
    is_fallback?: boolean;
    grounded_context?: string;
    pending_action?: {
      action_id: string;
      type: string;
      status: 'pending' | 'executed' | 'cancelled';
      params: {
        amount?: number;
        currency?: string;
        date?: string;
        category_name?: string;
        description?: string;
        transaction_id?: string;
      };
    } | null;
    action_result?: {
      success: boolean;
      message?: string;
    } | null;
  };
}

interface ConversationItem {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Custom wave hand icon matching the SayHalo / minimalist reference design
 */
function WavingHandIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 9C4.2 11 4.2 13.5 5.2 15.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M2.5 7C1.2 10 1.2 14.5 3 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M19.5 13.5V8.5C19.5 7.67 18.83 7 18 7C17.17 7 16.5 7.67 16.5 8.5V13M16.5 11.5V6.5C16.5 5.67 15.83 5 15 5C14.17 5 13.5 5.67 13.5 6.5V13M13.5 11.5V7.5C13.5 6.67 12.83 6 12 6C11.17 6 10.5 6.67 10.5 7.5V14.5M10.5 13.5V9.5C10.5 8.67 9.83 8 9 8C8.17 8 7.5 8.67 7.5 9.5V16C7.5 20.42 11.08 24 15.5 24C19.92 24 23.5 20.42 23.5 16V13C23.5 12.17 22.83 11.5 22 11.5C21.17 11.5 20.5 12.17 20.5 13V14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 3 Quick Prompt Cards inspired directly by the reference image
 */
const QUICK_PROMPT_CARDS = [
  {
    title: 'Bu oylik xarajatlar tahlili',
    subtitle: 'Joriy oy sarflari',
    query: 'Bu oy qancha pul sarfladim?',
    icon: 'plane' as const,
  },
  {
    title: 'Eng ko‘p sarflangan kategoriya',
    subtitle: 'Asosiy xarajat yo‘nalishlari',
    query: 'Eng ko‘p pul qaysi kategoriyaga ketdi?',
    icon: 'wave' as const,
  },
  {
    title: 'Xarajatlarni qisqartirish rejasi',
    subtitle: 'Tejash tavsiyalari',
    query: 'Xarajatlarimni qanday kamaytiraman?',
    icon: 'sliders' as const,
  },
];

/**
 * Lightweight, safe Markdown renderer for structured AI financial responses
 */
function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="space-y-1.5 my-2 pl-0.5">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  const formatInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-[#17211B]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={idx} className="text-sm font-semibold text-[#17211B] mt-3 mb-1.5 tracking-tight">
          {formatInline(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={idx} className="text-base sm:text-lg font-semibold text-[#17211B] mt-4 mb-2 tracking-tight">
          {formatInline(trimmed.replace(/^##\s+/, ''))}
        </h3>
      );
      return;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*•]\s+/, '');
      currentList.push(
        <li key={idx} className="flex items-start gap-2.5 text-sm sm:text-base leading-relaxed">
          <span className="h-2 w-2 rounded-full bg-[#176B45] shrink-0 mt-2" />
          <span className="text-[#17211B]">{formatInline(itemText)}</span>
        </li>
      );
      return;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      currentList.push(
        <li key={idx} className="flex items-start gap-2.5 text-sm sm:text-base leading-relaxed">
          <span className="font-mono font-semibold text-xs text-[#176B45] shrink-0 min-w-[20px] mt-0.5">
            {numMatch[1]}.
          </span>
          <span className="text-[#17211B]">{formatInline(numMatch[2])}</span>
        </li>
      );
      return;
    }

    flushList();
    elements.push(
      <p key={idx} className="text-sm sm:text-base text-[#17211B] leading-relaxed">
        {formatInline(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-2">{elements}</div>;
}

interface AIAdvisorChatProps {
  userName?: string;
}

export default function AIAdvisorChat({ userName = 'Asal Design' }: AIAdvisorChatProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  // Tool Drawers / Popovers
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);

  // Scenario simulation state
  const [simCategory, setSimCategory] = useState('Oziq-ovqat');
  const [simPercent, setSimPercent] = useState(15);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<{
    categoryName?: string;
    currentMonthlySpend?: number;
    currentMonthlySpending?: number;
    projectedMonthlySavings?: number;
    monthlySavings?: number;
    projectedAnnualSavings?: number;
    annualizedSavings?: number;
    explanation: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isSubmittingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    shouldAutoScrollRef.current = isNearBottom;
  };

  const scrollToBottom = (force = false) => {
    if (force || shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    let isCancelled = false;

    async function loadConversations() {
      try {
        const cached = peekCache<{ conversations: ConversationItem[] }>('/api/ai/conversations');
        if (cached?.conversations && !isCancelled) {
          setConversations(cached.conversations);
        }

        const data = await cachedFetch<{ conversations: ConversationItem[] }>(
          '/api/ai/conversations',
          undefined,
          60000
        );
        if (!isCancelled && data.conversations) {
          setConversations(data.conversations);
        }
      } catch {
        // ignore
      }
    }

    loadConversations();

    return () => {
      isCancelled = true;
    };
  }, []);

  const refreshConversations = async () => {
    try {
      const data = await cachedFetch<{ conversations: ConversationItem[] }>(
        '/api/ai/conversations',
        undefined,
        60000
      );
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch {
      // ignore
    }
  };

  interface RawMessageItem {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at?: string;
    evidence_references?: Message['evidence'];
    metadata?: {
      evidence?: Message['evidence'];
    };
  }

  const loadConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setHistoryOpen(false);
    setToolsMenuOpen(false);
    const targetUrl = `/api/ai/conversations/${convId}`;
    const cached = peekCache<{ messages?: RawMessageItem[]; conversation?: { ai_messages?: RawMessageItem[] } }>(targetUrl);
    if (cached) {
      const rawMessages = cached.messages || cached.conversation?.ai_messages || [];
      if (Array.isArray(rawMessages)) {
        setMessages(
          rawMessages.map((m: RawMessageItem) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
            evidence: m.evidence_references || m.metadata?.evidence,
          }))
        );
      }
      setLoadingHistory(false);
    } else {
      setLoadingHistory(true);
    }

    try {
      const data = await cachedFetch<{ messages?: RawMessageItem[]; conversation?: { ai_messages?: RawMessageItem[] } }>(targetUrl, undefined, 60000);
      const rawMessages = data.messages || data.conversation?.ai_messages || [];
      if (Array.isArray(rawMessages)) {
        setMessages(
          rawMessages.map((m: RawMessageItem) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
            evidence: m.evidence_references || m.metadata?.evidence,
          }))
        );
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async (userText?: string) => {
    const textToSend = (userText || input).trim();
    if (!textToSend || loading || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setInput('');
    setToolsMenuOpen(false);

    shouldAutoScrollRef.current = true;

    const tempUserMsg: Message = {
      id: generateId('temp'),
      role: 'user',
      content: textToSend,
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: textToSend,
          conversationId: activeConversationId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI yordamchi javob bera olmadi');
      }

      if (!activeConversationId && data.response?.conversationId) {
        setActiveConversationId(data.response.conversationId);
        refreshConversations();
      }

      const replyContent = (data.response?.answer || data.response?.replyText || '').trim();
      if (!replyContent) {
        throw new Error('AI yordamchi javobi bo‘sh qaytdi');
      }

      const assistantMsg: Message = {
        id: data.response?.messageId || data.response?.message?.id || generateId('msg'),
        role: 'assistant',
        content: replyContent,
        created_at: data.response?.message?.created_at || new Date().toISOString(),
        evidence: data.response?.evidence,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errMsg: Message = {
        id: generateId('err'),
        role: 'assistant',
        content: `Xatolik: ${err instanceof Error ? err.message : 'Javobni yuklab bo‘lmadi'}. Iltimos, qaytadan urinib ko‘ring.`,
        isError: true,
        retryPrompt: textToSend,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
      inputRef.current?.focus();
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate',
          categoryName: simCategory,
          percentageReduction: simPercent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Simulyatsiyani bajarib bo‘lmadi');
      }
      setSimResult(data.simulation);
    } catch {
      // ignore
    } finally {
      setSimLoading(false);
    }
  };

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setHistoryOpen(false);
    setSimOpen(false);
    setToolsMenuOpen(false);
  };

  return (
    <div className="relative max-w-4xl xl:max-w-5xl mx-auto w-full flex flex-col h-full flex-1 min-h-0 rounded-2xl sm:rounded-3xl border border-[#D5DED7] bg-white shadow-fintech-card overflow-hidden">
      {/* ── Top Floating Minimal Header ── */}
      <header className="px-5 sm:px-8 py-3.5 border-b border-[#D5DED7] bg-white flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#17211B] text-white flex items-center justify-center shadow-xs">
            <WavingHandIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm text-[#17211B]">SpendSense AI</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F7F9F7] hover:bg-[#EBF1ED] border border-[#D5DED7] text-xs font-semibold text-[#17211B] transition-all shadow-xs active:scale-95"
            title="Yangi suhbat boshlash"
          >
            <Plus className="h-3.5 w-3.5 text-[#176B45]" />
            <span className="hidden sm:inline">Yangi suhbat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setHistoryOpen((prev) => !prev);
              setSimOpen(false);
              setToolsMenuOpen(false);
            }}
            className={`min-h-[34px] px-3 rounded-xl border transition-all text-xs font-medium flex items-center gap-1.5 ${
              historyOpen
                ? 'bg-[#176B45] border-[#176B45] text-white'
                : 'bg-[#F7F9F7] hover:bg-[#EBF1ED] border-[#D5DED7] text-[#47544C]'
            }`}
            title="Suhbatlar tarixi"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tarix</span>
          </button>
        </div>
      </header>

      {/* ── Slide-in History Drawer ── */}
      {historyOpen && (
        <div className="border-b border-[#D5DED7] bg-[#F7F9F7] p-4 sm:p-5 space-y-3 animate-in slide-in-from-top-2 duration-150 shrink-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#17211B]">
              <History className="h-4 w-4 text-[#176B45]" />
              <h3 className="text-sm font-semibold">Oldingi suhbatlar</h3>
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="text-[#47544C] hover:text-[#17211B] p-1.5 rounded-lg"
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {conversations.length === 0 ? (
            <p className="text-xs sm:text-sm text-[#5A675F] py-2">Hali saqlangan suhbatlar mavjud emas.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => loadConversation(c.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-between truncate ${
                    activeConversationId === c.id
                      ? 'bg-[#176B45] text-white font-medium shadow-xs'
                      : 'text-[#47544C] hover:text-[#17211B] hover:bg-white border border-transparent hover:border-[#D5DED7]'
                  }`}
                >
                  <span className="truncate">{c.title || 'Moliyaviy maslahat'}</span>
                  <span className={`text-xs shrink-0 ml-2 ${activeConversationId === c.id ? 'text-white/80' : 'text-[#5A675F]'}`}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('uz-UZ') : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Slide-in Simulation Drawer ── */}
      {simOpen && (
        <div className="border-b border-[#D5DED7] bg-[#F7F9F7] p-4 sm:p-5 space-y-3.5 animate-in slide-in-from-top-2 duration-150 shrink-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#17211B]">
              <Sliders className="h-4 w-4 text-[#176B45]" />
              <h3 className="text-sm font-semibold">Xarajatni qisqartirish simulyatori (What-If)</h3>
            </div>
            <button
              type="button"
              onClick={() => setSimOpen(false)}
              className="text-[#47544C] hover:text-[#17211B] p-1.5 rounded-lg"
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSimulate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="sim-category-input" className="block text-[#47544C] text-xs mb-1.5 font-medium">
                Kategoriya
              </label>
              <input
                id="sim-category-input"
                type="text"
                value={simCategory}
                onChange={(e) => setSimCategory(e.target.value)}
                placeholder="Masalan: Oziq-ovqat"
                className="w-full bg-white border border-[#D5DED7] rounded-xl px-3.5 py-2 text-[#17211B] focus:outline-none focus:border-[#176B45] focus:ring-2 focus:ring-[#176B45]/20 text-sm min-h-[44px] transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-[#47544C] mb-1.5 font-medium">
                <span>Qisqartirish foizi:</span>
                <span className="font-mono text-[#176B45] font-bold">{simPercent}%</span>
              </div>
              <input
                id="sim-percent-slider"
                aria-label="Qisqartirish foizi"
                type="range"
                min="5"
                max="50"
                step="5"
                value={simPercent}
                onChange={(e) => setSimPercent(Number(e.target.value))}
                className="w-full accent-[#176B45] cursor-pointer mt-2"
              />
            </div>

            <div className="flex items-end">
              <button
                id="run-simulation-btn"
                type="submit"
                disabled={simLoading}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-fintech-card"
              >
                {simLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Hisoblash</span>
              </button>
            </div>
          </form>

          {simResult && (
            <div className="p-4 rounded-xl bg-white border border-[#D5DED7] text-sm flex flex-wrap items-center justify-between gap-2 shadow-fintech-card">
              <div className="text-xs sm:text-sm text-[#47544C]">
                Oylik tejash: <strong className="text-[#176B45] font-mono font-bold tabular-nums">+{Math.round(simResult.monthlySavings ?? simResult.projectedMonthlySavings ?? 0).toLocaleString('uz-UZ')} soʻm</strong> | Yillik: <strong className="text-[#176B45] font-mono font-bold tabular-nums">+{Math.round(simResult.annualizedSavings ?? simResult.projectedAnnualSavings ?? 0).toLocaleString('uz-UZ')} soʻm</strong>
              </div>
              <p className="text-sm text-[#47544C] w-full leading-relaxed pt-1">
                {simResult.explanation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Main Canvas / Message Thread ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 sm:p-6 sm:px-8 overflow-y-auto space-y-5 bg-[#F7F9F7]/50"
      >
        {/* ── SayHalo Inspired Hero Welcome Screen (In SpendSense Brand System) ── */}
        {messages.length === 0 && !loadingHistory && (
          <div className="min-h-full flex flex-col items-center justify-center py-3 sm:py-8 text-center animate-in fade-in-50 duration-200">
            {/* Top Squircle Avatar Icon with waving hand */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-[18px] sm:rounded-[22px] bg-[#17211B] shadow-fintech-card flex items-center justify-center text-white mb-3 sm:mb-5 transform hover:scale-105 transition-all duration-300">
              <WavingHandIcon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>

            {/* Greeting */}
            <p className="text-[#5A675F] text-base sm:text-xl font-medium tracking-tight mb-1 sm:mb-2">
              Salom, {userName || 'Foydalanuvchi'}
            </p>

            {/* Main Headline */}
            <h1 className="text-xl sm:text-4xl font-bold text-[#17211B] tracking-tight mb-2 sm:mb-3 max-w-xl mx-auto">
              Sizga qanday yordam bera olaman?
            </h1>

            {/* Subtitle */}
            <p className="text-xs sm:text-base text-[#47544C] max-w-md mx-auto leading-relaxed mb-4 sm:mb-8 px-2">
              Moliyaviy savollaringizga javob berish va shaxsiy tavsiyalar berishga tayyorman. Boshlaymizmi?
            </p>

            {/* 3 Quick Prompt Cards (Single 3-column Grid on Mobile & Desktop) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full max-w-3xl mx-auto">
              {QUICK_PROMPT_CARDS.map((card, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(card.query)}
                  className="bg-white rounded-xl sm:rounded-3xl p-2.5 sm:p-5 md:p-6 shadow-fintech-card border border-[#D5DED7] hover:border-[#176B45] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between text-left group active:scale-[0.98]"
                >
                  <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#17211B] group-hover:bg-[#176B45] text-white flex items-center justify-center mb-2.5 sm:mb-4 transition-colors shadow-xs shrink-0">
                    {card.icon === 'wave' ? (
                      <WavingHandIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    ) : card.icon === 'plane' ? (
                      <Plane className="h-4 w-4 sm:h-5 sm:w-5 text-white rotate-45" />
                    ) : (
                      <Sliders className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <h4 className="font-bold text-[11px] sm:text-base text-[#17211B] group-hover:text-[#176B45] transition-colors leading-tight line-clamp-2">
                      {card.title}
                    </h4>
                    <p className="text-[10px] sm:text-xs text-[#5A675F] mt-1 sm:mt-1.5 font-medium leading-tight line-clamp-1 sm:line-clamp-2">
                      {card.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading history skeletons */}
        {loadingHistory && (
          <div className="max-w-3xl mx-auto space-y-4 py-2">
            <MessageBubbleSkeleton isUser={false} />
            <MessageBubbleSkeleton isUser={true} />
            <MessageBubbleSkeleton isUser={false} />
          </div>
        )}

        {/* ── Active Conversation Messages ── */}
        {messages.length > 0 && (
          <div className="max-w-3xl mx-auto w-full space-y-5">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              const isExpanded = !!expandedEvidence[m.id];

              return (
                <div
                  key={m.id}
                  className={`flex gap-3 text-sm leading-relaxed ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* AI Avatar */}
                  {!isUser && (
                    <div className="w-9 h-9 rounded-xl bg-[#17211B] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <WavingHandIcon className="h-5 w-5 text-white" />
                    </div>
                  )}

                  {/* Message Bubble Card */}
                  <div
                    className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-5 sm:p-6 space-y-3 ${
                      isUser
                        ? 'bg-[#176B45] text-white rounded-tr-xs shadow-fintech-card'
                        : 'bg-white border border-[#D5DED7] text-[#17211B] rounded-tl-xs shadow-fintech-card'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed font-normal text-sm sm:text-base">{m.content}</p>
                    ) : (
                      <MarkdownText content={m.content} />
                    )}

                    {/* Pending Action Confirmation Card */}
                    {!isUser && m.evidence?.pending_action?.status === 'pending' && (
                      <div className="mt-3 p-4 rounded-xl bg-[#F7F9F7] border border-[#D5DED7] space-y-3 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#176B45] uppercase tracking-wider">
                            Amalni tasdiqlash
                          </span>
                          {m.evidence.pending_action.params.amount && (
                            <span className="text-sm font-mono font-bold tabular-nums text-[#17211B] bg-white px-2.5 py-1 rounded-lg border border-[#D5DED7]">
                              {Number(m.evidence.pending_action.params.amount).toLocaleString('uz-UZ')} {m.evidence.pending_action.params.currency || 'UZS'}
                            </span>
                          )}
                        </div>

                        <div className="text-xs sm:text-sm text-[#47544C] space-y-1">
                          {m.evidence.pending_action.params.category_name && (
                            <div>Kategoriya: <span className="text-[#17211B] font-semibold">{m.evidence.pending_action.params.category_name}</span></div>
                          )}
                          {m.evidence.pending_action.params.description && (
                            <div>Tavsif: <span className="text-[#17211B] font-semibold">{m.evidence.pending_action.params.description}</span></div>
                          )}
                          {m.evidence.pending_action.params.date && (
                            <div>Sana: <span className="text-[#17211B] font-mono tabular-nums">{m.evidence.pending_action.params.date}</span></div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2.5 border-t border-[#D5DED7]">
                          <button
                            id="confirm-ai-action-btn"
                            type="button"
                            disabled={loading}
                            onClick={() => handleSend('Ha, tasdiqlayman')}
                            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white font-semibold text-xs sm:text-sm transition-colors disabled:opacity-50 shadow-xs"
                          >
                            Tasdiqlash
                          </button>
                          <button
                            id="cancel-ai-action-btn"
                            type="button"
                            disabled={loading}
                            onClick={() => handleSend('Bekor qil')}
                            className="min-h-[40px] px-4 py-2 rounded-xl border border-[#D5DED7] bg-white hover:bg-[#F7F9F7] text-[#47544C] text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            Bekor qilish
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Grounded Evidence References */}
                    {!isUser && m.evidence && (
                      <div className="pt-2.5 border-t border-[#D5DED7] mt-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEvidence((prev) => ({
                              ...prev,
                              [m.id]: !prev[m.id],
                            }))
                          }
                          className="inline-flex items-center gap-1.5 text-xs text-[#5A675F] hover:text-[#176B45] transition-colors font-medium"
                        >
                          <ShieldCheck className="h-4 w-4 text-[#176B45]" />
                          <span>
                            {m.evidence.is_fallback
                              ? 'Aniq moliyaviy qoidalar asosida'
                              : 'Tasdiqlangan moliyaviy ma’lumotlar'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {isExpanded && m.evidence.grounded_context && (
                          <div className="mt-2.5 p-3 rounded-xl bg-[#F7F9F7] font-mono text-xs text-[#47544C] overflow-x-auto border border-[#D5DED7] leading-relaxed shadow-xs">
                            <p className="text-[#17211B] font-semibold mb-1">BAZA MA’LUMOTLARI:</p>
                            <pre className="whitespace-pre-wrap">{m.evidence.grounded_context}</pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Retry on Error */}
                    {!isUser && m.isError && m.retryPrompt && (
                      <div className="pt-2.5 border-t border-[#D5DED7] mt-2.5">
                        <button
                          id={`retry-btn-${m.id}`}
                          type="button"
                          disabled={loading}
                          onClick={() => handleSend(m.retryPrompt)}
                          className="inline-flex items-center gap-2 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white border border-[#D5DED7] hover:border-[#176B45] hover:text-[#176B45] text-[#17211B] text-xs sm:text-sm font-semibold transition-all shadow-xs disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-[#176B45]" />
                          <span>Qaytadan urinish</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* User Avatar */}
                  {isUser && (
                    <div className="h-9 w-9 rounded-xl bg-white border border-[#D5DED7] flex items-center justify-center text-[#17211B] shrink-0 mt-0.5 shadow-xs">
                      <User className="h-4 w-4 text-[#47544C]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="max-w-3xl mx-auto w-full flex items-center gap-3 text-[#47544C] text-sm">
            <div className="w-9 h-9 rounded-xl bg-[#17211B] text-white flex items-center justify-center shrink-0 shadow-xs">
              <WavingHandIcon className="h-5 w-5 text-white" />
            </div>
            <div className="px-5 py-3.5 rounded-2xl rounded-tl-xs bg-white border border-[#D5DED7] flex items-center gap-2.5 shadow-fintech-card">
              <Loader2 className="h-4 w-4 animate-spin text-[#176B45]" />
              <span className="text-xs sm:text-sm text-[#47544C] font-medium">
                SpendSense tahlil qilmoqda...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Chatbot Bottom Floating Input Dock (Responsive on All Devices) ── */}
      <footer className="p-2 sm:p-3.5 md:p-4 bg-white border-t border-[#D5DED7] shrink-0">
        <div className="w-full max-w-3xl mx-auto flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {/* Settings / Tools Icon Button */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setToolsMenuOpen((prev) => !prev)}
              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full transition-all flex items-center justify-center shadow-xs active:scale-95 cursor-pointer shrink-0 ${
                toolsMenuOpen || historyOpen || simOpen
                  ? 'bg-[#176B45] text-white'
                  : 'bg-[#17211B] hover:bg-[#125536] text-white'
              }`}
              title="Qo‘shimcha vositalar va sozlamalar"
              aria-label="Sozlamalar"
            >
              <Settings2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            {/* Quick Settings / Tools Popover */}
            {toolsMenuOpen && (
              <div className="absolute bottom-12 sm:bottom-14 left-0 w-60 sm:w-64 bg-white border border-[#D5DED7] rounded-2xl shadow-xl p-2 space-y-1 animate-in slide-in-from-bottom-2 duration-150 z-30">
                <button
                  type="button"
                  onClick={() => {
                    startNewChat();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#17211B] hover:bg-[#F7F9F7] flex items-center gap-2.5 transition-colors"
                >
                  <Plus className="h-4 w-4 text-[#176B45]" />
                  <span>Yangi suhbat</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setHistoryOpen((prev) => !prev);
                    setSimOpen(false);
                    setToolsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#17211B] hover:bg-[#F7F9F7] flex items-center gap-2.5 transition-colors"
                >
                  <History className="h-4 w-4 text-[#176B45]" />
                  <span>Suhbatlar tarixi</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSimOpen((prev) => !prev);
                    setHistoryOpen(false);
                    setToolsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-[#17211B] hover:bg-[#F7F9F7] flex items-center gap-2.5 transition-colors"
                >
                  <Sliders className="h-4 w-4 text-[#176B45]" />
                  <span>What-If simulyatori</span>
                </button>
              </div>
            )}
          </div>

          {/* Elongated Pill Input Container */}
          <div className="flex-1 min-w-0 min-h-[42px] sm:min-h-[50px] rounded-full bg-white border border-[#D5DED7] shadow-fintech-card focus-within:border-[#176B45] focus-within:ring-4 focus-within:ring-[#176B45]/10 px-2 sm:px-4 py-1 flex items-center gap-1 sm:gap-2.5 transition-all">
            {/* Link / Simulation Tool Icon */}
            <button
              type="button"
              onClick={() => {
                setSimOpen((prev) => !prev);
                setHistoryOpen(false);
              }}
              className="text-[#5A675F] hover:text-[#176B45] p-1 sm:p-1.5 rounded-full transition-colors shrink-0"
              title="What-If simulyatorini ochish"
            >
              <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 rotate-45" />
            </button>

            {/* Input Field */}
            <input
              ref={inputRef}
              id="advisor-question-input"
              type="text"
              placeholder="Moliyaviy savolingizni yozing..."
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !loading && !isSubmittingRef.current) {
                    handleSend();
                  }
                }
              }}
              className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm md:text-base text-[#17211B] placeholder-[#5A675F] focus:outline-none px-1"
            />

            {/* SpendSense Signature Brand Green Send Button */}
            <button
              id="advisor-send-btn"
              type="button"
              disabled={loading || !input.trim()}
              onClick={() => handleSend()}
              className="h-8 w-8 sm:h-9 sm:w-auto px-0 sm:px-4 py-0 sm:py-2 rounded-full bg-[#176B45] hover:bg-[#125536] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-fintech-card transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Yuborish"
              aria-label="Yuborish"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <>
                  <span className="hidden sm:inline">Yuborish</span>
                  <ArrowUpRight className="h-4 w-4 stroke-[2.5] shrink-0" />
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
