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
            lead="Stos technologiczny, podział na moduły, model danych, konfiguracja oraz status poszczególnych funkcji: co jest trwałe, a co symulowane."
            toc={[
                { id: 'stos', label: 'Stos' },
                { id: 'moduly', label: 'Moduły' },
                { id: 'zadanie', label: 'Przepływ żądania' },
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
                    [<code key="a">src/main.rs</code>, t('Routing, warstwa `guard`, zadanie tykające skan co sekundę, nasłuch na `0.0.0.0:8080`')],
                    [<code key="b">src/auth.rs</code>, t('Logowanie, sesje, middleware `guard`, lista stron uprawnień `PERMISSION_PAGES`')],
                    [<code key="c">src/db.rs</code>, 'Schemat, dane startowe, wszystkie zapytania SQL, klasyfikacja wpisów importu'],
                    [<code key="d">src/handlers.rs</code>, 'Handlery stron HTML i endpointów JSON'],
                    [<code key="e">src/state.rs</code>, 'Struktury danych i ładunki żądań (DTO)'],
                    [<code key="f">src/nav.rs</code>, 'Definicja menu i indeks wyszukiwarki w górnym pasku'],
                    [<code key="g">src/mock.rs</code>, t('Dane przykładowe zapisywane do tabeli `app_data`')],
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
                    Mutacje to wywołania <code>fetch</code> z JSON do <code>/api/*</code> (<Link href="/docs/api">API HTTP</Link>). Po sukcesie strona przeładowuje się; interfejs nie jest aplikacją jednostronicową.
                </li>
            </ol>

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
                    [<code key="d">policies</code>, 'Harmonogramy skanów: nazwa, kolejność, status, kryteria w JSONB'],
                    [<code key="e">host_ips</code>, <>Inwentarz hostów, zob. <Link href="/docs/hosty#typy">Host management</Link></>],
                    [<code key="e2">host_ranges</code>, 'jw.'],
                    [<code key="e3">host_fqdns</code>, 'jw.'],
                    [<code key="f">host_groups</code>, <>Grupy celów, zob. <Link href="/docs/hosty#grupy">Host management</Link></>],
                    [<code key="g">scan_state</code>, t('Jeden wiersz (`id = 1`) ze stanem bieżącego skanu')],
                    [<code key="h">app_data</code>, 'Klucz tekstowy i dokument JSONB: dane przykładowe ekranów wynikowych']
                ]}
            />
            <H3 id="seed">Dane startowe</H3>
            <p>
                Przy pustych tabelach powstają: konto domyślne (<Link href="/docs/dostep#logowanie">Dostęp i uprawnienia</Link>), trzy role, dwa harmonogramy, dwie grupy hostów, inwentarz z przykładowych adresów, stan skanu w trakcie wykonywania (34%) oraz wszystkie klucze <code>app_data</code>.
            </p>

            <H2 id="status">Status funkcji</H2>
            <p>To jedyne miejsce, które określa, czy funkcja działa na prawdziwych danych. Pozostałe strony opisują zachowanie, nie powtarzając tego podziału.</p>
            <RefTable
                head={['Funkcja', 'Stan', 'Źródło danych']}
                rows={[
                    ['Inwentarz hostów, grupy, tagi, import', <Badge key="1" variant="success">trwałe</Badge>, t('Tabele `host_*`; pełny zapis i odczyt')],
                    ['Harmonogramy skanów', <Badge key="2" variant="success">trwałe</Badge>, <>Tabela <code>policies</code>; harmonogramy nie uruchamiają skanów (<Link href="/docs/skanowanie#harmonogramy">Skanowanie</Link>)</>],
                    ['Administratorzy, role, sesje', <Badge key="3" variant="success">trwałe</Badge>, t('Tabele `admins`, `roles`, `sessions`')],
                    ['Przebieg skanu', <Badge key="4" variant="warn">symulowany</Badge>, <>Licznik w <code>scan_state</code> zwiększany co sekundę; stała pula celów, bez związku z ewidencją i harmonogramami; zakończony przebieg nie trafia do Scan Results (<Link href="/docs/skanowanie#uruchomienie">Skanowanie</Link>)</>],
                    ['Szczegóły pojedynczego uruchomienia, filtry Data Explorer po tagu i czasie, tag jako cel skanu', <Badge key="4b">niedostępne</Badge>, <>Opis obecnego zachowania i obejść: <Link href="/docs/wyniki#szczegoly">Wyniki i analiza</Link>, <Link href="/docs/tagowanie#zastosowania">Tagowanie</Link></>],
                    ['Dashboardy, Data Explorer, Scan Results, Compare Scans', <Badge key="5" variant="warn">dane przykładowe</Badge>, <>Dokumenty <code>app_data</code>, tylko do odczytu (<Link href="/docs/wyniki#zrodlo">Wyniki i analiza</Link>)</>],
                    ['Upcoming scan, Scan queue', <Badge key="6" variant="warn">statyczne</Badge>, 'Zapis w danych przykładowych i w szablonie; niezwiązane z harmonogramami'],
                    ['Settings: motyw', <Badge key="7" variant="success">działa</Badge>, <>Wybór w <code>localStorage</code> pod kluczem <code>asi.theme</code>, per przeglądarka</>],
                    ['Settings: głębokość i współbieżność skanowania', <Badge key="8">bez zapisu</Badge>, 'Kontrolki nie są podpięte do serwera']
                ]}
            />

            <H2 id="konfiguracja">Uruchomienie i konfiguracja</H2>
            <CodeBlock lang="bash" code={`cargo run   # http://localhost:8080`} />
            <RefTable
                head={['Ustawienie', 'Miejsce', 'Domyślnie']}
                rows={[
                    [<code key="a">DOCS_URL</code>, 'Zmienna środowiskowa; cel przycisku „?” w aplikacji', <code key="a2">http://localhost:3000/docs</code>],
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
