/**
 * Warstwa dostawcy modelu: Ollama (domyślnie) albo LM Studio (API zgodne z OpenAI).
 * Wybór: ASSISTANT_PROVIDER=ollama | lmstudio
 */
export type Provider = 'ollama' | 'lmstudio';
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const raw = (process.env.ASSISTANT_PROVIDER ?? 'ollama').toLowerCase();
export const PROVIDER: Provider = raw === 'lmstudio' || raw === 'lm-studio' || raw === 'openai' ? 'lmstudio' : 'ollama';
export const LABEL = PROVIDER === 'lmstudio' ? 'LM Studio' : 'Ollama';

export const BASE_URL = (
    PROVIDER === 'lmstudio' ? (process.env.LMSTUDIO_URL ?? 'http://127.0.0.1:1234') : (process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434')
).replace(/\/(v1)?\/?$/, '');

const CONFIGURED = process.env.ASSISTANT_MODEL?.trim() || (PROVIDER === 'ollama' ? 'gemma3:1b' : '');

const NUM_GPU = process.env.ASSISTANT_NUM_GPU ? Number(process.env.ASSISTANT_NUM_GPU) : undefined;

/** Lista modeli udostępnionych przez serwer. Rzuca wyjątek, gdy serwer nie odpowiada. */
export async function listModels(timeoutMs = 1500): Promise<string[]> {
    const url = PROVIDER === 'lmstudio' ? `${BASE_URL}/v1/models` : `${BASE_URL}/api/tags`;
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as { models?: { name: string }[]; data?: { id: string }[] };
    return PROVIDER === 'lmstudio' ? (data.data ?? []).map((m) => m.id) : (data.models ?? []).map((m) => m.name);
}

const isEmbedding = (id: string) => /embed|rerank/i.test(id);

/** Model do użycia: z ASSISTANT_MODEL, a dla LM Studio bez ustawienia — pierwszy sensowny z listy (preferowana Gemma). */
export function chooseModel(available: string[]): string {
    if (CONFIGURED) return CONFIGURED;
    const chat = available.filter((m) => !isEmbedding(m));
    return chat.find((m) => /gemma/i.test(m)) ?? chat[0] ?? '';
}

export const configuredModel = CONFIGURED;

export const isInstalled = (model: string, available: string[]) =>
    !!model && available.some((n) => n === model || n.split(':')[0] === model || n.toLowerCase().includes(model.toLowerCase()));

export function chatRequest(model: string, messages: ChatMessage[], signal: AbortSignal): Promise<Response> {
    const headers = { 'Content-Type': 'application/json' };
    if (PROVIDER === 'lmstudio') {
        return fetch(`${BASE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers,
            signal,
            body: JSON.stringify({ model, messages, stream: true, temperature: 0.2, max_tokens: 700 })
        });
    }
    return fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
            model,
            messages,
            stream: true,
            keep_alive: '10m',
            options: { temperature: 0.2, num_ctx: 4096, ...(Number.isFinite(NUM_GPU) ? { num_gpu: NUM_GPU } : {}) }
        })
    });
}

/** Wyciąga komunikat błędu z odpowiedzi serwera (Ollama: {error:"..."}, OpenAI: {error:{message}}). */
export function errorText(body: string): string {
    try {
        const j = JSON.parse(body) as { error?: string | { message?: string } };
        if (typeof j.error === 'string') return j.error;
        if (j.error?.message) return j.error.message;
    } catch {
        /* nie JSON */
    }
    return body;
}

/** Jednolity strumień tokenów z NDJSON (Ollama) i SSE (OpenAI/LM Studio). */
export async function* readTokens(body: ReadableStream<Uint8Array>): AsyncGenerator<{ text?: string; error?: string }> {
    const reader = body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
            let l = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (l.startsWith('data:')) l = l.slice(5).trim();
            if (!l || l === '[DONE]') continue;
            try {
                const j = JSON.parse(l) as {
                    message?: { content?: string };
                    choices?: { delta?: { content?: string } }[];
                    error?: string | { message?: string };
                };
                if (j.error) yield { error: typeof j.error === 'string' ? j.error : (j.error.message ?? 'Błąd modelu') };
                else {
                    const t = j.message?.content ?? j.choices?.[0]?.delta?.content;
                    if (t) yield { text: t };
                }
            } catch {
                /* niepełna linia — pomiń */
            }
        }
    }
}
