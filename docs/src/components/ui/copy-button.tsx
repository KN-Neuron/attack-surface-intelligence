'use client';
import * as React from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({ text }: { text: string }) {
    const [done, setDone] = React.useState(false);
    return (
        <button
            type="button"
            aria-label="Kopiuj"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-zs-muted transition-colors hover:bg-zs-hover hover:text-zs-text"
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    setDone(true);
                    setTimeout(() => setDone(false), 1500);
                } catch {
                    /* clipboard unavailable */
                }
            }}
        >
            {done ? <Check className="size-3.5 text-zs-success" /> : <Copy className="size-3.5" />}
            {done ? 'Skopiowano' : 'Kopiuj'}
        </button>
    );
}
