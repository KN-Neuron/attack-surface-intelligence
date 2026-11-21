'use client';
import * as React from 'react';
import Link from 'next/link';
import { ArrowUp, BookOpen, RotateCcw, Sparkles, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssistant } from './assistant-provider';
import { Markdown, type Source } from './markdown';

type Msg = { id: number; role: 'user' | 'assistant'; content: string; sources?: Source[]; mode?: 'llm' | 'retrieval' | 'none'; error?: string };
type Health = { provider: string; label: string; model: string; reachable: boolean; installed: boolean; chunks: number } | null;

const SUGGESTIONS = [
    'Jak nadać tagi importowanym hostom?',
    'Czym różni się tag od grupy hostów?',
    'Co robi podgląd importu?',
    'Jakie uprawnienia potrzebuję do edycji inwentarza?'
];

const isSmall = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

export function AssistantPanel() {
    const { open, setOpen } = useAssistant();
    const [messages, setMessages] = React.useState<Msg[]>([]);
    const [input, setInput] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [health, setHealth] = React.useState<Health>(null);
    const abortRef = React.useRef<AbortController | null>(null);
    const idRef = React.useRef(0);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLTextAreaElement>(null);
    const stick = React.useRef(true);

    // Stan modelu przy każdym otwarciu panelu.
    React.useEffect(() => {
        if (!open) return;
        let alive = true;
        fetch('/api/assistant', { cache: 'no-store' })
            .then((r) => r.json())
            .then((h) => alive && setHealth(h))
            .catch(() => alive && setHealth(null));
        const t = setTimeout(() => inputRef.current?.focus(), 60);
        return () => {
            alive = false;
            clearTimeout(t);
        };
    }, [open]);

    // Esc zamyka; na małym ekranie blokujemy przewijanie strony pod panelem.
    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && setOpen(false);
        window.addEventListener('keydown', onKey);
        const mq = window.matchMedia('(max-width: 767px)');
        const lock = () => (document.body.style.overflow = mq.matches ? 'hidden' : '');
        lock();
        mq.addEventListener('change', lock);
        return () => {
            window.removeEventListener('keydown', onKey);
            mq.removeEventListener('change', lock);
            document.body.style.overflow = '';
        };
    }, [open, setOpen]);

    React.useEffect(() => {
        const el = scrollRef.current;
        if (el && stick.current) el.scrollTop = el.scrollHeight;
    }, [messages]);

    React.useEffect(() => () => abortRef.current?.abort(), []);

    const patchLast = (fn: (m: Msg) => Msg) => setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 ? fn(m) : m)));

    async function ask(raw: string) {
        const question = raw.trim();
        if (!question || busy) return;
        const history = [...messages, { id: ++idRef.current, role: 'user' as const, content: question }];
        setMessages([...history, { id: ++idRef.current, role: 'assistant', content: '' }]);
        setInput('');
        setBusy(true);
        stick.current = true;
        const ac = new AbortController();
        abortRef.current = ac;

        try {
            const res = await fetch('/api/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
                signal: ac.signal
            });
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = '';
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                let nl: number;
                while ((nl = buf.indexOf('\n')) >= 0) {
                    const raw = buf.slice(0, nl).trim();
                    buf = buf.slice(nl + 1);
                    if (!raw) continue;
                    const ev = JSON.parse(raw) as { type: string; text?: string; sources?: Source[]; mode?: Msg['mode']; message?: string };
                    if (ev.type === 'token') patchLast((m) => ({ ...m, content: m.content + ev.text }));
                    else if (ev.type === 'sources') patchLast((m) => ({ ...m, sources: ev.sources }));
                    else if (ev.type === 'meta') patchLast((m) => ({ ...m, mode: ev.mode }));
                    else if (ev.type === 'error') patchLast((m) => ({ ...m, error: ev.message }));
                }
            }
        } catch (e) {
            if (!ac.signal.aborted) patchLast((m) => ({ ...m, error: e instanceof Error ? e.message : 'Błąd połączenia' }));
        } finally {
            setBusy(false);
            abortRef.current = null;
        }
    }

    const stop = () => abortRef.current?.abort();
    const reset = () => {
        stop();
        setMessages([]);
    };

    const status = !health
        ? { dot: 'bg-zs-dim', label: 'Sprawdzanie modelu…' }
        : health.reachable && health.installed
          ? { dot: 'bg-zs-success', label: `${health.model} · ${health.label}` }
          : { dot: 'bg-zs-warn', label: health.reachable ? `Brak modelu${health.model ? ` ${health.model}` : ''} (${health.label})` : `Tryb wyszukiwania (brak ${health.label})` };

    return (
        <aside
            aria-label="Asystent dokumentacji"
            data-open={open}
            className={cn(
                'hidden flex-col bg-zs-bg text-zs-text',
                // małe ekrany: cała powierzchnia; średnie: nakładka z prawej; duże: panel dokowany obok treści
                'data-[open=true]:flex data-[open=true]:animate-zs-slide-in-right',
                'fixed inset-0 z-50',
                'md:inset-y-auto md:top-[52px] md:right-0 md:bottom-0 md:left-auto md:w-[400px] md:border-l md:border-zs-border-strong md:shadow-zs-drawer',
                'xl:sticky xl:top-[52px] xl:z-auto xl:h-[calc(100vh-52px)] xl:shrink-0 xl:shadow-none'
            )}
        >
            <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-zs-border px-4 md:h-12">
                <Sparkles className="size-[18px] text-zs-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                    <h2 className="m-0 text-[15px] leading-tight font-semibold">Asystent</h2>
                    <p className="flex items-center gap-1.5 truncate text-[11px] text-zs-muted" aria-live="polite">
                        <span className={cn('size-1.5 shrink-0 rounded-full', status.dot)} /> {status.label}
                    </p>
                </div>
                <button type="button" onClick={reset} disabled={!messages.length} aria-label="Nowa rozmowa" title="Nowa rozmowa" className="grid size-8 cursor-pointer place-items-center rounded-md text-zs-muted hover:bg-zs-hover hover:text-zs-text disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent">
                    <RotateCcw className="size-4" />
                </button>
                <button type="button" onClick={() => setOpen(false)} aria-label="Zamknij asystenta" className="grid size-8 cursor-pointer place-items-center rounded-md text-zs-muted hover:bg-zs-hover hover:text-zs-text">
                    <X className="size-[18px]" />
                </button>
            </header>

            <div
                ref={scrollRef}
                onScroll={(e) => {
                    const el = e.currentTarget;
                    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                }}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
            >
                {messages.length === 0 ? (
                    <div className="pt-2">
                        <p className="text-sm leading-relaxed text-zs-muted">
                            Zadaj pytanie o ekrany opisane w tej dokumentacji. Odpowiadam wyłącznie na podstawie jej treści i podaję źródła.
                        </p>
                        <ul className="mt-4 space-y-2">
                            {SUGGESTIONS.map((s) => (
                                <li key={s}>
                                    <button type="button" onClick={() => ask(s)} className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg border border-zs-border bg-zs-surface px-3 py-2.5 text-left text-sm hover:border-zs-border-strong hover:bg-zs-hover">
                                        <BookOpen className="mt-0.5 size-4 shrink-0 text-zs-accent" aria-hidden />
                                        {s}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    messages.map((m, i) => {
                        const last = i === messages.length - 1;
                        if (m.role === 'user')
                            return (
                                <div key={m.id} className="flex justify-end">
                                    <p className="max-w-[88%] rounded-2xl rounded-br-md bg-zs-brand-hi px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap text-white">{m.content}</p>
                                </div>
                            );
                        return (
                            <div key={m.id} className="space-y-2.5">
                                {m.content ? (
                                    <Markdown text={m.content} sources={m.sources} onNavigate={() => isSmall() && setOpen(false)} />
                                ) : busy && last && !m.error ? (
                                    <p className="flex items-center gap-1.5 text-sm text-zs-muted" role="status">
                                        <span className="flex gap-1" aria-hidden>
                                            {[0, 150, 300].map((d) => (
                                                <span key={d} className="size-1.5 animate-pulse rounded-full bg-zs-accent" style={{ animationDelay: `${d}ms` }} />
                                            ))}
                                        </span>
                                        Szukam w dokumentacji…
                                    </p>
                                ) : null}
                                {m.error ? <p className="rounded-md border border-zs-danger/50 bg-zs-danger/10 px-3 py-2 text-[13px] text-[#ff9aa8]">Błąd: {m.error}</p> : null}
                                {m.sources?.length && m.mode !== 'none' ? (
                                    <div className="border-t border-zs-border pt-2">
                                        <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-zs-dim uppercase">Źródła</p>
                                        <ul className="space-y-1">
                                            {m.sources.map((s) => (
                                                <li key={s.n}>
                                                    <Link href={s.href} onClick={() => isSmall() && setOpen(false)} className="group flex items-baseline gap-2 text-[13px] text-zs-link no-underline hover:underline">
                                                        <span className="grid h-[18px] min-w-[18px] shrink-0 translate-y-0.5 place-items-center rounded bg-zs-accent/20 px-1 text-[11px] font-semibold text-zs-accent">{s.n}</span>
                                                        <span className="min-w-0 truncate">{s.title} › {s.section}</span>
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })
                )}
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    ask(input);
                }}
                className="shrink-0 border-t border-zs-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
                <div className="flex items-end gap-2 rounded-xl border border-zs-border-strong bg-zs-surface p-1.5 focus-within:border-zs-accent">
                    <textarea
                        ref={inputRef}
                        value={input}
                        rows={1}
                        maxLength={500}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                ask(input);
                            }
                        }}
                        placeholder="Zapytaj o dokumentację…"
                        aria-label="Pytanie do asystenta"
                        className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-5 text-zs-text outline-none placeholder:text-zs-dim md:text-sm [field-sizing:content]"
                    />
                    {busy ? (
                        <button type="button" onClick={stop} aria-label="Zatrzymaj" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-zs-raised text-zs-text hover:bg-zs-hover">
                            <Square className="size-3.5 fill-current" />
                        </button>
                    ) : (
                        <button type="submit" disabled={!input.trim()} aria-label="Wyślij" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-zs-accent text-zs-accent-ink hover:bg-zs-accent-strong disabled:cursor-default disabled:opacity-40 disabled:hover:bg-zs-accent">
                            <ArrowUp className="size-[18px]" />
                        </button>
                    )}
                </div>
                <p className="mt-2 px-1 text-[11px] leading-snug text-zs-dim">Model może się mylić — sprawdź wskazane źródła.</p>
            </form>
        </aside>
    );
}
