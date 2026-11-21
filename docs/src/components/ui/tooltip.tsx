'use client';
import * as React from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

function TooltipProvider({ delayDuration = 200, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
    return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({ className, sideOffset = 8, children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
    return (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
                sideOffset={sideOffset}
                className={cn(
                    'z-50 max-w-xs rounded-md border border-zs-border-strong bg-zs-raised px-2.5 py-1.5 text-xs text-zs-text shadow-xl data-[state=closed]:animate-zs-fade-out data-[state=delayed-open]:animate-zs-fade-in data-[state=instant-open]:animate-zs-fade-in',
                    className
                )}
                {...props}
            >
                {children}
                <TooltipPrimitive.Arrow className="fill-zs-raised" />
            </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
    );
}

/** Convenience wrapper: <Hint label="Edit"><button/></Hint> */
function Hint({ label, side = 'bottom', children }: { label: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; children: React.ReactElement }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={side}>{label}</TooltipContent>
        </Tooltip>
    );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Hint };
