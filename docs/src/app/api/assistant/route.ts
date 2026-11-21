import { connection } from 'next/server';
import { search, chunkCount, type Hit } from '@/lib/rag/search';
import { SYSTEM_PROMPT, buildUserMessage } from '@/lib/rag/prompt';
import { BASE_URL, LABEL, PROVIDER, chatRequest, chooseModel, configuredModel, errorText, isInstalled, listModels, readTokens, type ChatMessage } from '@/lib/rag/llm';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

const enc = new TextEncoder();
const line = (o: unknown) => enc.encode(JSON.stringify(o) + '\n');

const sourceOf = (hits: Hit[]) => hits.map((h, i) => ({ n: i + 1, title: h.page, section: h.section, href: h.href }));

/** GET: stan modelu (do wskaźnika w panelu). */
export async function GET() {
    await connection();
    try {
        const available = await listModels();
        const model = chooseModel(available);
        return Response.json({ provider: PROVIDER, label: LABEL, model, reachable: true, installed: isInstalled(model, available), chunks: chunkCount });
    } catch {
        return Response.json({ provider: PROVIDER, label: LABEL, model: configuredModel, reachable: false, installed: false, chunks: chunkCount });
    }
}

/** POST: pytanie → retrieval (BM25) → Gemma (Ollama, strumień) albo tryb samego wyszukiwania. */
export async function POST(request: Request) {
    let body: { messages?: unknown };
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Niepoprawny JSON' }, { status: 400 });
    }

    const messages = (Array.isArray(body.messages) ? body.messages : [])
        .filter((m): m is ChatMsg => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }))
        .slice(-7);
    const last = messages.at(-1);
    if (!last || last.role !== 'user' || !last.content.trim()) {
        return Response.json({ error: 'Brak pytania' }, { status: 400 });
    }

    const question = last.content.trim();
    // Pytanie najpierw szukamy samodzielnie. Dopiero gdy nic nie znajdzie, a wygląda na uzupełniające
    // ("a jak to usunąć?", "a w tym przypadku?"), dokładamy poprzednie pytanie użytkownika.
    const prevUser = messages.slice(0, -1).findLast((m) => m.role === 'user')?.content ?? '';
    const FOLLOW_UP = /^\s*(a|i|no|ale)\s|\b(to|ten|ta|te|tego|tym|tej|go|ją|je|nim|nią|tamto|dalej|jeszcze)\b/i;
    let hits = search(question, 4);
    if (!hits.length && prevUser && question.length < 40 && FOLLOW_UP.test(question)) hits = search(`${prevUser} ${question}`, 4);

    const stream = new ReadableStream({
        async start(controller) {
            const send = (o: unknown) => controller.enqueue(line(o));
            const text = (t: string) => send({ type: 'token', text: t });

            try {
                if (!hits.length) {
                    send({ type: 'meta', mode: 'none', model: configuredModel });
                    send({ type: 'sources', sources: [] });
                    text('Nie znalazłem tego w dokumentacji. Spróbuj użyć nazwy ekranu lub pola, np. „tagi”, „import hostów” albo „uprawnienia”.');
                    send({ type: 'done' });
                    return;
                }

                const sources = sourceOf(hits);
                const history = messages.slice(0, -1).slice(-4);
                const chat: ChatMessage[] = [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...history,
                    { role: 'user', content: buildUserMessage(question, hits) }
                ];

                let res: Response | null = null;
                let failure: 'unreachable' | 'missing' | 'error' | null = null;
                let detail = '';
                let model = configuredModel;
                try {
                    const available = await listModels(3000);
                    model = chooseModel(available);
                    if (!model || (PROVIDER === 'ollama' && !isInstalled(model, available))) failure = 'missing';
                } catch (e) {
                    if (request.signal.aborted) return;
                    failure = 'unreachable';
                    const code = (e as { cause?: { code?: string } }).cause?.code;
                    detail = code ?? (e instanceof Error ? e.message : 'nieznany błąd');
                }
                if (!failure) {
                    try {
                        res = await chatRequest(model, chat, request.signal);
                        if (res.status === 404) failure = 'missing';
                        else if (!res.ok || !res.body) {
                            failure = 'error';
                            const text = errorText(await res.text().catch(() => ''));
                            detail = `HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`;
                        }
                    } catch (e) {
                        if (request.signal.aborted) return;
                        failure = 'unreachable';
                        const code = (e as { cause?: { code?: string } }).cause?.code;
                        detail = code ?? (e instanceof Error ? e.message : 'nieznany błąd');
                    }
                }

                if (failure || !res?.body) {
                    // Tryb awaryjny: pokaż najtrafniejsze fragmenty bez generowania odpowiedzi.
                    send({ type: 'meta', mode: 'retrieval', model, reason: failure });
                    send({ type: 'sources', sources });
                    const shown = model || '(nie wybrano)';
                    const hint =
                        failure === 'missing'
                            ? PROVIDER === 'lmstudio'
                                ? `${LABEL} działa, ale nie widzę modelu${model ? ` **${model}**` : ''}. Pobierz model w LM Studio i ustaw jego nazwę w \`ASSISTANT_MODEL\` (lista: \`${BASE_URL}/v1/models\`).`
                                : `Ollama działa, ale model **${shown}** nie jest pobrany. Uruchom \`ollama pull ${shown}\` i zapytaj ponownie.`
                            : failure === 'error'
                              ? `${LABEL} (${BASE_URL}) zwrócił błąd: **${detail}**.`
                              : PROVIDER === 'lmstudio'
                                ? `Nie mogę połączyć się z LM Studio pod adresem \`${BASE_URL}\` (${detail}). W LM Studio otwórz zakładkę Developer i włącz „Start server”.`
                                : `Nie mogę połączyć się z Ollamą pod adresem \`${BASE_URL}\` (${detail}). Uruchom aplikację Ollama lub \`ollama serve\`, a potem \`ollama pull ${shown}\`.`;
                    text(`${hint}\n\nNajtrafniejsze fragmenty dokumentacji:\n\n`);
                    hits.forEach((h, i) => text(`**[${i + 1}] ${h.section}**\n${h.text.split('\n').slice(0, 6).join('\n')}\n\n`));
                    send({ type: 'done' });
                    return;
                }

                send({ type: 'meta', mode: 'llm', model });
                send({ type: 'sources', sources });

                for await (const t of readTokens(res.body)) {
                    if (t.error) send({ type: 'error', message: t.error });
                    else if (t.text) text(t.text);
                }
                send({ type: 'done' });
            } catch (e) {
                if (!request.signal.aborted) send({ type: 'error', message: e instanceof Error ? e.message : 'Błąd asystenta' });
            } finally {
                try {
                    controller.close();
                } catch {
                    /* już zamknięty */
                }
            }
        }
    });

    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}
