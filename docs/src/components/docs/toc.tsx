'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type TocItem = { id: string; label: string; level?: 2 | 3 };

export function Toc({ items }: { items: TocItem[] }) {
    const [active, setActive] = React.useState(items[0]?.id);

    React.useEffect(() => {
        const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
        if (!els.length) return;
        const io = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: '-72px 0px -65% 0px', threshold: 0 }
        );
        els.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [items]);

    return (
        <nav aria-label="Na tej stronie" className="text-sm">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zs-dim">Na tej stronie</p>
            <ul className="border-l border-zs-border">
                {items.map((i) => (
                    <li key={i.id}>
                        <a
                            href={`#${i.id}`}
                            className={cn(
                                '-ml-px block border-l py-1.5 pr-2 transition-colors',
                                i.level === 3 ? 'pl-7 text-[13px]' : 'pl-4',
                                active === i.id ? 'border-zs-accent text-zs-accent-strong' : 'border-transparent text-zs-muted hover:text-zs-text'
                            )}
                        >
                            {i.label}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
