'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sliders,
  RefreshCw,
  History,
  Plus,
  X,
  Wallet,
  PieChart,
  TrendingDown,
  Target,
  ArrowUpRight,
  Lock,
} from 'lucide-react';
import SpendSenseLogo from '@/components/brand/SpendSenseLogo';

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

const QUICK_PROMPT_CARDS = [
  {
    title: 'Bu oy qancha pul sarfladim?',
    subtitle: 'Joriy oylik xarajatlar summasi',
    category: 'Oylik xarajat',
    icon: Wallet,
  },
  {
    title: 'Eng ko‘p pul qaysi kategoriyaga ketdi?',
    subtitle: 'Asosiy xarajat yo‘nalishlari',
    category: 'Kategoriya tahlili',
    icon: PieChart,
  },
  {
    title: 'Xarajatlarimni qanday kamaytiraman?',
    subtitle: 'Tejash va optimallashtirish tavsiyasi',
    category: 'Tejash tavsiyasi',
    icon: TrendingDown,
  },
  {
    title: 'Jamg‘arma maqsadimga yetish uchun nima qilishim kerak?',
    subtitle: 'Oylik reja va imkoniyat hisobi',
    category: 'Jamg‘arma rejasi',
    icon: Target,
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

    // Heading 4 / 3
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={idx} className="text-xs font-bold text-[#17211B] mt-2.5 mb-1 tracking-tight">
          {formatInline(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={idx} className="text-sm font-bold text-[#17211B] mt-3 mb-1.5 tracking-tight">
          {formatInline(trimmed.replace(/^##\s+/, ''))}
        </h3>
      );
      return;
    }

    // Bullet items: -, *, •
    if (/^[-*•]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*•]\s+/, '');
      currentList.push(
        <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
          <span className="h-1.5 w-1.5 rounded-full bg-[#176B45] shrink-0 mt-1.5" />
          <span className="text-[#2C3830]">{formatInline(itemText)}</span>
        </li>
      );
      return;
    }

    // Numbered items: 1., 2., etc.
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      currentList.push(
        <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
          <span className="font-mono font-bold text-[11px] text-[#176B45] shrink-0 min-w-[16px]">
            {numMatch[1]}.
          </span>
          <span className="text-[#2C3830]">{formatInline(numMatch[2])}</span>
        </li>
      );
      return;
    }

    // Standard paragraph line
    flushList();
    elements.push(
      <p key={idx} className="text-xs text-[#2C3830] leading-relaxed">
        {formatInline(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-1.5">{elements}</div>;
}

export default function AIAdvisorChat() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  // Tool Drawers (History & What-If Simulation)
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Monitor user scroll to prevent forceful auto-scroll when reading history
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
        const res = await fetch('/api/ai/conversations');
        const data = await res.json();
        if (!isCancelled && res.ok && data.conversations) {
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
      const res = await fetch('/api/ai/conversations');
      const data = await res.json();
      if (res.ok && data.conversations) {
        setConversations(data.conversations);
      }
    } catch {
      // ignore
    }
  };

  const loadConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setLoadingHistory(true);
    setHistoryOpen(false);
    try {
      const res = await fetch(`/api/ai/conversations/${convId}`);
      const data = await res.json();
      const rawMessages = data.messages || data.conversation?.ai_messages || [];
      if (res.ok && Array.isArray(rawMessages)) {
        setMessages(
          rawMessages.map(
            (m: {
              id: string;
              role: 'user' | 'assistant';
              content: string;
              created_at: string;
              evidence_references?: Message['evidence'];
              metadata?: { evidence?: Message['evidence'] };
            }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              created_at: m.created_at,
              evidence: m.evidence_references || m.metadata?.evidence,
            })
          )
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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Force scroll down when sending user message
    shouldAutoScrollRef.current = true;

    // Optimistically append user message
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
  };

  return (
    <div className="max-w-4xl xl:max-w-5xl mx-auto w-full flex flex-col h-[calc(100dvh-10.5rem)] md:h-[calc(100dvh-8.5rem)] min-h-[580px] rounded-3xl border border-[#DFE7E1] bg-gradient-to-b from-[#FAFBF9] via-[#F4F8F5] to-[#EEF4F0] overflow-hidden shadow-[0_20px_50px_rgba(23,107,69,0.06)]">
      {/* ── Top Header (SayHalo Minimalist Style) ── */}
      <header className="px-4 sm:px-6 py-3.5 border-b border-[#E3EBE5] bg-white/85 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center h-10 w-10 rounded-2xl bg-gradient-to-br from-[#176B45] to-[#0E442B] text-white shadow-sm ring-4 ring-[#DDF3E5]/60 shrink-0">
            <Sparkles className="h-5 w-5 text-[#9EE5B8]" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#10B981] ring-2 ring-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-[#17211B] tracking-tight truncate">
                SpendSense AI yordamchi
              </h2>
              <span className="sr-only">SpendSense AI Advisor</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#DDF3E5] text-[#176B45] shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
                Tayyor
              </span>
            </div>
            <p className="text-[11px] text-[#68736C] truncate">
              Shaxsiy moliya tahlili va amaliy tavsiyalar
            </p>
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0F5F2] hover:bg-[#E2EDE6] text-[#176B45] font-semibold text-xs transition-all shadow-xs active:scale-95"
            title="Yangi suhbat boshlash"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Yangi suhbat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setHistoryOpen((prev) => !prev);
              setSimOpen(false);
            }}
            className={`p-2 rounded-full transition-all text-xs flex items-center justify-center ${
              historyOpen
                ? 'bg-[#176B45] text-white'
                : 'bg-[#F0F5F2] hover:bg-[#E2EDE6] text-[#55635B] hover:text-[#17211B]'
            }`}
            title="Suhbatlar tarixi"
          >
            <History className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSimOpen((prev) => !prev);
              setHistoryOpen(false);
            }}
            className={`p-2 rounded-full transition-all text-xs flex items-center justify-center ${
              simOpen
                ? 'bg-[#176B45] text-white'
                : 'bg-[#F0F5F2] hover:bg-[#E2EDE6] text-[#55635B] hover:text-[#17211B]'
            }`}
            title="Xarajatni qisqartirish simulyatori"
          >
            <Sliders className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Slide-in History Drawer ── */}
      {historyOpen && (
        <div className="border-b border-[#E3EBE5] bg-white/95 backdrop-blur-md p-4 space-y-3 animate-in slide-in-from-top-2 duration-150 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#17211B]">
              <History className="h-4 w-4 text-[#176B45]" />
              <h3 className="text-xs font-bold">Oldingi suhbatlar</h3>
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="text-[#68736C] hover:text-[#17211B] p-1 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {conversations.length === 0 ? (
            <p className="text-xs text-[#68736C] py-2">Hali saqlangan suhbatlar mavjud emas.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => loadConversation(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between truncate ${
                    activeConversationId === c.id
                      ? 'bg-[#DDF3E5] text-[#176B45] font-semibold'
                      : 'text-[#68736C] hover:text-[#17211B] hover:bg-[#F4F8F5]'
                  }`}
                >
                  <span className="truncate">{c.title || 'Moliyaviy maslahat'}</span>
                  <span className="text-[10px] text-[#8C9890] shrink-0 ml-2">
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
        <div className="border-b border-[#E3EBE5] bg-[#F7FAF7] p-4 space-y-3 animate-in slide-in-from-top-2 duration-150 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#17211B]">
              <Sliders className="h-4 w-4 text-[#176B45]" />
              <h3 className="text-xs font-bold">Xarajatni qisqartirish simulyatori (What-If)</h3>
            </div>
            <button
              type="button"
              onClick={() => setSimOpen(false)}
              className="text-[#68736C] hover:text-[#17211B] p-1 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSimulate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label htmlFor="sim-category-input" className="block text-[#68736C] text-[11px] mb-1 font-medium">
                Kategoriya
              </label>
              <input
                id="sim-category-input"
                type="text"
                value={simCategory}
                onChange={(e) => setSimCategory(e.target.value)}
                placeholder="Masalan: Oziq-ovqat"
                className="w-full bg-white border border-[#DCE4DE] rounded-xl px-3 py-1.5 text-[#17211B] focus:outline-none focus:border-[#176B45] text-xs transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-[#68736C] mb-1 font-medium">
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
                className="w-full accent-[#176B45] cursor-pointer mt-1"
              />
            </div>

            <div className="flex items-end">
              <button
                id="run-simulation-btn"
                type="submit"
                disabled={simLoading}
                className="w-full py-2 rounded-xl bg-[#176B45] text-white font-semibold text-xs hover:bg-[#125536] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
              >
                {simLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Hisoblash</span>
              </button>
            </div>
          </form>

          {simResult && (
            <div className="p-3 rounded-2xl bg-white border border-[#DCE4DE] text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="text-[11px] text-[#68736C]">
                Oylik tejash: <strong className="text-[#176B45] font-mono font-bold">+{Math.round(simResult.monthlySavings ?? simResult.projectedMonthlySavings ?? 0).toLocaleString('uz-UZ')} soʻm</strong> | Yillik: <strong className="text-[#176B45] font-mono font-bold">+{Math.round(simResult.annualizedSavings ?? simResult.projectedAnnualSavings ?? 0).toLocaleString('uz-UZ')} soʻm</strong>
              </div>
              <p className="text-[11px] text-[#68736C] w-full leading-relaxed">
                {simResult.explanation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Main Message Thread / Canvas ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4"
      >
        {/* ── Empty State: SayHalo Hero Welcome Screen ── */}
        {messages.length === 0 && !loadingHistory && (
          <div className="py-6 sm:py-10 max-w-2xl mx-auto flex flex-col items-center text-center space-y-6 animate-in fade-in-50 duration-200">
            {/* Halo Glow Badge */}
            <div className="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF3E5] text-[#176B45] text-xs font-semibold shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-[#176B45]" />
              <span>SpendSense AI Moliyaviy Yordamchi</span>
            </div>

            {/* Large Friendly Heading */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17211B] tracking-tight">
                Assalomu alaykum! Qanday yordam bera olaman?
              </h1>
              <p className="text-xs sm:text-sm text-[#68736C] max-w-md mx-auto leading-relaxed">
                Daromad va xarajatlaringizni tahlil qiling, byudjetingizni rejalashtiring yoki yangi jamg‘arma maqsadi sari qadam tashlang.
              </p>
            </div>

            {/* 4 Interactive Quick Prompt Cards (SayHalo Style) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-2 text-left">
              {QUICK_PROMPT_CARDS.map((card, idx) => {
                const IconComponent = card.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(card.title)}
                    className="p-3.5 sm:p-4 rounded-2xl border border-[#DFE7E1] bg-white hover:bg-[#F2F7F4] hover:border-[#176B45]/40 transition-all group flex items-start justify-between gap-3 shadow-xs hover:shadow-md text-left active:scale-[0.99]"
                  >
                    <div className="space-y-1 min-w-0">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#176B45]">
                        {card.category}
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-[#17211B] group-hover:text-[#176B45] transition-colors leading-snug">
                        {card.title}
                      </h4>
                      <p className="text-[11px] text-[#68736C] truncate">
                        {card.subtitle}
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-[#F0F5F2] group-hover:bg-[#DDF3E5] text-[#68736C] group-hover:text-[#176B45] flex items-center justify-center shrink-0 transition-colors mt-0.5">
                      <IconComponent className="h-4 w-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading history indicator */}
        {loadingHistory && (
          <div className="py-16 text-center text-[#68736C] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-[#176B45]" />
            <p className="text-xs font-medium">Suhbat xabarlari yuklanmoqda...</p>
          </div>
        )}

        {/* ── Message Bubbles ── */}
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const isExpanded = !!expandedEvidence[m.id];

          return (
            <div
              key={m.id}
              className={`flex gap-3 text-xs leading-relaxed ${
                isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {/* AI Avatar */}
              {!isUser && (
                <div className="shrink-0 mt-0.5">
                  <SpendSenseLogo variant="icon" size="sm" />
                </div>
              )}

              {/* Message Bubble Card */}
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 space-y-2.5 ${
                  isUser
                    ? 'bg-gradient-to-r from-[#176B45] to-[#125536] text-white rounded-tr-xs shadow-md'
                    : 'bg-white border border-[#E3EAE5] text-[#17211B] rounded-tl-xs shadow-xs'
                }`}
              >
                {/* Content: User plain text vs AI Formatted Markdown */}
                {isUser ? (
                  <p className="whitespace-pre-wrap leading-relaxed font-normal">{m.content}</p>
                ) : (
                  <MarkdownText content={m.content} />
                )}

                {/* Structured Action Confirmation Card if pending action */}
                {!isUser && m.evidence?.pending_action?.status === 'pending' && (
                  <div className="mt-2.5 p-3.5 rounded-2xl bg-[#F7FAF7] border border-[#176B45]/25 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#176B45] uppercase tracking-wider">
                        Amalni tasdiqlash
                      </span>
                      {m.evidence.pending_action.params.amount && (
                        <span className="text-xs font-mono font-bold text-[#17211B] bg-white px-2 py-0.5 rounded-md border border-[#DCE4DE]">
                          {Number(m.evidence.pending_action.params.amount).toLocaleString('uz-UZ')} {m.evidence.pending_action.params.currency || 'UZS'}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#68736C] space-y-1">
                      {m.evidence.pending_action.params.category_name && (
                        <div>Kategoriya: <span className="text-[#17211B] font-semibold">{m.evidence.pending_action.params.category_name}</span></div>
                      )}
                      {m.evidence.pending_action.params.description && (
                        <div>Tavsif: <span className="text-[#17211B] font-semibold">{m.evidence.pending_action.params.description}</span></div>
                      )}
                      {m.evidence.pending_action.params.date && (
                        <div>Sana: <span className="text-[#17211B] font-mono">{m.evidence.pending_action.params.date}</span></div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#DCE4DE]">
                      <button
                        id="confirm-ai-action-btn"
                        type="button"
                        disabled={loading}
                        onClick={() => handleSend('Ha, tasdiqlayman')}
                        className="px-3.5 py-1.5 rounded-xl bg-[#176B45] hover:bg-[#125536] text-white font-semibold text-xs transition-colors disabled:opacity-50 shadow-xs"
                      >
                        Tasdiqlash
                      </button>
                      <button
                        id="cancel-ai-action-btn"
                        type="button"
                        disabled={loading}
                        onClick={() => handleSend('Bekor qil')}
                        className="px-3.5 py-1.5 rounded-xl border border-[#DCE4DE] bg-white hover:bg-[#F7FAF7] text-[#68736C] text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        Bekor qilish
                      </button>
                    </div>
                  </div>
                )}

                {/* Grounded Evidence References */}
                {!isUser && m.evidence && (
                  <div className="pt-2 border-t border-[#EAEFEA] mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedEvidence((prev) => ({
                          ...prev,
                          [m.id]: !prev[m.id],
                        }))
                      }
                      className="inline-flex items-center gap-1.5 text-[10px] text-[#68736C] hover:text-[#176B45] transition-colors font-medium"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-[#176B45]" />
                      <span>
                        {m.evidence.is_fallback
                          ? 'Aniq moliyaviy qoidalar asosida'
                          : 'Tasdiqlangan moliyaviy ma’lumotlar'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>

                    {isExpanded && m.evidence.grounded_context && (
                      <div className="mt-2 p-2.5 rounded-xl bg-[#F8FAF8] font-mono text-[10px] text-[#55635B] overflow-x-auto border border-[#E3EAE5] leading-normal shadow-xs">
                        <p className="text-[#17211B] font-bold mb-1">BAZA MA’LUMOTLARI:</p>
                        <pre className="whitespace-pre-wrap">{m.evidence.grounded_context}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Retry button on error messages */}
                {!isUser && m.isError && m.retryPrompt && (
                  <div className="pt-2 border-t border-[#EAEFEA] mt-2">
                    <button
                      id={`retry-btn-${m.id}`}
                      type="button"
                      disabled={loading}
                      onClick={() => handleSend(m.retryPrompt)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#DCE4DE] hover:border-[#176B45] hover:text-[#176B45] text-[#17211B] text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className="h-3 w-3 text-[#176B45]" />
                      <span>Qaytadan urinish</span>
                    </button>
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="h-8 w-8 rounded-2xl bg-white border border-[#DCE4DE] flex items-center justify-center text-[#17211B] shrink-0 mt-0.5 shadow-xs">
                  <User className="h-4 w-4 text-[#55635B]" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator Wave */}
        {loading && (
          <div className="flex items-center gap-3 text-[#68736C] text-xs">
            <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-[#DDF3E5] to-[#C7ECD3] text-[#176B45] flex items-center justify-center shrink-0 border border-[#CDE3D5] shadow-xs">
              <Bot className="h-4 w-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white border border-[#E3EAE5] flex items-center gap-2.5 shadow-xs">
              <Loader2 className="h-4 w-4 animate-spin text-[#176B45]" />
              <span className="text-xs text-[#55635B] font-medium">
                SpendSense AI tahlil qilmoqda...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── SayHalo Bottom Input Dock ── */}
      <footer className="p-3.5 sm:p-5 border-t border-[#E3EBE5] bg-white/90 backdrop-blur-md shrink-0">
        <div className="relative rounded-2xl sm:rounded-3xl border border-[#DFE7E1] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.03)] focus-within:border-[#176B45] focus-within:ring-4 focus-within:ring-[#176B45]/10 transition-all flex items-end p-1.5 sm:p-2 gap-2">
          <textarea
            ref={textareaRef}
            id="advisor-question-input"
            rows={1}
            placeholder="Moliyaviy savolingizni yozing..."
            value={input}
            disabled={loading}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !loading && !isSubmittingRef.current) {
                  handleSend();
                }
              }
            }}
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-xs sm:text-sm text-[#17211B] placeholder-[#8C9890] focus:outline-none min-h-[44px] max-h-[120px] leading-relaxed"
          />

          {/* Integrated Rounded Send Action Button */}
          <button
            id="advisor-send-btn"
            type="button"
            disabled={loading || !input.trim()}
            onClick={() => handleSend()}
            className="h-10 w-10 rounded-xl sm:rounded-2xl bg-[#176B45] hover:bg-[#125536] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95 shrink-0"
            aria-label="Yuborish"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Footer Subtext Bar */}
        <div className="flex items-center justify-between text-[11px] text-[#68736C] px-2 mt-2">
          <span className="hidden sm:inline">Enter — yuborish, Shift+Enter — yangi qator</span>
          <span className="sm:hidden">Enter — yuborish</span>
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3 w-3 text-[#176B45]" />
            <span>Haqiqiy foydalanuvchi ma’lumotlari himoyalangan</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
