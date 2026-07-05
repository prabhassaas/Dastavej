/**
 * Bring-your-own-AI client. Talks to any OpenAI-compatible chat endpoint, so
 * the app stays free and serverless: point it at open-source models running
 * locally (Ollama, LM Studio, llama.cpp) for truly unlimited use, or at a
 * hosted provider's free tier (Groq, OpenRouter…). The endpoint URL, key and
 * model live in localStorage on the user's device only.
 */

export interface AiSettings {
  /** base URL ending in /v1, e.g. http://localhost:11434/v1 */
  endpoint: string;
  /** optional bearer token (not needed for local Ollama) */
  apiKey: string;
  /** model name, e.g. llama3.1, qwen2.5:14b, llama-3.3-70b-versatile */
  model: string;
}

const STORAGE_KEY = 'dastavej-ai-settings';

export const AI_PRESETS: { name: string; endpoint: string; note: string }[] = [
  {
    name: 'Ollama (local, unlimited)',
    endpoint: 'http://localhost:11434/v1',
    note:
      'Install from ollama.com, run `ollama pull llama3.1`, then start it with ' +
      '`OLLAMA_ORIGINS=* ollama serve` so your browser is allowed to call it (CORS) — free ' +
      'forever, fully private.',
  },
  {
    name: 'LM Studio (local)',
    endpoint: 'http://localhost:1234/v1',
    note: 'Start the local server in LM Studio.',
  },
  {
    name: 'Groq (hosted free tier)',
    endpoint: 'https://api.groq.com/openai/v1',
    note: 'Fast open-source models (Llama 3.x); needs a free API key.',
  },
  {
    name: 'OpenRouter (hosted)',
    endpoint: 'https://openrouter.ai/api/v1',
    note: 'Many open models, some free; needs an API key.',
  },
];

export function loadAiSettings(): AiSettings {
  const defaults: AiSettings = { endpoint: '', apiKey: '', model: '' };
  if (typeof window === 'undefined') return defaults;
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** True once endpoint + model are both filled in — "ready to use" settings. */
export function isAiConfigured(settings: AiSettings): boolean {
  return Boolean(settings.endpoint.trim() && settings.model.trim());
}

/**
 * Back up the provider settings (including the API key) to a small JSON
 * file. localStorage is the only place these live, so an explicit "clear
 * cookies and site data" in the browser wipes them for good — that's the
 * browser doing exactly what the user asked, and no client-side app should
 * try to defeat it. This is the honest mitigation: a one-file backup the
 * user controls, so restoring after a real wipe is a re-import, not
 * retyping a key from memory.
 */
export function serializeAiSettings(settings: AiSettings): string {
  return JSON.stringify(settings, null, 2);
}

export function parseAiSettingsFile(text: string): AiSettings {
  const parsed = JSON.parse(text);
  return {
    endpoint: typeof parsed.endpoint === 'string' ? parsed.endpoint : '',
    apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    model: typeof parsed.model === 'string' ? parsed.model : '',
  };
}

/**
 * Folded into every generation prompt so output defaults to a polished,
 * presentation-ready bar even when the user's topic/prompt says nothing
 * about style — "write about X" should still come back looking like
 * something you'd hand to a client, not a rough draft.
 */
export const PROFESSIONAL_STYLE_INSTRUCTION =
  'Regardless of how the request is phrased, write and structure this at a market-ready, ' +
  'professional-presentation standard by default: clear hierarchy, confident and precise ' +
  'language, concrete facts/data/examples over vague filler, and section headings that read ' +
  'like a polished business report or client deck rather than a rough draft.';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** One non-streaming chat completion. Throws with a readable message. */
export async function aiChat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const s = loadAiSettings();
  if (!s.endpoint || !s.model) {
    throw new Error('Configure an AI endpoint and model first (AI tab → Provider settings).');
  }
  let res: Response;
  try {
    res = await fetch(`${s.endpoint.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(s.apiKey ? { Authorization: `Bearer ${s.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: s.model, messages, stream: false }),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // A network-level failure here almost always means either the server
    // isn't running, or (very commonly with local Ollama/LM Studio) it's
    // running but refusing the browser's cross-origin request — the fetch
    // API reports both as an opaque "Failed to fetch" with no other detail.
    throw new Error(
      `Could not reach ${s.endpoint} — is the server running? If this is a local model ` +
        `(Ollama, LM Studio), the server also needs to allow requests from this page's ` +
        `origin (CORS). For Ollama: stop it and restart with ` +
        `\`OLLAMA_ORIGINS=* ollama serve\` (or set OLLAMA_ORIGINS to this app's exact URL).`,
    );
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`AI endpoint returned ${res.status}: ${body}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('AI endpoint returned no content.');
  return content;
}

/**
 * Ask the configured model to fix obvious OCR mistakes (misrecognized
 * characters, wrongly split/joined words, stray artifacts) in a block of raw
 * tesseract.js output, preserving the original wording and line structure as
 * closely as possible. Used by the OCR tab's optional "Improve with AI" step
 * — tesseract does the recognition, the LLM does the cleanup pass.
 */
export async function improveOcrText(rawText: string, signal?: AbortSignal): Promise<string> {
  if (!rawText.trim()) return rawText;
  const reply = await aiChat(
    [
      {
        role: 'system',
        content:
          'You are given raw OCR output that may contain misrecognized characters, wrongly ' +
          'split or joined words, stray line breaks and scanning artifacts. Correct obvious OCR ' +
          'errors while preserving the original meaning, wording and line/paragraph structure as ' +
          'closely as possible. Reply with ONLY the corrected text — no preamble, no commentary, ' +
          'no markdown fences, no added or removed content beyond fixing recognition errors.',
      },
      { role: 'user', content: rawText },
    ],
    signal,
  );
  return reply.trim();
}

/** Extract a JSON object from a model reply that may be fenced or chatty. */
export function parseJsonReply(reply: string): Record<string, unknown> {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : reply;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The AI reply did not contain JSON.');
  return JSON.parse(candidate.slice(start, end + 1));
}
