'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Code, Palette, Radar, Server, ShieldCheck, Tags } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { nav } from '@/lib/nav';
import { cn } from '@/lib/utils';

const icons = { book: BookOpen, server: Server, tags: Tags, radar: Radar, shield: ShieldCheck, code: Code, palette: Palette } as const;

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const [open, setOpen] = React.useState<string[]>(nav.map((s) => s.id));

    return (
        <Accordion
            multiple
            value={open}
            onValueChange={(v) => setOpen(Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)])}
            className="flex flex-col gap-1"
        >
            {nav.map((section) => {
                const Icon = icons[section.icon];
                const hasActive = section.groups.some((g) => g.items.some((i) => i.href === pathname));
                return (
                    <AccordionItem key={section.id} value={section.id}>
                        <AccordionTrigger icon={<Icon className={cn('size-[18px] shrink-0', hasActive ? 'text-zs-accent' : 'text-zs-muted')} />}>
                            {section.title}
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="pb-2 pl-[22px]">
                                <div className="border-l border-zs-border pl-3">
                                    {section.groups.map((g, gi) => (
                                        <div key={gi} className="mt-1">
                                            {g.label ? <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zs-dim">{g.label}</p> : null}
                                            <ul className="flex flex-col gap-0.5">
                                                {g.items.map((item) => {
                                                    const active = item.href === pathname;
                                                    return (
                                                        <li key={item.href}>
                                                            <Link
                                                                href={item.href}
                                                                onClick={onNavigate}
                                                                aria-current={active ? 'page' : undefined}
                                                                className={cn(
                                                                    'relative block rounded-[9px] px-3 py-2 text-sm transition-colors',
                                                                    active ? 'bg-zs-active font-semibold text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-zs-accent' : 'text-zs-muted hover:bg-zs-hover hover:text-zs-text'
                                                                )}
                                                            >
                                                                {item.title}
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                );
            })}
        </Accordion>
    );
}
