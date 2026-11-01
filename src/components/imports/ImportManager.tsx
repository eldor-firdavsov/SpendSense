'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ImportPreviewRow, ImportColumnMapping } from '@/lib/imports/schemas';
import { PageHeader, BentoGrid, BentoCard } from '@/components/bento';

interface ImportJob {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  imported_rows?: number;
  failed_rows?: number;
  skipped_rows?: number;
  success_rows?: number;
  error_rows?: number;
  created_at: string;
}

interface PreviewData {
  jobId?: string;
  filename: string;
  headers: string[];
  mapping?: ImportColumnMapping;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ImportPreviewRow[];
}

export default function ImportManager() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [mapping, setMapping] = useState<Partial<ImportColumnMapping>>({});

  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'import_all'>('skip');
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    insertedCount: number;
    skippedCount: number;
    jobId: string;
  } | null>(null);

  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsReloadTrigger, setJobsReloadTrigger] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadJobs() {
      try {
        const res = await fetch('/api/imports/jobs');
        const data = await res.json();
        if (!isCancelled) {
          if (res.ok && data.jobs) {
            setJobs(data.jobs);
          }
          setLoadingJobs(false);
        }
      } catch {
        if (!isCancelled) {
          setLoadingJobs(false);
        }
      }
    }

    loadJobs();

    return () => {
      isCancelled = true;
    };
  }, [jobsReloadTrigger]);

  const refreshJobs = () => {
    setLoadingJobs(true);
    setJobsReloadTrigger((prev) => prev + 1);
  };

  const handleFileSelect = async (fileToProcess?: File, customMapping?: Partial<ImportColumnMapping>) => {
    const file = fileToProcess || selectedFile;
    if (!file) return;

    if (fileToProcess) {
      setSelectedFile(fileToProcess);
    }

    setUploadError(null);
    setCommitResult(null);

    const formData = new FormData();
    formData.append('file', file);
    if (customMapping) {
      formData.append('mapping', JSON.stringify(customMapping));
    }

    setUploading(true);
    try {
      const res = await fetch('/api/imports/preview', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Faylni ko‘rib chiqishda xatolik yuz berdi');
      }
      setPreview(data.preview);
      if (data.preview?.mapping) {
        setMapping(data.preview.mapping);
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Yuklash muvaffaqiyatsiz tugadi');
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    setUploadError(null);

    try {
      const validRowsToCommit = preview.rows
        .filter((r) => r.isValid && r.parsed)
        .map((r) => ({
          transaction_date: r.parsed!.transaction_date,
          description: r.parsed!.description,
          amount: r.parsed!.amount,
          currency: r.parsed!.currency,
          type: r.parsed!.type,
          merchant: r.parsed!.merchant || null,
          notes: r.parsed!.notes || null,
        }));

      if (validRowsToCommit.length === 0) {
        throw new Error('Saqlash uchun to‘g‘ri qatorlar topilmadi.');
      }

      const res = await fetch('/api/imports/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: preview.jobId || undefined,
          filename: preview.filename,
          duplicateStrategy,
          rows: validRowsToCommit,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ma’lumotlarni saqlashda xatolik yuz berdi');
      }

      const insertedCount = data.result?.importedRows ?? data.result?.insertedCount ?? 0;
      const skippedCount = data.result?.skippedRows ?? data.result?.skippedCount ?? 0;
      const jobId = data.result?.jobId ?? data.result?.job?.id ?? '';

      setCommitResult({
        insertedCount,
        skippedCount,
        jobId,
      });
      refreshJobs();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Importni tasdiqlashda xatolik');
    } finally {
      setCommitting(false);
    }
  };

  const resetAll = () => {
    setPreview(null);
    setCommitResult(null);
    setUploadError(null);
    setSelectedFile(null);
    setShowMapping(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <UploadCloud className="h-6 w-6 text-[#176B45]" />
            <span>Ma’lumotlarni import qilish</span>
          </div>
        }
        subtitle="Bank ko‘chirmalarini CSV yoki Excel formatida xavfsiz va takroriylikdan himoyalangan holda yuklang."
        onRefresh={resetAll}
        refreshTitle="Qayta boshlash"
        refreshId="refresh-import-btn"
        actions={
          <Link
            href="/transactions"
            className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-white border border-[#D5DED7] text-sm font-semibold text-[#17211B] hover:bg-[#F7F9F7] transition-colors shadow-xs"
          >
            <span>Faoliyatga qaytish</span>
          </Link>
        }
      />

      {/* Success State Banner */}
      {commitResult && (
        <div className="p-5 sm:p-6 rounded-2xl bg-[#DDF3E5] border border-[#176B45]/20 text-[#176B45] space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-[#176B45]" />
            <div>
              <h3 className="font-semibold text-base text-[#17211B]">Import muvaffaqiyatli yakunlandi!</h3>
              <p className="text-sm sm:text-base text-[#176B45] mt-0.5">
                Fayldagi ma’lumotlar bazaga to‘liq va xavfsiz tarzda saqlandi.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 pt-2 border-t border-[#176B45]/15 text-xs sm:text-sm">
            <span className="bg-white px-3 py-1 rounded-lg border border-[#176B45]/30 font-semibold text-[#176B45]">
              +{commitResult.insertedCount} ta yangi tranzaksiya yaratildi
            </span>
            <span className="bg-white px-3 py-1 rounded-lg border border-[#D5DED7] text-[#47544C]">
              {commitResult.skippedCount} ta takroriy yozuv o‘tkazib yuborildi
            </span>
          </div>
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <Link
              id="view-imported-transactions-link"
              href="/transactions"
              className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#176B45] text-white font-semibold text-sm hover:bg-[#125536] transition-colors shadow-xs"
            >
              <span>Tranzaksiyalarni ko‘rish</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              id="import-another-btn"
              type="button"
              onClick={resetAll}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-white text-[#17211B] font-semibold text-sm hover:bg-[#F7F9F7] border border-[#D5DED7] transition-colors"
            >
              Yana boshqa fayl yuklash
            </button>
          </div>
        </div>
      )}

      {/* Upload Box (visible when not committed) */}
      {!commitResult && !preview && (
        <BentoGrid cols={12}>
          {/* Main Dropzone Tile */}
          <BentoCard
            span={{ default: 12, lg: 8 }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            className={`p-8 sm:p-12 border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-4 ${
              isDragging
                ? 'border-[#176B45] bg-[#E5F4EA]/50'
                : 'border-[#D5DED7] bg-[#F7F9F7] hover:border-[#176B45]/40'
            }`}
          >
            <div className="h-16 w-16 rounded-2xl bg-white border border-[#D5DED7] flex items-center justify-center text-[#176B45] shadow-xs">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-semibold text-[#17211B]">
                Bank ko‘chirmasi faylini bu yerga sudrab tashlang
              </p>
              <p className="text-sm sm:text-base text-[#47544C] mt-1">
                .csv, .xlsx va .xls formatlari qo‘llab-quvvatlanadi (maksimal hajm 10MB)
              </p>
            </div>

            <label
              htmlFor="file-upload-input"
              className="cursor-pointer inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#176B45] text-white font-semibold text-sm hover:bg-[#125536] transition-colors shadow-xs"
            >
              <UploadCloud className="h-4.5 w-4.5" />
              <span>Kompyuterdan fayl tanlash</span>
            </label>
            <input
              id="file-upload-input"
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </BentoCard>

          {/* Security & Instructions Tile */}
          <BentoCard
            span={{ default: 12, lg: 4 }}
            variant="green"
            className="flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <ShieldCheck className="h-5 w-5 text-[#176B45]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#176B45]">
                  Xavfsizlik va aniqlik kafolati
                </h3>
              </div>
              <p className="text-sm sm:text-base text-[#47544C] leading-relaxed mb-4">
                SpendSense AI import qilingan har bir bank ko‘chirmasini qat’iy xavfsizlik standartlari asosida qayta ishlaydi:
              </p>

              <ul className="space-y-3 text-xs sm:text-sm text-[#17211B]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#176B45] shrink-0 mt-0.5" />
                  <span>Formula inyeksiyasidan (CWE-1236) to‘liq zararsizlantirish</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#176B45] shrink-0 mt-0.5" />
                  <span>Avtomatik sana, summa va valyutani aniqlash</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#176B45] shrink-0 mt-0.5" />
                  <span>Takroriy tranzaksiyalarni intellektual aniqlash va o‘tkazib yuborish</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#176B45] shrink-0 mt-0.5" />
                  <span>Qat’iy shaxsiy ma’lumotlar izolatsiyasi (RLS)</span>
                </li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-white/80 border border-[#D5DED7] text-xs text-[#5A675F] leading-relaxed">
              Qo‘llab-quvvatlanadigan banklar: Humo, Uzcard, Click, Payme, Ipak Yo‘li, Kapitalbank va standart CSV eksportlari.
            </div>
          </BentoCard>
        </BentoGrid>
      )}

      {/* Uploading Spinner */}
      {uploading && (
        <div className="p-10 text-center text-[#5A675F] flex flex-col items-center justify-center gap-2">
          <RefreshCw className="h-7 w-7 animate-spin text-[#176B45]" />
          <p className="text-sm sm:text-base font-semibold text-[#17211B]">Fayl tahlil qilinmoqda va tekshirilmoqda...</p>
          <p className="text-sm sm:text-base text-[#47544C]">Formulalar zararsizlantirilib, ustunlar tekshirilmoqda</p>
        </div>
      )}

      {/* Error Message */}
      {uploadError && (
        <div className="p-4 sm:p-5 rounded-2xl bg-red-50 border border-red-200 text-[#C74747] text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-[#C74747]" />
          <div>
            <p className="font-semibold text-sm sm:text-base text-[#17211B]">Import xatoligi</p>
            <p className="text-sm text-[#C74747] mt-0.5">{uploadError}</p>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {preview && !commitResult && (
        <div className="space-y-4">
          {/* Summary Banner */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#D5DED7] space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono text-[#176B45] uppercase tracking-wider font-semibold">
                  Fayl ko‘rib chiqishga tayyor
                </span>
                <h2 className="text-base sm:text-lg font-semibold text-[#17211B] mt-0.5">{preview.filename}</h2>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  id="cancel-preview-btn"
                  type="button"
                  onClick={resetAll}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white text-[#47544C] hover:text-[#17211B] border border-[#D5DED7] text-sm font-semibold transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  id="commit-import-btn"
                  type="button"
                  onClick={handleCommit}
                  disabled={committing || preview.validRows === 0}
                  className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#176B45] text-white font-semibold text-sm hover:bg-[#125536] transition-colors disabled:opacity-50 shadow-xs"
                >
                  {committing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Saqlanmoqda...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{preview.validRows} ta tranzaksiyani saqlash</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Metric Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#D5DED7] text-xs">
              <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-[#D5DED7]">
                <span className="text-[#5A675F] text-xs">Jami qatorlar</span>
                <p className="text-base font-semibold font-mono tabular-nums text-[#17211B] mt-0.5">{preview.totalRows}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#DDF3E5] border border-[#176B45]/20">
                <span className="text-[#176B45] text-xs">To‘g‘ri qatorlar</span>
                <p className="text-base font-semibold font-mono tabular-nums text-[#176B45] mt-0.5">{preview.validRows}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
                <span className="text-[#C74747] text-xs">Noto‘g‘ri qatorlar</span>
                <p className="text-base font-semibold font-mono tabular-nums text-[#C74747] mt-0.5">{preview.invalidRows}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-800 text-xs">Takroriy qatorlar</span>
                <p className="text-base font-semibold font-mono tabular-nums text-amber-800 mt-0.5">{preview.duplicateRows}</p>
              </div>
            </div>

            {/* Duplicate Strategy Option */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm">
              <span className="text-[#47544C] font-medium">Takroriy yozuvlar strategiyasi:</span>
              <div className="inline-flex rounded-xl bg-[#F7F9F7] p-1 border border-[#D5DED7]">
                <button
                  type="button"
                  id="strategy-skip-btn"
                  onClick={() => setDuplicateStrategy('skip')}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg transition-colors text-xs sm:text-sm ${
                    duplicateStrategy === 'skip'
                      ? 'bg-[#176B45] text-white font-semibold shadow-xs'
                      : 'text-[#47544C] hover:text-[#17211B] hover:bg-black/5'
                  }`}
                >
                  Takroriylarni o‘tkazib yuborish (Tavsiya etiladi)
                </button>
                <button
                  type="button"
                  id="strategy-all-btn"
                  onClick={() => setDuplicateStrategy('import_all')}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg transition-colors text-xs sm:text-sm ${
                    duplicateStrategy === 'import_all'
                      ? 'bg-[#17211B] text-white font-semibold shadow-xs'
                      : 'text-[#47544C] hover:text-[#17211B] hover:bg-black/5'
                  }`}
                >
                  Barchasini import qilish
                </button>
              </div>
            </div>

            {/* Column Mapping Toggle & Drawer */}
            <div className="pt-3 border-t border-[#D5DED7] text-xs sm:text-sm space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  id="toggle-mapping-btn"
                  onClick={() => setShowMapping((prev) => !prev)}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#176B45] hover:text-[#125536] transition-colors"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Ustunlarni moslashtirish {showMapping ? 'yopish' : 'ochish'}</span>
                  {showMapping ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showMapping && selectedFile && (
                  <button
                    type="button"
                    id="repreview-mapping-btn"
                    onClick={() => handleFileSelect(selectedFile, mapping)}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl bg-[#176B45] text-white text-xs font-semibold hover:bg-[#125536] transition-colors shadow-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${uploading ? 'animate-spin' : ''}`} />
                    <span>Qayta tekshirish</span>
                  </button>
                )}
              </div>

              {showMapping && (
                <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs sm:text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-[#47544C] mb-1.5">
                      Sana ustuni (Date) *
                    </label>
                    <select
                      value={mapping.dateColumn || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, dateColumn: e.target.value }))}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-[#D5DED7] bg-white text-[#17211B] text-xs sm:text-sm font-mono focus:border-[#176B45] outline-none"
                    >
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#47544C] mb-1.5">
                      Tavsif ustuni (Description) *
                    </label>
                    <select
                      value={mapping.descriptionColumn || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, descriptionColumn: e.target.value }))}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-[#D5DED7] bg-white text-[#17211B] text-xs sm:text-sm font-mono focus:border-[#176B45] outline-none"
                    >
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#47544C] mb-1.5">
                      Summa ustuni (Amount) *
                    </label>
                    <select
                      value={mapping.amountColumn || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, amountColumn: e.target.value }))}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-[#D5DED7] bg-white text-[#17211B] text-xs sm:text-sm font-mono focus:border-[#176B45] outline-none"
                    >
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#47544C] mb-1.5">
                      Standart valyuta (Currency)
                    </label>
                    <select
                      value={mapping.defaultCurrency || 'UZS'}
                      onChange={(e) => setMapping((m) => ({ ...m, defaultCurrency: e.target.value }))}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-[#D5DED7] bg-white text-[#17211B] text-xs sm:text-sm font-mono focus:border-[#176B45] outline-none"
                    >
                      <option value="UZS">UZS (so‘m)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Table of Preview Rows */}
          <div className="rounded-2xl border border-[#D5DED7] bg-white overflow-hidden shadow-xs">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#D5DED7] flex items-center justify-between bg-[#F7F9F7]">
              <h3 className="text-sm font-semibold text-[#17211B]">Qatorlardan namunalar</h3>
              <span className="text-xs text-[#5A675F]">Dastlabki {Math.min(50, preview.rows.length)} ta qator</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#F7F9F7] text-[#47544C] border-b border-[#D5DED7]">
                  <tr>
                    <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Qator #</th>
                    <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Holat</th>
                    <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Sana</th>
                    <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Tavsif</th>
                    <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Turi</th>
                    <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider text-right">Summa</th>
                    <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Tekshiruv natijasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5DED7]">
                  {preview.rows.slice(0, 50).map((r) => (
                    <tr
                      key={r.rowIndex}
                      className={`hover:bg-[#F7F9F7] transition-colors ${
                        !r.isValid
                          ? 'bg-red-50/40'
                          : r.isDuplicate
                          ? 'bg-amber-50/40'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-3.5 text-[#5A675F] font-mono tabular-nums">{r.rowIndex}</td>
                      <td className="py-3 px-3.5">
                        {!r.isValid ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-[#C74747] border border-red-200">
                            <XCircle className="h-3.5 w-3.5" />
                            Xato
                          </span>
                        ) : r.isDuplicate ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Takroriy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#DDF3E5] text-[#176B45] border border-[#176B45]/20">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            To‘g‘ri
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-[#17211B] font-mono tabular-nums">
                        {r.parsed?.transaction_date || '—'}
                      </td>
                      <td className="py-3 px-3.5 text-[#17211B] max-w-[220px] truncate font-medium">
                        {r.parsed?.description || JSON.stringify(r.raw)}
                      </td>
                      <td className="py-3 px-3.5">
                        {r.parsed?.type ? (
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                              r.parsed.type === 'income'
                                ? 'bg-[#DDF3E5] text-[#176B45]'
                                : 'bg-red-50 text-[#C74747]'
                            }`}
                          >
                            {r.parsed.type === 'income' ? 'Kirim' : 'Chiqim'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={`py-3 px-3.5 text-right font-mono font-semibold tabular-nums ${
                        r.parsed ? (r.parsed.type === 'income' ? 'text-[#176B45]' : 'text-[#C74747]') : 'text-[#17211B]'
                      }`}>
                        {r.parsed ? `${r.parsed.type === 'income' ? '+' : '-'}${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(r.parsed.amount))} ${r.parsed.currency || 'UZS'}` : '—'}
                      </td>
                      <td className="py-3 px-3.5 text-[#47544C] max-w-[240px]">
                        {r.errors.length > 0 ? (
                          <span className="text-[#C74747] text-xs font-medium">{r.errors.join(', ')}</span>
                        ) : r.isDuplicate ? (
                          <span className="text-amber-800 text-xs font-medium">Mavjud tranzaksiyaga mos</span>
                        ) : (
                          <span className="text-[#176B45] text-xs font-medium">Tayyor</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Past Import Jobs History */}
      <div className="space-y-3.5 pt-6 border-t border-[#D5DED7]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-[#176B45]" />
            <h2 className="text-base font-semibold text-[#17211B]">Import tarixi</h2>
          </div>
          <button
            type="button"
            onClick={refreshJobs}
            className="min-h-[36px] text-xs sm:text-sm font-semibold text-[#47544C] hover:text-[#17211B] flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingJobs ? 'animate-spin text-[#176B45]' : ''}`} />
            <span>Yangilash</span>
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#F7F9F7] border border-[#D5DED7] text-center text-xs sm:text-sm text-[#5A675F]">
            Hozircha import qilingan fayllar mavjud emas.
          </div>
        ) : (
          <div className="rounded-2xl border border-[#D5DED7] bg-white overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#F7F9F7] text-[#47544C] border-b border-[#D5DED7]">
                <tr>
                  <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Sana</th>
                  <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Fayl nomi</th>
                  <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider">Holat</th>
                  <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider text-right">Muvaffaqiyatli</th>
                  <th className="py-3 px-3.5 font-semibold text-xs uppercase tracking-wider text-right">Xatolar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5DED7]">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#F7F9F7] transition-colors">
                    <td className="py-3 px-3.5 text-[#5A675F] font-mono tabular-nums">
                      {new Date(job.created_at).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="py-3 px-3.5 text-[#17211B] font-medium">{job.filename}</td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                          job.status === 'completed'
                            ? 'bg-[#DDF3E5] text-[#176B45] border border-[#176B45]/20'
                            : job.status === 'failed'
                            ? 'bg-red-50 text-[#C74747] border border-red-200'
                            : 'bg-[#F7F9F7] text-[#5A675F] border border-[#D5DED7]'
                        }`}
                      >
                        {job.status === 'completed' ? 'Bajarildi' : job.status === 'failed' ? 'Xatolik' : 'Kutilmoqda'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-semibold tabular-nums text-[#176B45]">
                      {job.imported_rows ?? job.success_rows ?? 0}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-semibold tabular-nums text-[#C74747]">
                      {job.failed_rows ?? job.error_rows ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
