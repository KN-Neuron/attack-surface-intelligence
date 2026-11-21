import * as React from 'react';

/** Documentation reference table, styled like the app's tables. */
export function RefTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
    return (
        <div className="my-5 overflow-x-auto rounded-xl border border-zs-border bg-zs-surface">
            <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-zs-field">
                    <tr>
                        {head.map((h) => (
                            <th key={h} className="border-b border-zs-border px-4 py-3 text-[12.5px] font-semibold whitespace-nowrap text-zs-muted">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} className="border-b border-zs-border/60 last:border-0 even:bg-white/[0.02]">
                            {r.map((c, j) => (
                                <td key={j} className={`px-4 py-3 align-top ${j === 0 ? 'font-medium whitespace-nowrap text-zs-text' : 'text-zs-text/85'}`}>
                                    {c}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
