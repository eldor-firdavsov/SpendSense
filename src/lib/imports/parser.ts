import * as XLSX from 'xlsx';
import type { ImportColumnMapping, ImportPreviewRow } from './schemas.ts';

/**
 * Escapes values against formula injection (CSV Injection / CWE-1236)
 */
export function sanitizeCellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // If first character is dangerous formula trigger, prefix with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str;
}

/**
 * Parses raw date string or Excel serial number into ISO date YYYY-MM-DD
 */
export function parseDate(val: unknown, format: string = 'auto'): string | null {
  if (!val) return null;

  // Handle JS Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Handle Excel numeric serial dates (e.g. 45000)
  if (typeof val === 'number') {
    try {
      const p = XLSX.SSF.parse_date_code(val);
      if (p && p.y && p.m && p.d) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
      }
    } catch {
      // Fallback below
    }
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const targetDate = new Date(excelEpoch.getTime() + val * 86400000);
    if (!isNaN(targetDate.getTime())) {
      return targetDate.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // Handle ISO date format YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (with optional time)
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    const isoStr = `${y}-${m}-${d}`;
    const testDate = new Date(`${isoStr}T00:00:00Z`);
    if (!isNaN(testDate.getTime())) return isoStr;
  }

  // Handle DD.MM.YYYY, DD/MM/YYYY, or MM/DD/YYYY
  const partsMatch = str.match(/^(\d{1,2})([/.\-])(\d{1,2})\2(\d{2,4})/);
  if (partsMatch) {
    const p1 = parseInt(partsMatch[1], 10);
    const p2 = parseInt(partsMatch[3], 10);
    let y = partsMatch[4];
    if (y.length === 2) y = `20${y}`;

    let m: number;
    let d: number;

    // If separator is dot '.', or format is DD/MM/YYYY, or p1 > 12: p1 is day, p2 is month
    if (partsMatch[2] === '.' || format === 'DD/MM/YYYY' || p1 > 12) {
      d = p1;
      m = p2;
    } else if (p2 > 12) {
      m = p1;
      d = p2;
    } else {
      // Default to MM/DD/YYYY if format is not explicitly DD/MM/YYYY and separator is /
      m = p1;
      d = p2;
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const isoStr = `${y}-${pad(m)}-${pad(d)}`;
      const parsedObj = new Date(`${isoStr}T00:00:00Z`);
      if (!isNaN(parsedObj.getTime())) {
        return isoStr;
      }
    }
  }

  // Generic fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Parses numeric amount and resolves transaction type
 */
export function parseAmountAndType(
  rawAmount: unknown,
  rawType: unknown,
  defaultType: 'income' | 'expense' = 'expense'
): { amount: number; type: 'income' | 'expense' } | null {
  if (rawAmount === null || rawAmount === undefined) return null;

  let str = String(rawAmount).trim();
  if (!str) return null;

  // Handle parentheses for negative numbers e.g. (50.00)
  const isParenNegative = /^\(.*\)$/.test(str);
  if (isParenNegative) {
    str = str.replace(/[()]/g, '');
  }

  const hasPlusSign = str.includes('+');
  const hasMinusSign = str.includes('-');

  // Remove currency words and symbols
  str = str
    .replace(/(?:USD|UZS|EUR|RUB|SO'?M|SOM|СУМ|[$€£])/gi, '')
    .trim();

  // Handle European comma decimals vs US dot decimals:
  // e.g. "1 250,50" -> "1250.50", "1,250.50" -> "1250.50", "1500,00" -> "1500.00"
  if (/^\s*-?\+?\d{1,3}(?:\s\d{3})*,\d{1,2}\s*$/.test(str) || /^\s*-?\+?\d+,\d{1,2}\s*$/.test(str)) {
    str = str.replace(/\s/g, '').replace(',', '.');
  } else {
    str = str.replace(/[, \s]/g, '');
  }

  let num = parseFloat(str);
  if (isNaN(num)) return null;

  if (isParenNegative && num > 0) {
    num = -num;
  }

  let resolvedType: 'income' | 'expense' = defaultType;

  // Check explicit rawType if provided
  if (rawType) {
    const typeStr = String(rawType).toLowerCase().trim();
    if (
      typeStr.includes('inc') ||
      typeStr.includes('credit') ||
      typeStr === 'cr' ||
      typeStr.includes('kirim') ||
      typeStr.includes('приход') ||
      typeStr.includes('доход')
    ) {
      resolvedType = 'income';
    } else if (
      typeStr.includes('exp') ||
      typeStr.includes('debit') ||
      typeStr === 'dr' ||
      typeStr.includes('chiqim') ||
      typeStr.includes('xarajat') ||
      typeStr.includes('расход')
    ) {
      resolvedType = 'expense';
    }
  } else {
    // Infer from sign or +/-
    if (num < 0 || hasMinusSign) {
      resolvedType = 'expense';
      num = Math.abs(num);
    } else if (hasPlusSign) {
      resolvedType = 'income';
    }
  }

  const positiveAmount = Math.abs(Math.round(num * 100) / 100);
  if (positiveAmount <= 0) return null;

  return { amount: positiveAmount, type: resolvedType };
}

/**
 * Heuristically guesses best column matches from file headers
 */
export function detectColumnMapping(headers: string[]): ImportColumnMapping {
  const findMatch = (keywords: string[]) => {
    return (
      headers.find((h) => {
        const lower = h.toLowerCase().trim();
        return keywords.some((k) => lower === k || lower.includes(k));
      }) || ''
    );
  };

  const dateCol = findMatch([
    'date',
    'tx_date',
    'transaction_date',
    'posted',
    'time',
    'sana',
    'data',
    'дата',
    'kun',
    'vaqt',
    'datetime',
    'timestamp',
  ]);
  const descCol = findMatch([
    'description',
    'desc',
    'memo',
    'narration',
    'details',
    'name',
    'payee',
    'tavsif',
    'izoh',
    'maqsad',
    'nomi',
    'to‘lov',
    'tolov',
    'описание',
    'детали',
    'назначение',
  ]);
  const amountCol = findMatch([
    'amount',
    'sum',
    'total',
    'value',
    'summa',
    'miqdor',
    'сумма',
    'стоимость',
    'narx',
    'balans',
  ]);
  const typeCol = findMatch([
    'type',
    'direction',
    'transaction_type',
    'credit/debit',
    'cr/dr',
    'turi',
    'tur',
    'тип',
    'vid',
  ]);
  const catCol = findMatch([
    'category',
    'cat',
    'classification',
    'kategoriya',
    'bo‘lim',
    'bolim',
    'категория',
  ]);
  const merchCol = findMatch([
    'merchant',
    'store',
    'vendor',
    'payee',
    'savdogar',
    'qabul qiluvchi',
    'oluvchi',
    'hamkor',
    'магазин',
    'получатель',
  ]);
  const notesCol = findMatch([
    'notes',
    'note',
    'comment',
    'remarks',
    'eslatma',
    'qo‘shimcha',
    'qoshimcha',
    'примечание',
  ]);

  return {
    dateColumn: dateCol || headers[0] || 'Date',
    descriptionColumn: descCol || headers[1] || 'Description',
    amountColumn: amountCol || headers[2] || 'Amount',
    typeColumn: typeCol || undefined,
    categoryColumn: catCol || undefined,
    merchantColumn: merchCol || undefined,
    notesColumn: notesCol || undefined,
    defaultType: 'expense',
    defaultCurrency: 'USD',
    dateFormat: 'auto',
  };
}

/**
 * Parses file buffer (CSV or XLSX) into raw rows and headers
 */
export function parseSpreadsheetBuffer(buffer: Buffer): {
  headers: string[];
  rows: Record<string, unknown>[];
} {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellFormula: false,
    raw: false,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Spreadsheet contains no sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  // Ensure formula cells without computed values preserve their raw text for sanitization
  for (const cellAddress in sheet) {
    if (cellAddress.startsWith('!')) continue;
    const cell = sheet[cellAddress];
    if (cell && cell.f && (cell.v === undefined || cell.v === null || cell.v === '')) {
      cell.v = `=${cell.f}`;
      cell.t = 's';
    }
  }

  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = (jsonData[0] || []).map((h) => String(h || '').trim());
  const validHeaders = rawHeaders.filter((h) => h.length > 0);

  const rawRows = jsonData.slice(1);
  const rows: Record<string, unknown>[] = [];

  for (const row of rawRows) {
    // Check if row has any content
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
      continue;
    }
    const rowObj: Record<string, unknown> = {};
    rawHeaders.forEach((header, idx) => {
      if (header) {
        rowObj[header] = row[idx] !== undefined ? row[idx] : '';
      }
    });
    rows.push(rowObj);
  }

  return { headers: validHeaders, rows };
}

/**
 * Validates and normalizes raw rows according to mapping
 */
export function normalizeRows(
  rows: Record<string, unknown>[],
  mapping: ImportColumnMapping
): ImportPreviewRow[] {
  return rows.map((row, idx) => {
    const errors: string[] = [];
    const rawDate = row[mapping.dateColumn];
    const rawDesc = row[mapping.descriptionColumn];
    const rawAmount = row[mapping.amountColumn];
    const rawType = mapping.typeColumn ? row[mapping.typeColumn] : undefined;
    const rawCat = mapping.categoryColumn ? row[mapping.categoryColumn] : undefined;
    const rawMerch = mapping.merchantColumn ? row[mapping.merchantColumn] : undefined;
    const rawNotes = mapping.notesColumn ? row[mapping.notesColumn] : undefined;

    const parsedDate = parseDate(rawDate, mapping.dateFormat);
    if (!parsedDate) {
      errors.push(`"${mapping.dateColumn}" ustunida sana (date) noto‘g‘ri yoki kiritilmagan`);
    }

    const description = rawDesc !== undefined ? sanitizeCellValue(rawDesc) : '';
    if (!description) {
      errors.push(`"${mapping.descriptionColumn}" ustunida tavsif (Description) kiritilishi shart`);
    }

    const parsedAmountType = parseAmountAndType(rawAmount, rawType, mapping.defaultType);
    if (!parsedAmountType) {
      errors.push(`"${mapping.amountColumn}" ustunida summa (amount) noto‘g‘ri kiritilgan`);
    }

    const isValid = errors.length === 0;

    return {
      rowIndex: idx + 1,
      raw: row,
      parsed: isValid
        ? {
            transaction_date: parsedDate!,
            description,
            amount: parsedAmountType!.amount,
            currency: mapping.defaultCurrency,
            type: parsedAmountType!.type,
            category_name: rawCat ? sanitizeCellValue(rawCat) : null,
            merchant: rawMerch ? sanitizeCellValue(rawMerch) : null,
            notes: rawNotes ? sanitizeCellValue(rawNotes) : null,
          }
        : null,
      isValid,
      errors,
      isDuplicate: false,
    };
  });
}
