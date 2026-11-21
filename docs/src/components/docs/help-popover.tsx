'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight, CircleHelp, FileText, Link2, Search, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Hint } from '@/components/ui/tooltip';
import { useAssistant } from '@/components/assistant/assistant-provider';
import { cn } from '@/lib/utils';

const STEPS = [
    {
        icon: Search,
        title: 'Znajdź stronę',
        body: 'Użyj menu po lewej albo wyszukiwarki w górnym pasku (skrót Ctrl K / ⌘K). Wpisz nazwę strony lub ekranu aplikacji, np. „tagowanie” albo „Host inventory”.'
    },
    {
        icon: FileText,
        title: 'Czytaj stronę',
        body: 'Po prawej widzisz spis treści bieżącej strony, a na dole przyciski „Poprzednia / Następna”. Przykłady kodu skopiujesz jednym kliknięciem.'
    },
    {
        icon: Link2,
        title: 'Idź za odnośnikami',
        body: 'Każdy fakt jest opisany w jednym miejscu. Gdy temat wraca na innej stronie, znajdziesz tam odnośnik do sekcji z pełnym opisem.'
    },
    {
        icon: Sparkles,
        title: 'Zapytaj asystenta',
        body: 'Przycisk ✦ otwiera panel z asystentem. Odpowiada na podstawie tej dokumentacji i wskazuje źródła, do których możesz od razu przejść.'
    }
] as const;

export function HelpPopover() {
    const [open, setOpen] = React.useState(false);
    const [step, setStep] = React.useState(0);
    const assistant = useAssistant();
    const s = STEPS[step];
    const Icon = s.icon;
    const last = step === STEPS.length - 1;

    return (
        <Popover
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (v) setStep(0);
            }}
        >
            <Hint label="Pomoc">
                <PopoverTrigger asChild>
                    <button type="button" aria-label="Pomoc" className="cursor-pointer rounded-md p-1.5 text-white/90 hover:bg-white/10 data-[state=open]:bg-white/15">
                        <CircleHelp className="size-5" />
                    </button>
                </PopoverTrigger>
            </Hint>
            <PopoverContent aria-label="Krótki tutorial">
                <div className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-[11px] font-semibold tracking-wide text-zs-dim uppercase">Krótki tutorial · {step + 1}/{STEPS.length}</p>
                        <div className="flex gap-1.5" role="tablist" aria-label="Kroki">
                            {STEPS.map((x, i) => (
                                <button key={x.title} type="button" role="tab" aria-selected={i === step} aria-label={`Krok ${i + 1}: ${x.title}`} onClick={() => setStep(i)} className={cn('h-1.5 cursor-pointer rounded-full transition-all', i === step ? 'w-5 bg-zs-accent' : 'w-1.5 bg-zs-border-strong hover:bg-zs-dim')} />
                            ))}
                        </div>
                    </div>
                    <div className="mb-3 grid size-10 place-items-center rounded-lg bg-zs-accent/15 text-zs-accent">
                        <Icon className="size-5" aria-hidden />
                    </div>
                    <h3 className="m-0 text-base font-semibold">{s.title}</h3>
                    <p className="mt-1.5 min-h-[4.5rem] text-sm leading-relaxed text-zs-muted">{s.body}</p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-zs-border px-3 py-2.5">
                    <button type="button" onClick={() => setStep((n) => n - 1)} disabled={step === 0} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2.5 text-sm text-zs-muted hover:bg-zs-hover hover:text-zs-text disabled:invisible">
                        <ChevronLeft className="size-4" /> Wstecz
                    </button>
                    {last ? (
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                assistant.setOpen(true);
                            }}
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-zs-accent px-3 text-sm font-medium text-zs-accent-ink hover:bg-zs-accent-strong"
                        >
                            <Sparkles className="size-4" /> Otwórz asystenta
                        </button>
                    ) : (
                        <button type="button" onClick={() => setStep((n) => n + 1)} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-zs-accent px-3 text-sm font-medium text-zs-accent-ink hover:bg-zs-accent-strong">
                            Dalej <ChevronRight className="size-4" />
                        </button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
