/**
 * Gemini API client with timeout, retry, and deterministic fallback
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

export interface GeminiResponse {
  text: string;
  isFallback: boolean;
  model: string;
}

/**
 * Sends a structured prompt to Gemini via direct HTTPS API
 */
export async function generateGeminiContent(
  prompt: string,
  systemInstruction?: string,
  timeoutMs: number = 25000
): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) {
    return {
      text: 'Gemini API kaliti server muhitida sozlanmagan.',
      isFallback: true,
      model: 'deterministic_fallback',
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const bodyPayload: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  };

  if (systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  // Attempt with 1 retry
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) {
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const text = parts
          .map((p: { text?: string }) => p.text || '')
          .join('')
          .trim();

        if (text) {
          return {
            text,
            isFallback: false,
            model: GEMINI_MODEL,
          };
        }
      }

      // If rate limited or model error on first attempt, retry once
      if (attempt === 1 && (response.status === 429 || response.status >= 500)) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const errorData = await response.json().catch(() => ({}));
      console.warn(`Gemini API warning (HTTP ${response.status}):`, errorData);
      break;
    } catch (err: unknown) {
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      console.warn('Gemini API fetch error:', err instanceof Error ? err.message : err);
    }
  }

  return {
    text: 'Moliyaviy tahlil xizmati hozirda deterministik qoidalar rejimida ishlamoqda.',
    isFallback: true,
    model: 'deterministic_fallback',
  };
}
