import type { Metadata } from 'next';
import { t } from '@/components/docs/inline';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';

export const metadata: Metadata = { title: 'Data Explorer' };

export default function Page() {
    return (
        <DocPage
            href="/docs/data-explorer"
            title="Data Explorer"
            lead="Historia przechwyceń: jeden wiersz na host i skan, 45 kolumn, filtry z operatorami, okres, CSV, edycja i odnośniki z dashboardów."
            toc={[
                { id: 'model', label: 'Co pokazuje ekran' },
                { id: 'kolumny', label: 'Kolumny' },
                { id: 'okres', label: 'Timeframe' },
                { id: 'filtry', label: 'Filtry' },
                { id: 'operatory', label: 'Operatory', level: 3 },
                { id: 'przyklad', label: 'Przykład: gdzie działa Nginx', level: 3 },
                { id: 'csv', label: 'CSV: eksport i import' },
                { id: 'tabela', label: 'Tabela i stronicowanie' },
                { id: 'edycja', label: 'Tryb edycji' },
                { id: 'dashboardy', label: 'Odnośniki z dashboardów' }
            ]}
        >
            <H2 id="model">Co pokazuje ekran</H2>
            <p>
                Data Explorer czyta tabelę <code>scan_host_captures</code>: <strong>niezmienną historię</strong> przechwyceń. Każdy skan, który sprawdził dany host, zostawia własny wiersz, więc ten sam host pojawia się wielokrotnie — po jednym wierszu na skan. Numer skanu w kolumnie <code>Scan</code> (oraz <code>Last scan</code>) wiąże wiersz z uruchomieniem.
            </p>
            <ul>
                <li>
                    Skan Full zapisuje pełne przechwycenie: odpowiedź HTTP, nagłówki, cookies, technologie, TLS i porty. Skan Reachability dopisuje wiersz z samym stanem <code>Up</code>/<code>Down</code> i czasami; pozostałe kolumny są puste, a wcześniejsze przechwycenia pozostają nietknięte.
                </li>
                <li>
                    <code>scan_hosts</code> to osobna, bieżąca linia na adres, używana przez dashboardy i alerty. Data Explorer jej nie wyświetla; pokazuje historię.
                </li>
                <li>
                    <strong>Tagi</strong> są rozwiązywane z ewidencji przy każdym wczytaniu strony. Wiersz może też nieść tagi zapisane podczas importu CSV. Zmiana tagu w Host management jest więc widoczna po odświeżeniu ekranu.
                </li>
                <li>
                    Przed pierwszym skanem tabela jest pusta (<code>No hosts match the current filters.</code>). Daty i godziny są wyświetlane w UTC, a filtry działają w przeglądarce na wczytanym zestawie wierszy.
                </li>
            </ul>

            <H2 id="kolumny">Kolumny</H2>
            <p>Wszystkie kolumny można wybrać w filtrach. Typ filtra decyduje o dostępnych operatorach.</p>
            <RefTable
                head={['Kolumna', 'Typ filtra', 'Zawartość']}
                rows={[
                    [<code key="1">Host</code>, 'tekst', 'Klucz przechwycenia: adres IP albo nazwa FQDN, jeśli skan Full celował w nazwę'],
                    [<code key="2">Scan</code>, 'tekst', t('Etykieta skanu albo `#numer`, gdy skan nie ma etykiety')],
                    [<code key="3">Tags</code>, 'lista', 'Tagi wpisu z ewidencji oraz tagi zapisane w wierszu przez import CSV'],
                    [<code key="4">Status</code>, 'Up / Down', t('`Up`: host odpowiedział w tym skanie; znaczenie zależy od typu skanu')],
                    [<code key="5">Scheme</code>, 'tekst', t('`http` lub `https` odpowiedzi')],
                    [<code key="6">Port</code>, 'liczba', 'Port, na którym otrzymano odpowiedź'],
                    [<code key="7">HTTP</code>, 'liczba', 'Kod statusu odpowiedzi'],
                    [<code key="8">Content type</code>, 'tekst', t('Nagłówek `Content-Type`')],
                    [<code key="9">Title</code>, 'tekst', 'Tytuł strony (znacznik title)'],
                    [<code key="10">Server</code>, 'tekst', t('Nagłówek `Server`')],
                    [<code key="11">Technologies</code>, 'lista', t('Wykryte technologie jako `nazwa wersja`')],
                    [<code key="12">Vulnerabilities</code>, 'lista', 'CVE z alertów New CVE przypisanych do tego skanu i hosta'],
                    [<code key="13">Open ports</code>, 'tekst', t('Porty i usługi, np. `443/HTTPS`')],
                    [<code key="14">CDN</code>, 'tekst', 'Nazwa sieci CDN rozpoznana przez httpx'],
                    [<code key="15">CDN type</code>, 'tekst', 'Typ CDN zgłoszony przez httpx'],
                    [<code key="16">CNAME</code>, 'tekst', 'Rekord CNAME hosta'],
                    [<code key="17">Resolves to</code>, 'tekst', 'Adresy, na które wskazuje host (host IP oraz rekordy A/AAAA)'],
                    [<code key="18">Headers</code>, 'lista', 'Nagłówki odpowiedzi w postaci `nazwa: wartość`'],
                    [<code key="19">Cookies</code>, 'lista', t('Wartości `Set-Cookie` jako `nazwa=wartość`')],
                    [<code key="20">Host IP</code>, 'tekst', 'Adres, na który rozwiązał się cel'],
                    [<code key="21">ASN</code>, 'tekst', 'Numer i operator sieci (ASN), gdy httpx go zgłosił'],
                    [<code key="22">TLS</code>, 'tekst', t('Wersja TLS i wystawca certyfikatu, np. `TLS 1.3 · Example CA`')],
                    [<code key="23">Cert expires</code>, 'data', t('Data wygaśnięcia certyfikatu `YYYY-MM-DD`')],
                    [<code key="24">Cert serial</code>, 'tekst', 'Numer seryjny certyfikatu'],
                    [<code key="25">Cert fingerprint</code>, 'tekst', 'Odcisk SHA-256 certyfikatu'],
                    [<code key="26">JARM</code>, 'tekst', 'Odcisk JARM serwera TLS'],
                    [<code key="27">Favicon hash</code>, 'tekst', 'Hash mmh3 favikony'],
                    [<code key="28">HTTP/2</code>, 'tak / nie', 'Czy host obsługuje HTTP/2'],
                    [<code key="29">Pipeline</code>, 'tak / nie', 'Czy httpx wykrył HTTP pipelining'],
                    [<code key="30">VHOST</code>, 'tak / nie', 'Czy httpx wykrył wirtualny host'],
                    [<code key="31">Size</code>, 'liczba', 'Długość odpowiedzi w bajtach'],
                    [<code key="32">Words</code>, 'liczba', 'Liczba słów w odpowiedzi'],
                    [<code key="33">Lines</code>, 'liczba', 'Liczba linii w odpowiedzi'],
                    [<code key="34">Body hash</code>, 'tekst', 'Hash treści odpowiedzi'],
                    [<code key="35">Header hash</code>, 'tekst', 'Hash nagłówków odpowiedzi'],
                    [<code key="36">Response</code>, 'tekst', 'Czas odpowiedzi zgłoszony przez httpx'],
                    [<code key="37">URL</code>, 'tekst', 'Adres odpowiedzi'],
                    [<code key="38">Final URL</code>, 'tekst', 'Adres po przekierowaniach'],
                    [<code key="39">Path</code>, 'tekst', 'Ścieżka żądania'],
                    [<code key="40">Method</code>, 'tekst', 'Metoda HTTP'],
                    [<code key="41">Captured</code>, 'data', 'Moment wykonania przechwycenia'],
                    [<code key="42">Last checked</code>, 'data', 'Ostatnie sprawdzenie hosta (z bieżącego stanu)'],
                    [<code key="43">Last seen</code>, 'data', 'Ostatnia odpowiedź hosta'],
                    [<code key="44">First seen</code>, 'data', 'Pierwsze zapisanie hosta'],
                    [<code key="45">Last scan</code>, 'tekst', t('Numer skanu tego wiersza, np. `#12`')]
                ]}
            />

            <H2 id="okres">Timeframe</H2>
            <p>
                Lista <code>Timeframe</code> ogranicza wiersze według <code>Last checked</code>, a gdy go brak, <code>Last seen</code> i <code>First seen</code>:
            </p>
            <RefTable
                head={['Wartość', 'Zakres']}
                rows={[
                    [<code key="a">Current day</code>, 'Od północy bieżącego dnia'],
                    [<code key="b">Current week</code>, 'Od północy poniedziałku'],
                    [<code key="c">Current month</code>, 'Od pierwszego dnia miesiąca, o północy (wartość domyślna)'],
                    [<code key="d">Custom</code>, t('Pola `From` i `To` (data i godzina; domyślnie ostatnie 7 dni); koniec obejmuje wybraną minutę')]
                ]}
            />
            <Callout type="warning" title="Host nie pojawia się na liście">
                Granice okresów wyznacza strefa czasowa przeglądarki, a filtr korzysta z <code>Last checked</code> bieżącego stanu hosta, nie z daty <code>Captured</code> wiersza. Host sprawdzony ostatnio w poprzednim miesiącu nie mieści się w domyślnym <code>Current month</code>: ustaw <code>Custom</code> z szerszym zakresem. Zmiana okresu działa od razu, bez przycisku <code>Apply</code>.
            </Callout>

            <H2 id="filtry">Filtry</H2>
            <ol>
                <li>
                    Kliknij <code>Add filter</code> i wybierz kolumnę z listy (pole <code>Search filters...</code> zawęża listę). W panelu pojawia się filtr z operatorami i polem wartości.
                </li>
                <li>
                    Wybierz operator i wpisz wartość. Kolejne filtry dodasz przyciskiem <code>+</code> obok.
                </li>
                <li>
                    Kliknij <code>Apply</code> (przycisk <code>Add filter</code> zmienia się w <code>Apply</code>, gdy istnieje choć jeden filtr). Zmiany w filtrach nie wpływają na tabelę, dopóki ich nie zastosujesz.
                </li>
            </ol>
            <ul>
                <li>Wszystkie filtry łączą się spójnikiem <strong>i</strong>; każdy można zmienić lub usunąć krzyżykiem, a <code>Clear all</code> usuwa wszystkie.</li>
                <li>Dopasowanie nie rozróżnia wielkości liter. Pod przyciskiem widać liczbę wierszy (<code>N hosts</code>) i liczbę filtrów.</li>
                <li>Tej samej kolumny można użyć wielokrotnie, np. <code>Technologies contains nginx</code> i <code>Technologies does not contain 1.18</code>. <kbd>Enter</kbd> w polu wartości też stosuje filtry.</li>
                <li>Kolumny <code>Tags</code>, <code>Technologies</code>, <code>Vulnerabilities</code>, <code>Headers</code> i <code>Cookies</code> to listy: operator działa na wszystkich elementach naraz.</li>
            </ul>

            <H3 id="operatory">Operatory</H3>
            <RefTable
                head={['Typ kolumny', 'Operatory']}
                rows={[
                    ['tekst', t('`contains`, `does not contain`, `equals`, `starts with`, `is empty`, `is not empty`')],
                    ['liczba', t('`=`, `≠`, `>`, `≥`, `<`, `≤` (wartość jest liczbą; pole puste lub niepoprawne nie pasuje)')],
                    ['lista', t('`contains`, `does not contain`, `is empty`, `is not empty`')],
                    ['Up / Down (Status)', t('`is up`, `is down` (bez wartości)')],
                    ['tak / nie (HTTP/2, Pipeline, VHOST)', t('`is yes`, `is no` (bez wartości)')],
                    ['data', t('`after`, `before`')]
                ]}
            />
            <Callout type="warning" title="Operatory after i before dla dat">
                W obecnej wersji <code>after</code> i <code>before</code> nie porównują chronologicznie: wpisana fraza jest dopasowywana jako fragment tekstu do wyświetlanej daty. Dla <code>Cert expires</code> (<code>YYYY-MM-DD</code>) fraza <code>2026-12</code> znajdzie certyfikaty wygasające w grudniu 2026. Dla pozostałych kolumn dat użyj listy <Link href="#okres">Timeframe</Link>.
            </Callout>

            <H3 id="przyklad">Przykład: gdzie działa Nginx</H3>
            <ol>
                <li>
                    Kliknij <code>Add filter</code>, wybierz <code>Technologies</code>, operator <code>contains</code>, wpisz <code>nginx</code> i kliknij <code>Apply</code>.
                </li>
                <li>
                    Z kolumn <code>Host</code>, <code>Scan</code>, <code>Technologies</code> i <code>Captured</code> odczytaj, gdzie i kiedy wykryto Nginx.
                </li>
                <li>
                    Aby zawęzić do wersji, wpisz <code>nginx 1.24</code> albo dodaj drugi filtr.
                </li>
                <li>
                    Aby połączyć to z ewidencją, dodaj filtr <code>Tags contains env:prod</code> lub <code>Host starts with 203.0.113.</code>.
                </li>
            </ol>

            <H2 id="csv">CSV: eksport i import</H2>
            <p>
                <code>Download CSV</code> zapisuje <strong>wszystkie wiersze po filtrach i okresie</strong>, nie tylko widoczną stronę. Plik ma nagłówek z etykietami kolumn, 45 kolumn, separator <code>,</code>, kodowanie UTF-8 z BOM i nazwę <code>data-explorer-RRRR-MM-DD.csv</code>. Wartości list są łączone średnikiem i spacją (<code>; </code>), a flagi zapisywane jako <code>Yes</code> / <code>No</code>.
            </p>
            <p>
                Import jest dostępny wyłącznie w trybie edycji (wymaga uprawnienia zapisu). Otwórz <code>Edit mode</code>, kliknij <code>Import from CSV</code> i wskaż plik. Wymagania i skutki:
            </p>
            <ul>
                <li>Plik musi mieć nagłówek i kolumnę <code>Host</code>; kolejność kolumn jest dowolna, bo wiersze są mapowane po etykietach.</li>
                <li>Import tworzy <strong>nowy skan</strong> z etykietą <code>CSV import · data</code>, silnikiem <code>csv</code> i triggerem <code>import</code>; pojawia się on w Scan Results.</li>
                <li>Wiersze bez <code>Host</code> są pomijane i liczone w komunikacie jako <code>Skipped</code>.</li>
                <li>Listy w komórkach są rozdzielane średnikiem. Tagi z kolumny <code>Tags</code> są zapisywane w wierszu przechwycenia.</li>
                <li>Import nie scala danych z istniejącym skanem: dopisuje osobne wiersze historii.</li>
            </ul>
            <Callout type="note" title="Najbezpieczniejszy obieg">
                Wyeksportuj przefiltrowaną tabelę, popraw wybrane komórki, a potem zaimportuj ten sam plik. Dzięki nagłówkom eksport i import są wzajemnie zgodne.
            </Callout>

            <H2 id="tabela">Tabela i stronicowanie</H2>
            <ul>
                <li>Kolejność jest stała: najnowsze przechwycenia najpierw, a przy tym samym czasie alfabetycznie według hosta. Kolumn nie da się sortować.</li>
                <li>Stopka pokazuje zakres (np. <code>1–100 of 342</code>) i pozwala wybrać 100 (domyślnie), 500 lub 1000 wierszy na stronę.</li>
                <li>Znaczniki w kolumnach list to oddzielne chipy; pusta wartość to <code>—</code>.</li>
            </ul>

            <H2 id="edycja">Tryb edycji</H2>
            <p>
                Konta z zapisem do strony Data Explorer widzą w nagłówku panelu przycisk <code>Edit mode</code>. Po włączeniu tabela dostaje kolumnę <code>Actions</code>, a <code>Edit</code> przy wierszu otwiera okno <code>Edit host</code> dla <strong>tego konkretnego skanu</strong>.
            </p>
            <RefTable
                head={['Pole', 'Można edytować']}
                rows={[
                    [t('`Title`, `Server`, `Scheme`, `Port`, `HTTP status`, `CDN`, `CNAME`, `Status` (Up / Down)'), 'tak'],
                    [t('`Technologies`, `TLS`, `Open ports`, nagłówki, cookies, hashe, daty i `Last scan`'), 'nie: to dowody ze skanera']
                ]}
            />
            <ul>
                <li><code>Save</code> wysyła zmiany do <code>PUT /api/scans/{'{scan_id}'}/assets/{'{address}'}</code> i odświeża stronę; po błędzie wyświetla <code>Could not save this host. Please try again.</code></li>
                <li>Edycja trafia do wiersza historii wybranego skanu oraz do bieżącego stanu hosta (<code>scan_hosts</code>), więc poprawiona wartość jest widoczna także na dashboardach.</li>
                <li>Najbliższy skan Full nadpisze pola bieżącego stanu; wiersze historii innych skanów pozostają bez zmian.</li>
            </ul>
            <Callout type="warning" title="Zapis wymaga też Scan Status">
                Przycisk <code>Edit mode</code> zależy od zapisu do Data Explorer, ale endpoint leży pod prefiksem <code>/api/scans</code> i jest chroniony kluczem <code>scan_management</code>. Konto z zapisem tylko do Data Explorer zobaczy edytor, ale zapis dostanie 403 (<Link href="/docs/dostep#sciezki">Dostęp i uprawnienia</Link>).
            </Callout>

            <H2 id="dashboardy">Odnośniki z dashboardów</H2>
            <p>
                Dashboardy i okno Scan details otwierają Data Explorer z już zastosowanymi filtrami. Odnośnik ma postać <code>?filter=kolumna|operator|wartość</code>; parametr <code>filter</code> można powtarzać, a znaki <code>|</code> koduje się jako <code>%7C</code>. Gdy pominięto operator, użyty jest pierwszy operator typu kolumny; nieznana kolumna jest ignorowana.
            </p>
            <RefTable
                head={['Odnośnik', 'Filtr', 'Skąd']}
                rows={[
                    [<code key="a">filter=up|true|</code>, 'Status is up', 'Reachable hosts, Hosts in Explorer'],
                    [<code key="b">filter=up|false|</code>, 'Status is down', 'Unreachable hosts'],
                    [<code key="c">filter=open_ports|not_empty|</code>, 'Open ports is not empty', 'Detected services'],
                    [<code key="d">filter=technologies|not_empty|</code>, 'Technologies is not empty', 'Technologies used'],
                    [<code key="e">filter=vulnerabilities|not_empty|</code>, 'Vulnerabilities is not empty', 'Vulnerable versions'],
                    [<code key="f">filter=last_scan|equals|#12</code>, 'Last scan equals #12', 'Show in Data Explorer w oknie Scan details']
                ]}
            />
            <CodeBlock
                lang="text"
                title="Własny odnośnik: hosty z nginx i tagiem env:prod"
                code={`/log-center/data-explorer?filter=up%7Ctrue%7C&filter=technologies%7Ccontains%7Cnginx&filter=tags%7Ccontains%7Cenv:prod`}
            />
            <p>
                Klucze kolumn i identyfikatory operatorów odpowiadają tabeli powyżej: <code>contains</code>, <code>not_contains</code>, <code>equals</code>, <code>starts</code>, <code>empty</code>, <code>not_empty</code>, <code>eq</code>, <code>ne</code>, <code>gt</code>, <code>gte</code>, <code>lt</code>, <code>lte</code>, <code>true</code>, <code>false</code>, <code>after</code>, <code>before</code>.
            </p>
        </DocPage>
    );
}
