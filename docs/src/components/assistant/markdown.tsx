import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type Source = { n: number; title: string; section: string; href: string };

type Block = { type: 'p'; text: string } | { type: 'ul' | 'ol'; items: string[] } | { type: 'code'; text: string };

function parse(src: string): Block[] {
    const blocks: Block[] = [];
    const lines = src.replace(/\r/g, '').split('\n');
    let para: string[] = [];
    let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
    let fence: string[] | null = null;

    const flushPara = () => {
        if (para.length) blocks.push({ type: 'p', text: para.join('\n') });
        para = [];
    };
    const flushList = () => {
        if (list) blocks.push(list);
        list = null;
    };

    for (const raw of lines) {
        if (raw.trim().startsWith('```')) {
            if (fence) {
                blocks.push({ type: 'code', text: fence.join('\n') });
                fence = null;
            } else {
                flushPara();
                flushList();
                fence = [];
            }
            continue;
        }
        if (fence) {
            fence.push(raw);
            continue;
        }
        const ul = raw.match(/^\s*[-*•]\s+(.*)$/);
        const ol = raw.match(/^\s*\d+[.)]\s+(.*)$/);
        if (ul || ol) {
            flushPara();
            const type = ul ? 'ul' : 'ol';
            if (!list || list.type !== type) {
                flushList();
                list = { type, items: [] };
            }
            list.items.push((ul ?? ol)![1]);
        } else if (!raw.trim()) {
            flushPara();
            flushList();
        } else {
            flushList();
            para.push(raw);
        }
    }
    if (fence) blocks.push({ type: 'code', text: fence.join('\n') });
    flushPara();
    flushList();
    return blocks;
}

function Inline({ text, sources, onNavigate }: { text: string; sources: Source[]; onNavigate?: () => void }) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g).filter(Boolean);
    return (
        <>
            {parts.map((p, i) => {
                if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i} className="font-semibold text-zs-text">{p.slice(2, -2)}</strong>;
                if (p.startsWith('`') && p.endsWith('`') && p.length > 2)
                    return (
                        <code key={i} className="rounded border border-zs-border bg-zs-raised px-1 py-px font-mono text-[0.85em] text-zs-accent-strong">
                            {p.slice(1, -1)}
                        </code>
                    );
                const m = p.match(/^\[(\d+)\]$/);
                if (m) {
                    const s = sources.find((x) => x.n === Number(m[1]));
                    if (s)
                        return (
                            <Link
                                key={i}
                                href={s.href}
                                onClick={onNavigate}
                                title={`${s.title} › ${s.section}`}
                                className="mx-0.5 inline-grid h-[18px] min-w-[18px] -translate-y-px place-items-center rounded bg-zs-accent/20 px-1 text-[11px] font-semibold text-zs-accent no-underline hover:bg-zs-accent/35"
                            >
                                {s.n}
                            </Link>
                        );
                }
                return <React.Fragment key={i}>{p}</React.Fragment>;
            })}
        </>
    );
}

/** Minimalny renderer Markdowna (akapity, listy, **pogrubienie**, `kod`, bloki kodu, cytowania [n]) — bez dangerouslySetInnerHTML. */
export function Markdown({ text, sources = [], onNavigate, className }: { text: string; sources?: Source[]; onNavigate?: () => void; className?: string }) {
    const blocks = React.useMemo(() => parse(text), [text]);
    return (
        <div className={cn('space-y-2.5 text-[14px] leading-relaxed break-words', className)}>
            {blocks.map((b, i) => {
                if (b.type === 'p')
                    return (
                        <p key={i} className="whitespace-pre-line">
                            <Inline text={b.text} sources={sources} onNavigate={onNavigate} />
                        </p>
                    );
                if (b.type === 'code')
                    return (
                        <pre key={i} className="overflow-x-auto rounded-md border border-zs-border bg-zs-deep/60 p-3 font-mono text-[12.5px] leading-5">
                            {b.text}
                        </pre>
                    );
                const Tag = b.type;
                return (
                    <Tag key={i} className={cn('space-y-1 pl-5', b.type === 'ul' ? 'list-disc' : 'list-decimal', 'marker:text-zs-dim')}>
                        {b.items.map((it, j) => (
                            <li key={j}>
                                <Inline text={it} sources={sources} onNavigate={onNavigate} />
                            </li>
                        ))}
                    </Tag>
                );
            })}
        </div>
    );
}
