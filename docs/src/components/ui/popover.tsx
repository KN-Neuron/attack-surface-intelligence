'use client';
import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverClose = PopoverPrimitive.Close;

function PopoverContent({ className, align = 'end', sideOffset = 10, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                align={align}
                sideOffset={sideOffset}
                collisionPadding={12}
                className={cn(
                    'z-50 w-[min(calc(100vw-24px),360px)] rounded-xl border border-zs-border-strong bg-zs-surface p-0 text-zs-text shadow-2xl outline-none data-[state=closed]:animate-zs-fade-out data-[state=open]:animate-zs-fade-in',
                    className
                )}
                {...props}
            />
        </PopoverPrimitive.Portal>
    );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverClose };
