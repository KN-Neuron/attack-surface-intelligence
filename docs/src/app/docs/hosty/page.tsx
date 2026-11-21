import type { Metadata } from 'next';
import { t } from '@/components/docs/inline';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';
import { ImportPreviewMock } from '@/components/docs/ui-mocks';

export const metadata: Metadata = { title: 'Host management' };

export default function Page() {
    return (
        <DocPage
            href="/docs/hosty"
            title="Host management"
            lead="Ewidencja hostów (host inventory) to lista zasobów, które organizacja deklaruje jako swoje: adresy IP, zakresy CIDR i nazwy FQDN. Z tej listy wybiera się cele skanów; wpisy można tagować i łączyć w grupy."
            toc={[
                { id: 'ekran', label: 'Ekran Host management' },
                { id: 'typy', label: 'Typy wpisów' },
                { id: 'dodawanie', label: 'Dodawanie wpisów' },
                { id: 'zapisane', label: 'Co zostało zapisane' },
                { id: 'liczniki', label: 'Liczniki: ewidencja a skan', level: 3 },
                { id: 'edycja', label: 'Edycja i usuwanie' },
                { id: 'import', label: 'Import z pliku CSV' },
                { id: 'format', label: 'Format pliku', level: 3 },
                { id: 'podglad', label: 'Podgląd i zatwierdzenie', level: 3 },
                { id: 'klasyfikacja', label: 'Klasyfikacja wpisów', level: 3 },
                { id: 'grupy', label: 'Host groups' },
                { id: 'grupa-kroki', label: 'Tworzenie i edycja grupy', level: 3 },
                { id: 'grupa-skutki', label: 'Grupa a harmonogramy', level: 3 }
            ]}
        >
            <H2 id="ekran">Ekran Host management</H2>
            <p>
                Ekran otwiera pozycja <code>Host management</code> w menu bocznym. Ma cztery zakładki: <code>IPs</code>, <code>IP ranges</code>, <code>FQDNs</code> i <code>Host groups</code>. Przycisk po prawej stronie paska zakładek zmienia się razem z zakładką (<code>Add IPs</code>, <code>Add IP range</code>,{' '}
                <code>Add FQDN</code>, <code>New group</code>), a przycisk <code>Import hosts</code> w nagłówku strony jest dostępny zawsze.
            </p>
            <p>
                Do przeglądania wystarczy uprawnienie odczytu do strony <code>Host management</code>; dodawanie, edycja, usuwanie i import wymagają uprawnienia zapisu (<Link href="/docs/dostep#role">Dostęp i uprawnienia › Role</Link>).
            </p>

            <H2 id="typy">Typy wpisów</H2>
            <RefTable
                head={['Typ', 'Zakładka', 'Kiedy użyć', 'Przykład']}
                rows={[
                    ['Adres IP', <code key="a">IPs</code>, 'Pojedynczy serwer lub urządzenie ze stałym adresem IPv4, np. host publiczny albo brama', <code key="a3">203.0.113.10</code>],
                    ['Zakres CIDR', <code key="b">IP ranges</code>, 'Cała podsieć z ewidencji, np. segment serwerowni lub sieć laboratorium; wybór zakresu jako celu obejmuje wszystkie adresy tego bloku', <code key="b3">198.51.100.0/24</code>],
                    ['FQDN', <code key="c">FQDNs</code>, 'Nazwa domeny lub subdomeny używanej przez organizację, gdy adres IP może się zmieniać albo usługa jest znana z nazwy', <code key="c3">www.example.com</code>]
                ]}
            />
            <p>
                Typy są od siebie niezależne: ten sam serwer może figurować w ewidencji jako adres IP i jako FQDN. Aplikacja nie rozwiązuje nazw DNS i nie sprawdza, czy adres należy do któregoś z zapisanych zakresów, więc każdy wpis jest osobną pozycją ewidencji.
            </p>

            <H2 id="dodawanie">Dodawanie wpisów</H2>
            <ol>
                <li>
                    Otwórz zakładkę typu i kliknij <code>Add IPs</code>, <code>Add IP range</code> albo <code>Add FQDN</code>.
                </li>
                <li>
                    W polu wartości wpisz jedną lub wiele pozycji, każdą w nowej linii albo rozdzielone przecinkiem lub średnikiem, np. <code>203.0.113.10, 203.0.113.11</code>.
                </li>
                <li>
                    Opcjonalnie dodaj tagi w polu <code>Tags (optional)</code>. Ten sam zestaw tagów dostaną wszystkie pozycje z tego zapisu (<Link href="/docs/tagowanie/operacje#pole">Operacje na tagach</Link>).
                </li>
                <li>
                    Kliknij <code>Save</code>. Strona się przeładuje, a nowe wpisy pojawią się w tabeli.
                </li>
            </ol>
            <ul>
                <li>
                    Wartość, która już jest w ewidencji, jest <strong>pomijana bez komunikatu</strong> i zachowuje swoje dotychczasowe tagi.
                </li>
                <li>Nazwy FQDN są zapisywane małymi literami.</li>
                <li>Puste pozycje i białe znaki na początku i końcu są usuwane.</li>
            </ul>
            <Callout type="warning" title="Formularze dodawania nie sprawdzają formatu">
                <p>
                    Okna <code>Add IPs</code>, <code>Add IP range</code> i <code>Add FQDN</code> zapisują wartość tak, jak ją wpisano. Literówka w rodzaju <code>10.0.0.300</code>, zakres <code>10.0.0.0/99</code> albo zakres wpisany w zakładce <code>IPs</code> trafi do ewidencji. Po zapisie sprawdź tabelę.
                </p>
                <p>
                    Format sprawdza wyłącznie <Link href="#import">import z pliku</Link>: przy dłuższej liście bezpieczniej jest zapisać ją w pliku i zaimportować, bo aplikacja sama rozpozna typ każdej pozycji i pominie niepoprawne.
                </p>
            </Callout>

            <H2 id="zapisane">Co zostało zapisane</H2>
            <p>Każda zakładka pokazuje tabelę wpisów danego typu z polem wyszukiwania i stronicowaniem.</p>
            <RefTable
                head={['Zakładka', 'Kolumny']}
                rows={[
                    [<code key="a">IPs</code>, t('`IP address`, `Tags`, `Added`, `Actions`')],
                    [<code key="b">IP ranges</code>, t('`CIDR range`, `Hosts`, `Tags`, `Added`, `Actions`')],
                    [<code key="c">FQDNs</code>, t('`FQDN`, `Tags`, `Added`, `Actions`')],
                    [<code key="d">Host groups</code>, t('`Group`, `IPs`, `IP ranges`, `FQDNs`, `Tags`, `Targets`, `Actions`')]
                ]}
            />
            <ul>
                <li>
                    <code>Added</code> to data i godzina dodania wpisu według zegara serwera, np. <code>November 21, 2026 9:14:02 AM</code>. Edycja jej nie zmienia.
                </li>
                <li>
                    Pole <code>Search…</code> nad tabelą dopasowuje fragment tekstu w całym wierszu (wartość, tagi, data) bez względu na wielkość liter, na wszystkich stronach tabeli (<Link href="/docs/tagowanie/operacje#wyszukiwanie">Wyszukiwanie po tagach</Link>).
                </li>
                <li>
                    Stopka tabeli pokazuje liczbę wierszy, np. <code>1–10 of 42</code>, i pozwala wybrać 10, 25 lub 100 wierszy na stronę.
                </li>
            </ul>

            <H3 id="liczniki">Liczniki: ewidencja a skan</H3>
            <p>Ekran Host management liczy wpisy i adresy w ewidencji, a nie hosty wykryte w sieci. Liczby z różnych ekranów oznaczają co innego:</p>
            <RefTable
                head={['Licznik', 'Gdzie', 'Co liczy']}
                rows={[
                    [t('`1–10 of N` w stopce'), 'Każda zakładka Host management', 'Liczbę wpisów w tej zakładce, po uwzględnieniu filtru wyszukiwania. Zakres CIDR liczy się jako jeden wpis'],
                    [<code key="b">Hosts</code>, t('Zakładka `IP ranges`'), <>Liczbę adresów w bloku CIDR: 2^(32 − prefiks), łącznie z adresem sieci i rozgłoszeniowym. <code>/24</code> daje 256, <code>/32</code> daje 1. Skan rozwija jednak z jednego zakresu najwyżej 1024 adresy (<Link href="/docs/skanowanie#rozwiazywanie">Rozwiązywanie celów</Link>)</>],
                    [<code key="c">Targets</code>, t('Zakładka `Host groups`'), t('Liczbę wpisów w grupie: adresy IP + zakresy + FQDN. Zakres `/24` to jeden cel, a nie 256')],
                    [t('`Hosts discovered`, `Alive`, `Reachable hosts`'), 'Scan Management, Scan Results, Latest Scan summary', <>Hosty zaobserwowane w skanie (<Link key="l" href="/docs/wyniki#wyniki">Wyniki i analiza</Link>), niezależne od wielkości ewidencji</>]
                ]}
            />
            <p>
                Ewidencja mówi, co wolno skanować; wynik skanu mówi, co podczas konkretnego uruchomienia odpowiedziało. Zakres <code>/24</code> w ewidencji to 256 adresów do sprawdzenia, ale w wyniku może pojawić się kilka aktywnych hostów albo żaden.
            </p>

            <H2 id="edycja">Edycja i usuwanie</H2>
            <p>
                Każdy wiersz w zakładkach <code>IPs</code>, <code>IP ranges</code> i <code>FQDNs</code> ma akcje <code>Edit</code> i <code>Remove</code>; obie działają tak samo dla wszystkich trzech typów.
            </p>
            <ul>
                <li>
                    <strong>Edit</strong> otwiera okno (<code>Edit IP address</code>, <code>Edit IP range</code>, <code>Edit FQDN</code>) z wartością i tagami wpisu. Po <code>Save</code> zapisana zostaje dokładnie ta lista tagów, która jest w oknie (<Link href="/docs/tagowanie/operacje#edycja">Operacje na tagach › Edycja</Link>). Edycja również nie sprawdza formatu.
                </li>
                <li>
                    Zmiana na wartość, która już istnieje w tym samym typie, kończy się komunikatem <code>Could not save this entry. Please try again.</code>
                </li>
                <li>
                    <strong>Remove</strong> pyta o potwierdzenie (<code>Remove this entry from the inventory?</code>) i usuwa wpis trwale.
                </li>
            </ul>
            <RefTable
                head={['Operacja na wpisie', 'Grupy hostów', 'Harmonogramy (Scan Scheduling)', 'Wyniki skanów']}
                rows={[
                    ['Zmiana wartości', 'Wartość jest podmieniana we wszystkich grupach, do których wpis należy', t('Bez zmian: harmonogram nadal pokazuje starą wartość jako cel. Przy następnej edycji harmonogramu stara wartość nie jest już zaznaczona i po `Save` znika z celów'), 'Bez zmian'],
                    ['Usunięcie', 'Wpis jest usuwany ze wszystkich grup', 'Jak wyżej: cel zostaje w harmonogramie jako nieaktualna pozycja, dopóki nie zapiszesz harmonogramu ponownie', 'Bez zmian: historia wyników nie jest kasowana']
                ]}
            />

            <H2 id="import">Import z pliku CSV</H2>
            <p>
                <code>Import hosts</code> dodaje wiele wpisów naraz z pliku <code>.csv</code> lub <code>.txt</code>. W odróżnieniu od formularzy dodawania import sam rozpoznaje typ każdej pozycji (IP, zakres, FQDN), pomija pozycje niepoprawne i duplikaty, a przed zapisem pokazuje podgląd.
            </p>

            <H3 id="format">Format pliku</H3>
            <p>
                Plik nie wymaga nagłówka, konkretnych kolumn ani jednego separatora. Przeglądarka dzieli całą zawartość na pozycje po znaku nowej linii, przecinku i średniku, usuwa cudzysłowy na początku i końcu pozycji, a serwer klasyfikuje każdą z nich osobno. Minimalny poprawny plik:
            </p>
            <CodeBlock
                lang="text"
                title="hosty.csv"
                code={`ip
203.0.113.10
203.0.113.11
198.51.100.0/24
www.example.com`}
            />
            <p>
                Pierwsza linia jest opcjonalna: słowa typowe dla nagłówka (np. <code>ip</code>, <code>address</code>, <code>host</code>, <code>fqdn</code>, <code>cidr</code>, <code>target</code>) są ignorowane. Równie dobrze zadziała jedna linia <code>203.0.113.10;203.0.113.11;www.example.com</code>.
            </p>
            <Callout type="warning" title="Brane są pod uwagę wszystkie komórki pliku">
                Ponieważ plik jest dzielony na komórki bez względu na kolumny, import z eksportu ewidencji z wieloma kolumnami (np. opis, lokalizacja) doda każdą komórkę, która wygląda jak adres IP, zakres albo nazwa domenowa, także z kolumny opisu. Pozostałe komórki (liczby, daty, nazwiska) trafią do licznika <code>Skipped</code>. Przed importem zostaw w pliku tylko kolumnę z celami.
            </Callout>

            <H3 id="podglad">Podgląd i zatwierdzenie</H3>
            <ol>
                <li>
                    Kliknij <code>Import hosts</code>, a potem przeciągnij plik na pole <code>Drop a file or click to browse</code> albo kliknij je i wskaż plik. Nie ma osobnego przycisku importu: wybranie pliku od razu uruchamia analizę.
                </li>
                <li>
                    Otworzy się okno <code>Import preview</code> z nazwą pliku i pięcioma licznikami. W tym momencie <strong>nic nie jest jeszcze zapisane</strong>.
                </li>
                <li>
                    Opcjonalnie dodaj tagi w polu <code>Tags (optional)</code>. Zostaną nadane wszystkim nowym wpisom z pliku, bez względu na typ.
                </li>
                <li>
                    Kliknij <code>Confirm</code>, aby zapisać, albo <code>Cancel</code>, aby zrezygnować. <code>Confirm</code> jest nieaktywny, gdy plik nie wnosi żadnego nowego wpisu.
                </li>
                <li>
                    Po zapisie okno zmienia tytuł na <code>Import complete</code> i pokazuje liczby faktycznie zapisanych wpisów. <code>Done</code> przeładowuje stronę.
                </li>
            </ol>
            <ImportPreviewMock />
            <RefTable
                head={['Licznik', 'Znaczenie w podglądzie', 'Znaczenie po zapisie']}
                rows={[
                    [t('`IPs`, `IP ranges`, `FQDNs`'), 'Ile nowych wpisów danego typu przybędzie', 'Ile wpisów danego typu dodano'],
                    [<code key="d">Duplicates</code>, 'Pozycje poprawne, ale powtórzone w pliku albo już obecne w ewidencji', 'Jak w podglądzie; te pozycje nie zostały zapisane'],
                    [<code key="s">Skipped</code>, 'Pozycje nierozpoznane jako IPv4, zakres CIDR ani FQDN (np. IPv6, tekst opisu, liczby)', 'Jak w podglądzie; te pozycje nie zostały zapisane']
                ]}
            />
            <Callout type="note" title="Duplikaty nie dostają tagu z importu">
                Wpis, który już jest w ewidencji, jest pomijany razem z tagami importu i zachowuje dotychczasowe tagi. Ponowny import tego samego pliku z nowym tagiem nie oznaczy więc istniejących wpisów: zmień ich tagi przez <code>Edit</code> (<Link href="/docs/tagowanie/operacje#import">Operacje na tagach › Tagi w imporcie</Link>).
            </Callout>

            <H3 id="klasyfikacja">Klasyfikacja wpisów</H3>
            <p>Serwer przypisuje każdą pozycję do typu, sprawdzając reguły w tej kolejności:</p>
            <RefTable
                head={['Krok', 'Reguła', 'Wynik']}
                rows={[
                    ['1', 'Pusta pozycja', 'pominięta bez liczenia'],
                    ['2', 'Słowo nagłówkowe, bez względu na wielkość liter: ip, ips, address, addresses, host, hosts, fqdn, fqdns, range, ranges, cidr, target, targets, hostname', 'pominięte bez liczenia'],
                    ['3', t('IPv4 z prefiksem 0–32, np. `198.51.100.0/24`'), t('zakres (`IP ranges`)')],
                    ['4', 'Poprawny adres IPv4', t('adres (`IPs`)')],
                    ['5', 'Nazwa domenowa: do 253 znaków, co najmniej jedna kropka, etykiety do 63 znaków z liter, cyfr i myślników, nie zaczynające się ani nie kończące myślnikiem; kropka końcowa jest ignorowana', t('FQDN (`FQDNs`), zapisany małymi literami')],
                    ['6', 'Wszystko inne, w tym adresy IPv6', <code key="s">Skipped</code>]
                ]}
            />
            <p>
                Zakres jest zapisywany dokładnie tak, jak go podano: <code>198.51.100.7/24</code> zostanie zapisany jako osobny wpis obok <code>198.51.100.0/24</code>. Podawaj zakresy adresem sieci.
            </p>

            <H2 id="grupy">Host groups</H2>
            <p>
                Grupa hostów to nazwany zestaw wpisów wybranych ręcznie z ewidencji. Może łączyć adresy IP, zakresy i FQDN, np. grupa <code>Produkcja</code> z zasobami produkcyjnymi i grupa <code>Development</code> ze środowiskiem deweloperskim. Grupę wybiera się potem jako cel skanu, zamiast zaznaczać każdy wpis z osobna. Czym grupa różni się od tagu, opisuje{' '}
                <Link href="/docs/tagowanie#tag-czy-grupa">Tagowanie › Tag a grupa</Link>.
            </p>

            <H3 id="grupa-kroki">Tworzenie i edycja grupy</H3>
            <ol>
                <li>
                    Najpierw dodaj wpisy do ewidencji: grupa może zawierać tylko to, co już jest w zakładkach <code>IPs</code>, <code>IP ranges</code> i <code>FQDNs</code>.
                </li>
                <li>
                    W zakładce <code>Host groups</code> kliknij <code>New group</code>.
                </li>
                <li>
                    Wpisz <code>Group name</code> (wymagane) i opcjonalnie tagi grupy.
                </li>
                <li>
                    W sekcjach <code>IP addresses</code>, <code>IP ranges</code> i <code>FQDNs</code> zaznacz członków. Pole <code>Filter…</code> nad każdą listą zawęża ją po fragmencie wartości (nie po tagach).
                </li>
                <li>
                    Kliknij <code>Save</code>.
                </li>
            </ol>
            <ul>
                <li>
                    <strong>Edit</strong> w wierszu grupy otwiera to samo okno (<code>Edit host group</code>) z bieżącą nazwą, tagami i członkami; możesz dodać lub odznaczyć członków i zmienić nazwę.
                </li>
                <li>
                    <strong>Remove</strong> usuwa grupę po potwierdzeniu. Wpisy ewidencji zostają (<code>Inventory entries are kept.</code>).
                </li>
                <li>Nazwa grupy nie musi być unikalna, ale harmonogramy wskazują grupę po nazwie, więc unikaj powtórzeń.</li>
                <li>Grupa nie przejmuje tagów swoich członków i nie przekazuje im własnych.</li>
            </ul>

            <H3 id="grupa-skutki">Grupa a harmonogramy</H3>
            <p>
                Harmonogram zapisuje grupę jako cel <strong>po nazwie</strong> (<Link href="/docs/skanowanie#cele">Skanowanie › Cele</Link>). Z tego wynika:
            </p>
            <ul>
                <li>
                    Zmiana składu grupy nie wymaga edycji harmonogramu: harmonogram wskazuje grupę, a nie listę jej członków, a skład jest odczytywany w chwili uruchomienia skanu.
                </li>
                <li>
                    Zmiana nazwy lub usunięcie grupy <strong>zrywa</strong> to powiązanie. Harmonogram nadal pokazuje starą nazwę w kolumnie <code>Targets</code>; otwórz go przez <code>Edit</code>, zaznacz grupę ponownie i zapisz.
                </li>
                <li>
                    Wynik uruchomienia nie zapamiętuje składu grupy: Scan Results i okno Scan details pokazują tylko adresy, które skan rozwiązał (<Link href="/docs/skanowanie#rozwiazywanie">Skanowanie › Rozwiązywanie celów</Link>), więc po zmianie grupy nie da się odtworzyć, jakie hosty obejmował wcześniejszy skan.
                </li>
            </ul>
            <Callout type="note" title="Dane startowe">
                Przy pustej bazie powstają przykładowe grupy <code>Perimeter DMZ</code> i <code>Core services</code>.
            </Callout>
        </DocPage>
    );
}
