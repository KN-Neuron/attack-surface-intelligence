'use client';
import * as React from 'react';

type Ctx = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void };
const AssistantCtx = React.createContext<Ctx | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false);
    const value = React.useMemo<Ctx>(() => ({ open, setOpen, toggle: () => setOpen((o) => !o) }), [open]);
    return <AssistantCtx.Provider value={value}>{children}</AssistantCtx.Provider>;
}

export function useAssistant() {
    const ctx = React.useContext(AssistantCtx);
    if (!ctx) throw new Error('useAssistant must be used inside <AssistantProvider>');
    return ctx;
}
