'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search, Sparkles } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { SidebarNav } from './sidebar-nav';
import { Hint } from '@/components/ui/tooltip';
import { flatNav } from '@/lib/nav';
import { HelpPopover } from './help-popover';
import { useAssistant } from '@/components/assistant/assistant-provider';
import { cn } from '@/lib/utils';

export function Topbar() {
    const router = useRouter();
    const assistant = useAssistant();
    const [mobileNav, setMobileNav] = React.useState(false);
    const [q, setQ] = React.useState('');
    const [focus, setFocus] = React.useState(false);
    const [cursor, setCursor] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const results = React.useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return [];
        return flatNav.filter((i) => `${i.title} ${i.section} ${i.hint ?? ''}`.toLowerCase().includes(s));
    }, [q]);

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const go = (href: string) => {
        setQ('');
        setFocus(false);
        inputRef.current?.blur();
        router.push(href);
    };

    return (
        <>
            <header className="sticky top-0 z-40 flex h-[52px] items-center gap-3 bg-zs-brand px-4 text-white">
                <button type="button" aria-label="Menu" onClick={() => setMobileNav(true)} className="grid size-9 cursor-pointer place-items-center rounded-md hover:bg-white/10 lg:hidden">
                    <Menu className="size-5" />
                </button>
                <div className="mx-auto flex w-full max-w-[520px] items-center gap-3 px-2">
                    <div className="relative w-full">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/75" />
                        <input
                            ref={inputRef}
                            value={q}
                            onChange={(e) => {
                                setQ(e.target.value);
                                setCursor(0);
                            }}
                            onFocus={() => setFocus(true)}
                            onBlur={() => setTimeout(() => setFocus(false), 120)}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setCursor((c) => Math.min(c + 1, results.length - 1));
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setCursor((c) => Math.max(c - 1, 0));
                                } else if (e.key === 'Enter' && results[cursor]) {
                                    go(results[cursor].href);
                                } else if (e.key === 'Escape') {
                                    setQ('');
                                    inputRef.current?.blur();
                                }
                            }}
                            placeholder="Szukaj w dokumentacji"
                            aria-label="Szukaj w dokumentacji"
                            className="h-8 w-full rounded-md border border-white/35 bg-white/8 pr-12 pl-9 text-sm text-white outline-none placeholder:text-white/70 focus:border-white/70 focus:bg-white/14"
                        />
                        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-white/30 px-1.5 py-px font-mono text-[10px] text-white/75 sm:block">Ctrl K</kbd>

                        {focus && q.trim() ? (
                            <div className="absolute top-10 right-0 left-0 overflow-hidden rounded-lg border border-zs-border bg-zs-surface text-zs-text shadow-2xl">
                                {results.length === 0 ? (
                                    <p className="px-4 py-3 text-sm text-zs-muted">Brak wyników dla „{q}”</p>
                                ) : (
                                    <ul>
                                        {results.map((r, i) => (
                                            <li key={r.href}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => go(r.href)}
                                                    onMouseEnter={() => setCursor(i)}
                                                    className={`flex w-full cursor-pointer flex-col px-4 py-2.5 text-left ${i === cursor ? 'bg-zs-hover' : ''}`}
                                                >
                                                    <span className="text-sm font-medium">{r.title}</span>
                                                    <span className="text-xs text-zs-muted">{r.section}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <Hint label={assistant.open ? 'Zwiń asystenta' : 'Asystent'}>
                        <button
                            type="button"
                            aria-label="Asystent"
                            aria-pressed={assistant.open}
                            onClick={assistant.toggle}
                            className={cn(
                                'grid size-8 cursor-pointer place-items-center rounded-md transition-colors',
                                assistant.open ? 'bg-white/20 text-white ring-1 ring-white/70 hover:bg-white/25' : 'bg-white text-zs-brand hover:bg-white/90'
                            )}
                        >
                            <Sparkles className="size-[18px]" />
                        </button>
                    </Hint>
                    <HelpPopover />
                </div>
            </header>

            <Drawer open={mobileNav} onOpenChange={setMobileNav} position="left" title="Nawigacja">
                <SidebarNav onNavigate={() => setMobileNav(false)} />
            </Drawer>
        </>
    );
}
