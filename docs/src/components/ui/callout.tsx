import * as React from 'react';
import { Info, Lightbulb, TriangleAlert, OctagonAlert } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const callout = cva('my-6 flex gap-3 rounded-xl border border-zs-border bg-zs-surface px-4 py-3.5 text-sm leading-relaxed', {
    variants: {
        type: {
            note: '[&_svg]:text-zs-accent',
            tip: '[&_svg]:text-zs-success',
            warning: '[&_svg]:text-zs-warn',
            danger: '[&_svg]:text-zs-danger'
        }
    },
    defaultVariants: { type: 'note' }
});

const icons = { note: Info, tip: Lightbulb, warning: TriangleAlert, danger: OctagonAlert } as const;
const labels = { note: 'Uwaga', tip: 'Wskazówka', warning: 'Ostrzeżenie', danger: 'Ważne' } as const;

export function Callout({ type = 'note', title, className, children }: VariantProps<typeof callout> & { title?: string; className?: string; children: React.ReactNode }) {
    const t = type ?? 'note';
    const Icon = icons[t];
    return (
        <div role="note" className={cn(callout({ type }), className)}>
            <Icon className="mt-0.5 size-[18px] shrink-0" />
            <div className="min-w-0 text-zs-text/90">
                <p className="mb-1 font-semibold text-zs-text">{title ?? labels[t]}</p>
                <div className="[&_p+p]:mt-2">{children}</div>
            </div>
        </div>
    );
}
