'use client';
import * as React from 'react';
import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    position?: 'left' | 'right';
    title?: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

/** Side panel (shadcn "Sheet" on Radix Dialog) — right for "Add …" forms, left for mobile navigation. */
export function Drawer({ open, onOpenChange, position = 'right', title, footer, className, children }: DrawerProps) {
    const right = position === 'right';
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-zs-deep/70 backdrop-blur-[2px] data-[state=closed]:animate-zs-fade-out data-[state=open]:animate-zs-fade-in" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className={cn(
                        'fixed top-0 z-50 flex h-full w-[min(92vw,380px)] flex-col bg-zs-surface text-zs-text shadow-zs-drawer outline-none',
                        right
                            ? 'right-0 border-l border-zs-border data-[state=closed]:animate-zs-slide-out-right data-[state=open]:animate-zs-slide-in-right'
                            : 'left-0 border-r border-zs-border data-[state=closed]:animate-zs-slide-out-left data-[state=open]:animate-zs-slide-in-left',
                        className
                    )}
                >
                    <div className="flex items-center justify-between px-6 pt-6 pb-4">
                        <Dialog.Title className="text-xl font-medium">{title}</Dialog.Title>
                        <Dialog.Close className="grid size-8 cursor-pointer place-items-center rounded-md text-zs-muted outline-none hover:bg-zs-hover hover:text-zs-text focus-visible:ring-2 focus-visible:ring-zs-accent/60" aria-label="Zamknij">
                            <X className="size-5" />
                        </Dialog.Close>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
                    {footer ? <div className="flex items-center justify-end gap-3 border-t border-zs-border px-6 py-4">{footer}</div> : null}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
