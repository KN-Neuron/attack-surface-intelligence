import type { Metadata } from 'next';
import { t } from '@/components/docs/inline';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { RefTable } from '@/components/ui/ref-table';

export const metadata: Metadata = { title: 'Wyniki i analiza' };

export default function Page() {
    return (
        <DocPage
            href="/docs/wyniki"
            title="Wyniki i analiza"
            lead="Ekrany do odczytu wyników: lista uruchomień (Scan Results), porównanie dwóch skanów (Compare Scans), historia obserwacji (Data Explorer) i dashboardy z Latest Scan summary."
            toc={[
                { id: 'wyniki', label: 'Scan Results' },
                { id: 'szczegoly', label: 'Szczegóły uruchomienia', level: 3 },
                { id: 'porownanie', label: 'Compare Scans' },
                { id: 'porownanie-czytanie', label: 'Jak czytać porównanie', level: 3 },
                { id: 'data-explorer', label: 'Data Explorer' },
                { id: 'data-explorer-przyklad', label: 'Przykład: gdzie wykryto Nginx', level: 3 },
                { id: 'dashboardy', label: 'Dashboardy' },
                { id: 'latest', label: 'Latest Scan summary', level: 3 },
                { id: 'technologies', label: 'Technologies used', level: 3 },
                { id: 'vulnerable', label: 'Vulnerable versions', level: 3 },
                { id: 'zrodlo', label: 'Źródło danych' }
            ]}
        >
            <Callout type="note" title="Dane przykładowe">
                Wszystkie ekrany tej strony pokazują dziś dane przykładowe zapisane przy pierwszym uruchomieniu aplikacji, a nie wyniki skanów wykonanych w Scan Management (<Link href="/docs/architektura#status">Architektura › Status funkcji</Link>). Opis dotyczy układu ekranów, ich sterowania i sposobu czytania danych.
            </Callout>

            <H2 id="wyniki">Scan Results</H2>
            <p>
                Ekran <code>Scan Results</code> (Scanning › Scan Results) to lista wykonanych uruchomień, od najnowszego. Pozwala odszukać konkretne uruchomienie po dacie i sprawdzić jego status.
            </p>
            <RefTable
                head={['Kolumna', 'Znaczenie']}
                rows={[
                    [<code key="a">Scan</code>, t('Nazwa uruchomienia, np. `Scan #57`; wyższy numer to późniejsze uruchomienie')],
                    [t('`Started`, `Finished`, `Duration`'), t('Czas rozpoczęcia i zakończenia (np. `Nov 21, 2026 7:14 AM`) oraz czas trwania w minutach')],
                    [<code key="c">Target</code>, 'Zakres, którego dotyczyło uruchomienie'],
                    [t('`Alive`, `Down`'), 'Liczba hostów, które odpowiedziały, i tych, które nie odpowiedziały'],
                    [t('`Services`, `Tech`, `Vulns`'), 'Liczba wykrytych usług, technologii i podatności'],
                    [<code key="f">Status</code>, t('`Completed` (zakończone), `Partial` (zakończone częściowo) albo `Failed` (nieudane)')]
                ]}
            />
            <ul>
                <li>
                    Lista nad tabelą ogranicza okres: <code>Last 24 hours</code>, <code>Last 7 days</code>, <code>Last 14 days</code>, <code>Last 30 days</code> (domyślnie), <code>Last 180 days</code>, <code>Last 365 days</code>, <code>All scans</code>.
                </li>
                <li>Stopka pokazuje liczbę uruchomień w wybranym okresie i pozwala przechodzić między stronami.</li>
                <li>
                    Skan, który właśnie trwa, widać w <Link href="/docs/skanowanie#stan">Scan Management</Link>, a nie na tej liście.
                </li>
            </ul>

            <H3 id="szczegoly">Szczegóły uruchomienia</H3>
            <p>
                Wiersze listy nie są dziś klikalne i aplikacja nie ma osobnego widoku szczegółów pojedynczego uruchomienia. Wszystko, co wiadomo o uruchomieniu, jest w jego wierszu. Aby przyjrzeć się uruchomieniu bliżej:
            </p>
            <ul>
                <li>
                    zestaw je z innym w <Link href="#porownanie">Compare Scans</Link>;
                </li>
                <li>
                    obejrzyj pojedyncze zdarzenia (hosty, usługi, technologie) w <Link href="#data-explorer">Data Explorer</Link>; zdarzenia nie są jednak oznaczone numerem uruchomienia, więc łączy się je z wierszem listy po czasie.
                </li>
            </ul>

            <H2 id="porownanie">Compare Scans</H2>
            <p>Ekran zestawia liczniki dwóch uruchomień z listy Scan Results.</p>
            <ol>
                <li>
                    Otwórz Scanning › <code>Compare Scans</code>. Sloty <code>Scan A</code> i <code>Scan B</code> są wstępnie wypełnione dwoma najnowszymi uruchomieniami (A to najnowsze, B poprzednie).
                </li>
                <li>
                    Kliknij <code>Select scan</code> pod slotem A. W oknie <code>Select scan A</code> wpisz w filtr fragment nazwy, daty lub zakresu (np. <code>10.0.3.0/24</code>) i kliknij uruchomienie, które ma być punktem odniesienia.
                </li>
                <li>
                    Powtórz to dla slotu B, wybierając uruchomienie, które chcesz ocenić.
                </li>
                <li>Tabela <code>Comparison</code> przelicza się od razu po wyborze.</li>
            </ol>
            <p>
                Do oceny zmian w jednym środowisku wybierz dwa uruchomienia o <strong>tym samym celu</strong> (ta sama wartość w kolumnie <code>Target</code>, widoczna pod nazwą w slocie i na liście wyboru) i ze statusem <code>Completed</code>. Porównanie skanów różnych zakresów albo skanu nieudanego pokaże różnicę wynikającą z zakresu, a nie ze zmian w sieci.
            </p>

            <H3 id="porownanie-czytanie">Jak czytać porównanie</H3>
            <RefTable
                head={['Metryka', 'Co oznacza', 'Kierunek korzystny']}
                rows={[
                    ['Alive hosts', 'Hosty, które odpowiedziały', 'wzrost'],
                    ['Hosts down', 'Hosty, które nie odpowiedziały', 'spadek'],
                    ['Services', 'Łączna liczba wykrytych usług', 'wzrost'],
                    ['Technologies', 'Łączna liczba wykrytych technologii', 'wzrost'],
                    ['Vulnerabilities', 'Łączna liczba wykrytych podatności', 'spadek']
                ]}
            />
            <ul>
                <li>
                    Kolumna <code>Change</code> pokazuje różnicę <strong>B − A</strong> i, gdy wartość w A jest większa od zera, zmianę procentową względem A. Wiersz jest wyróżniony jako poprawa, pogorszenie lub brak zmiany zgodnie z kierunkiem korzystnym.
                </li>
                <li>
                    Ponieważ różnica liczy się od A, wstaw do slotu A starsze uruchomienie (bazowe), a do B nowsze. Przy ustawieniu domyślnym (A nowsze) znaki zmian są odwrócone względem upływu czasu.
                </li>
                <li>
                    Porównanie operuje na <strong>sumach</strong>. <code>Services +12</code> oznacza, że w B wykryto o 12 usług więcej niż w A, a nie że pojawiło się 12 nowych: część usług mogła zniknąć, a inne się pojawić. Ekran nie pokazuje listy usług nowo wykrytych ani tych, które zniknęły; pojedyncze obserwacje sprawdzisz w <Link href="#data-explorer">Data Explorer</Link>.
                </li>
            </ul>

            <H2 id="data-explorer">Data Explorer</H2>
            <p>
                Data Explorer pokazuje pojedyncze obserwacje (zdarzenia) zebrane przez skanowanie: odpowiedzi hostów, otwarte porty, wykryte technologie i podatności. Tu sprawdzisz, na którym hoście i kiedy wykryto np. Nginx, Apache albo WordPress.
            </p>
            <RefTable
                head={['Element', 'Zawartość']}
                rows={[
                    [<code key="a">No.</code>, 'Numer porządkowy na liście'],
                    [<code key="b">Event Time</code>, t('Czas obserwacji, czyli moment, w którym skan wykrył zdarzenie, z dokładnością do sekundy, np. `Nov 21, 2026 9:11:02 AM`. Najnowsze na górze')],
                    [<code key="c">Host</code>, 'Adres IP, którego dotyczy obserwacja'],
                    [<code key="d">Category</code>, t('`Discovery`, `Service`, `Technology` lub `Vulnerability`')],
                    [<code key="e">Event</code>, t('Opis, np. `Detected nginx 1.24.0`, `TCP port 443 open (HTTPS)`, `Outdated OpenSSH 8.9p1 (CVE-2023-38408)`')],
                    [<code key="f">Severity</code>, t('`Info`, `Medium`, `High` lub `Critical`')],
                    ['Nagłówek', t('Okres danych (np. `Nov 21, 2026 09:14 AM - now`) i łączna liczba zdarzeń (`N Events Found`)')]
                ]}
            />
            <p>
                Jedynym filtrem jest pole <code>Search events</code> w panelu po lewej. Dopasowuje fragment tekstu w całym wierszu (host, opis, kategoria, poziom, czas), bez względu na wielkość liter, i działa w trakcie pisania; <code>Apply filter</code> stosuje filtr ponownie. Liczbę dopasowanych wierszy pokazuje stopka tabeli, a nie licznik <code>Events Found</code> w nagłówku, który zawsze podaje liczbę wszystkich zdarzeń.
            </p>
            <Callout type="warning" title="Brak filtrów po tagu i po czasie">
                Data Explorer nie ma dziś filtra po tagach hostów, pola początkowego znacznika czasu ani wyboru okresu: okres w nagłówku jest stały. Nie da się też łączyć kilku filtrów, bo pole wyszukiwania przyjmuje jedną frazę. Obejście dla tagów opisuje <Link href="/docs/tagowanie#data-explorer">Tagowanie › Data Explorer</Link>.
            </Callout>

            <H3 id="data-explorer-przyklad">Przykład: gdzie wykryto Nginx</H3>
            <ol>
                <li>
                    Otwórz <code>Data Explorer</code> i wpisz w <code>Search events</code> frazę <code>nginx</code>.
                </li>
                <li>
                    Lista zawęzi się do zdarzeń <code>Detected nginx …</code>. Z kolumny <code>Host</code> odczytaj adres, a z <code>Event Time</code> czas wykrycia.
                </li>
                <li>
                    Aby ograniczyć wynik do interesującego okresu, przejrzyj kolumnę <code>Event Time</code>: lista jest posortowana od najnowszych, więc zdarzenia sprzed wybranej chwili są na dalszych stronach.
                </li>
                <li>
                    Aby zawęzić wynik do hostów z tagiem, np. <code>serwery-www</code>, porównaj kolumnę <code>Host</code> z listą adresów o tym tagu z Host management.
                </li>
            </ol>
            <p>Gdy lista jest pusta, poszerz zapytanie:</p>
            <ul>
                <li>
                    skróć frazę: <code>nginx</code> zamiast <code>nginx 1.25</code>, bo wersja w opisie może być inna;
                </li>
                <li>
                    szukaj samej nazwy produktu, bez słów w rodzaju „serwer”, i sprawdź pisownię (<code>wordpress</code>, <code>apache</code>);
                </li>
                <li>
                    wyczyść pole, aby zobaczyć wszystkie zdarzenia z okresu w nagłówku, i upewnij się, że host w ogóle ma obserwacje.
                </li>
            </ul>

            <H2 id="dashboardy">Dashboardy</H2>
            <H3 id="latest">Latest Scan summary</H3>
            <p>
                Dashboard <code>Latest Scan summary</code> (Dashboards › Latest Scan summary) to skrót najnowszego wyniku. Pod tytułem widnieje <code>Latest scan</code> z datą i godziną skanu, którego dotyczy skrót, np. <code>November 21, 2026 09:14:02 AM</code>.
            </p>
            <RefTable
                head={['Element', 'Zawartość', 'Zależy od selektora okresu']}
                rows={[
                    [<code key="a">Reachable hosts</code>, t('Hosty, które odpowiedziały, i zmiana `… since last scan`'), 'tak'],
                    [<code key="b">Unreachable hosts</code>, t('Hosty, które nie odpowiedziały, i zmiana `… since last scan`'), 'tak'],
                    [<code key="c">Detected services</code>, 'Liczba wykrytych usług', 'tak'],
                    [<code key="d">Services by scan range</code>, 'Słupki liczby usług dla każdego okresu; kliknięcie słupka wybiera ten okres', 'wyróżnia wybrany słupek'],
                    [<code key="e">Service families</code>, 'Wykres kołowy usług według rodzin', 'nie'],
                    [t('`Most detected services`, `Most detected technologies`'), 'Najczęściej wykrywane usługi i technologie z wersją i liczbą hostów', 'nie']
                ]}
            />
            <ul>
                <li>
                    Selektor okresu w prawym górnym rogu (<code>Last 24 hours</code> … <code>Last 365 days</code>, domyślnie <code>Last 7 days</code>) zmienia wyłącznie trzy kafelki liczbowe i wyróżnienie słupka. Nie zmienia daty <code>Latest scan</code>, nie wybiera innego uruchomienia i nie wpływa na wykres rodzin ani tabele.
                </li>
                <li>
                    Odnośnik <code>Scan history</code> prowadzi do <Link href="#wyniki">Scan Results</Link> i jest widoczny tylko dla kont z dostępem do tego ekranu. <code>All technologies</code> prowadzi do <Link href="#technologies">Technologies used</Link>. Dashboard nie ma odnośnika do szczegółów konkretnego uruchomienia.
                </li>
                <li>
                    Którego uruchomienia dotyczy skrót, ustalisz po dacie <code>Latest scan</code>. W obecnej wersji z danymi przykładowymi ta data nie odpowiada żadnemu wierszowi Scan Results, więc nie da się jednoznacznie powiązać skrótu z uruchomieniem z listy.
                </li>
            </ul>

            <H3 id="technologies">Technologies used</H3>
            <p>
                Tabela technologii: <code>Technology</code>, <code>Version(s)</code>, <code>Category</code>, <code>Hosts</code>. Przycisk szczegółów otwiera okno z listą hostów, na których technologię wykryto: <code>Host</code>, <code>OS</code>, <code>Port</code>, <code>Service</code>, <code>First seen</code>, <code>Last seen</code>. Kolumny <code>First seen</code> i <code>Last seen</code> pokazują, od kiedy i do kiedy technologia była obserwowana na hoście.
            </p>
            <H3 id="vulnerable">Vulnerable versions</H3>
            <p>
                Tabela wykrytych wersji z podatnościami: <code>Service</code>, <code>Version</code>, <code>CVE</code> (odnośnik do NVD), <code>Severity</code>, <code>Hosts</code>. Przyciski <code>All</code>, <code>Critical</code>, <code>High</code> i <code>Medium</code> filtrują listę po poziomie i pokazują liczność każdego; obok widać liczbę unikalnych hostów, których dotyczą wyniki. Wybrany poziom i pole wyszukiwania (usługa, CVE, host) działają łącznie.
            </p>

            <H2 id="zrodlo">Źródło danych</H2>
            <p>Dla administratora: ekrany wynikowe czytają dokumenty z tabeli <code>app_data</code>, zapisywane przy pierwszym uruchomieniu i nigdy nienadpisywane.</p>
            <RefTable
                head={['Klucz w app_data', 'Ekran']}
                rows={[
                    [<code key="1">scan_history</code>, 'Scan Results i Compare Scans'],
                    [<code key="2">data_events</code>, 'Data Explorer'],
                    [<code key="3">timeline_points</code>, 'Latest Scan summary: kafelki i wykres okresów'],
                    [<code key="4">latest_scan</code>, 'Latest Scan summary: data Latest scan'],
                    [<code key="5">service_slices</code>, 'Latest Scan summary: Service families'],
                    [<code key="6">popular_services</code>, 'Latest Scan summary: Most detected services'],
                    [<code key="7">popular_technologies</code>, 'Latest Scan summary: Most detected technologies'],
                    [<code key="8">technologies</code>, 'Technologies used'],
                    [<code key="9">detected_vulns</code>, 'Vulnerable versions'],
                    [<code key="10">upcoming_scan</code>, 'Scan Management: karta Upcoming scan']
                ]}
            />
        </DocPage>
    );
}
