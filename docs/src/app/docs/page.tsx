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
                { id: 'krok-5', label: '5. Latest Scan summary', level: 3 },
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
                <li>sprawdzanie, jak zmieniają się usługi wykrywane na hostach między kolejnymi skanami;</li>
                <li>odtworzenie historii wykryć konkretnej aplikacji, np. na których hostach i kiedy pojawił się Nginx albo WordPress.</li>
            </ul>

            <H2 id="pojecia">Ewidencja, cel, uruchomienie, obserwacja</H2>
            <p>Te pięć pojęć występuje w całej dokumentacji i odpowiada różnym ekranom aplikacji:</p>
            <RefTable
                head={['Pojęcie', 'Przykład', 'Gdzie']}
                rows={[
                    ['Wpis w ewidencji', <><code key="a">198.51.100.0/24</code> dodany w Host management</>, <Link key="l1" href="/docs/hosty">Host management</Link>],
                    ['Cel skanu', 'Ten zakres zaznaczony w sekcji Targets konfiguracji', <Link key="l2" href="/docs/skanowanie#cele">Skanowanie › Cele</Link>],
                    ['Konfiguracja / harmonogram', <><code key="c">Produkcja – nocny skan</code>, codziennie o 01:00</>, <Link key="l3" href="/docs/skanowanie#harmonogramy">Scan Scheduling</Link>],
                    ['Uruchomienie', <><code key="d">Scan #57</code> z 21 listopada, status Completed</>, <Link key="l4" href="/docs/wyniki#wyniki">Scan Results</Link>],
                    ['Obserwacja', <><code key="e">Detected nginx 1.24.0</code> na hoście 198.51.100.7</>, <Link key="l5" href="/docs/wyniki#data-explorer">Data Explorer</Link>]
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
                W <code>Scan Scheduling</code> kliknij <code>Add scan</code>, nadaj konfiguracji nazwę, zaznacz cele z ewidencji (grupy, adresy, zakresy, FQDN) i wybierz częstotliwość: <code>Daily</code>, <code>Weekly</code>, <code>Monthly</code> albo <code>On demand</code>. Skan ręczny uruchamiasz przyciskiem <code>Start scan now</code> w <code>Scan Management</code>.
            </p>
            <p>
                Szczegóły: <Link href="/docs/skanowanie#nowy">Tworzenie skanu</Link>, <Link href="/docs/skanowanie#uruchomienie">Uruchomienie skanu</Link>.
            </p>
            <Callout type="warning" title="Stan obecnej wersji">
                Harmonogramy są zapisywane, ale nie uruchamiają skanów automatycznie, a skan ręczny działa na stałej, przykładowej puli celów (<Link href="/docs/skanowanie#czas">Skanowanie › Harmonogram</Link>).
            </Callout>

            <H3 id="krok-3">3. Scan Results: znajdź uruchomienie</H3>
            <p>
                W <code>Scan Results</code> odszukaj uruchomienie po dacie (<code>Started</code>) i sprawdź jego <code>Status</code>. Wiersz zawiera wszystkie dane uruchomienia: cel, czas trwania, liczbę hostów aktywnych i nieaktywnych, usług, technologii i podatności. Aby zobaczyć, co się zmieniło, zestaw je z wcześniejszym uruchomieniem tego samego celu w <code>Compare Scans</code>.
            </p>
            <p>
                Szczegóły: <Link href="/docs/wyniki#wyniki">Scan Results</Link>, <Link href="/docs/wyniki#szczegoly">Szczegóły uruchomienia</Link>, <Link href="/docs/wyniki#porownanie">Compare Scans</Link>.
            </p>

            <H3 id="krok-4">4. Data Explorer: prześledź historię obserwacji</H3>
            <p>
                Z wyniku przejdź do pojedynczych obserwacji. W <code>Data Explorer</code> wpisz w <code>Search events</code> nazwę aplikacji, np. <code>nginx</code>, i odczytaj z kolumn <code>Host</code> i <code>Event Time</code>, gdzie i kiedy ją wykryto. Filtra po tagu i po początkowym znaczniku czasu w obecnej wersji nie ma; obejście opisuje przykład w rozdziale.
            </p>
            <p>
                Szczegóły: <Link href="/docs/wyniki#data-explorer">Data Explorer</Link>, <Link href="/docs/wyniki#data-explorer-przyklad">Przykład: gdzie wykryto Nginx</Link>.
            </p>

            <H3 id="krok-5">5. Latest Scan summary: sprawdź skrót</H3>
            <p>
                Na dashboardzie <code>Latest Scan summary</code> odczytaj datę <code>Latest scan</code>, czyli skan, którego dotyczy skrót, oraz kafelki <code>Reachable hosts</code>, <code>Unreachable hosts</code> i <code>Detected services</code>. Selektor okresu zmienia tylko te trzy kafelki.
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
                    ['Scanning › Scan Management', <code key="4">/scanning/management</code>, 'Uruchomienie, pauza i przerwanie skanu', <Link key="d4" href="/docs/skanowanie#stan">Scan Management</Link>],
                    ['Scanning › Scan Scheduling', <code key="5">/scanning/policies</code>, 'Konfiguracje skanów: cele i harmonogram', <Link key="d5" href="/docs/skanowanie#harmonogramy">Scan Scheduling</Link>],
                    ['Scanning › Scan Results', <code key="6">/log-center/scan-history</code>, 'Lista uruchomień z datą i statusem', <Link key="d6" href="/docs/wyniki#wyniki">Scan Results</Link>],
                    ['Scanning › Compare Scans', <code key="7">/scanning/compare-scans</code>, 'Zestawienie dwóch uruchomień', <Link key="d7" href="/docs/wyniki#porownanie">Compare Scans</Link>],
                    ['Host management', <code key="8">/host-management</code>, 'Ewidencja: IP, zakresy, FQDN, grupy, import', <Link key="d8" href="/docs/hosty">Host management</Link>],
                    ['Data Explorer', <code key="9">/log-center/data-explorer</code>, 'Pojedyncze obserwacje ze skanów', <Link key="d9" href="/docs/wyniki#data-explorer">Data Explorer</Link>],
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
