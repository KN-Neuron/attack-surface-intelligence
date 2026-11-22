import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';
import { t } from '@/components/docs/inline';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Architektura' };

export default function Page() {
    return (
        <DocPage
            href="/docs/architektura"
            title="Architektura"
            lead="Stos technologiczny, podział na moduły, model danych, konfiguracja oraz status poszczególnych funkcji: co działa na prawdziwych danych, a co nadal na przykładowych."
            toc={[
                { id: 'stos', label: 'Stos' },
                { id: 'moduly', label: 'Moduły' },
                { id: 'zadanie', label: 'Przepływ żądania' },
                { id: 'skan', label: 'Silnik skanowania' },
                { id: 'dane', label: 'Model danych' },
                { id: 'seed', label: 'Dane startowe', level: 3 },
                { id: 'status', label: 'Status funkcji' },
                { id: 'konfiguracja', label: 'Uruchomienie i konfiguracja' }
            ]}
        >
            <H2 id="stos">Stos</H2>
            <RefTable
                head={['Warstwa', 'Technologia', 'Uwagi']}
                rows={[
                    ['Język', 'Rust, edycja 2024', t('Pojedynczy plik wykonywalny `attack-surface-intelligence`')],
                    ['Serwer HTTP', 'Axum 0.8, tower-http', t('Kompresja gzip, statyczne pliki z katalogu `static/`')],
                    ['Szablony', 'Askama 0.16', 'Szablony kompilowane do kodu, renderowane po stronie serwera'],
                    ['Baza danych', 'PostgreSQL przez sqlx 0.8', 'Listy (tagi, kryteria, członkowie grup) w kolumnach JSONB'],
                    ['Uwierzytelnianie', 'bcrypt, sesje w bazie, ciasteczko', <><Link href="/docs/dostep#logowanie">Dostęp i uprawnienia</Link></>],
                    ['Interfejs', 'Czysty JavaScript i CSS', t('Bez frameworka i bundlera: `static/app.js`, `static/app.css`, `static/defectdojo.js`')],
                    ['Dokumentacja', 'Next.js 16, Tailwind CSS v4, Radix UI', t('Osobna aplikacja w `docs/`, serwowana pod `/docs`')]
                ]}
            />

            <H2 id="moduly">Moduły</H2>
            <RefTable
                head={['Plik', 'Odpowiedzialność']}
                rows={[
                    [<code key="a">src/main.rs</code>, t('Routing, warstwa `guard`, zadanie sprawdzające harmonogramy co 30 s, nasłuch na `0.0.0.0` i porcie z `PORT` (domyślnie 8080)')],
                    [<code key="b">src/auth.rs</code>, t('Logowanie, sesje, middleware `guard`, lista stron uprawnień `PERMISSION_PAGES` (12 kluczy)')],
                    [<code key="c">src/db.rs</code>, 'Schemat, dane startowe, wszystkie zapytania SQL, klasyfikacja wpisów importu'],
                    [<code key="d">src/handlers.rs</code>, 'Handlery stron HTML i endpointów JSON'],
                    [<code key="d2">src/scan.rs</code>, <>Silnik skanowania: rozwiązywanie celów, httpx, masscan i sonda TCP, alerty (w tym Custom Signatures), harmonogram (<Link key="sk" href="#skan">Silnik skanowania</Link>)</>],
                    [<code key="d3">src/defectdojo.rs</code>, 'Klient DefectDojo API v2, mapowanie findingów, push/pull i zapis historii synchronizacji'],
                    [<code key="e">src/state.rs</code>, 'Struktury danych, kryteria sygnatur i ładunki żądań (DTO)'],
                    [<code key="f">src/nav.rs</code>, 'Definicja menu i indeks wyszukiwarki w górnym pasku'],
                    [<code key="g">src/mock.rs</code>, t('Dane przykładowe zapisywane do tabeli `app_data` (historia skanów, dashboardy, lista znanych podatnych wersji)')],
                    [<code key="h">templates/</code>, <>Szablon bazowy <code>base.html</code>, strony w <code>pages/</code>, stopki tabel <code>partials/pager.html</code> i <code>pager-large.html</code>, dzwonek alertów <code>partials/alert_bell.html</code></>]
                ]}
            />

            <H2 id="zadanie">Przepływ żądania</H2>
            <ol>
                <li>
                    Publiczne są wyłącznie <code>/login</code> i <code>/static/*</code>. Pliki statyczne mają nagłówek <code>Cache-Control: no-cache</code>, więc zmiana stylu jest widoczna po odświeżeniu.
                </li>
                <li>
                    Pozostałe ścieżki przechodzą przez <code>auth::guard</code>: sesja, rola, macierz uprawnień (<Link href="/docs/dostep#rbac">Dostęp i uprawnienia</Link>).
                </li>
                <li>
                    Strona HTML jest renderowana z kontekstem <code>Shell</code>: menu przefiltrowane uprawnieniami, nazwa administratora i adres dokumentacji.
                </li>
                <li>
                    Mutacje to wywołania <code>fetch</code> z JSON do <code>/api/*</code> (<Link href="/docs/api">API HTTP</Link>). Po sukcesie strona przeładowuje się; interfejs nie jest aplikacją jednostronicową. Wyjątkiem są Scan Status, który co 1,5 s odpytuje <code>/api/scan/status</code>, oraz filtry Data Explorer, działające w przeglądarce na wczytanym zestawie wierszy.
                </li>
            </ol>

            <H2 id="skan">Silnik skanowania</H2>
            <p>
                Skan jest zadaniem w tle tego samego procesu co serwer WWW (<code>tokio::spawn</code>); zewnętrzne programy <code>httpx</code> i <code>masscan</code> uruchamiane są jako procesy potomne. Zasady działania z perspektywy użytkownika opisuje <Link href="/docs/skanowanie#uruchomienie">Skanowanie › Uruchomienie skanu</Link>; tu zebrano elementy istotne dla wdrożenia.
            </p>
            <ul>
                <li>
                    <strong>Jeden slot.</strong> Wiersz <code>scan_state</code> (<code>id = 1</code>) pełni rolę blokady: kolejny skan nie wystartuje, dopóki trwa poprzedni (żądanie dostaje 409).
                </li>
                <li>
                    <strong>Cele.</strong> Cele pochodzą wyłącznie z ewidencji: grupy są rozwijane do swoich wpisów, a kryterium <code>tag</code> wybiera wpisy (IP, zakresy, FQDN) noszące dany tag. Zakres CIDR jest rozwijany do maksymalnie 1024 adresów, a cała lista jest przycinana do 2048 adresów.
                </li>
                <li>
                    <strong>FQDN.</strong> Skan Full zachowuje nazwę jako cel, żeby httpx wysłał właściwy nagłówek <code>Host</code> i SNI (wirtualne hosty, CDN, reverse proxy). Skan Reachability zastępuje nazwę pierwszym adresem z DNS. Nazwy, których nie da się rozwiązać, są pomijane.
                </li>
                <li>
                    <strong>httpx.</strong> Limit czasu pojedynczego żądania to 10 s. Liczba wątków, limit żądań na sekundę i liczba ponowień pochodzą z <Link href="/docs/ustawienia#skaner">Settings › HTTP scanner</Link>. Skaner pobiera też nagłówki i cookies (potrzebne Custom Signatures) oraz pełny wiersz JSON w kolumnie <code>raw</code>.
                </li>
                <li>
                    <strong>Wyniki.</strong> Każdy skan to wiersz w <code>scans</code>; bieżący stan hosta trafia do <code>scan_hosts</code> (jedna linia na adres, nadpisywana), a pełna historia do <code>scan_host_captures</code> (jedna linia na host i skan). Alerty trafiają do <code>alerts</code> (<Link href="/docs/alerty">Alerty</Link>).
                </li>
                <li>
                    <strong>Harmonogram.</strong> Pętla w <code>main.rs</code> co 30 s wywołuje <code>tick_scheduler</code>: uzupełnia terminy <code>next_run_at</code> i startuje wymagalną konfigurację.
                </li>
                <li>
                    <strong>Restart.</strong> Przy starcie wiersze skanów w stanie <code>Running</code> dostają status <code>Failed</code> (<code>interrupted by restart</code>), a blokada jest zwalniana. Skan nie wznawia się po restarcie.
                </li>
                <li>
                    <strong>Lista celów</strong> jest zapisywana do pliku tymczasowego, który znika po skanie. Do skanerów trafiają wyłącznie wartości rozpoznane jako adres lub rozwiązywalna nazwa, więc dowolny tekst z konfiguracji nie staje się argumentem programu.
                </li>
            </ul>

            <H2 id="dane">Model danych</H2>
            <p>
                Schemat powstaje przy starcie z instrukcji <code>CREATE TABLE IF NOT EXISTS</code> i <code>ALTER TABLE … ADD COLUMN IF NOT EXISTS</code> (<code>db::init</code>). Nie ma narzędzia migracji. Dane startowe są wstawiane tylko do pustych tabel.
            </p>
            <RefTable
                head={['Tabela', 'Zawartość']}
                rows={[
                    [<code key="a">admins</code>, t('Konta administratorów: e-mail (UNIQUE), skrót hasła, nazwa roli, status, flaga `is_default`')],
                    [<code key="b">roles</code>, 'Nazwa roli (UNIQUE) i macierz uprawnień w JSONB'],
                    [<code key="c">sessions</code>, 'Token sesji, administrator, czas wygaśnięcia, flaga „remember”'],
                    [<code key="d">policies</code>, t('Harmonogramy skanów: nazwa, kolejność, status, kryteria w JSONB oraz `last_run_at` i `next_run_at`')],
                    [<code key="e">host_ips</code>, <>Inwentarz hostów, zob. <Link href="/docs/hosty#typy">Host management</Link></>],
                    [<code key="e2">host_ranges</code>, 'jw.'],
                    [<code key="e3">host_fqdns</code>, 'jw.'],
                    [<code key="f">host_groups</code>, <>Grupy celów, zob. <Link href="/docs/hosty#grupy">Host management</Link></>],
                    [<code key="g">scan_state</code>, t('Jeden wiersz (`id = 1`) ze stanem bieżącego skanu: postęp, liczniki, typ, silnik, `scan_id`, liczba alertów')],
                    [<code key="g1">scans</code>, t('Jedno uruchomienie: etykieta, typ, silnik, trigger (`manual`, `policy`, `scheduled`, `import`), cele, status, czasy, liczniki i komunikat błędu')],
                    [<code key="g2">scan_hosts</code>, t('Bieżący stan każdego adresu (`address` UNIQUE): `up`, czasy, odpowiedź HTTP, TLS, technologie i porty w JSONB, surowy wiersz httpx w `raw`')],
                    [<code key="g3">scan_host_captures</code>, t('Niezmienna historia: jedna linia na host i skan (`scan_id`, `address`), z pełnym przechwyceniem, nagłówkami, cookies i tagami z importu CSV. Czyta z niej Data Explorer')],
                    [<code key="g4">alerts</code>, t('Alert: typ (`new_host`, `host_down`, `new_cve`, `custom_signature`), waga, host, treść, `detail`, dane potwierdzenia, odwołanie do skanu')],
                    [<code key="s">signatures</code>, t('Custom Signatures: nazwa, opis, waga, stan, flaga `predefined`, tryb `all`/`any` i kryteria w JSONB')],
                    [<code key="h">app_data</code>, t('Klucz tekstowy i dokument JSONB: dane przykładowe ekranów wynikowych, lista podatnych wersji, `scan_settings` i `defectdojo_settings`')],
                    [<code key="dd1">defectdojo_syncs</code>, 'Historia pushów, pulli i testów połączenia wraz z licznikami, błędem i surową odpowiedzią API'],
                    [<code key="dd2">defectdojo_imports</code>, 'Identyfikatory produktu, engagementu i testu utworzone dla pary skan/produkt (re-push do tego samego testu)'],
                    [<code key="dd3">defectdojo_findings</code>, 'Lokalny cache findingów pobranych z DefectDojo']
                ]}
            />
            <H3 id="seed">Dane startowe</H3>
            <p>
                Przy pustych tabelach powstają: konto domyślne (<Link href="/docs/dostep#logowanie">Dostęp i uprawnienia</Link>), trzy role, dwa harmonogramy, dwie grupy hostów, inwentarz z przykładowych adresów, bezczynny stan skanu, predefiniowana sygnatura <code>Interesting cookie/header</code> oraz klucze <code>app_data</code> z danymi przykładowymi. Tabele <code>scans</code>, <code>scan_hosts</code>, <code>scan_host_captures</code> i <code>alerts</code> startują puste i wypełniają się dopiero skanami.
            </p>

            <H2 id="status">Status funkcji</H2>
            <p>To jedyne miejsce, które określa, czy funkcja działa na prawdziwych danych. Pozostałe strony opisują zachowanie, nie powtarzając tego podziału.</p>
            <RefTable
                head={['Funkcja', 'Stan', 'Źródło danych']}
                rows={[
                    ['Inwentarz hostów, grupy, tagi, import', <Badge key="1" variant="success">trwałe</Badge>, t('Tabele `host_*`; pełny zapis i odczyt')],
                    ['Harmonogramy skanów', <Badge key="2" variant="success">działają</Badge>, <>Tabela <code>policies</code>; zadanie w tle uruchamia je w terminie (<Link href="/docs/skanowanie#scheduler">Skanowanie › Uruchamianie z harmonogramu</Link>)</>],
                    ['Administratorzy, role, sesje', <Badge key="3" variant="success">trwałe</Badge>, t('Tabele `admins`, `roles`, `sessions`')],
                    ['Skan Full (httpx) i Reachability (masscan lub TCP)', <Badge key="4" variant="success">działa</Badge>, <>Prawdziwe sprawdzenie hostów z ewidencji; wymaga programów z rozdziału <Link href="#konfiguracja">Uruchomienie i konfiguracja</Link></>],
                    ['Strojenie httpx w Settings (limit, wątki, ponowienia)', <Badge key="4a" variant="success">działa i zapisuje</Badge>, <>Klucz <code>app_data.scan_settings</code> (<Link href="/docs/ustawienia#skaner">Settings</Link>)</>],
                    ['Custom Signatures i alerty Signature match', <Badge key="4b" variant="success">działa</Badge>, <>Tabela <code>signatures</code>; dopasowanie na <code>scan_host_captures</code> (<Link href="/docs/sygnatury">Custom Signatures</Link>)</>],
                    ['Scan Results, okno Scan details, Data Explorer, Alerts', <Badge key="5" variant="success">z prawdziwych skanów</Badge>, <>Tabele <code>scans</code>, <code>scan_hosts</code>, <code>scan_host_captures</code>, <code>alerts</code> (<Link href="/docs/wyniki#zrodlo">Wyniki i analiza › Źródło danych</Link>)</>],
                    ['Data Explorer: CSV export i import', <Badge key="5a" variant="success">działa</Badge>, <>Wiersze <code>scan_host_captures</code>; import tworzy nowy skan (<Link href="/docs/data-explorer#csv">Data Explorer › CSV</Link>)</>],
                    ['Upcoming scan', <Badge key="6" variant="success">z harmonogramów</Badge>, t('Najbliższa włączona konfiguracja; bez niej wartości przykładowe')],
                    ['Compare Scans i Technologies used', <Badge key="7" variant="success">z prawdziwych skanów</Badge>, <>Liczby z <code>scans</code> i <code>scan_host_captures</code> (<Link href="/docs/wyniki#dashboardy">Wyniki i analiza</Link>)</>],
                    ['Vulnerable versions, kafelki i tabele Latest Scan summary', <Badge key="8" variant="warn">dane przykładowe</Badge>, <>Dokumenty <code>app_data</code>, tylko do odczytu; prawdziwe są <code>Latest scan</code> i <code>Open alerts</code> (<Link href="/docs/wyniki#dane">Wyniki i analiza</Link>)</>],
                    ['Scan queue', <Badge key="9" variant="warn">statyczne</Badge>, 'Stała zawartość szablonu; aplikacja nie kolejkuje skanów'],
                    ['Licznik Vulns w Scan Results', <Badge key="10">niewyliczany</Badge>, <>Dla prawdziwych skanów 0; podatności zgłasza <Link href="/docs/alerty#cve">New CVE</Link></>],
                    ['Tag jako cel skanu, filtr Data Explorer po tagu', <Badge key="11" variant="success">dostępne</Badge>, <>Kryterium <code>tag</code> i kolumna <code>Tags</code> (<Link href="/docs/tagowanie#zastosowania">Tagowanie</Link>)</>],
                    ['Settings: motyw', <Badge key="12" variant="success">działa</Badge>, <>Wybór w <code>localStorage</code> pod kluczem <code>asi.theme</code>, per przeglądarka</>],
                    ['Settings: stare listy „Default scan depth” i „Scan concurrency”', <Badge key="13">bez zapisu</Badge>, 'Kontrolki nie są podpięte do serwera; rzeczywiste parametry są w karcie HTTP scanner']
                ]}
            />

            <H2 id="konfiguracja">Uruchomienie i konfiguracja</H2>
            <CodeBlock lang="bash" code={`cargo run                     # http://localhost:8080
docker compose up --build     # aplikacja + PostgreSQL`} />
            <p>
                Skan Full wymaga programu <code>httpx</code> od ProjectDiscovery, a szybka sonda Reachability programu <code>masscan</code> (z uprawnieniami do surowych gniazd). Pliki wykonywalne są szukane w kolejności: ścieżka ze zmiennej <code>HTTPX_BIN</code> / <code>MASSCAN_BIN</code>, <code>/usr/local/bin</code>, <code>~/.local/bin</code>, <code>~/go/bin</code>, <code>/usr/bin</code>. Program jest rozpoznawany po wyniku <code>-version</code>: pod nazwą <code>httpx</code> bywa też niezwiązane narzędzie Pythona i jest ono pomijane.
            </p>
            <RefTable
                head={['Ustawienie', 'Miejsce', 'Domyślnie']}
                rows={[
                    [<code key="p">PORT</code>, 'Zmienna środowiskowa; port nasłuchu', <code key="p2">8080</code>],
                    [<code key="a">DOCS_URL</code>, 'Zmienna środowiskowa; cel przycisku „?” w aplikacji', <code key="a2">http://localhost:3000/docs</code>],
                    [<code key="h1">HTTPX_BIN</code>, 'Zmienna środowiskowa; ścieżka programu httpx', 'wyszukiwanie według listy powyżej'],
                    [<code key="h2">MASSCAN_BIN</code>, 'Zmienna środowiskowa; ścieżka programu masscan', 'wyszukiwanie według listy powyżej'],
                    [<code key="b">DATABASE_URL</code>, <>Zmienna środowiskowa; nadpisuje adres zapisany w <code>src/db.rs</code></>, <>fallback w kodzie (<code>src/db.rs</code>)</>],
                    [<code key="c">DEFAULT_ADMIN_EMAIL</code>, <>Stała w <code>src/db.rs</code></>, <code key="c2">admin@hacknation.pl</code>],
                    [<code key="d">DEFAULT_ADMIN_PASSWORD</code>, <>Stała w <code>src/db.rs</code></>, <code key="d2">securepassword</code>]
                ]}
            />
            <Callout type="danger" title="Adres bazy i hasło są zapisane w kodzie">
                W <code>src/db.rs</code> nadal znajduje się pełny adres Railway PostgreSQL z poświadczeniami jako fallback dla <code>DATABASE_URL</code>. Poświadczenia są w repozytorium. Przed wdrożeniem ustaw <code>DATABASE_URL</code> jako sekret, usuń fallback z kodu i zmień hasło bazy.
            </Callout>
            <p>
                Dokumentacja jest osobną aplikacją (Next.js 16, port 3000) w katalogu <code>docs/</code> repozytorium. Instrukcję jej uruchomienia i odbudowy indeksu asystenta zawiera plik <code>docs/README.md</code>.
            </p>
        </DocPage>
    );
}
