import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { findNav } from '@/lib/nav';
import { Toc, type TocItem } from './toc';

interface DocPageProps {
    href: string;
    title: string;
    lead: React.ReactNode;
    toc: TocItem[];
    children: React.ReactNode;
}

export function DocPage({ href, title, lead, toc, children }: DocPageProps) {
    const { current, prev, next } = findNav(href);
    return (
        <div className="mx-auto flex w-full max-w-[1180px] gap-12 px-6 py-10 lg:px-10">
            <article className="min-w-0 flex-1">
                <p className="mb-3 flex items-center gap-2 text-sm text-zs-muted">
                    <span>Docs</span>
                    <ChevronRight className="size-3.5 text-zs-dim" />
                    <span>{current?.section}</span>
                </p>
                <h1 className="text-[34px] leading-tight font-semibold tracking-tight">{title}</h1>
                <p className="mt-3 max-w-3xl text-lg leading-relaxed text-zs-muted">{lead}</p>
                <div className="my-8 h-px bg-zs-border" />

                <div className="prose-zs">{children}</div>

                <nav className="mt-16 grid gap-4 border-t border-zs-border pt-8 sm:grid-cols-2" aria-label="Poprzednia i następna strona">
                    {prev ? (
                        <Link href={prev.href} className="group rounded-xl border border-zs-border p-4 transition-colors hover:border-zs-border-strong hover:bg-zs-surface">
                            <span className="flex items-center gap-1 text-xs text-zs-dim">
                                <ChevronLeft className="size-3.5" /> Poprzednia
                            </span>
                            <span className="mt-1 block font-medium text-zs-link group-hover:text-zs-accent-strong">{prev.title}</span>
                        </Link>
                    ) : (
                        <span />
                    )}
                    {next ? (
                        <Link href={next.href} className="group rounded-xl border border-zs-border p-4 text-right transition-colors hover:border-zs-border-strong hover:bg-zs-surface sm:col-start-2">
                            <span className="flex items-center justify-end gap-1 text-xs text-zs-dim">
                                Następna <ChevronRight className="size-3.5" />
                            </span>
                            <span className="mt-1 block font-medium text-zs-link group-hover:text-zs-accent-strong">{next.title}</span>
                        </Link>
                    ) : null}
                </nav>
            </article>

            <aside className="hidden w-56 shrink-0 xl:block group-data-[assistant=open]/shell:xl:hidden min-[1920px]:group-data-[assistant=open]/shell:xl:block">
                <div className="sticky top-[84px]">
                    <Toc items={toc} />
                </div>
            </aside>
        </div>
    );
}
