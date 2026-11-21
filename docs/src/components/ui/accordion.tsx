'use client';
import * as React from 'react';
import { Accordion as RadixAccordion } from 'radix-ui';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Value = string | string[] | null | undefined;

interface AccordionProps {
    value?: Value;
    onValueChange?: (value: Value) => void;
    multiple?: boolean;
    className?: string;
    children: React.ReactNode;
}

/** Controlled accordion. `multiple` -> string[] value, otherwise a single string (or null when closed). */
export function Accordion({ value, onValueChange, multiple, className, children }: AccordionProps) {
    if (multiple) {
        return (
            <RadixAccordion.Root type="multiple" value={Array.isArray(value) ? value : []} onValueChange={(v) => onValueChange?.(v)} className={className}>
                {children}
            </RadixAccordion.Root>
        );
    }
    return (
        <RadixAccordion.Root
            type="single"
            collapsible
            value={typeof value === 'string' ? value : ''}
            onValueChange={(v) => onValueChange?.(v === '' ? null : v)}
            className={className}
        >
            {children}
        </RadixAccordion.Root>
    );
}

export function AccordionItem({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
    return (
        <RadixAccordion.Item value={value} className={className}>
            {children}
        </RadixAccordion.Item>
    );
}

export function AccordionTrigger({ className, children, icon }: { className?: string; children: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <RadixAccordion.Header className="m-0! flex">
            <RadixAccordion.Trigger
                className={cn(
                    'group/trigger flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-[15px] text-zs-link outline-none transition-colors hover:bg-zs-hover focus-visible:ring-2 focus-visible:ring-zs-accent/50',
                    className
                )}
            >
                {icon}
                <span className="flex-1">{children}</span>
                <ChevronDown className="size-4 shrink-0 text-zs-muted transition-transform group-data-[state=open]/trigger:rotate-180" />
            </RadixAccordion.Trigger>
        </RadixAccordion.Header>
    );
}

export function AccordionContent({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <RadixAccordion.Content className="overflow-hidden data-[state=closed]:animate-zs-accordion-up data-[state=open]:animate-zs-accordion-down">
            <div className={className}>{children}</div>
        </RadixAccordion.Content>
    );
}
