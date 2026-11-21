export type NavItem = { title: string; href: string; hint?: string };
export type NavGroup = { label?: string; items: NavItem[] };
export type NavSection = { id: string; title: string; icon: 'book' | 'server' | 'tags' | 'radar' | 'shield' | 'code' | 'palette'; groups: NavGroup[] };

export const nav: NavSection[] = [
    {
        id: 'start',
        title: 'Start',
        icon: 'book',
        groups: [
            {
                items: [
                    { title: 'Wprowadzenie i workflow', href: '/docs', hint: 'Pojęcia, workflow krok po kroku, mapa ekranów' },
                    { title: 'Architektura', href: '/docs/architektura', hint: 'Stos, moduły, model danych, konfiguracja, status funkcji' }
                ]
            }
        ]
    },
    {
        id: 'hosts',
        title: 'Hosty',
        icon: 'server',
        groups: [{ items: [{ title: 'Host management', href: '/docs/hosty', hint: 'Adresy IP, zakresy CIDR, FQDN, import CSV, Host groups' }] }]
    },
    {
        id: 'tagging',
        title: 'Tagowanie',
        icon: 'tags',
        groups: [
            {
                items: [
                    { title: 'Przegląd', href: '/docs/tagowanie', hint: 'Tag a grupa, trzy zastosowania, łączenie kryteriów' },
                    { title: 'Operacje na tagach', href: '/docs/tagowanie/operacje', hint: 'Nadawanie, zmiana, tagi w imporcie, wyszukiwanie' },
                    { title: 'API tagowania', href: '/docs/tagowanie/api', hint: 'Endpointy inwentarza i importu, kształty JSON, semantyka' },
                    { title: 'Konwencje', href: '/docs/tagowanie/konwencje', hint: 'Schemat nazw, tag czy grupa, higiena, zapytania SQL' }
                ]
            }
        ]
    },
    {
        id: 'scanning',
        title: 'Skanowanie i wyniki',
        icon: 'radar',
        groups: [
            {
                items: [
                    { title: 'Skanowanie', href: '/docs/skanowanie', hint: 'Scan Scheduling, cele, harmonogram, uruchomienie' },
                    { title: 'Wyniki i analiza', href: '/docs/wyniki', hint: 'Scan Results, Compare Scans, Data Explorer, Latest Scan summary' }
                ]
            }
        ]
    },
    {
        id: 'access',
        title: 'Administracja',
        icon: 'shield',
        groups: [{ items: [{ title: 'Dostęp i uprawnienia', href: '/docs/dostep', hint: 'Role, kto może co zrobić, Admin management' }] }]
    },
    {
        id: 'reference',
        title: 'Referencja',
        icon: 'code',
        groups: [{ items: [{ title: 'API HTTP', href: '/docs/api', hint: 'Konwencje i endpointy JSON' }] }]
    },
    {
        id: 'design',
        title: 'Design System',
        icon: 'palette',
        groups: [
            {
                items: [
                    { title: 'Kolory i tokeny', href: '/docs/design/theming', hint: 'Paleta Nightshade i mapowanie na zmienne aplikacji' },
                    { title: 'Komponenty aplikacji', href: '/docs/design/components', hint: 'Klasy CSS i atrybuty data-* interfejsu' }
                ]
            }
        ]
    }
];

export const flatNav: (NavItem & { section: string })[] = nav.flatMap((s) => s.groups.flatMap((g) => g.items.map((i) => ({ ...i, section: s.title }))));

export function findNav(href: string) {
    const index = flatNav.findIndex((i) => i.href === href);
    return { index, current: flatNav[index], prev: flatNav[index - 1], next: flatNav[index + 1] };
}
