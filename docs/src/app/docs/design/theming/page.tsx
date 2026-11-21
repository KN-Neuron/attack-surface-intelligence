import type { Metadata } from 'next';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { CodeBlock } from '@/components/ui/code-block';
import Link from 'next/link';
import { Callout } from '@/components/ui/callout';
import { RefTable } from '@/components/ui/ref-table';

export const metadata: Metadata = { title: 'Kolory i tokeny' };

const groups: { title: string; items: { name: string; var: string; hex: string; use: string }[] }[] = [
    {
        title: 'Powierzchnie',
        items: [
            { name: 'deep', var: '--color-zs-deep', hex: '#07060f', use: 'Tło za panelami, overlay' },
            { name: 'bg', var: '--color-zs-bg', hex: '#0b0a12', use: 'Tło strony i menu bocznego' },
            { name: 'side', var: '--color-zs-side', hex: '#0e0d17', use: 'Menu boczne' },
            { name: 'surface', var: '--color-zs-surface', hex: '#131220', use: 'Panele, karty, tabele, drawer' },
            { name: 'raised', var: '--color-zs-raised', hex: '#181628', use: 'Kody w tekście, wyróżnione tła' },
            { name: 'field', var: '--color-zs-field', hex: '#0f0e1a', use: 'Pola formularzy, nagłówki tabel' },
            { name: 'hover', var: '--color-zs-hover', hex: '#1e1b32', use: 'Najechana pozycja menu, wiersz, przycisk' },
            { name: 'active', var: '--color-zs-active', hex: '#2a2450', use: 'Aktywna pozycja menu bocznego' },
            { name: 'border', var: '--color-zs-border', hex: '#25223a', use: 'Obramowania, separatory' },
            { name: 'border-strong', var: '--color-zs-border-strong', hex: '#343052', use: 'Obramowania okien, pola w stanie hover' }
        ]
    },
    {
        title: 'Marka i akcenty',
        items: [
            { name: 'brand', var: '--color-zs-brand', hex: '#5b3fd9', use: 'Górny pasek, przyciski główne, aktywne przełączniki' },
            { name: 'brand-hi', var: '--color-zs-brand-hi', hex: '#6e52ea', use: 'Stan hover elementów marki i bąbelka użytkownika w asystencie' },
            { name: 'accent', var: '--color-zs-accent', hex: '#a78bfa', use: 'Przycisk główny, aktywne przełączniki, podkreślenie zakładki' },
            { name: 'accent-strong', var: '--color-zs-accent-strong', hex: '#c4b5fd', use: 'Hover akcentu, kod w tekście' },
            { name: 'link', var: '--color-zs-link', hex: '#b7a3ff', use: 'Linki, nieaktywne zakładki' }
        ]
    },
    {
        title: 'Statusy',
        items: [
            { name: 'success', var: '--color-zs-success', hex: '#5fd3a0', use: 'Poprawa, stan „Enabled”, wskaźnik działającego asystenta ' },
            { name: 'warn', var: '--color-zs-warn', hex: '#f2c14e', use: 'Ostrzeżenia, poziom Medium' },
            { name: 'danger', var: '--color-zs-danger', hex: '#ff6b7d', use: 'Błędy, pogorszenie, poziom Critical' }
        ]
    },
    {
        title: 'Wykresy',
        items: [
            { name: 'chart-1', var: '--color-zs-chart-1', hex: '#8b6cff', use: 'Seria główna: Web (HTTP/HTTPS), WordPress' },
            { name: 'chart-2', var: '--color-zs-chart-2', hex: '#2dd4bf', use: 'Seria druga: SSH, Node.js' },
            { name: 'chart-3', var: '--color-zs-chart-3', hex: '#f2c14e', use: 'Seria trzecia: DNS, nginx' },
            { name: 'chart-4', var: '--color-zs-chart-4', hex: '#f472b6', use: 'Seria czwarta: Database, PHP' },
            { name: 'chart-5', var: '--color-zs-chart-5', hex: '#ff9a62', use: 'Seria piąta: Remote desktop, Joomla' },
            { name: 'bar', var: '--color-zs-bar', hex: '#a78bfa', use: 'Słupek względnej liczności w tabelach' }
        ]
    },
    {
        title: 'Tekst',
        items: [
            { name: 'text', var: '--color-zs-text', hex: '#ece9f7', use: 'Treść podstawowa' },
            { name: 'muted', var: '--color-zs-muted', hex: '#a09bb8', use: 'Opisy, etykiety pomocnicze' },
            { name: 'dim', var: '--color-zs-dim', hex: '#736e8d', use: 'Nagłówki grup, placeholdery' }
        ]
    }
];

