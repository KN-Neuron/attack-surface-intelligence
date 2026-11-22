import type { Metadata } from 'next';
import { t } from '@/components/docs/inline';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';

export const metadata: Metadata = { title: 'Skanowanie' };

export default function Page() {
    return (
        <DocPage
            href="/docs/skanowanie"
            title="Skanowanie"
            lead="Konfiguracja skanów i harmonogramów (Scan Scheduling), typy skanów, sposób wyznaczania celów oraz uruchamianie i śledzenie skanu (Scan Status)."
            toc={[
                { id: 'pojecia', label: 'Konfiguracja, uruchomienie, wynik' },
                { id: 'harmonogramy', label: 'Scan Scheduling' },
                { id: 'nowy', label: 'Tworzenie skanu', level: 3 },
                { id: 'cele', label: 'Cele', level: 3 },
                { id: 'czas', label: 'Harmonogram i strefa czasowa', level: 3 },
                { id: 'scheduler', label: 'Uruchamianie z harmonogramu', level: 3 },
                { id: 'zarzadzanie', label: 'Edycja, uruchomienie, usunięcie', level: 3 },
                { id: 'uruchomienie', label: 'Uruchomienie skanu' },
                { id: 'sposoby', label: 'Cztery sposoby uruchomienia', level: 3 },
                { id: 'typy', label: 'Typy skanu', level: 3 },
                { id: 'rozwiazywanie', label: 'Rozwiązywanie celów', level: 3 },
                { id: 'stan', label: 'Scan Status', level: 3 },
                { id: 'przejscia', label: 'Stany i przejścia', level: 3 },
                { id: 'kolejka', label: 'Upcoming scan i Scan queue', level: 3 }
            ]}
        >
            <H2 id="pojecia">Konfiguracja, uruchomienie, wynik</H2>
            <RefTable
                head={['Pojęcie', 'Gdzie w aplikacji', 'Co to jest']}
                rows={[
                    ['Wpis w ewidencji', 'Host management', <>Zasób zadeklarowany przez organizację (<Link key="h" href="/docs/hosty">Host management</Link>)</>],
                    ['Cel skanu', t('Sekcja `Targets` konfiguracji'), 'Wpis ewidencji lub grupa wybrana do konkretnej konfiguracji'],
                    ['Konfiguracja (harmonogram)', 'Scan Scheduling', 'Nazwany zestaw celów z typem skanu oraz informacją, kiedy i jak często skan ma się odbywać'],
                    ['Uruchomienie', 'Scan Status, Scan Results', <>Jedno wykonanie skanu z czasem rozpoczęcia i zakończenia oraz statusem (<Link key="r" href="/docs/wyniki#wyniki">Wyniki i analiza</Link>)</>],
                    ['Obserwacja', 'Data Explorer, Alerts, dashboardy', <>Stan hosta zapisany przez skan: odpowiedź, usługa, technologia, certyfikat (<Link key="d" href="/docs/data-explorer">Data Explorer</Link>); zmiana względem poprzednich skanów trafia do <Link key="a" href="/docs/alerty">Alerts</Link></>]
                ]}
            />

            <H2 id="harmonogramy">Scan Scheduling</H2>
            <p>
                Ekran <code>Scan Scheduling</code> (w menu: Scanning › Scan Scheduling) zawiera listę zapisanych konfiguracji skanów z kolumnami <code>Order</code>, <code>Name</code>, <code>Type</code>, <code>Targets</code>, <code>Schedule</code>, <code>Status</code> i <code>Actions</code>. Lista jest posortowana według <code>Order</code>.
            </p>

            <H3 id="nowy">Tworzenie skanu</H3>
            <ol>
                <li>
                    Kliknij <code>Add scan</code>. Otworzy się okno <code>New scan</code>.
                </li>
                <li>
                    Wpisz <code>Name</code>, np. <code>Produkcja – nocny skan</code> (pole wymagane).
                </li>
                <li>
                    Opcjonalnie ustaw <code>Order</code> (pozycja na liście, od 1) i przełącznik <code>Status</code> (<code>Enabled</code> / <code>Disabled</code>).
                </li>
                <li>
                    W polu <code>Scan type</code> wybierz <code>Full scan test (httpx)</code> (domyślnie) albo <code>Reachability (masscan)</code>. Podpowiedź pod polem opisuje różnicę (<Link href="#typy">Typy skanu</Link>).
                </li>
                <li>
                    W sekcji <code>Targets</code> zaznacz cele (<Link href="#cele">Cele</Link>). Licznik <code>N selected</code> pokazuje, ile pozycji wybrano.
                </li>
                <li>
                    W sekcji <code>Schedule</code> wybierz <code>Frequency</code> i czas (<Link href="#czas">Harmonogram</Link>). Pod polami pojawia się opis, np. <code>Runs every Monday at 22:00.</code>
                </li>
                <li>
                    Kliknij <code>Save</code>. Bez zaznaczonego celu aplikacja wyświetli <code>Pick at least one target from host management.</code> i nie zapisze konfiguracji.
                </li>
            </ol>

            <H3 id="cele">Cele</H3>
            <p>
                Cele wybiera się wyłącznie z ewidencji: wpis musi najpierw istnieć w Host management. Sekcja <code>Targets</code> ma cztery listy z polami wyboru, każdą z filtrem:
            </p>
            <RefTable
                head={['Lista', 'Co zaznaczasz', 'Etykieta w kolumnie Targets']}
                rows={[
                    [<code key="a">Host groups</code>, t('Grupę hostów; obok nazwy widać liczbę jej celów (`N target(s)`). Grupa obejmuje wszystko, co zawiera'), <code key="a2">Host group</code>],
                    [<code key="b">IP addresses</code>, 'Pojedynczy adres z zakładki IPs', <code key="b2">IP address</code>],
                    [<code key="c">IP ranges</code>, 'Zakres CIDR z zakładki IP ranges; obejmuje adresy bloku (z limitem opisanym w rozdziale Rozwiązywanie celów)', <code key="c2">IP range</code>],
                    [<code key="d">FQDNs</code>, 'Nazwę domenową z zakładki FQDNs', <code key="d2">FQDN</code>]
                ]}
            />
            <ul>
                <li>
                    Typy celów można łączyć w jednej konfiguracji, np. grupa <code>Produkcja</code> oraz dodatkowo adres <code>203.0.113.10</code> i nazwa <code>www.example.com</code>.
                </li>
                <li>
                    Wyboru po tagu nie ma. Aby objąć harmonogramem hosty z tagiem, zbuduj z nich grupę (<Link href="/docs/tagowanie#scheduling">Tagowanie › Scan Scheduling</Link>).
                </li>
                <li>
                    Cel jest zapisywany jako tekst (nazwa grupy, adres, zakres, nazwa), a skan odczytuje go dopiero przy uruchomieniu. Grupa jest rozwijana według <strong>bieżącego</strong> składu, więc dodanie członka do grupy zmienia cele najbliższego skanu bez edycji konfiguracji. Zmiana nazwy lub usunięcie grupy zrywa powiązanie: skan nie znajdzie grupy o starej nazwie (<Link href="/docs/hosty#grupa-skutki">Host management › Grupa a harmonogramy</Link>). Adres, zakres i FQDN są używane tak, jak zapisano, także gdy wpis usunięto z ewidencji (<Link href="/docs/hosty#edycja">Edycja i usuwanie</Link>).
                </li>
            </ul>
            <p>
                Do oddzielnego skanowania środowisk utwórz dwie konfiguracje, np. <code>Produkcja – nocny skan</code> z celem w postaci grupy <code>Produkcja</code> i <code>Development – tygodniowy</code> z grupą <code>Development</code>. Etykieta uruchomienia w Scan Results to nazwa konfiguracji, więc wyniki obu łatwo rozdzielić (<Link href="/docs/wyniki#wyniki">Scan Results</Link>).
            </p>

            <H3 id="czas">Harmonogram i strefa czasowa</H3>
            <RefTable
                head={['Frequency', 'Pola czasu', 'Kolumna Schedule pokazuje']}
                rows={[
                    [<code key="a">Daily</code>, t('`Hour`, `Minute`'), t('`Frequency Daily`, `When Every day at 01:00`')],
                    [<code key="b">Weekly</code>, t('`Day` (Monday–Sunday), `Hour`, `Minute`'), t('`When Mondays at 22:00`')],
                    [<code key="c">Monthly</code>, t('`Day` (Day 1–Day 28), `Hour`, `Minute`'), t('`When Day 15 at 03:30`')],
                    [<code key="d">On demand</code>, 'brak', t('tylko `Frequency On demand`; podpowiedź w formularzu: `This scan only runs when started manually.`')]
                ]}
            />
            <ul>
                <li>
                    <code>Hour</code> ma wartości 00–23, a <code>Minute</code> co 5 minut (00, 05, …, 55). Dla <code>Monthly</code> dostępne są dni 1–28, więc skan miesięczny nie wypada nigdy na nieistniejący dzień miesiąca.
                </li>
                <li>
                    Formularz nie ma pola strefy czasowej, a godzina jest zapisywana bez strefy (np. <code>mon 22:00</code>). Serwer interpretuje ją w <strong>lokalnej strefie systemu, na którym działa aplikacja</strong>. Pole <code>Next run</code> w karcie <code>Upcoming scan</code> jest podawane w tej samej strefie, natomiast czasy w Scan Results i Data Explorer są wyświetlane w UTC.
                </li>
            </ul>
            <CodeBlock
                lang="json"
                title="Zapisana konfiguracja (dla porównania z kolumnami listy)"
                code={`{
  "name": "Produkcja – nocny skan",
  "order": 1,
  "enabled": true,
  "criteria": [
    { "kind": "type", "value": "full" },
    { "kind": "host group", "value": "Produkcja" },
    { "kind": "fqdn", "value": "www.example.com" },
    { "kind": "frequency", "value": "Daily" },
    { "kind": "when", "value": "every 01:00" }
  ]
}`}
            />
            <p>
                Konfiguracje zapisane przed wprowadzeniem typów nie mają kryterium <code>type</code> i są traktowane jak <code>full</code>.
            </p>

            <H3 id="scheduler">Uruchamianie z harmonogramu</H3>
            <p>
                Zadanie w tle sprawdza harmonogramy co 30 sekund. Skan z harmonogramu startuje więc z opóźnieniem do pół minuty względem zapisanej godziny.
            </p>
            <ul>
                <li>
                    Termin następnego uruchomienia (<code>next_run_at</code>) jest wyliczany przy pierwszym przebiegu zadania po zapisie konfiguracji. Każda edycja konfiguracji zeruje termin i powoduje ponowne wyliczenie, a po uruchomieniu serwer wylicza kolejny.
                </li>
                <li>
                    Skanuje się wyłącznie konfiguracje o statusie <code>Enabled</code> i częstotliwości innej niż <code>On demand</code>. Gdy kilka jest wymagalnych jednocześnie, pierwsza jest ta z najwcześniejszym terminem (przy remisie decyduje <code>Order</code>).
                </li>
                <li>
                    Jednocześnie działa jeden skan. Jeśli slot jest zajęty albo konfiguracja nie ma żadnego celu do skanowania, termin nie przesuwa się, a próba powtarza się w kolejnym przebiegu.
                </li>
                <li>
                    Zaległe uruchomienia nie są nadrabiane: po przestoju aplikacji wymagalna konfiguracja uruchomi się raz, a następny termin wyliczy się od chwili uruchomienia.
                </li>
                <li>
                    Skan z harmonogramu ma w Scan Results etykietę równą nazwie konfiguracji i trigger <code>scheduled</code>.
                </li>
            </ul>

            <H3 id="zarzadzanie">Edycja, uruchomienie, usunięcie</H3>
            <RefTable
                head={['Akcja', 'Jak', 'Skutek']}
                rows={[
                    ['Uruchomienie', t('`Run now` w wierszu'), <>Natychmiast uruchamia skan z celami i typem tej konfiguracji, także gdy ma status <code>Disabled</code> lub <code>On demand</code>. Po sukcesie następuje przejście do Scan Status (<Link key="s" href="#sposoby">Cztery sposoby uruchomienia</Link>)</>],
                    ['Edycja', t('`Edit` w wierszu otwiera okno `Edit scan` z bieżącymi wartościami'), t('`Save` nadpisuje nazwę, kolejność, status, typ, cele i harmonogram. Cele, których nie ma już w ewidencji, nie są zaznaczone i po zapisie znikają')],
                    ['Wyłączenie', t('Przełącznik `Status` w oknie edycji, potem `Save`'), t('Kolumna `Status` pokazuje `Disabled`, a harmonogram przestaje uruchamiać skany. Konfiguracja zostaje na liście')],
                    ['Usunięcie', t('`Remove` i potwierdzenie `Remove this scan? This cannot be undone.`'), 'Konfiguracja jest usuwana trwale. Wyniki wcześniejszych uruchomień zostają w Scan Results']
                ]}
            />

            <H2 id="uruchomienie">Uruchomienie skanu</H2>
            <H3 id="sposoby">Cztery sposoby uruchomienia</H3>
            <RefTable
                head={['Sposób', 'Cele', 'Typ', 'Etykieta w Scan Results', 'Trigger']}
                rows={[
                    [t('`Start scan now` w karcie `Scan activity`'), 'Cała ewidencja', t('Z listy `Scan type` obok przycisku (domyślnie `Full scan test (httpx)`)'), <code key="a">Manual scan</code>, <code key="a2">manual</code>],
                    [t('`Start now` w karcie `Upcoming scan`'), 'Cała ewidencja, nie cele pokazanej konfiguracji', t('Z tej samej listy `Scan type`'), <code key="b">Manual scan</code>, <code key="b2">manual</code>],
                    [t('`Run now` w Scan Scheduling'), 'Cele konfiguracji', 'Typ konfiguracji', 'Nazwa konfiguracji', <code key="c">policy</code>],
                    ['Harmonogram', 'Cele konfiguracji', 'Typ konfiguracji', 'Nazwa konfiguracji', <code key="d">scheduled</code>]
                ]}
            />
            <ul>
                <li>
                    Skan z całej ewidencji obejmuje wszystkie adresy IP, zakresy CIDR i nazwy FQDN z Host management.
                </li>
                <li>
                    Uruchamianie, wstrzymywanie i przerywanie wymaga zapisu do strony <code>Scan Status</code>, a <code>Run now</code> – zapisu do <code>Scan Scheduling</code> (<Link href="/docs/dostep#sciezki">Dostęp i uprawnienia</Link>).
                </li>
                <li>
                    W jednej chwili działa <strong>jeden</strong> skan. Próba uruchomienia drugiego, a także skanu bez żadnego rozwiązanego celu, kończy się komunikatem <code>Could not start the scan. Another scan may already be running.</code> (API zwraca 409; <Link href="/docs/api#scan">API HTTP › Skan</Link>).
                </li>
            </ul>

            <H3 id="typy">Typy skanu</H3>
            <RefTable
                head={['', 'Full scan test', 'Reachability']}
                rows={[
                    ['Silnik', <><code key="a">httpx</code> (ProjectDiscovery)</>, <><code key="b">masscan</code>, a przy braku uprawnień lub programu sonda TCP</>],
                    ['Co sprawdza', 'Odpowiedź HTTP(S) hosta: kod statusu, tytuł, serwer, przekierowania, rozmiar, CDN i CNAME, HTTP/2, certyfikat TLS oraz technologie', t('Czy host odpowiada na któryś z portów 80, 443, 22, 445, 3389, 8443')],
                    ['Co zapisuje', <>Wszystkie pola obserwacji (<Link key="d" href="/docs/data-explorer#kolumny">kolumny Data Explorer</Link>)</>, t('Tylko status `Up`/`Down` i czasy `Last checked`; pozostałe dane z wcześniejszego skanu Full zostają nietknięte')],
                    ['Znaczenie Up / Down', 'Up: host odpowiedział po HTTP(S). Host, który nasłuchuje tylko na innym protokole, np. SSH, jest w skanie Full oznaczony jako Down', 'Up: otwarty co najmniej jeden z portów z listy'],
                    ['Wymagania', <>Program <code key="e">httpx</code> w wersji ProjectDiscovery; bez niego skan kończy się statusem <code>Failed</code> (<Link key="f" href="/docs/architektura#konfiguracja">Architektura › Konfiguracja</Link>)</>, t('masscan wymaga uprawnień do surowych gniazd. Gdy go brakuje, zawodzi albo nie znajdzie żadnego hosta, skan przechodzi na sprawdzenie połączeniem TCP (silnik w Scan Status: `TCP probe`)')]
                ]}
            />
            <ul>
                <li>
                    <code>httpx</code> działa z limitem czasu 10 s na host, jedną ponowną próbą i 25 wątkami, podąża za przekierowaniami. Informacja o jednym porcie hosta w kolumnie usług pochodzi z odpowiedzi, którą zwrócił httpx (<code>HTTP</code> lub <code>HTTPS</code>).
                </li>
                <li>
                    masscan skanuje z szybkością 1000 pakietów na sekundę i obsługuje tylko IPv4. Sonda TCP łączy się z sześcioma portami równolegle (limit czasu 2 s), a host uznaje za dostępny, gdy któryś port przyjmie połączenie; sprawdza jednocześnie 64 hosty.
                </li>
                <li>
                    Skan Full zapisuje stan jednej, bieżącej linii na adres: nowy skan nadpisuje poprzednie pola, a historii zmian dla pojedynczego hosta aplikacja nie przechowuje. O zmianach informuje <Link href="/docs/alerty">Alerts</Link>.
                </li>
            </ul>

            <H3 id="rozwiazywanie">Rozwiązywanie celów</H3>
            <p>Przed startem serwer zamienia cele konfiguracji (albo całą ewidencję) na listę adresów do sprawdzenia:</p>
            <ol>
                <li>
                    Grupa jest rozwijana do swoich adresów IP, zakresów i nazw FQDN. Skan bez celów (ręczny) bierze wszystkie wpisy ewidencji.
                </li>
                <li>
                    Zakres CIDR jest rozwijany do adresów, <strong>łącznie z adresem sieci i rozgłoszeniowym</strong>, ale nie więcej niż <strong>1024 adresy z jednego zakresu</strong> (od początku bloku). Zakresy IPv6 są pomijane; pojedyncze adresy IPv6 są skanowane.
                </li>
                <li>
                    Nazwy FQDN są zamieniane na pierwszy adres z DNS. Nazwa bez adresu jest pomijana, a skan i jego wyniki dotyczą <strong>adresu IP</strong>, nie nazwy.
                </li>
                <li>
                    Lista jest deduplikowana i skracana do <strong>2048 adresów</strong>.
                </li>
            </ol>
            <Callout type="warning" title="Skrócona lista celów">
                Adresy ponad oba limity nie są skanowane, ale uruchomienie nie kończy się błędem: sumaryczną liczbę pominiętych adresów podaje komunikat <code>Target list truncated: N address(es) beyond the 2048 scan cap were skipped.</code> w oknie Scan details (<Link href="/docs/wyniki#szczegoly">Wyniki i analiza</Link>). Zakres większy niż <code>/22</code> jest skanowany tylko od początku bloku, a w jednym skanie mieści się najwyżej 2048 adresów. Większe środowisko podziel na kilka konfiguracji.
            </Callout>

            <H3 id="stan">Scan Status</H3>
            <p>
                Karta <code>Scan activity</code> pokazuje stan (<code>Running</code>, <code>Paused</code>, <code>Idle</code>), pasek postępu z procentem, bieżący cel (<code>Scanning …</code>), linię z typem i silnikiem (np. <code>Full scan test · httpx</code>) oraz liczniki <code>Targets scanned</code> (<code>wykonane / wszystkie</code>), <code>Hosts discovered</code>, <code>Started</code> i <code>Alerts raised</code>. Dane odświeżają się co 1,5 s.
            </p>
            <ul>
                <li>
                    <code>Pause scan</code> / <code>Resume scan</code> wstrzymuje i wznawia trwający skan; <code>Cancel scan</code> go przerywa.
                </li>
                <li>
                    Gdy nic nie działa, karta pokazuje <code>No scan in progress</code> i <code>Last scan finished …</code> (pierwsze uruchomienie: zachętę do startu), listę <code>Scan type</code> oraz przycisk <code>Start scan now</code>.
                </li>
                <li>
                    Licznik <code>Alerts raised</code> uzupełnia się dopiero na końcu skanu, kiedy karta przechodzi już w stan bezczynności, więc ostateczną liczbę alertów odczytasz z Scan Results lub strony Alerts (<Link href="/docs/alerty">Alerty</Link>).
                </li>
            </ul>

            <H3 id="przejscia">Stany i przejścia</H3>
            <RefTable
                head={['Akcja', 'Skutek']}
                rows={[
                    [t('`Start scan now` / `Start now` / `Run now`'), 'Zawsze zaczyna od zera: postęp 0%, nowy wiersz w Scan Results ze statusem Running'],
                    [t('`Pause scan`'), t('Przełącza wstrzymanie trwającego skanu. W skanie Full zatrzymuje odczyt wyników httpx do czasu wznowienia. W skanie Reachability działa tylko do rozpoczęcia sondy: raz uruchomiona sonda dobiega końca')],
                    [t('`Resume scan`'), 'Wznawia od miejsca wstrzymania'],
                    [t('`Cancel scan`'), 'Natychmiast zamyka skan ze statusem Cancelled. Proces httpx jest zatrzymywany, sonda TCP przerywa po bieżącej partii 64 hostów, a uruchomiony już masscan dobiega końca'],
                    ['Wszystkie cele sprawdzone', t('Skan kończy się statusem `Completed`; wiersz uzupełnia czas zakończenia, czas trwania i liczniki, a ze zmian względem wcześniejszych skanów powstają alerty')],
                    ['Błąd silnika', t('Status `Failed` z komunikatem widocznym w oknie Scan details, np. brak programu httpx')],
                    ['Restart aplikacji w trakcie skanu', t('Przy starcie wiersz skanu w stanie Running dostaje status `Failed` z komunikatem `interrupted by restart`')]
                ]}
            />
            <p>
                Alerty są wyliczane z tego, co skan zdążył zapisać, także gdy zostanie przerwany albo zakończy się błędem.
            </p>

            <H3 id="kolejka">Upcoming scan i Scan queue</H3>
            <p>
                Karta <code>Upcoming scan</code> pokazuje pola <code>Policy</code>, <code>Next run</code>, <code>Schedule</code>, <code>Target</code> i <code>Hosts in scope</code>. Dane pochodzą z <strong>włączonej konfiguracji z najbliższym terminem</strong>; <code>Hosts in scope</code> to liczba celów rozwiązana w chwili wyświetlenia strony (według zasad z rozdziału Rozwiązywanie celów). Bez włączonej konfiguracji z harmonogramem karta pokazuje wartości przykładowe.
            </p>
            <Callout type="note" title="Start now nie uruchamia pokazanej konfiguracji">
                <code>Start now</code> w karcie <code>Upcoming scan</code> startuje skan całej ewidencji o typie wybranym na liście <code>Scan type</code>. Aby uruchomić konkretną konfigurację, użyj <code>Run now</code> w Scan Scheduling.
            </Callout>
            <p>
                Karta <code>Scan queue</code> ma stałą, przykładową zawartość i nie odzwierciedla żadnej kolejki: aplikacja uruchamia jeden skan naraz i nie kolejkuje następnych.
            </p>
        </DocPage>
    );
}
