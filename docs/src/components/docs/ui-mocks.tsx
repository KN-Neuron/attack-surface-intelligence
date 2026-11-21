import * as React from 'react';
import { PortalFrame } from './portal-frame';

/** Statyczne podglądy fragmentów interfejsu aplikacji (nie są treścią indeksu RAG — to <figure>). */

export function Chip({ children, removable }: { children: React.ReactNode; removable?: boolean }) {
    return (
        <span className="inline-flex items-center gap-1 rounded border border-zs-border-strong bg-zs-raised px-2 py-0.5 text-xs text-zs-accent-strong">
            {children}
            {removable ? <span className="text-zs-dim">×</span> : null}
        </span>
    );
}

const rows: { value: string; tags: string[]; added: string }[] = [
    { value: '203.0.113.10', tags: ['env:prod', 'role:edge', 'exposure:external'], added: 'November 21, 2026 9:14:02 AM' },
    { value: '203.0.113.11', tags: ['env:prod', 'role:edge'], added: 'November 21, 2026 9:14:02 AM' },
    { value: '198.51.100.7', tags: [], added: 'November 20, 2026 4:02:51 PM' }
];

export function InventoryMock() {
    return (
        <PortalFrame title="Host inventory · IPs" caption="Kolumna Tags w tabeli IP. Wpis bez tagów pokazuje myślnik.">
            <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                    <tr className="text-zs-muted">
                        {['IP address', 'Tags', 'Added', 'Actions'].map((h) => (
                            <th key={h} className="border-b border-zs-border px-3 py-2 font-semibold">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.value} className="border-b border-zs-border/60 last:border-0">
                            <td className="px-3 py-2.5 font-mono text-zs-text">{r.value}</td>
                            <td className="px-3 py-2.5">
                                <div className="flex flex-wrap gap-1.5">{r.tags.length ? r.tags.map((t) => <Chip key={t}>{t}</Chip>) : <span className="text-zs-dim">—</span>}</div>
                            </td>
                            <td className="px-3 py-2.5 text-zs-dim">{r.added}</td>
                            <td className="px-3 py-2.5 text-zs-link">Edit · Remove</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </PortalFrame>
    );
}

export function TagInputMock() {
    return (
        <PortalFrame title="Add IP addresses" caption="Pole tagów: wpis + przycisk Add albo Enter; chipy usuwa się krzyżykiem.">
            <div className="max-w-md space-y-4 text-[13px]">
                <div>
                    <p className="mb-1.5 font-medium text-zs-text">IP addresses</p>
                    <div className="h-20 rounded border border-zs-border bg-zs-field px-3 py-2 font-mono text-zs-muted">
                        203.0.113.10
                        <br />
                        203.0.113.11
                    </div>
                </div>
                <div>
                    <p className="mb-1.5 font-medium text-zs-text">Tags (optional)</p>
                    <div className="flex gap-2">
                        <div className="h-8 flex-1 rounded border border-zs-border bg-zs-field px-3 leading-8 text-zs-dim">e.g. production</div>
                        <span className="inline-flex h-8 items-center rounded border border-zs-border-strong px-3 text-zs-text">+ Add</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        <Chip removable>env:prod</Chip>
                        <Chip removable>role:edge</Chip>
                    </div>
                </div>
            </div>
        </PortalFrame>
    );
}

export function ImportPreviewMock() {
    return (
        <PortalFrame title="Import hosts · Import preview" caption="Podgląd importu: liczniki i tagi przed zapisem. Nic nie jest zapisane do czasu Confirm.">
            <div className="max-w-md text-[13px]">
                <p className="text-base font-semibold text-zs-text">Import preview</p>
                <p className="mt-2 font-mono text-zs-muted">hosty.csv</p>
                <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                    {[
                        ['24', 'IPs'],
                        ['3', 'IP ranges'],
                        ['11', 'FQDNs'],
                        ['5', 'Duplicates'],
                        ['2', 'Skipped']
                    ].map(([value, label], i) => (
                        <div key={label} className={'rounded border border-zs-border px-1 py-2 ' + (i > 2 ? 'text-zs-dim' : 'text-zs-text')}>
                            <div className="text-base font-semibold">{value}</div>
                            <div className="text-[11px]">{label}</div>
                        </div>
                    ))}
                </div>
                <p className="mb-1.5 mt-4 font-medium text-zs-text">Tags (optional)</p>
                <div className="flex flex-wrap gap-1.5">
                    <Chip removable>serwery-www</Chip>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <span className="inline-flex h-8 items-center rounded border border-zs-border-strong px-3 text-zs-text">Cancel</span>
                    <span className="inline-flex h-8 items-center rounded bg-zs-brand px-3 font-medium text-white">Confirm</span>
                </div>
            </div>
        </PortalFrame>
    );
}
