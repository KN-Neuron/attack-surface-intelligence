'use client';
import * as React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function Faq({ items }: { items: { q: string; a: React.ReactNode }[] }) {
    const [open, setOpen] = React.useState<string | null>(null);
    return (
        <div data-faq className="my-5">
            {/* Treść dla indeksu RAG (zamknięte panele akordeonu nie trafiają do HTML-a). */}
            <dl hidden>
                {items.map((it, i) => (
                    <React.Fragment key={i}>
                        <dt>{it.q}</dt>
                        <dd>{it.a}</dd>
                    </React.Fragment>
                ))}
            </dl>
            <Accordion value={open} onValueChange={(v) => setOpen(v == null || Array.isArray(v) ? null : String(v))} className="my-0 divide-y divide-zs-border overflow-hidden rounded-lg border border-zs-border">
            {items.map((it, i) => (
                <AccordionItem key={i} value={String(i)}>
                    <AccordionTrigger className="rounded-none px-4 py-3.5 text-zs-text">{it.q}</AccordionTrigger>
                    <AccordionContent>
                        <div className="px-4 pb-4 text-[15px] leading-relaxed text-zs-text/80">{it.a}</div>
                    </AccordionContent>
                </AccordionItem>
            ))}
            </Accordion>
        </div>
    );
}
