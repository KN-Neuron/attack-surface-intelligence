import * as React from 'react';
import { Link2 } from 'lucide-react';

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <h2 id={id} className="group scroll-mt-20 border-b border-zs-border pb-2 text-[26px] font-semibold tracking-tight text-zs-text">
            {children}
            <a href={`#${id}`} aria-label="Link do sekcji" className="ml-2 inline-block align-middle text-zs-dim opacity-0 transition-opacity group-hover:opacity-100 hover:text-zs-accent">
                <Link2 className="size-4" />
            </a>
        </h2>
    );
}

export function H3({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <h3 id={id} className="group scroll-mt-20 text-[19px] font-semibold tracking-tight text-zs-text">
            {children}
            <a href={`#${id}`} aria-label="Link do sekcji" className="ml-2 inline-block align-middle text-zs-dim opacity-0 transition-opacity group-hover:opacity-100 hover:text-zs-accent">
                <Link2 className="size-3.5" />
            </a>
        </h3>
    );
}
