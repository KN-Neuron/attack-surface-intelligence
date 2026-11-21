import * as React from 'react';
import { cn } from '@/lib/utils';

/** Okno w stylu aplikacji wokół statycznych podglądów interfejsu. */
export function PortalFrame({ title, children, className, caption }: { title: string; children: React.ReactNode; className?: string; caption?: string }) {
    return (
        <figure className="my-6">
            <div className="overflow-hidden rounded-xl border border-zs-border-strong bg-zs-bg shadow-[0_20px_60px_-20px_rgb(0_0_0/0.7)]">
                <div className="flex items-center gap-2 bg-zs-brand px-3 py-2">
                    <span className="size-2.5 rounded-full bg-white/40" />
                    <span className="size-2.5 rounded-full bg-white/40" />
                    <span className="size-2.5 rounded-full bg-white/40" />
                    <span className="ml-2 truncate text-xs font-medium text-white/90">{title}</span>
                </div>
                <div className={cn('p-5 sm:p-6', className)}>{children}</div>
            </div>
            {caption ? <figcaption className="mt-2.5 text-center text-[13px] text-zs-dim">{caption}</figcaption> : null}
        </figure>
    );
}

/** Numerowany znacznik na schematach. */
export function Pin({ n, className }: { n: number; className?: string }) {
    return (
        <span className={cn('inline-grid size-5 place-items-center rounded-full bg-zs-accent text-[11px] font-bold text-zs-accent-ink', className)}>{n}</span>
    );
}
