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
                    ['Interfejs', 'Czysty JavaScript i CSS', t('Bez frameworka i bundlera: `static/app.js`, `static/app.css`')]
                ]}
            />

            <H2 id="moduly">Moduły</H2>
            <RefTable
                head={['Plik', 'Odpowiedzialność']}
                rows={[
                    [<code key="a">src/main.rs</code>, t('Routing, warstwa `guard`, zadanie sprawdzające harmonogramy co 30 s, nasłuch na `0.0.0.0` i porcie z `PORT` (domyślnie 8080)')],
                    [<code key="b">src/auth.rs</code>, t('Logowanie, sesje, middleware `guard`, lista stron uprawnień `PERMISSION_PAGES`')],
                    [<code key="c">src/db.rs</code>, 'Schemat, dane startowe, wszystkie zapytania SQL, klasyfikacja wpisów importu'],
                    [<code key="d">src/handlers.rs</code>, 'Handlery stron HTML i endpointów JSON'],
                    [<code key="d2">src/scan.rs</code>, <>Silnik skanowania: rozwiązywanie celów, httpx, masscan i sonda TCP, alerty, harmonogram (<Link key="sk" href="#skan">Silnik skanowania</Link>)</>],
                    [<code key="e">src/state.rs</code>, 'Struktury danych i ładunki żądań (DTO)'],
                    [<code key="f">src/nav.rs</code>, 'Definicja menu i indeks wyszukiwarki w górnym pasku'],
                    [<code key="g">src/mock.rs</code>, t('Dane przykładowe zapisywane do tabeli `app_data` (historia skanów, dashboardy, lista znanych podatnych wersji)')],
                    [<code key="h">templates/</code>, <>Szablon bazowy <code>base.html</code>, strony w <code>pages/</code>, stopka tabel <code>partials/pager.html</code></>]
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
                    Mutacje to wywołania <code>fetch</code> z JSON do <code>/api/*</code> (<Link href="/docs/api">API HTTP</Link>). Po sukcesie strona przeładowuje się; interfejs nie jest aplikacją jednostronicową. Wyjątkiem są Scan Management, który co 1,5 s odpytuje <code>/api/scan/status</code>, oraz filtry Data Explorer, działające w przeglądarce na wczytanym zestawie hostów.
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
                    <strong>Wyniki.</strong> Każdy skan to wiersz w <code>scans</code>; stan hostów trafia do <code>scan_hosts</code> (jedna linia na adres, nadpisywana), a zmiany do <code>alerts</code> (<Link href="/docs/alerty">Alerty</Link>).
                </li>
                <li>
                    <strong>Harmonogram.</strong> Pętla w <code>main.rs</code> co 30 s wywołuje <code>tick_scheduler</code>: uzupełnia terminy <code>next_run_at</code> i startuje wymagalną konfigurację.
                </li>
                <li>
                    <strong>Restart.</strong> Przy starcie wiersze skanów w stanie <code>Running</code> dostają status <code>Failed</code> (<code>interrupted by restart</code>), a blokada jest zwalniana. Skan nie wznawia się po restarcie.
                </li>
                <li>
                    <strong>Lista celów</strong> jest zapisywana do pliku tymczasowego, który znika po skanie. Do skanerów trafiają wyłącznie adresy IP: nazwy są rozwiązywane przez DNS, a wpisy, które nie są adresem ani rozwiązywalną nazwą, odpadają, więc dowolny tekst z konfiguracji nie staje się argumentem programu.
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
                    [<code key="g1">scans</code>, t('Jedno uruchomienie: etykieta, typ, silnik, trigger (`manual`, `policy`, `scheduled`), cele, status, czasy, liczniki i komunikat błędu')],
                    [<code key="g2">scan_hosts</code>, t('Aktualny stan każdego adresu (`address` UNIQUE): `up`, czasy `first_seen`, `last_seen`, `last_checked`, odpowiedź HTTP, TLS, technologie i porty w JSONB, surowy wiersz httpx w `raw`')],
                    [<code key="g3">alerts</code>, t('Alert: typ, waga, host, treść, `detail` (CVE), dane potwierdzenia, odwołanie do skanu (`ON DELETE SET NULL`)')],
                    [<code key="h">app_data</code>, 'Klucz tekstowy i dokument JSONB: dane przykładowe ekranów wynikowych oraz lista znanych podatnych wersji']
                ]}
            />
            <H3 id="seed">Dane startowe</H3>
            <p>
                Przy pustych tabelach powstają: konto domyślne (<Link href="/docs/dostep#logowanie">Dostęp i uprawnienia</Link>), trzy role, dwa harmonogramy, dwie grupy hostów, inwentarz z przykładowych adresów, bezczynny stan skanu oraz klucze <code>app_data</code> z danymi przykładowymi. Tabele <code>scans</code>, <code>scan_hosts</code> i <code>alerts</code> startują puste i wypełniają się dopiero skanami.
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
                    ['Scan Results, okno Scan details, Data Explorer, Alerts', <Badge key="5" variant="success">z prawdziwych skanów</Badge>, <>Tabele <code>scans</code>, <code>scan_hosts</code>, <code>alerts</code> (<Link href="/docs/wyniki#zrodlo">Wyniki i analiza › Źródło danych</Link>)</>],
                    ['Upcoming scan', <Badge key="6" variant="success">z harmonogramów</Badge>, t('Najbliższa włączona konfiguracja; bez niej wartości przykładowe')],
                    ['Compare Scans, Technologies used, Vulnerable versions, kafelki i tabele Latest Scan summary', <Badge key="7" variant="warn">dane przykładowe</Badge>, <>Dokumenty <code>app_data</code>, tylko do odczytu; prawdziwe są jedynie <code>Latest scan</code> i <code>Open alerts</code> (<Link href="/docs/wyniki#dane">Wyniki i analiza</Link>)</>],
                    ['Scan queue', <Badge key="8" variant="warn">statyczne</Badge>, 'Stała zawartość szablonu; aplikacja nie kolejkuje skanów'],
                    ['Licznik Vulns w Scan Results', <Badge key="9">niewyliczany</Badge>, <>Dla prawdziwych skanów 0; podatności zgłasza <Link href="/docs/alerty#cve">New CVE</Link></>],
                    ['Filtr Data Explorer po tagu hosta, tag jako cel skanu', <Badge key="10">niedostępne</Badge>, <>Obejścia: <Link href="/docs/tagowanie#zastosowania">Tagowanie</Link></>],
                    ['Settings: motyw', <Badge key="11" variant="success">działa</Badge>, <>Wybór w <code>localStorage</code> pod kluczem <code>asi.theme</code>, per przeglądarka</>],
                    ['Settings: głębokość i współbieżność skanowania', <Badge key="12">bez zapisu</Badge>, 'Kontrolki nie są podpięte do serwera: limity skanera są stałymi w kodzie']
                ]}
            />

            <H2 id="konfiguracja">Uruchomienie i konfiguracja</H2>
            <CodeBlock lang="bash" code={`cargo run   # http://localhost:8080`} />
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
                    [<code key="b">DATABASE_URL</code>, <>Stała w <code>src/db.rs</code></>, 'Adres bazy PostgreSQL w kodzie'],
                    [<code key="c">DEFAULT_ADMIN_EMAIL</code>, <>Stała w <code>src/db.rs</code></>, <code key="c2">admin@hacknation.pl</code>]
                ]}
            />
            <Callout type="danger" title="Adres bazy jest zapisany w kodzie">
                Poświadczenia bazy znajdują się w repozytorium. Przed wdrożeniem przenieś je do zmiennej środowiskowej i zmień hasło bazy.
            </Callout>
            <p>
                Dokumentacja jest osobną aplikacją (Next.js, port 3000) w katalogu <code>frontend/docs</code>. Instrukcja jej uruchomienia i odbudowy indeksu asystenta znajduje się w pliku <code>README.md</code> tego katalogu.
            </p>
        </DocPage>
    );
}
