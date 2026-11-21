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
            lead="Konfiguracja skanów i harmonogramów (Scan Scheduling) oraz ręczne uruchamianie i śledzenie bieżącego skanu (Scan Management)."
            toc={[
                { id: 'pojecia', label: 'Konfiguracja, uruchomienie, wynik' },
                { id: 'harmonogramy', label: 'Scan Scheduling' },
                { id: 'nowy', label: 'Tworzenie skanu', level: 3 },
                { id: 'cele', label: 'Cele', level: 3 },
                { id: 'czas', label: 'Harmonogram i strefa czasowa', level: 3 },
                { id: 'zarzadzanie', label: 'Edycja, wyłączenie, usunięcie', level: 3 },
                { id: 'uruchomienie', label: 'Uruchomienie skanu' },
                { id: 'stan', label: 'Scan Management', level: 3 },
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
                    ['Konfiguracja (harmonogram)', 'Scan Scheduling', 'Nazwany zestaw celów z informacją, kiedy i jak często skan ma się odbywać'],
                    ['Uruchomienie', 'Scan Management, Scan Results', 'Jedno wykonanie skanu z datą rozpoczęcia, zakończenia i statusem'],
                    ['Obserwacja', 'Scan Results, Data Explorer, dashboardy', <>Coś, co wykryto podczas uruchomienia: aktywny host, usługa, technologia, podatność (<Link key="w" href="/docs/wyniki">Wyniki i analiza</Link>)</>]
                ]}
            />

            <H2 id="harmonogramy">Scan Scheduling</H2>
            <p>
                Ekran <code>Scan Scheduling</code> (w menu: Scanning › Scan Scheduling) zawiera listę zapisanych konfiguracji skanów z kolumnami <code>Order</code>, <code>Name</code>, <code>Targets</code>, <code>Schedule</code>, <code>Status</code> i <code>Actions</code>. Lista jest posortowana według <code>Order</code>.
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
                    [<code key="c">IP ranges</code>, 'Zakres CIDR z zakładki IP ranges; obejmuje wszystkie adresy bloku', <code key="c2">IP range</code>],
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
                    Cel jest zapisywany jako tekst (nazwa grupy, adres, zakres, nazwa). Zmiana nazwy grupy lub zmiana i usunięcie wpisu w ewidencji nie aktualizują zapisanych celów (<Link href="/docs/hosty#edycja">Host management › Edycja i usuwanie</Link>,{' '}
                    <Link href="/docs/hosty#grupa-skutki">Grupa a harmonogramy</Link>).
                </li>
            </ul>
            <p>
                Do oddzielnego skanowania środowisk utwórz dwie konfiguracje, np. <code>Produkcja – nocny skan</code> z celem w postaci grupy <code>Produkcja</code> i <code>Development – tygodniowy</code> z grupą <code>Development</code>. Wyniki obu będą wtedy porównywalne tylko w obrębie tej samej konfiguracji (<Link href="/docs/wyniki#porownanie">Compare Scans</Link>).
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
                    Formularz nie ma pola strefy czasowej, a godzina jest zapisywana bez strefy (np. <code>mon 22:00</code>). Pozostałe daty w aplikacji, np. <code>Added</code> czy czas rozpoczęcia skanu, pochodzą z zegara serwera.
                </li>
            </ul>
            <Callout type="warning" title="Harmonogram nie uruchamia jeszcze skanów">
                Zapisany harmonogram jest dziś konfiguracją i opisem: żaden proces w tle nie odczytuje pól <code>Frequency</code> i czasu ani nie dodaje uruchomień do kolejki. Skan uruchamia się wyłącznie ręcznie (<Link href="#uruchomienie">Uruchomienie skanu</Link>). Z tego samego powodu nie ma momentu, w którym skład grupy byłby odczytywany dla zaplanowanego uruchomienia.
            </Callout>
            <CodeBlock
                lang="json"
                title="Zapisana konfiguracja (dla porównania z kolumnami listy)"
                code={`{
  "name": "Produkcja – nocny skan",
  "order": 1,
  "enabled": true,
  "criteria": [
    { "kind": "host group", "value": "Produkcja" },
    { "kind": "fqdn", "value": "www.example.com" },
    { "kind": "frequency", "value": "Daily" },
    { "kind": "when", "value": "every 01:00" }
  ]
}`}
            />

            <H3 id="zarzadzanie">Edycja, wyłączenie, usunięcie</H3>
            <RefTable
                head={['Akcja', 'Jak', 'Skutek']}
                rows={[
                    ['Edycja', t('`Edit` w wierszu otwiera okno `Edit scan` z bieżącymi wartościami'), t('`Save` nadpisuje nazwę, kolejność, status, cele i harmonogram. Cele, których nie ma już w ewidencji, nie są zaznaczone i po zapisie znikają')],
                    ['Wyłączenie', t('Przełącznik `Status` w oknie edycji, potem `Save`'), t('Kolumna `Status` pokazuje `Disabled`. Konfiguracja zostaje na liście')],
                    ['Usunięcie', t('`Remove` i potwierdzenie `Remove this scan? This cannot be undone.`'), 'Konfiguracja jest usuwana trwale. Historia wyników nie jest kasowana']
                ]}
            />

            <H2 id="uruchomienie">Uruchomienie skanu</H2>
            <p>
                Skan ręczny uruchamia się na ekranie <code>Scan Management</code>, a nie z wiersza harmonogramu: lista Scan Scheduling nie ma akcji uruchomienia. Są dwa przyciski o tym samym działaniu:
            </p>
            <ul>
                <li>
                    <code>Start scan now</code> w karcie <code>Scan activity</code>, widoczny, gdy żaden skan nie trwa (<code>No scan in progress</code>);
                </li>
                <li>
                    <code>Start now</code> w karcie <code>Upcoming scan</code>.
                </li>
            </ul>
            <p>
                Uruchomienie wymaga uprawnienia zapisu do strony <code>Scan Management</code> (<Link href="/docs/dostep#role">Dostęp i uprawnienia</Link>).
            </p>
            <Callout type="warning" title="Przebieg skanu jest symulowany">
                <p>
                    W obecnej wersji uruchomienie nie korzysta z celów żadnej konfiguracji ani z ewidencji. Skan przechodzi przez stałą pulę 12 bloków <code>10.0.0.0/24</code> … <code>10.0.11.0/24</code>, postęp rośnie o 0,9 punktu procentowego na sekundę (pełny przebieg trwa ok. 2 minuty), a licznik hostów rośnie o kilka na sekundę.
                </p>
                <p>
                    Zakończony przebieg nie dopisuje nowego wiersza w Scan Results (<Link href="/docs/architektura#status">Architektura › Status funkcji</Link>).
                </p>
            </Callout>

            <H3 id="stan">Scan Management</H3>
            <p>
                Karta <code>Scan activity</code> pokazuje stan (<code>Running</code>, <code>Paused</code>, <code>Idle</code>), pasek postępu z procentem, bieżący cel (<code>Scanning …</code>) i liczniki <code>Targets scanned</code>, <code>Hosts discovered</code> oraz <code>Started</code>. Dane odświeżają się automatycznie co 1,5 s.
            </p>
            <ul>
                <li>
                    <code>Pause scan</code> / <code>Resume scan</code> wstrzymuje i wznawia trwający skan.
                </li>
                <li>
                    <code>Cancel scan</code> przerywa skan. Po zakończeniu lub przerwaniu karta pokazuje <code>Last scan finished …</code>.
                </li>
            </ul>

            <H3 id="przejscia">Stany i przejścia</H3>
            <RefTable
                head={['Akcja', 'Skutek']}
                rows={[
                    [t('`Start scan now` / `Start now`'), 'Zawsze zaczyna od zera: postęp 0%, pierwszy cel z puli, czas rozpoczęcia „teraz”'],
                    [t('`Pause scan`'), 'Wstrzymuje przyrost postępu i liczników; działa tylko na trwającym skanie'],
                    [t('`Resume scan`'), 'Wznawia od miejsca wstrzymania'],
                    [t('`Cancel scan`'), 'Kończy skan, zapisuje czas zakończenia; postęp zostaje na osiągniętej wartości'],
                    ['Postęp 100%', 'Skan kończy się samoczynnie i zapisuje czas zakończenia']
                ]}
            />

            <H3 id="kolejka">Upcoming scan i Scan queue</H3>
            <p>
                Karta <code>Upcoming scan</code> pokazuje pola <code>Policy</code>, <code>Next run</code>, <code>Schedule</code>, <code>Target</code> i <code>Hosts in scope</code>, a karta <code>Scan queue</code> listę pozycji ze stanem <code>In progress</code> lub <code>Queued</code>. Obie karty mają dziś stałą, przykładową zawartość i nie wynikają z zapisanych harmonogramów; nie traktuj ich jako informacji o najbliższym uruchomieniu.
            </p>
        </DocPage>
    );
}
