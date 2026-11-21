import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function CardLink({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="group relative block rounded-xl border border-zs-border bg-zs-surface p-4 transition-colors hover:border-zs-border-strong">
            <ArrowUpRight className="absolute top-4 right-4 size-4 text-zs-dim transition-colors group-hover:text-zs-accent" />
            <p className="font-medium text-zs-text">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-zs-muted">{children}</p>
        </Link>
    );
}
