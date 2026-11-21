import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none', {
    variants: {
        variant: {
            default: 'border-zs-border-strong bg-zs-raised text-zs-muted',
            accent: 'border-zs-accent/30 bg-zs-accent/15 text-zs-accent',
            success: 'border-zs-success/30 bg-zs-success/10 text-zs-success',
            warn: 'border-zs-warn/30 bg-zs-warn/10 text-zs-warn',
            danger: 'border-zs-danger/30 bg-zs-danger/10 text-zs-danger'
        }
    },
    defaultVariants: { variant: 'default' }
});

export function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
