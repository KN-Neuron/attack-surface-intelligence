import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { RefTable } from '@/components/ui/ref-table';

export const metadata: Metadata = { title: 'Wprowadzenie' };

export default function Page() {
    return (
        <DocPage
            href="/docs"
            title="Wprowadzenie"
            lead="Visibly pozwala organizacji zadeklarować własne zasoby sieciowe, wybrać z nich podzbiór do skanowania i analizować obserwacje z kolejnych uruchomień. Dokumentacja jest przeznaczona dla osób technicznych, które znają adresację IP, DNS i usługi sieciowe."
            toc={[
                { id: 'zakres', label: 'Do czego służy aplikacja' },
                { id: 'pojecia', label: 'Ewidencja, cel, uruchomienie, obserwacja' },
                { id: 'workflow', label: 'Workflow' },
                { id: 'krok-1', label: '1. Host Management', level: 3 },
                { id: 'krok-2', label: '2. Scan Scheduling', level: 3 },
                { id: 'krok-3', label: '3. Scan Results', level: 3 },
                { id: 'krok-4', label: '4. Data Explorer', level: 3 },
                { id: 'krok-5', label: '5. Alerts', level: 3 },
                { id: 'krok-6', label: '6. Latest Scan summary', level: 3 },
                { id: 'mapa', label: 'Mapa aplikacji' },
                { id: 'konwencje', label: 'Jak czytać dokumentację' }
            ]}
        >
            <H2 id="zakres">Do czego służy aplikacja</H2>
            <p>
                Użytkownik wprowadza do aplikacji zasoby z ewidencji organizacji (adresy IP, zakresy CIDR, nazwy FQDN), wybiera, które z nich skanować, i przegląda, co wykryto. Skanowane są wyłącznie zasoby zadeklarowane w ewidencji. Typowe zastosowania:
            </p>
            <ul>
                <li>oddzielne skanowanie środowiska produkcyjnego i deweloperskiego, każde z własną konfiguracją;</li>
                <li>wykrywanie zmian między skanami: nowych hostów, hostów, które przestały odpowiadać, i technologii w wersjach ze znanymi podatnościami;</li>
                <li>sprawdzenie, na których hostach działa konkretna aplikacja, np. Nginx albo WordPress, i jak wygląda ich odpowiedź HTTP oraz certyfikat TLS.</li>
            </ul>

            <H2 id="pojecia">Ewidencja, cel, uruchomienie, obserwacja</H2>
            <p>Te pięć pojęć występuje w całej dokumentacji i odpowiada różnym ekranom aplikacji:</p>
            <RefTable
                head={['Pojęcie', 'Przykład', 'Gdzie']}
                rows={[
                    ['Wpis w ewidencji', <><code key="a">198.51.100.0/24</code> dodany w Host management</>, <Link key="l1" href="/docs/hosty">Host management</Link>],
                    ['Cel skanu', 'Ten zakres zaznaczony w sekcji Targets konfiguracji', <Link key="l2" href="/docs/skanowanie#cele">Skanowanie › Cele</Link>],
                    ['Konfiguracja / harmonogram', <><code key="c">Produkcja – nocny skan</code>, codziennie o 01:00</>, <Link key="l3" href="/docs/skanowanie#harmonogramy">Scan Scheduling</Link>],
                    ['Uruchomienie', <><code key="d">Produkcja – nocny skan</code> z 21 listopada, status Completed</>, <Link key="l4" href="/docs/wyniki#wyniki">Scan Results</Link>],
                    ['Obserwacja', <>Host 198.51.100.7 z technologią <code key="e">Nginx 1.24.0</code></>, <Link key="l5" href="/docs/data-explorer">Data Explorer</Link>]
                ]}
            />
            <p>
                Host może być w ewidencji i zostać wybrany jako cel, a dopiero wynik konkretnego uruchomienia pokazuje, co na nim faktycznie wykryto. Licznik wpisów w ewidencji nie jest liczbą hostów wykrytych w skanie (<Link href="/docs/hosty#liczniki">Liczniki: ewidencja a skan</Link>).
            </p>

            <H2 id="workflow">Workflow</H2>
            <p>Typowa kolejność pracy z aplikacją. Każdy krok prowadzi do rozdziału, który opisuje funkcję w całości.</p>

            <H3 id="krok-1">1. Host Management: zbuduj ewidencję</H3>
            <p>
                W <code>Host management</code> dodaj pojedyncze adresy IP, zakresy CIDR lub nazwy FQDN (<code>Add IPs</code>, <code>Add IP range</code>, <code>Add FQDN</code>) albo zaimportuj je z pliku (<code>Import hosts</code>). Zapisane wpisy tworzą host inventory. Opcjonalnie oznacz je tagami albo zbierz w grupy (<code>Host groups</code>), jeśli chcesz wybierać cały zestaw jednym kliknięciem.
            </p>
            <p>
                Szczegóły: <Link href="/docs/hosty#dodawanie">Dodawanie wpisów</Link>, <Link href="/docs/hosty#import">Import z pliku CSV</Link>, <Link href="/docs/hosty#grupy">Host groups</Link>, <Link href="/docs/tagowanie">Tagowanie</Link>.
            </p>

            <H3 id="krok-2">2. Scan Scheduling: skonfiguruj skan</H3>
            <p>
                W <code>Scan Scheduling</code> kliknij <code>Add scan</code>, nadaj konfiguracji nazwę, wybierz typ skanu (<code>Full scan test</code> albo <code>Reachability</code>), zaznacz cele z ewidencji (grupy, adresy, zakresy, FQDN) i wybierz częstotliwość: <code>Daily</code>, <code>Weekly</code>, <code>Monthly</code> albo <code>On demand</code>. Włączona konfiguracja uruchamia się sama w wyznaczonym terminie.
            </p>
            <p>
                Skan możesz też uruchomić od razu: <code>Run now</code> przy konfiguracji albo <code>Start scan now</code> w <code>Scan Management</code>, gdzie widać też postęp i można skan wstrzymać lub przerwać.
            </p>
            <p>
                Szczegóły: <Link href="/docs/skanowanie#nowy">Tworzenie skanu</Link>, <Link href="/docs/skanowanie#typy">Typy skanu</Link>, <Link href="/docs/skanowanie#scheduler">Uruchamianie z harmonogramu</Link>, <Link href="/docs/skanowanie#uruchomienie">Uruchomienie skanu</Link>.
            </p>
            <Callout type="note" title="Programy skanujące">
                Skan Full wymaga zainstalowanego programu <code>httpx</code>, a szybka sonda Reachability programu <code>masscan</code> (<Link href="/docs/architektura#konfiguracja">Architektura › Uruchomienie i konfiguracja</Link>).
            </Callout>

            <H3 id="krok-3">3. Scan Results: znajdź uruchomienie</H3>
            <p>
                W <code>Scan Results</code> odszukaj uruchomienie po dacie (<code>Started</code>) i sprawdź jego <code>Status</code>. Wiersz zawiera typ, cel, czas trwania, liczbę hostów aktywnych i nieaktywnych, usług i alertów, a przycisk <code>Details</code> otwiera podsumowanie uruchomienia z podziałem alertów, celami i najczęstszymi technologiami.
            </p>
            <p>
                Szczegóły: <Link href="/docs/wyniki#wyniki">Scan Results</Link>, <Link href="/docs/wyniki#szczegoly">Szczegóły uruchomienia</Link>.
            </p>

            <H3 id="krok-4">4. Data Explorer: sprawdź stan hostów</H3>
            <p>
                W <code>Data Explorer</code> zobaczysz, co skan zapisał o każdym adresie: status, odpowiedź HTTP, technologie, certyfikat i czasy. Dodaj filtr, np. <code>Technologies contains nginx</code>, i kliknij <code>Apply</code>; okres zmienia lista <code>Timeframe</code>. Filtrowania po tagu hosta w obecnej wersji nie ma; obejście opisuje rozdział o tagach.
            </p>
            <p>
                Szczegóły: <Link href="/docs/data-explorer#filtry">Filtry</Link>, <Link href="/docs/data-explorer#przyklad">Przykład: gdzie działa Nginx</Link>.
            </p>

            <H3 id="krok-5">5. Alerts: potwierdź zmiany</H3>
            <p>
                Po każdym skanie na stronie <code>Alerts</code> pojawiają się nowe hosty, hosty, które przestały odpowiadać, i technologie w wersjach ze znaną podatnością. Przejrzyj zakładkę <code>New</code> i potwierdź alerty, które zostały obsłużone.
            </p>
            <p>
                Szczegóły: <Link href="/docs/alerty#reguly">Reguły alertów</Link>, <Link href="/docs/alerty#potwierdzanie">Potwierdzanie</Link>.
            </p>

            <H3 id="krok-6">6. Latest Scan summary: sprawdź skrót</H3>
            <p>
                Na dashboardzie <code>Latest Scan summary</code> odczytaj datę <code>Latest scan</code> i kafelek <code>Open alerts</code>. Pozostałe kafelki i tabele tego ekranu pokazują dane przykładowe.
            </p>
            <p>
                Szczegóły: <Link href="/docs/wyniki#latest">Latest Scan summary</Link>.
            </p>

            <H2 id="mapa">Mapa aplikacji</H2>
            <p>Menu boczne pokazuje tylko ekrany, do których konto ma dostęp (<Link href="/docs/dostep#role">Dostęp i uprawnienia</Link>).</p>
            <RefTable
                head={['Ekran w menu', 'Ścieżka', 'Zadanie', 'Opis']}
                rows={[
                    ['Dashboards › Latest Scan summary', <code key="1">/dashboards/scan-summary</code>, 'Skrót najnowszego wyniku', <Link key="d1" href="/docs/wyniki#latest">Latest Scan summary</Link>],
                    ['Dashboards › Technologies used', <code key="2">/dashboards/technologies-used</code>, 'Wykryte technologie i hosty, na których działają', <Link key="d2" href="/docs/wyniki#technologies">Technologies used</Link>],
                    ['Dashboards › Vulnerable versions', <code key="3">/dashboards/vulnerable-versions</code>, 'Wykryte wersje z podatnościami (CVE)', <Link key="d3" href="/docs/wyniki#vulnerable">Vulnerable versions</Link>],
                    ['Dashboards › Alerts', <code key="3a">/log-center/alerts</code>, 'Zmiany wykryte przez skany do potwierdzenia', <Link key="d3a" href="/docs/alerty">Alerty</Link>],
                    ['Scanning › Scan Management', <code key="4">/scanning/management</code>, 'Start, pauza i przerwanie skanu, postęp na żywo', <Link key="d4" href="/docs/skanowanie#stan">Scan Management</Link>],
                    ['Scanning › Scan Scheduling', <code key="5">/scanning/policies</code>, 'Konfiguracje skanów: typ, cele i harmonogram', <Link key="d5" href="/docs/skanowanie#harmonogramy">Scan Scheduling</Link>],
                    ['Scanning › Scan Results', <code key="6">/log-center/scan-history</code>, 'Lista uruchomień ze statusem i szczegółami', <Link key="d6" href="/docs/wyniki#wyniki">Scan Results</Link>],
                    ['Scanning › Compare Scans', <code key="7">/scanning/compare-scans</code>, 'Zestawienie dwóch uruchomień', <Link key="d7" href="/docs/wyniki#porownanie">Compare Scans</Link>],
                    ['Host management', <code key="8">/host-management</code>, 'Ewidencja: IP, zakresy, FQDN, grupy, import', <Link key="d8" href="/docs/hosty">Host management</Link>],
                    ['Data Explorer', <code key="9">/log-center/data-explorer</code>, 'Tabela hostów z filtrami', <Link key="d9" href="/docs/data-explorer">Data Explorer</Link>],
                    ['Admin management', <code key="10">/admin-management</code>, 'Konta administratorów i role', <Link key="d10" href="/docs/dostep#konta">Dostęp i uprawnienia</Link>],
                    ['Settings', <code key="11">/settings</code>, 'Motyw interfejsu', <Link key="d11" href="/docs/architektura#status">Architektura › Status funkcji</Link>]
                ]}
            />

            <H2 id="konwencje">Jak czytać dokumentację</H2>
            <ul>
                <li>
                    Każdy fakt jest opisany <strong>raz</strong>, w rozdziale, do którego należy. Pozostałe strony odsyłają do niego linkami.
                </li>
                <li>
                    Nazwy ekranów, pól i przycisków podajemy w oryginale, kodem, tak jak w interfejsie: <code>Add IPs</code>, <code>Import hosts</code>, <code>Start scan now</code>.
                </li>
                <li>
                    Nazwy <code>Produkcja</code>, <code>Development</code> i <code>serwery-www</code> to przykładowe nazwy grup i tagów nadane przez użytkownika, a nie elementy aplikacji. Adresy w przykładach pochodzą z zakresów dokumentacyjnych (<code>203.0.113.0/24</code>, <code>198.51.100.0/24</code>) i domeny <code>example.com</code>.
                </li>
                <li>
                    Funkcje, które działają inaczej niż wynikałoby z nazwy ekranu albo opierają się na danych przykładowych, są oznaczone ostrzeżeniem; pełne zestawienie zawiera <Link href="/docs/architektura#status">Architektura › Status funkcji</Link>.
                </li>
                <li>
                    Wyszukiwarka u góry (<kbd>Ctrl</kbd> + <kbd>K</kbd>) przeszukuje spis stron, a asystent (✦) odpowiada na podstawie treści tej dokumentacji.
                </li>
            </ul>
            <Callout type="note" title="Dokumentacja z aplikacji">
                Przycisk „?” w aplikacji otwiera ten serwis. Adres ustawia zmienna środowiskowa <code>DOCS_URL</code> (<Link href="/docs/architektura#konfiguracja">Architektura › Uruchomienie i konfiguracja</Link>).
            </Callout>
        </DocPage>
    );
}
