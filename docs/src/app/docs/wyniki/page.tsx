import type { Metadata } from 'next';
import { t } from '@/components/docs/inline';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { RefTable } from '@/components/ui/ref-table';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Wyniki i analiza' };

export default function Page() {
    return (
        <DocPage
            href="/docs/wyniki"
            title="Wyniki i analiza"
            lead="Ekrany do odczytu wyników: lista uruchomień z oknem szczegółów (Scan Results), porównanie dwóch skanów (Compare Scans) i dashboardy. Stan hostów opisuje Data Explorer, a zmiany Alerts."
            toc={[
                { id: 'dane', label: 'Które dane są prawdziwe' },
                { id: 'wyniki', label: 'Scan Results' },
                { id: 'szczegoly', label: 'Szczegóły uruchomienia', level: 3 },
                { id: 'porownanie', label: 'Compare Scans' },
                { id: 'porownanie-czytanie', label: 'Jak czytać porównanie', level: 3 },
                { id: 'dashboardy', label: 'Dashboardy' },
                { id: 'latest', label: 'Latest Scan summary', level: 3 },
                { id: 'technologies', label: 'Technologies used', level: 3 },
                { id: 'vulnerable', label: 'Vulnerable versions', level: 3 },
                { id: 'zrodlo', label: 'Źródło danych' }
            ]}
        >
            <H2 id="dane">Które dane są prawdziwe</H2>
            <p>
                Skan uruchomiony w aplikacji zapisuje wyniki do własnych tabel, a część ekranów nadal czyta dane przykładowe zapisane przy pierwszym uruchomieniu. Podział dla każdego ekranu jest w tabeli <Link href="#zrodlo">Źródło danych</Link>; skrót:
            </p>
            <RefTable
                head={['Ekran', 'Dane']}
                rows={[
                    ['Scan Results, okno Scan details, Data Explorer, Alerts, kafelki Open alerts i Latest scan', <Badge key="1" variant="success">z prawdziwych skanów</Badge>],
                    ['Compare Scans, Technologies used, Vulnerable versions, pozostałe kafelki i tabele Latest Scan summary', <Badge key="2" variant="warn">dane przykładowe</Badge>]
                ]}
            />
            <p>
                Wiersze przykładowe w Scan Results mają znacznik <code>Demo</code>, aby świeża instalacja nie była pusta.
            </p>

            <H2 id="wyniki">Scan Results</H2>
            <p>
                Ekran <code>Scan Results</code> (Scanning › Scan Results) to lista uruchomień: najpierw prawdziwe, od najnowszego, potem wiersze <code>Demo</code>. Prawdziwych wierszy jest najwyżej 200 najnowszych. Ekran pozwala odszukać uruchomienie po dacie i sprawdzić jego status.
            </p>
            <RefTable
                head={['Kolumna', 'Znaczenie']}
                rows={[
                    [<code key="a">Scan</code>, <>Etykieta uruchomienia: nazwa konfiguracji albo <code>Manual scan</code> dla skanu ręcznego (<Link key="a1" href="/docs/skanowanie#sposoby">Cztery sposoby uruchomienia</Link>). Wiersze przykładowe mają znacznik <code>Demo</code></>],
                    [<code key="b">Type</code>, <><code>Full scan test</code> albo <code>Reachability</code> (<Link key="b1" href="/docs/skanowanie#typy">Typy skanu</Link>)</>],
                    [t('`Started`, `Finished`, `Duration`'), t('Czas rozpoczęcia i zakończenia (UTC, np. `Nov 21, 2026 7:14 AM`) oraz czas trwania w pełnych minutach: skan krótszy niż minuta ma `0m`. W trakcie skanu `Finished` i `Duration` mają wartość `—`')],
                    [<code key="c">Target</code>, t('Pierwsze cztery adresy skanu i `+N more`; pełna lista w oknie szczegółów')],
                    [t('`Alive`, `Down`'), 'Liczba hostów, które odpowiedziały, i tych, które nie odpowiedziały w tym uruchomieniu'],
                    [t('`Services`, `Tech`, `Vulns`'), t('`Services` i `Tech` liczą hosty, dla których zapisano co najmniej jedną usługę lub technologię (także z wcześniejszego skanu Full, gdy bieżący był typu Reachability). `Vulns` nie jest dziś wyliczane dla prawdziwych skanów i pokazuje 0; dopasowania do znanych podatności widać w Alerts jako `New CVE`')],
                    [<code key="e">Alerts</code>, 'Liczba alertów, które wygenerował ten skan, jako znaczek; 0 oznacza brak nowych alertów'],
                    [<code key="f">Status</code>, t('`Running`, `Completed`, `Cancelled` lub `Failed`; wiersze przykładowe mogą mieć też `Partial`')],
                    [<code key="g">Details</code>, 'Otwiera okno szczegółów uruchomienia']
                ]}
            />
            <ul>
                <li>
                    Lista nad tabelą ogranicza okres: <code>Last 24 hours</code>, <code>Last 7 days</code>, <code>Last 14 days</code>, <code>Last 30 days</code> (domyślnie), <code>Last 180 days</code>, <code>Last 365 days</code>, <code>All scans</code>.
                </li>
                <li>Stopka pokazuje liczbę uruchomień w wybranym okresie i pozwala przechodzić między stronami.</li>
                <li>
                    Skan, który właśnie trwa, jest na liście od startu (status <code>Running</code>); jego postęp na żywo widać w <Link href="/docs/skanowanie#stan">Scan Status</Link>.
                </li>
            </ul>

            <H3 id="szczegoly">Szczegóły uruchomienia</H3>
            <p>
                Przycisk <code>Details</code> otwiera okno z podsumowaniem pojedynczego uruchomienia. Nagłówek podaje etykietę oraz typ i silnik (np. <code>Full scan test · httpx</code>).
            </p>
            <RefTable
                head={['Część okna', 'Zawartość']}
                rows={[
                    ['Metadane', t('`Status`, `Trigger` (`manual`, `policy` albo `scheduled`), `Started`, `Finished`, `Duration`')],
                    ['Kafle liczników', t('`Hosts in scope`, `Reachable`, `Unreachable`, `Services`, `Technologies`, `Vulnerable matches` (jak `Vulns` w liście, dziś 0)')],
                    [<code key="a">Alerts raised</code>, <>Podział alertów tego skanu: <code>New hosts</code>, <code>Hosts down</code>, <code>New CVEs</code> oraz <code>Still unacknowledged</code>, czyli ile z nich nadal czeka na potwierdzenie (<Link key="a1" href="/docs/alerty">Alerty</Link>)</>],
                    [<code key="b">Targets</code>, 'Adresy, które skan rozwiązał z celów konfiguracji (pierwsze cztery i licznik pozostałych)'],
                    [t('`Top technologies`, `Top services`'), 'Do ośmiu pozycji z liczbą hostów, na których występują'],
                    ['Baner', t('Gdy uruchomienie zakończyło się błędem (`Failed`) albo lista celów została skrócona, nad licznikami widać komunikat, np. brak programu httpx lub `Target list truncated: …`')]
                ]}
            />
            <ul>
                <li>
                    Dla wierszy <code>Demo</code> okno jest syntetyzowane z danych przykładowych i nie zawiera list celów, technologii i usług.
                </li>
                <li>
                    Dane okna pobiera endpoint <code>GET /api/scans/{'{id}'}</code>. Jego ścieżka podpada pod prefiks <code>/api/scan</code>, więc wymaga <strong>odczytu strony Scan Status</strong>, a nie Scan Results (<Link href="/docs/dostep#sciezki">Dostęp i uprawnienia</Link>). Konto bez tego uprawnienia, np. rola startowa <code>Analyst</code>, widzi listę, ale <code>Details</code> nie załaduje szczegółów.
                </li>
                <li>
                    Szczegóły hostów z tego uruchomienia odczytasz w <Link href="/docs/data-explorer">Data Explorer</Link>: kolumna <code>Last scan</code> zawiera numer ostatniego skanu, który objął host, ale numer ten nie jest pokazany w liście Scan Results, więc łączy się je po czasie.
                </li>
            </ul>

            <H2 id="porownanie">Compare Scans</H2>
            <Callout type="warning" title="Compare Scans czyta tylko dane przykładowe">
                Sloty <code>Scan A</code> i <code>Scan B</code> oferują wyłącznie uruchomienia przykładowe (<code>Scan #…</code>). Skanów wykonanych w aplikacji tu nie ma, więc do oceny zmian w prawdziwym środowisku użyj Alerts i Data Explorer. Opis poniżej dotyczy sposobu czytania zestawienia.
            </Callout>
            <p>Ekran zestawia liczniki dwóch uruchomień.</p>
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
                    Porównanie operuje na <strong>sumach</strong>. <code>Services +12</code> oznacza, że w B wykryto o 12 usług więcej niż w A, a nie że pojawiło się 12 nowych: część usług mogła zniknąć, a inne się pojawić. Ekran nie pokazuje listy usług nowo wykrytych ani tych, które zniknęły.
                </li>
            </ul>

            <H2 id="dashboardy">Dashboardy</H2>
            <H3 id="latest">Latest Scan summary</H3>
            <p>
                Dashboard <code>Latest Scan summary</code> (Dashboards › Latest Scan summary) to skrót najnowszego wyniku. Pod tytułem widnieje <code>Latest scan</code> z datą i godziną rozpoczęcia ostatniego prawdziwego skanu (UTC), np. <code>Nov 21, 2026 7:14 AM</code>. Przed pierwszym skanem wartość to <code>unavailable</code>.
            </p>
            <RefTable
                head={['Element', 'Zawartość', 'Zależy od selektora okresu']}
                rows={[
                    [<code key="a">Reachable hosts</code>, t('Hosty, które odpowiedziały, i zmiana `… since last scan`; odnośnik `Open in Data Explorer` (filtr: Status is up)'), 'tak'],
                    [<code key="b">Unreachable hosts</code>, t('Hosty, które nie odpowiedziały, i zmiana `… since last scan`; odnośnik `Open in Data Explorer` (Status is down)'), 'tak'],
                    [<code key="o">Open alerts</code>, t('Liczba niepotwierdzonych alertów (wartość prawdziwa) i odnośnik `Review alerts` do strony Alerts'), 'nie'],
                    [<code key="c">Detected services</code>, t('Liczba wykrytych usług; odnośnik `Open in Data Explorer` (Open ports is not empty)'), 'tak'],
                    [<code key="d">Services by scan range</code>, 'Słupki liczby usług dla każdego okresu; kliknięcie słupka wybiera ten okres', 'wyróżnia wybrany słupek'],
                    [<code key="e">Service families</code>, 'Wykres kołowy usług według rodzin', 'nie'],
                    [t('`Most detected services`, `Most detected technologies`'), 'Najczęściej wykrywane usługi i technologie z wersją i liczbą hostów', 'nie']
                ]}
            />
            <ul>
                <li>
                    Kafelki <code>Reachable hosts</code>, <code>Unreachable hosts</code>, <code>Detected services</code>, wykres okresów, <code>Service families</code> i tabele popularności pochodzą z danych przykładowych. Prawdziwe są <code>Latest scan</code> i <code>Open alerts</code>.
                </li>
                <li>
                    Selektor okresu w prawym górnym rogu (<code>Last 24 hours</code> … <code>Last 365 days</code>, domyślnie <code>Last 7 days</code>) zmienia wyłącznie trzy kafelki liczbowe i wyróżnienie słupka. Nie zmienia daty <code>Latest scan</code> ani wykresu rodzin i tabel.
                </li>
                <li>
                    Nagłówek ma odnośniki <code>Hosts in Explorer</code> (do <Link href="/docs/data-explorer#dashboardy">Data Explorer</Link> z filtrem hostów dostępnych) i <code>Scan history</code> (do <Link href="#wyniki">Scan Results</Link>). Każdy jest widoczny tylko dla kont z dostępem do docelowego ekranu. <code>All technologies</code> prowadzi do <Link href="#technologies">Technologies used</Link>.
                </li>
            </ul>

            <H3 id="technologies">Technologies used</H3>
            <p>
                Tabela technologii: <code>Technology</code>, <code>Version(s)</code>, <code>Category</code>, <code>Hosts</code>. Przycisk szczegółów otwiera okno z listą hostów, na których technologię wykryto: <code>Host</code>, <code>OS</code>, <code>Port</code>, <code>Service</code>, <code>First seen</code>, <code>Last seen</code>. Przycisk <code>Open in Data Explorer</code> w nagłówku przechodzi do hostów z niepustą kolumną <code>Technologies</code>. Dane tego dashboardu są przykładowe; technologie z prawdziwych skanów oglądasz w Data Explorer.
            </p>
            <H3 id="vulnerable">Vulnerable versions</H3>
            <p>
                Tabela wykrytych wersji z podatnościami: <code>Service</code>, <code>Version</code>, <code>CVE</code> (odnośnik do NVD), <code>Severity</code>, <code>Hosts</code>. Przyciski <code>All</code>, <code>Critical</code>, <code>High</code> i <code>Medium</code> filtrują listę po poziomie i pokazują liczność każdego; wyszukiwarka (usługa, CVE, host) stoi w tym samym rzędzie co przyciski, a wybrany poziom i fraza działają łącznie. <code>Open in Data Explorer</code> przechodzi do hostów z niepustą kolumną <code>Vulnerabilities</code>. Tabela jest przykładowa; podatności z prawdziwych skanów trafiają do <Link href="/docs/alerty">Alerts</Link> jako <code>New CVE</code>.
            </p>

            <H2 id="zrodlo">Źródło danych</H2>
            <p>Dla administratora: skąd każdy ekran czyta dane.</p>
            <RefTable
                head={['Ekran', 'Źródło', 'Charakter']}
                rows={[
                    ['Scan Results, Scan details', <>Tabele <code key="1">scans</code>, <code key="2">scan_hosts</code>, <code key="3">alerts</code>; do listy dołączane są wiersze <code key="4">scan_history</code></>, <Badge key="b1" variant="success">prawdziwe + demo</Badge>],
                    ['Data Explorer', <>Tabela <code key="5">scan_hosts</code></>, <Badge key="b2" variant="success">prawdziwe</Badge>],
                    ['Alerts, Open alerts, Latest scan', <>Tabele <code key="6">alerts</code>, <code key="7">scans</code></>, <Badge key="b3" variant="success">prawdziwe</Badge>],
                    ['Compare Scans', <>Klucz <code key="8">scan_history</code> w <code key="8a">app_data</code></>, <Badge key="b4" variant="warn">przykładowe</Badge>],
                    ['Latest Scan summary: kafelki, wykres okresów', <>Klucz <code key="9">timeline_points</code></>, <Badge key="b5" variant="warn">przykładowe</Badge>],
                    ['Latest Scan summary: Service families, tabele popularności', <>Klucze <code key="10">service_slices</code>, <code key="10a">popular_services</code>, <code key="10b">popular_technologies</code></>, <Badge key="b6" variant="warn">przykładowe</Badge>],
                    ['Technologies used', <>Klucz <code key="11">technologies</code></>, <Badge key="b7" variant="warn">przykładowe</Badge>],
                    ['Vulnerable versions', <>Klucz <code key="12">detected_vulns</code></>, <Badge key="b8" variant="warn">przykładowe</Badge>],
                    ['Scan Status: Upcoming scan', <>Konfiguracje z tabeli <code key="13">policies</code>; klucz <code key="13a">upcoming_scan</code> jako wartości zastępcze</>, <Badge key="b9" variant="success">prawdziwe</Badge>],
                    ['Dopasowanie podatności w skanie', <>Klucz <code key="14">vulnerabilities</code>: lista znanych wersji z podatnościami (<Link key="l" href="/docs/alerty#cve">Alerty › New CVE</Link>)</>, <Badge key="b10">referencyjne</Badge>]
                ]}
            />
            <p>
                Klucze <code>data_events</code> i <code>latest_scan</code> są zapisywane przy pierwszym uruchomieniu, ale żaden ekran ich dziś nie czyta. Dokumenty <code>app_data</code> są wstawiane raz i nigdy nie nadpisywane.
            </p>
        </DocPage>
    );
}
