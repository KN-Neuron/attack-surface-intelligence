import type { Metadata } from 'next';
import { t } from '@/components/docs/inline';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { RefTable } from '@/components/ui/ref-table';

export const metadata: Metadata = { title: 'Alerty' };

export default function Page() {
    return (
        <DocPage
            href="/docs/alerty"
            title="Alerty"
            lead="Alerts zbiera zmiany wykryte przez skany: nowe hosty, hosty, które przestały odpowiadać, i technologie w wersjach ze znanymi podatnościami. Alert czeka na potwierdzenie przez administratora."
            toc={[
                { id: 'reguly', label: 'Reguły alertów' },
                { id: 'host', label: 'New host i Host down', level: 3 },
                { id: 'cve', label: 'New CVE', level: 3 },
                { id: 'duplikaty', label: 'Duplikaty' },
                { id: 'ekran', label: 'Ekran Alerts' },
                { id: 'potwierdzanie', label: 'Potwierdzanie', level: 3 },
                { id: 'gdzie', label: 'Gdzie widać alerty' },
                { id: 'ograniczenia', label: 'Ograniczenia' }
            ]}
        >
            <H2 id="reguly">Reguły alertów</H2>
            <p>
                Alerty powstają na końcu każdego skanu (także przerwanego albo zakończonego błędem), przez porównanie wyniku z tym, co aplikacja wiedziała wcześniej. Skan z zerem celów nie startuje, więc nie generuje alertów.
            </p>
            <RefTable
                head={['Typ (kolumna Type)', 'Waga', 'Warunek', 'Treść w Finding']}
                rows={[
                    [<code key="a">New host</code>, <code key="a1">Info</code>, 'Host odpowiedział w tym skanie, a jego adresu nie było wcześniej w danych skanera', <code key="a2">New host discovered in scope</code>],
                    [<code key="b">Host down</code>, <code key="b1">High</code>, 'Host odpowiadał w jednym z wcześniejszych skanów, a w tym skanie nie odpowiedział', <code key="b2">Host no longer responds to the scan</code>],
                    [<code key="c">New CVE</code>, t('z listy referencyjnej: `Critical`, `High` albo `Medium`'), 'Wykryta technologia w wersji ze znaną podatnością (zob. niżej)', t('`Detected <usługa> version matching <CVE>` oraz identyfikator CVE pod spodem')]
                ]}
            />

            <H3 id="host">New host i Host down</H3>
            <ul>
                <li>
                    Pierwszy skan na pustej bazie oznacza wszystkie odpowiadające hosty jako <code>New host</code>. Alerty te informują o nowo zaobserwowanym zasobie, nie o błędzie.
                </li>
                <li>
                    <code>New host</code> dotyczy adresu, którego nie było wcześniej w danych skanera. Host, który najpierw został sprawdzony jako <code>Down</code>, a dopiero później odpowiedział, nie wygeneruje tego alertu.
                </li>
                <li>
                    Znaczenie <code>odpowiedział</code> zależy od typu skanu: skan Full liczy odpowiedź HTTP(S), skan Reachability otwarty port z listy (<Link href="/docs/skanowanie#typy">Skanowanie › Typy skanu</Link>). Host z samym SSH będzie więc w skanie Full uznany za niedostępny i da alert <code>Host down</code>, jeśli wcześniej odpowiadał na HTTP.
                </li>
            </ul>

            <H3 id="cve">New CVE</H3>
            <p>
                Po skanie Full aplikacja porównuje technologie wykryte na hostach z listą znanych wersji z podatnościami (dokument <code>vulnerabilities</code> w <code>app_data</code>). Alert powstaje, gdy:
            </p>
            <ol>
                <li>
                    nazwa technologii zgadza się z nazwą usługi z listy (bez względu na wielkość liter), np. <code>nginx</code>;
                </li>
                <li>
                    wykryta wersja nie jest pusta, a wersja z listy zaczyna się od wykrytej wersji (wykryte <code>1.24</code> pasuje do <code>1.24.0</code>).
                </li>
            </ol>
            <Callout type="note" title="Lista wersji jest stała i krótka">
                Lista referencyjna zawiera sześć wpisów: OpenSSH 8.9p1, Apache httpd 2.4.58, nginx 1.24.0, PostgreSQL 15.4, MySQL 8.0.35 i Redis 7.2.3. Aplikacja nie ma ekranu do jej edycji ani zewnętrznego źródła CVE. Ponieważ nazwy technologii pochodzą z rozpoznania httpx, a dopasowanie wymaga identycznej nazwy, w praktyce wyzwala ją głównie <code>nginx</code>.
            </Callout>
            <p>
                Wykryte CVE trafiają do kolumny <code>Vulnerabilities</code> w <Link href="/docs/data-explorer#kolumny">Data Explorer</Link>. Licznik <code>Vulns</code> w Scan Results nie jest dziś na ich podstawie aktualizowany (<Link href="/docs/wyniki#wyniki">Wyniki i analiza</Link>).
            </p>

            <H2 id="duplikaty">Duplikaty</H2>
            <p>
                Alert nie powstaje, jeśli w tabeli istnieje już alert o tym samym typie, hoście i identyfikatorze CVE, <strong>także potwierdzony</strong>. Skutki:
            </p>
            <ul>
                <li>
                    każdy host zgłasza <code>New host</code> i <code>Host down</code> najwyżej raz w historii aplikacji: kolejna awaria tego samego hosta po wcześniejszym powrocie nie wygeneruje nowego alertu;
                </li>
                <li>
                    to samo CVE na tym samym hoście zgłasza się raz; po potwierdzeniu nie wróci przy następnym skanie.
                </li>
            </ul>

            <H2 id="ekran">Ekran Alerts</H2>
            <p>
                Ekran <code>Alerts</code> (w menu: Dashboards › Alerts) pokazuje do 500 ostatnich alertów; niepotwierdzone są na górze.
            </p>
            <RefTable
                head={['Element', 'Zawartość']}
                rows={[
                    [t('Zakładki `New`, `Acknowledged`, `All`'), 'Filtr po statusie z licznikami; domyślnie New (niepotwierdzone)'],
                    [<code key="s">Search host, finding, severity...</code>, 'Pole w rzędzie zakładek: dopasowuje fragment tekstu w wierszu i działa razem z zakładką'],
                    [<code key="c1">Severity</code>, t('`Info`, `Medium`, `High` lub `Critical`')],
                    [<code key="c2">Type</code>, t('`New host`, `Host down` lub `New CVE`')],
                    [<code key="c3">Host</code>, 'Adres, którego dotyczy alert'],
                    [<code key="c4">Finding</code>, 'Opis i, dla New CVE, identyfikator podatności'],
                    [<code key="c5">Scan</code>, 'Etykieta uruchomienia, które wygenerowało alert (Manual scan albo nazwa konfiguracji)'],
                    [<code key="c6">Detected</code>, 'Czas wykrycia (UTC)'],
                    [<code key="c7">Status</code>, t('`New` albo `Acknowledged`; po najechaniu na potwierdzony alert widać, kto go potwierdził')]
                ]}
            />
            <p>Stopka tabeli pozwala przechodzić między stronami i zmieniać liczbę wierszy.</p>

            <H3 id="potwierdzanie">Potwierdzanie</H3>
            <ul>
                <li>
                    Potwierdzenie wymaga zapisu do strony <code>Alerts</code>; konta tylko z odczytem (np. <code>Analyst</code>) widzą listę bez pól wyboru i przycisków.
                </li>
                <li>
                    <code>Acknowledge</code> w wierszu potwierdza jeden alert. Pola wyboru w pierwszej kolumnie i przycisk <code>Acknowledge selected</code> w nagłówku potwierdzają kilka naraz.
                </li>
                <li>
                    Potwierdzenie zapisuje imię i nazwisko administratora oraz czas. Interfejs nie pozwala cofnąć potwierdzenia.
                </li>
                <li>
                    Potwierdzenie usuwa alert z licznika <code>Open alerts</code> i z zakładki <code>New</code>, ale go nie kasuje: alert zostaje w zakładkach <code>Acknowledged</code> i <code>All</code> oraz w bazie.
                </li>
            </ul>

            <H2 id="gdzie">Gdzie widać alerty</H2>
            <RefTable
                head={['Miejsce', 'Co pokazuje']}
                rows={[
                    ['Scan Management', t('Licznik `Alerts raised` trwającego skanu (uzupełnia się na końcu)')],
                    ['Scan Results', <>Kolumna <code>Alerts</code> z liczbą alertów każdego skanu</>],
                    ['Okno Scan details', t('Podział na `New hosts`, `Hosts down`, `New CVEs` i `Still unacknowledged`')],
                    ['Latest Scan summary', t('Kafelek `Open alerts` z odnośnikiem `Review alerts`')],
                    ['Data Explorer', <>Kolumna <code>Vulnerabilities</code></>]
                ]}
            />

            <H2 id="ograniczenia">Ograniczenia</H2>
            <ul>
                <li>Alerty nie są wysyłane poza aplikację: nie ma powiadomień e-mail ani webhooków. Źródłem prawdy jest strona Alerts.</li>
                <li>Reguł nie można konfigurować ani wyłączać; wagi są stałe.</li>
                <li>Dostęp do ekranu i do potwierdzania reguluje klucz <code>alerts</code> (<Link href="/docs/dostep#sciezki">Dostęp i uprawnienia</Link>); punkty końcowe opisuje <Link href="/docs/api#alerty">API HTTP › Alerty</Link>.</li>
            </ul>
        </DocPage>
    );
}
