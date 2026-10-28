
import AppError from '../utils/AppError.js';

const API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

const TIMEOUT_MS = 25000;
const MAX_ATTEMPTS = 3;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const safeCode = (value) =>
  typeof value === 'string' && /^[A-Z0-9_]{1,80}$/i.test(value)
    ? value
    : 'UNKNOWN';

const retryableStatus = (status) =>
  [408, 500, 502, 503, 504].includes(status);

async function callModel(model, apiKey, requestBody) {
  let lastResponse;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TIMEOUT_MS
    );

    try {
      const response = await fetch(
        `${API_BASE}/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );

      lastResponse = response;

      if (
        retryableStatus(response.status) &&
        attempt < MAX_ATTEMPTS
      ) {
        await response.body?.cancel().catch(() => {});
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }

      return response;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AppError(
          'AI search timed out. Please try again.',
          504
        );
      }

      if (attempt === MAX_ATTEMPTS) {
        throw new AppError(
          'Could not connect to the AI service.',
          503
        );
      }

      console.error('[Gemini AI Search] Network retry', {
        attempt,
        model,
        code: safeCode(error?.cause?.code),
      });

      await sleep(1000 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  return lastResponse;
}

export const generateAIJson = async ({
  systemInstruction,
  input,
  responseSchema,
}) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const primaryModel =
    process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';

  // Override this fallback in backend configuration if necessary.
  const fallbackModel =
    process.env.GEMINI_FALLBACK_MODEL?.trim() ||
    'gemini-2.5-flash';

  if (!apiKey) {
    throw new AppError(
      'AI search is not configured. Please use regular search.',
      503
    );
  }

  if (
    typeof systemInstruction !== 'string' ||
    !systemInstruction.trim() ||
    input == null
  ) {
    throw new AppError('Invalid AI search input.', 400);
  }

  const generationConfig = {
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
  };

  if (responseSchema) {
    generationConfig.responseSchema = responseSchema;
  }

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: JSON.stringify(input) }],
      },
    ],
    generationConfig,
  };

  const models = [...new Set([primaryModel, fallbackModel])];
  let lastStatus = 503;

  for (const model of models) {
    let response;

    try {
      response = await callModel(model, apiKey, requestBody);
    } catch (error) {
      console.error('[Gemini AI Search] Model request failed', {
        model,
        statusCode: error?.statusCode || 503,
      });

      lastStatus = error?.statusCode || 503;
      continue;
    }

    let payload;

    try {
      payload = await response.json();
    } catch {
      console.error('[Gemini AI Search] Invalid provider response', {
        model,
        httpStatus: response.status,
      });

      lastStatus = 502;
      continue;
    }

    if (!response.ok) {
      lastStatus = response.status;

      console.error('[Gemini AI Search] Provider error', {
        model,
        httpStatus: response.status,
        providerStatus: safeCode(payload?.error?.status),
      });

      // Try fallback only for temporary service errors.
      if (retryableStatus(response.status)) {
        continue;
      }

      if (response.status === 429) {
        throw new AppError(
          'AI usage limit reached. Please try later.',
          429
        );
      }

      if ([401, 403].includes(response.status)) {
        throw new AppError(
          'AI API access was denied. Check your API configuration.',
          503
        );
      }

      if (response.status === 404) {
        // The configured model may not be available.
        continue;
      }

      throw new AppError(
        'AI search could not process the request.',
        502
      );
    }

    const candidate = payload?.candidates?.[0];

    if (
      payload?.promptFeedback?.blockReason ||
      !candidate ||
      candidate.finishReason !== 'STOP'
    ) {
      console.error('[Gemini AI Search] Incomplete response', {
        model,
        finishReason: safeCode(candidate?.finishReason),
      });

      lastStatus = 502;
      continue;
    }

    const text = (candidate.content?.parts || [])
      .filter(
        (part) =>
          part.thought !== true &&
          typeof part.text === 'string'
      )
      .map((part) => part.text)
      .join('')
      .trim();

    if (!text) {
      lastStatus = 502;
      continue;
    }

    try {
      const result = JSON.parse(text);

      if (
        result === null ||
        typeof result !== 'object' ||
        Array.isArray(result)
      ) {
        throw new Error('Unexpected JSON structure');
      }

      console.info('[Gemini AI Search] Success', { model });
      return result;
    } catch {
      console.error('[Gemini AI Search] Invalid JSON output', {
        model,
      });

      lastStatus = 502;
    }
  }

  throw new AppError(
    'AI search is temporarily unavailable. Please use regular search.',
    lastStatus >= 500 ? 503 : lastStatus
  );
};

export default generateAIJson;