export default function Page() {
    return (
        <DocPage
            href="/docs/design/theming"
            title="Kolory i tokeny"
            lead="Jedna paleta „Nightshade” dla dokumentacji i aplikacji: grafitowy fiolet na powierzchniach, fioletowa marka i jasnofioletowy akcent. Zapisana jako tokeny Tailwind v4 i zmienne CSS."
            toc={[
                { id: 'paleta', label: 'Paleta' },
                { id: 'gradient', label: 'Górny pasek', level: 3 },
                { id: 'typografia', label: 'Typografia' },
                { id: 'aplikacja', label: 'Zgodność z aplikacją' },
                { id: 'zasady', label: 'Zasady stylu', level: 3 },
                { id: 'uzycie', label: 'Użycie w aplikacji' }
            ]}
        >
            <H2 id="paleta">Paleta</H2>
            <p>
                Interfejs jest ciemny, z powierzchniami w odcieniach grafitowego fioletu. Fioletowa marka (<code>brand</code>) to górny pasek i przyciski główne, a jaśniejszy akcent (<code>accent</code>) – linki, zakładki i fokus. Kolory statusów są celowo spoza
                gamy fioletów, żeby błąd i sukces nigdy nie mylił się z marką.
            </p>

            <div className="mt-6 space-y-8">
                {groups.map((g) => (
                    <div key={g.title}>
                        <h3 className="mb-3 text-sm font-semibold tracking-wide text-zs-muted uppercase">{g.title}</h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {g.items.map((c) => (
                                <div key={c.name} className="overflow-hidden rounded-lg border border-zs-border bg-zs-surface/40">
                                    <div className="h-14 border-b border-zs-border" style={{ background: `var(${c.var})` }} />
                                    <div className="p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-zs-text">{c.name}</span>
                                            <code className="!border-0 !bg-transparent !p-0 text-xs !text-zs-muted">{c.hex}</code>
                                        </div>
                                        <p className="mt-1 text-xs leading-relaxed text-zs-muted">{c.use}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <H3 id="gradient">Górny pasek</H3>
            <div className="h-12 rounded-lg bg-zs-brand" />
            <p>
                Pasek jest jednolity (<code>brand</code>), bez gradientu – tak samo w aplikacji i w dokumentacji. Ikony i tekst na nim są białe (kontrast około 7:1); wyjątkiem jest biały przycisk asystenta z fioletową ikoną. Wariant <code>brand-hi</code> służy tylko do stanu hover.
            </p>

            <H2 id="typografia">Typografia</H2>
            <p>Aplikacja używa kroju Open Sans (pliki w <code>static/fonts</code>) z rezerwą w postaci fontów systemowych. Dokumentacja używa Inter Variable oraz JetBrains Mono dla kodu.</p>
            <div className="not-prose my-4 rounded-lg border border-zs-border bg-zs-surface/40 p-5">
                <p className="text-[34px] leading-tight font-semibold tracking-tight">Nagłówek strony</p>
                <p className="mt-2 text-[26px] font-normal tracking-tight">Tytuł widżetu lub sekcji</p>
                <p className="mt-2 text-[15px]">Tekst podstawowy w tabelach i opisach. Host inventory, Tags, Added.</p>
                <p className="mt-2 font-mono text-[13px] text-zs-accent-strong">203.0.113.10 — env:prod, role:edge</p>
            </div>

            <H2 id="aplikacja">Zgodność z aplikacją</H2>
            <p>
                Aplikacja Visibly używa tej samej palety jako zmiennych CSS w <code>static/app.css</code>. Poniższa tabela mapuje tokeny dokumentacji na zmienne aplikacji; aplikacja ma dodatkowo jasny motyw
                (<code>[data-theme=&quot;light&quot;]</code>) zbudowany z tych samych odcieni marki.
            </p>
            <RefTable
                head={['Token dokumentacji', 'Zmienna w aplikacji', 'Ciemny', 'Jasny']}
                rows={[
                    [<code key="a">bg</code>, <code key="a2">--canvas</code>, '#0b0a12', '#f6f5fb'],
                    [<code key="b0">side</code>, <code key="b1">--sidebar</code>, '#0e0d17', '#f0eefa'],
                    [<code key="b">surface</code>, <code key="b2">--card</code>, '#131220', '#ffffff'],
                    [<code key="c">raised</code>, <code key="c2">--card-alt</code>, '#181628', '#f4f2fb'],
                    [<code key="c0">field</code>, <code key="c1">--input-bg</code>, '#0f0e1a', '#ffffff'],
                    [<code key="d">hover</code>, <code key="d2">--hover-bg</code>, '#1e1b32', '#efecf9'],
                    [<code key="d0">active</code>, <code key="d1">--sidebar-active</code>, '#2a2450', '#e3dcff'],
                    [<code key="e">border</code>, <code key="e2">--border</code>, '#25223a', '#ddd9ee'],
                    [<code key="f">text</code>, <code key="f2">--text</code>, '#ece9f7', '#1a1630'],
                    [<code key="g">muted</code>, <code key="g2">--text-dim</code>, '#a09bb8', '#55506f'],
                    [<code key="h">dim</code>, <code key="h2">--text-mute</code>, '#736e8d', '#7f7a99'],
                    [<code key="i">brand</code>, <code key="i2">--topbar</code>, '#5b3fd9', '#5b3fd9'],
                    [<code key="j">accent</code>, <code key="j2">--accent</code>, '#a78bfa', '#5b3fd9'],
                    [<code key="k">link</code>, <code key="k2">--link</code>, '#b7a3ff', '#5b3fd9'],
                    [<code key="l">success</code>, <code key="l2">--good</code>, '#5fd3a0', '#1f8f5e'],
                    [<code key="m">danger</code>, <code key="m2">--bad</code>, '#ff6b7d', '#d03a52']
                ]}
            />
            <H3 id="zasady">Zasady stylu</H3>
            <p>
                Reguły poniżej obowiązują ekrany z klasą <code>screen-redesign</code> na elemencie <code>body</code> (wszystkie ekrany aplikacji poza Data Explorer, Latest Scan summary i logowaniem) oraz Latest Scan summary. Pozostałe ekrany (Data Explorer, logowanie) mają mniejszy promień (4 px) i kontrolki o wysokości 31 px. Klasy i atrybuty opisuje strona{' '}
                <Link href="/docs/design/components#klasy">Komponenty aplikacji</Link>.
            </p>
            <RefTable
                head={['Element', 'Zasada']}
                rows={[
                    ['Karty i tabele', 'Tło „surface”, obramowanie 1 px, promień 12 px, bez cieni'],
                    ['Kontrolki', 'Wysokość 34 px, promień 9 px, tło „field”, obramowanie 1 px; fokus to obwódka w kolorze akcentu'],
                    ['Przycisk główny', 'Jednolity „brand”, biały tekst, hover „brand-hi”; bez gradientów i poświat'],
                    ['Zakładki', 'Podkreślenie 2 px w kolorze akcentu, aktywna zakładka jaśniejsza i pogrubiona'],
                    ['Menu boczne', 'Aktywna pozycja na tle „active” z pionowym paskiem akcentu po lewej'],
                    ['Statusy', 'Zawsze kolory success / warn / danger, nigdy kolor marki'],
                    ['Ruch', 'Krótkie przejścia, a przy ustawieniu „ogranicz ruch” bez animacji']
                ]}
            />

            <H2 id="uzycie">Użycie w aplikacji</H2>
            <p>
                Paleta żyje w <code>static/app.css</code> jako zmienne na <code>:root</code> (ciemny motyw), a jasny motyw nadpisuje je w bloku <code>[data-theme=&quot;light&quot;]</code>. Komponenty odwołują się wyłącznie do zmiennych, więc zmiana palety nie wymaga edycji reguł.
            </p>
            <CodeBlock
                lang="css"
                title="static/app.css"
                code={`:root {
    --topbar: #5b3fd9;
    --canvas: #0b0a12;
    --card: #131220;
    --border: #25223a;
    --text: #ece9f7;
    --accent: #a78bfa;
    --link: #b7a3ff;
}

[data-theme="light"] {
    --canvas: #f6f5fb;
    --card: #ffffff;
    --border: #ddd9ee;
    --text: #1a1630;
    --accent: #5b3fd9;
    --link: #5b3fd9;
}`}
            />
            <Callout type="note" title="Dokumentacja ma tylko ciemny motyw">
                Tokeny <code>zs-*</code> dokumentacji odpowiadają ciemnym wartościom zmiennych aplikacji. Jasny wariant istnieje tylko w aplikacji.
            </Callout>
        </DocPage>
    );
}
