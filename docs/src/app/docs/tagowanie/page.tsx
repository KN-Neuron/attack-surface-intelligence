import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';
import { t } from '@/components/docs/inline';
import { Badge } from '@/components/ui/badge';
import { InventoryMock } from '@/components/docs/ui-mocks';

export const metadata: Metadata = { title: 'Tagowanie: przegląd' };

export default function Page() {
    return (
        <DocPage
            href="/docs/tagowanie"
            title="Tagowanie: przegląd"
            lead="Tag to etykieta tekstowa przypisana do wpisu ewidencji (adresu IP, zakresu, FQDN) albo do grupy hostów. Pozwala opisać zasoby kilkoma niezależnymi cechami, np. środowiskiem i rolą, i odnajdywać je po tych cechach."
            toc={[
                { id: 'tag-czy-grupa', label: 'Tag a grupa' },
                { id: 'przyklad', label: 'Przykład: Produkcja i serwery-www', level: 3 },
                { id: 'definicja', label: 'Model tagu' },
                { id: 'gdzie', label: 'Co można otagować' },
                { id: 'zastosowania', label: 'Trzy zastosowania tagów' },
                { id: 'host-management', label: 'Host Management', level: 3 },
                { id: 'scheduling', label: 'Scan Scheduling', level: 3 },
                { id: 'data-explorer', label: 'Data Explorer', level: 3 },
                { id: 'laczenie', label: 'Wiele tagów i łączenie kryteriów' },
                { id: 'odczyt', label: 'Kiedy tag jest odczytywany' },
                { id: 'zakres', label: 'Zakres implementacji' }
            ]}
        >
            <H2 id="tag-czy-grupa">Tag a grupa</H2>
            <RefTable
                head={['', 'Grupa hostów', 'Tag']}
                rows={[
                    ['Czym jest', 'Nazwanym zestawem wpisów, które użytkownik wybrał ręcznie z ewidencji', 'Etykietą przypisaną do konkretnego wpisu; zbiór „hostów z tagiem X” powstaje z wszystkich wpisów, które ją mają'],
                    ['Jak przybywa członków', t('Trzeba otworzyć grupę (`Edit`) i zaznaczyć nowy wpis'), 'Wystarczy nadać tag nowemu wpisowi, np. przy dodawaniu albo imporcie'],
                    ['Ile naraz', 'Wpis może należeć do wielu grup', 'Wpis może mieć wiele tagów'],
                    ['Wybór jako cel skanu', <Badge key="g" variant="success">dostępny</Badge>, <Badge key="t">niedostępny</Badge>],
                    ['Wyszukiwanie w tabelach', 'Po nazwie grupy w zakładce Host groups', 'Po fragmencie tagu w każdej tabeli ewidencji']
                ]}
            />
            <p>
                Grupa odpowiada na pytanie „co skanuję tym harmonogramem”, a tag na pytanie „jaką cechę ma ten zasób”. Grupę opisuje{' '}
                <Link href="/docs/hosty#grupy">Host management › Host groups</Link>, a dobór między tagiem a grupą w typowych sytuacjach <Link href="/docs/tagowanie/konwencje#tag-czy-grupa">Konwencje › Tag czy grupa</Link>.
            </p>

            <H3 id="przyklad">Przykład: Produkcja i serwery-www</H3>
            <p>
                Grupa <code>Produkcja</code> zawiera konkretne wpisy produkcyjne, np. zakres <code>198.51.100.0/24</code> i nazwę <code>www.example.com</code>. Grupa <code>Development</code> zawiera wpisy środowiska deweloperskiego, np. <code>dev.example.com</code> i <code>203.0.113.20</code>.
            </p>
            <p>
                Tag <code>serwery-www</code> przekracza ten podział: nadajesz go serwerom WWW z obu środowisk (<code>www.example.com</code>, <code>dev.example.com</code>, <code>203.0.113.20</code>). Przykład odpowiada faktycznym możliwościom aplikacji: tag można nadać każdemu z trzech typów wpisów, a wpis może jednocześnie należeć do grupy i mieć tagi.
            </p>
            <InventoryMock />

            <H2 id="definicja">Model tagu</H2>
            <RefTable
                head={['Właściwość', 'Wartość']}
                rows={[
                    ['Typ', 'Dowolny tekst; obcinane są tylko białe znaki na początku i końcu'],
                    ['Liczba na obiekt', 'Dowolna; kolejność odpowiada kolejności dodania'],
                    ['Brak tagów', 'Obiekt bez tagów pokazuje w kolumnie Tags myślnik'],
                    ['Równość', t('Dokładne porównanie znaków: `prod` i `Prod` to dwa różne tagi')],
                    ['Rejestr tagów', 'Brak. Tag istnieje tylko jako wartość na obiektach: nie ma listy wszystkich tagów, globalnej zmiany nazwy ani usuwania tagu'],
                    ['Dziedziczenie', 'Brak. Tagi grupy i tagi jej członków są niezależne']
                ]}
            />

            <H2 id="gdzie">Co można otagować</H2>
            <RefTable
                head={['Obiekt', 'Gdzie nadać i zmienić tagi', 'Tabela w bazie']}
                rows={[
                    ['Adres IP', t('`Add IPs`, `Import hosts`, `Edit` w zakładce IPs'), <code key="a">host_ips</code>],
                    ['Zakres CIDR', t('`Add IP range`, `Import hosts`, `Edit` w zakładce IP ranges'), <code key="b">host_ranges</code>],
                    ['FQDN', t('`Add FQDN`, `Import hosts`, `Edit` w zakładce FQDNs'), <code key="c">host_fqdns</code>],
                    ['Grupa hostów', t('`New group` i `Edit` w zakładce Host groups'), <code key="d">host_groups</code>]
                ]}
            />
            <p>Tag zakresu dotyczy wpisu zakresu jako całości. Pojedyncze adresy wewnątrz zakresu nie są osobnymi wpisami i nie mają własnych tagów.</p>

            <H2 id="zastosowania">Trzy zastosowania tagów</H2>
            <RefTable
                head={['Miejsce', 'Zachowanie', 'Stan']}
                rows={[
                    ['Host Management', 'Nadawanie tagów przy dodawaniu i imporcie, zmiana i usuwanie przez Edit, wyszukiwanie wpisów po tagu', <Badge key="1" variant="success">dostępne</Badge>],
                    ['Scan Scheduling', 'Wybór hostów oznaczonych tagiem jako celu harmonogramu lub skanu ręcznego', <Badge key="2">niedostępne</Badge>],
                    ['Data Explorer', 'Filtrowanie tabeli hostów po tagu', <Badge key="3">niedostępne</Badge>]
                ]}
            />

            <H3 id="host-management">Host Management</H3>
            <ul>
                <li>
                    <strong>Pojedynczy wpis lub lista:</strong> pole <code>Tags (optional)</code> w oknach <code>Add IPs</code>, <code>Add IP range</code>, <code>Add FQDN</code>. Wszystkie pozycje z jednego zapisu dostają ten sam zestaw (<Link href="/docs/tagowanie/operacje#dodawanie">Operacje › Dodawanie</Link>).
                </li>
                <li>
                    <strong>Zestaw z pliku:</strong> pole tagów w oknie <code>Import preview</code> oznacza wszystkie nowe wpisy z pliku, np. tagiem <code>serwery-www</code> albo tagiem partii <code>import:2026-11</code> (<Link href="/docs/tagowanie/operacje#import">Operacje › Tagi w imporcie</Link>).
                </li>
                <li>
                    <strong>Zmiana i usunięcie tagu na istniejącym wpisie:</strong> akcja <code>Edit</code> w wierszu tabeli; chip usuwa się krzyżykiem (<Link href="/docs/tagowanie/operacje#edycja">Operacje › Edycja</Link>).
                </li>
                <li>
                    <strong>Odnalezienie wpisów z tagiem:</strong> pole <code>Search…</code> nad tabelą (<Link href="/docs/tagowanie/operacje#wyszukiwanie">Operacje › Wyszukiwanie</Link>).
                </li>
            </ul>

            <H3 id="scheduling">Scan Scheduling</H3>
            <p>
                Formularz harmonogramu pozwala wybrać jako cel grupę, adres IP, zakres albo FQDN, ale <strong>nie tag</strong> (<Link href="/docs/skanowanie#cele">Skanowanie › Cele</Link>). Aby objąć odrębnym harmonogramem hosty z tagiem, np. <code>serwery-www</code>:
            </p>
            <ol>
                <li>
                    W Host management wyszukaj <code>serwery-www</code> w zakładkach <code>IPs</code>, <code>IP ranges</code> i <code>FQDNs</code>.
                </li>
                <li>
                    Utwórz grupę, np. <code>Serwery WWW</code>, i zaznacz w niej znalezione wpisy (<Link href="/docs/hosty#grupa-kroki">Tworzenie grupy</Link>). Listy członków w oknie grupy nie pokazują tagów, więc posłuż się wynikiem wyszukiwania z poprzedniego kroku.
                </li>
                <li>
                    W Scan Scheduling wybierz tę grupę jako cel.
                </li>
            </ol>
            <p>Nowy wpis z tagiem <code>serwery-www</code> nie trafi do grupy sam: dodaj go do niej przez <code>Edit</code> grupy.</p>

            <H3 id="data-explorer">Data Explorer</H3>
            <p>
                Data Explorer ma filtry z operatorami dla dwudziestu kolumn, ale tag hosta nie jest kolumną: dane skanera nie zawierają tagów z ewidencji (<Link href="/docs/data-explorer#filtry">Data Explorer › Filtry</Link>). Pytanie „na których hostach z tagiem serwery-www działa Nginx” rozwiązuje się dziś w dwóch krokach:
            </p>
            <ol>
                <li>
                    W Host management wyszukaj <code>serwery-www</code> i zanotuj adresy.
                </li>
                <li>
                    W Data Explorer dodaj filtr <code>Technologies contains nginx</code> i porównaj kolumnę <code>Host</code> z listą z pierwszego kroku. Gdy adresy tworzą jedną podsieć, możesz dodać filtr <code>Host starts with</code>.
                </li>
            </ol>

            <H2 id="laczenie">Wiele tagów i łączenie kryteriów</H2>
            <ul>
                <li>Wpis może mieć dowolnie wiele tagów, np. <code>env:prod</code>, <code>serwery-www</code> i <code>owner:netops</code> naraz.</li>
                <li>
                    Wyszukiwanie w tabelach ma jedno pole i dopasowuje <strong>jeden fragment tekstu</strong> w całym wierszu. Nie ma operatorów „i” ani „lub”: aby znaleźć wpisy z dwoma tagami naraz, wyszukaj pierwszy tag i przejrzyj wynik pod kątem drugiego.
                </li>
                <li>
                    Fragment pasuje także do części tagu, wartości i daty: fraza <code>www</code> znajdzie tag <code>serwery-www</code>, ale też nazwę <code>www.example.com</code>. Dobieraj nazwy tagów tak, aby jedna nie zawierała się w drugiej (<Link href="/docs/tagowanie/konwencje#nazewnictwo">Konwencje › Nazewnictwo</Link>).
                </li>
                <li>
                    Dla zapytań łączących wiele tagów osoba z dostępem do bazy może użyć SQL, bo tagi są zapisane jako tablica JSONB:
                </li>
            </ul>
            <CodeBlock
                lang="sql"
                code={`-- adresy z tagiem serwery-www
SELECT address FROM host_ips WHERE tags ? 'serwery-www';

-- nazwy mające oba tagi naraz
SELECT fqdn FROM host_fqdns WHERE tags @> '["serwery-www", "env:prod"]';`}
            />

            <H2 id="odczyt">Kiedy tag jest odczytywany</H2>
            <RefTable
                head={['Miejsce', 'Moment odczytu', 'Skutek zmiany tagu']}
                rows={[
                    ['Tabele Host management', 'Przy każdym wyświetleniu strony', 'Widoczny od razu po zapisie'],
                    ['Harmonogramy', 'Nie dotyczy: harmonogram nie odwołuje się do tagów', 'Zmiana tagu nie zmienia celów żadnego harmonogramu'],
                    ['Wyniki, Data Explorer, dashboardy', 'Nie dotyczy: dane skanera (scan_hosts) nie przechowują tagów hostów', 'Zmiana tagu nie zmienia danych skanera ani wyników']
                ]}
            />
            <p>
                Aplikacja nie przechowuje historii tagów. Po zmianie tagu nie da się ustalić, jakie tagi wpis miał w chwili wcześniejszego skanu.
            </p>

            <H2 id="zakres">Zakres implementacji</H2>
            <RefTable
                head={['Funkcja', 'Stan']}
                rows={[
                    ['Nadawanie tagów przy dodawaniu, imporcie i tworzeniu grupy', <Badge key="1" variant="success">dostępne</Badge>],
                    ['Zmiana i usuwanie tagów pojedynczego wpisu i grupy (Edit)', <Badge key="2" variant="success">dostępne</Badge>],
                    ['Wyszukiwanie tekstowe po tagach w tabelach Host management', <Badge key="3" variant="success">dostępne</Badge>],
                    ['Filtrowanie po tagach w SQL', <Badge key="4" variant="success">dostępne</Badge>],
                    ['Nadanie tagu wielu istniejącym wpisom naraz', <Badge key="5">niedostępne</Badge>],
                    ['Globalna zmiana nazwy lub usunięcie tagu', <Badge key="6">niedostępne</Badge>],
                    ['Tag jako cel harmonogramu lub skanu ręcznego', <Badge key="7">niedostępne</Badge>],
                    ['Filtrowanie Data Explorer, wyników i dashboardów po tagach hostów', <Badge key="8">niedostępne</Badge>]
                ]}
            />
            <Callout type="tip" title="Do czasu kryterium opartego na tagach">
                Odpowiednikiem wyboru „wszystkie hosty z tagiem” jako celu skanu jest grupa zbudowana z wpisów o tym tagu (<Link href="#scheduling">Scan Scheduling</Link>).
            </Callout>
        </DocPage>
    );
}
