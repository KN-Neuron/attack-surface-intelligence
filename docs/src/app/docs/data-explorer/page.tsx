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
            lead="Tabela hostów zapisanych przez skany: jeden wiersz na adres, dwadzieścia kolumn, filtry z operatorami, okres, edycja i odnośniki z dashboardów."
            toc={[
                { id: 'model', label: 'Co pokazuje ekran' },
                { id: 'kolumny', label: 'Kolumny' },
                { id: 'okres', label: 'Timeframe' },
                { id: 'filtry', label: 'Filtry' },
                { id: 'operatory', label: 'Operatory', level: 3 },
                { id: 'przyklad', label: 'Przykład: gdzie działa Nginx', level: 3 },
                { id: 'tabela', label: 'Tabela i stronicowanie' },
                { id: 'edycja', label: 'Tryb edycji' },
                { id: 'dashboardy', label: 'Odnośniki z dashboardów' }
            ]}
        >
            <H2 id="model">Co pokazuje ekran</H2>
            <p>
                Data Explorer (w menu: Data Explorer) czyta tabelę <code>scan_hosts</code>: <strong>aktualny stan</strong> każdego adresu, który skan kiedykolwiek sprawdził. To nie jest dziennik zdarzeń. Nowy skan nadpisuje pola hosta, a o tym, co się zmieniło, informuje strona <Link href="/docs/alerty">Alerts</Link>.
            </p>
            <ul>
                <li>
                    Skan Full zapisuje wszystkie pola; skan Reachability zmienia tylko <code>Status</code>, <code>Last checked</code>, <code>Last seen</code> i <code>Last scan</code> (<Link href="/docs/skanowanie#typy">Typy skanu</Link>).
                </li>
                <li>
                    Przed pierwszym skanem tabela jest pusta (<code>No hosts match the current filters.</code>). Dane przykładowe nie są tu pokazywane.
                </li>
                <li>
                    Daty i godziny są wyświetlane w UTC. Okres i filtry działają w przeglądarce na wczytanym zestawie hostów, więc zmieniają wynik od razu, bez przeładowania.
                </li>
            </ul>

            <H2 id="kolumny">Kolumny</H2>
            <RefTable
                head={['Kolumna', 'Typ filtra', 'Zawartość']}
                rows={[
                    [<code key="1">Host</code>, 'tekst', 'Adres IP skanowanego hosta. Nazwy FQDN są przed skanem zamieniane na adres (Skanowanie › Rozwiązywanie celów)'],
                    [<code key="2">Status</code>, 'Up / Down', t('`Up`: host odpowiedział w ostatnim skanie. Znaczenie zależy od typu skanu (HTTP(S) albo otwarty port)')],
                    [<code key="3">Scheme</code>, 'tekst', t('`http` lub `https` odpowiedzi zapisanej przez httpx')],
                    [<code key="4">Port</code>, 'liczba', 'Port, na którym httpx otrzymał odpowiedź'],
                    [<code key="5">HTTP</code>, 'liczba', 'Kod statusu odpowiedzi HTTP'],
                    [<code key="6">Title</code>, 'tekst', 'Tytuł strony (znacznik title)'],
                    [<code key="7">Server</code>, 'tekst', t('Nagłówek `Server` serwera WWW')],
                    [<code key="8">Technologies</code>, 'lista', t('Wykryte technologie jako znaczniki `nazwa wersja`, np. `Nginx 1.24.0`; bez wersji, gdy jej nie rozpoznano')],
                    [<code key="9">Vulnerabilities</code>, 'lista', <>Identyfikatory CVE z alertów <code>New CVE</code> dla tego hosta, także już potwierdzonych (<Link key="a" href="/docs/alerty#cve">Alerty › New CVE</Link>)</>],
                    [<code key="10">Open ports</code>, 'tekst', t('Port i usługa w postaci `443/HTTPS`; skan Full zapisuje port, na którym odpowiedział httpx')],
                    [<code key="11">CDN</code>, 'tekst', 'Nazwa sieci CDN rozpoznana przez httpx'],
                    [<code key="12">CNAME</code>, 'tekst', 'Rekord CNAME hosta'],
                    [<code key="13">TLS</code>, 'tekst', t('Wersja TLS i wystawca certyfikatu, np. `TLS 1.3 · Example CA`')],
                    [<code key="14">Cert expires</code>, 'data', t('Data wygaśnięcia certyfikatu w postaci `YYYY-MM-DD`')],
                    [<code key="15">Size</code>, 'liczba', t('Długość odpowiedzi (`Content-Length`) w bajtach')],
                    [<code key="16">Response</code>, 'tekst', 'Czas odpowiedzi zgłoszony przez httpx'],
                    [<code key="17">Last checked</code>, 'data', 'Moment ostatniego sprawdzenia hosta, niezależnie od typu skanu i wyniku'],
                    [<code key="18">Last seen</code>, 'data', t('Ostatni moment, w którym host odpowiedział. Dla hosta w stanie `Down` pozostaje datą ostatniej odpowiedzi')],
                    [<code key="19">First seen</code>, 'data', 'Moment, w którym host został zapisany po raz pierwszy'],
                    [<code key="20">Last scan</code>, 'tekst', t('Numer ostatniego skanu, który objął host, np. `#12`')]
                ]}
            />

            <H2 id="okres">Timeframe</H2>
            <p>
                Lista <code>Timeframe</code> w panelu po lewej ogranicza hosty do tych, które sprawdzono w wybranym okresie (według <code>Last checked</code>, a gdy go brak, <code>Last seen</code> i <code>First seen</code>):
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
                Granice okresów wyznacza strefa czasowa przeglądarki. Host sprawdzony ostatnio w poprzednim miesiącu nie mieści się w domyślnym <code>Current month</code>: jeśli spodziewanego hosta brakuje, ustaw <code>Custom</code> z szerszym zakresem. Zmiana okresu działa od razu, bez przycisku <code>Apply</code>.
            </Callout>

            <H2 id="filtry">Filtry</H2>
            <ol>
                <li>
                    Kliknij <code>Add filter</code> i wybierz kolumnę z listy (pole <code>Search filters...</code> zawęża listę). W panelu pojawia się filtr z listą operatorów i polem wartości.
                </li>
                <li>
                    Wybierz operator i wpisz wartość. Kolejne filtry dodasz przyciskiem <code>+</code> obok.
                </li>
                <li>
                    Kliknij <code>Apply</code> (przycisk <code>Add filter</code> zmienia się w <code>Apply</code>, gdy istnieje choć jeden filtr). Zmiany w filtrach nie wpływają na tabelę, dopóki ich nie zastosujesz; niezastosowana zmiana jest oznaczona na przycisku.
                </li>
            </ol>
            <ul>
                <li>
                    Wszystkie filtry łączą się spójnikiem <strong>i</strong>. Każdy można w dowolnej chwili zmienić (operator, wartość) albo usunąć krzyżykiem; <code>Clear all</code> usuwa wszystkie.
                </li>
                <li>
                    Dopasowanie nie rozróżnia wielkości liter. Pod przyciskiem widać liczbę hostów po zastosowaniu okresu i filtrów (<code>N hosts</code>) oraz liczbę filtrów.
                </li>
                <li>
                    Tej samej kolumny można użyć wielokrotnie, np. <code>Technologies contains nginx</code> i <code>Technologies does not contain 1.18</code>. Klawisz <kbd>Enter</kbd> w polu wartości też stosuje filtry.
                </li>
            </ul>

            <H3 id="operatory">Operatory</H3>
            <RefTable
                head={['Typ kolumny', 'Operatory']}
                rows={[
                    ['tekst', t('`contains`, `does not contain`, `equals`, `starts with`, `is empty`, `is not empty`')],
                    ['liczba', t('`=`, `≠`, `>`, `≥`, `<`, `≤` (wartość jest liczbą; pole puste lub niepoprawne nie pasuje)')],
                    ['lista (Technologies, Vulnerabilities)', t('`contains`, `does not contain`, `is empty`, `is not empty`; porównanie dotyczy wszystkich elementów listy naraz')],
                    ['Up / Down (Status)', t('`is up`, `is down` (bez wartości)')],
                    ['data', t('`after`, `before`')]
                ]}
            />
            <Callout type="warning" title="Operatory after i before dla dat">
                W obecnej wersji <code>after</code> i <code>before</code> nie porównują chronologicznie: wpisana fraza jest dopasowywana jako fragment tekstu do wyświetlanej daty. Dla <code>Cert expires</code> (<code>YYYY-MM-DD</code>) fraza <code>2026-12</code> znajdzie certyfikaty wygasające w grudniu 2026. Dla pozostałych kolumn dat użyj listy <Link href="#okres">Timeframe</Link>.
            </Callout>
            <p>
                Wyszukiwanie po tagach hostów nie jest dostępne, bo tag nie jest kolumną (<Link href="/docs/tagowanie#data-explorer">Tagowanie › Data Explorer</Link>).
            </p>

            <H3 id="przyklad">Przykład: gdzie działa Nginx</H3>
            <ol>
                <li>
                    Kliknij <code>Add filter</code>, wybierz <code>Technologies</code>, operator <code>contains</code>, wpisz <code>nginx</code> i kliknij <code>Apply</code>.
                </li>
                <li>
                    Z kolumn <code>Host</code>, <code>Technologies</code> i <code>Last checked</code> odczytaj, gdzie i kiedy sprawdzono hosty z Nginx.
                </li>
                <li>
                    Aby ograniczyć wynik do wersji, wpisz w polu wartości <code>nginx 1.24</code> (znacznik ma postać <code>nazwa wersja</code>) albo dodaj drugi filtr.
                </li>
                <li>
                    Aby zawęzić do adresów z jednej podsieci, dodaj filtr <code>Host starts with 203.0.113.</code>.
                </li>
            </ol>
            <p>Gdy lista jest pusta:</p>
            <ul>
                <li>
                    zwiększ <code>Timeframe</code> (zob. ostrzeżenie wyżej) i sprawdź, czy host w ogóle został objęty skanem Full: skan Reachability nie zapisuje technologii;
                </li>
                <li>
                    skróć frazę: szukaj <code>nginx</code> zamiast pełnej wersji, bo nazwa technologii pochodzi z odcisku palca httpx i może mieć inną pisownię;
                </li>
                <li>
                    sprawdź operator: <code>equals</code> wymaga dokładnej, całej wartości.
                </li>
            </ul>

            <H2 id="tabela">Tabela i stronicowanie</H2>
            <ul>
                <li>
                    Wiersze są posortowane stale: najpierw hosty <code>Up</code>, potem alfabetycznie według adresu. Kolumn nie da się sortować.
                </li>
                <li>
                    Stopka tabeli pokazuje zakres (np. <code>1–100 of 342</code>) i pozwala wybrać 100 (domyślnie), 500 lub 1000 wierszy na stronę.
                </li>
                <li>
                    Znaczniki w kolumnach <code>Technologies</code> i <code>Vulnerabilities</code> to oddzielne chipy; pusta wartość to <code>—</code>.
                </li>
            </ul>

            <H2 id="edycja">Tryb edycji</H2>
            <p>
                Konta z zapisem do strony Data Explorer widzą w nagłówku panelu przycisk <code>Edit mode</code>. Po włączeniu tabela dostaje kolumnę <code>Actions</code>, a <code>Edit</code> przy hoście otwiera okno <code>Edit host</code>.
            </p>
            <RefTable
                head={['Pole', 'Można edytować']}
                rows={[
                    [t('`Title`, `Server`, `Scheme`, `Port`, `HTTP status`, `CDN`, `CNAME`, `Status` (Up / Down)'), 'tak'],
                    [t('`Technologies`, `TLS`, `Open ports`, daty i `Last scan`'), 'nie: to dowody ze skanera; okno przypomina o tym w podpowiedzi']
                ]}
            />
            <ul>
                <li>
                    <code>Save</code> wysyła zmiany (<Link href="/docs/api#asset">API HTTP › Hosty z Data Explorer</Link>) i odświeża stronę; po błędzie wyświetla <code>Could not save this host. Please try again.</code>
                </li>
                <li>
                    Edycja jest korektą ręczną. Najbliższy skan Full hosta nadpisze pola ręcznie zmienione (w tym <code>Status</code>), a skan Reachability nadpisze tylko <code>Status</code>.
                </li>
            </ul>

            <H2 id="dashboardy">Odnośniki z dashboardów</H2>
            <p>
                Dashboardy otwierają Data Explorer z już zastosowanymi filtrami. Odnośnik ma postać <code>?filter=kolumna|operator|wartość</code>; parametr <code>filter</code> można powtarzać, a znaki <code>|</code> koduje się jako <code>%7C</code>. Gdy pominięto operator, użyty jest pierwszy operator typu kolumny; nieznana kolumna jest ignorowana.
            </p>
            <RefTable
                head={['Odnośnik', 'Filtr', 'Skąd']}
                rows={[
                    [<code key="a">filter=up|true|</code>, 'Status is up', 'Reachable hosts, Hosts in Explorer'],
                    [<code key="b">filter=up|false|</code>, 'Status is down', 'Unreachable hosts'],
                    [<code key="c">filter=ports|not_empty|</code>, 'Open ports is not empty', 'Detected services'],
                    [<code key="d">filter=technologies|not_empty|</code>, 'Technologies is not empty', 'Technologies used'],
                    [<code key="e">filter=vulnerabilities|not_empty|</code>, 'Vulnerabilities is not empty', 'Vulnerable versions']
                ]}
            />
            <CodeBlock
                lang="text"
                title="Własny odnośnik: hosty z nginx, które odpowiadają"
                code={`/log-center/data-explorer?filter=up%7Ctrue%7C&filter=technologies%7Ccontains%7Cnginx`}
            />
            <p>
                Klucze kolumn: <code>address</code>, <code>up</code>, <code>scheme</code>, <code>port</code>, <code>status_code</code>, <code>title</code>, <code>webserver</code>, <code>technologies</code>, <code>vulnerabilities</code>, <code>ports</code>, <code>cdn</code>, <code>cname</code>, <code>tls</code>, <code>tls_expires</code>, <code>content_length</code>, <code>response_time</code>, <code>last_checked</code>, <code>last_seen</code>, <code>first_seen</code>, <code>last_scan</code>. Identyfikatory operatorów: <code>contains</code>, <code>not_contains</code>, <code>equals</code>, <code>starts</code>, <code>empty</code>, <code>not_empty</code>, <code>eq</code>, <code>ne</code>, <code>gt</code>, <code>gte</code>, <code>lt</code>, <code>lte</code>, <code>true</code>, <code>false</code>, <code>after</code>, <code>before</code>.
            </p>
        </DocPage>
    );
}
