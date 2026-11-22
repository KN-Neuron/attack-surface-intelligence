import type { Metadata } from 'next';
import { t } from '@/components/docs/inline';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2 } from '@/components/docs/headings';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';

export const metadata: Metadata = { title: 'API HTTP' };

export default function Page() {
    return (
        <DocPage
            href="/docs/api"
            title="API HTTP"
            lead="Konwencje wspólne oraz spis endpointów JSON poza inwentarzem hostów, który opisuje osobna strona."
            toc={[
                { id: 'konwencje', label: 'Konwencje' },
                { id: 'scan', label: 'Skan' },
                { id: 'harmonogramy', label: 'Harmonogramy' },
                { id: 'alerty', label: 'Alerty' },
                { id: 'asset', label: 'Hosty z Data Explorer' },
                { id: 'administracja', label: 'Administratorzy i role' },
                { id: 'wyszukiwarka', label: 'Wyszukiwarka' },
                { id: 'inwentarz', label: 'Inwentarz hostów' }
            ]}
        >
            <H2 id="konwencje">Konwencje</H2>
            <RefTable
                head={['Zagadnienie', 'Zasada']}
                rows={[
                    ['Uwierzytelnianie', <>Ciasteczko sesji (<Link href="/docs/dostep#logowanie">Dostęp i uprawnienia</Link>). Brak sesji daje 401</>],
                    ['Uprawnienia', <>Metody inne niż <code>GET</code> wymagają zapisu w odpowiedniej sekcji; brak uprawnień daje 403 (<Link href="/docs/dostep#sciezki">mapowanie ścieżek</Link>)</>],
                    ['Format', t('Żądania i odpowiedzi w JSON; nagłówek `Content-Type: application/json` w żądaniach z ciałem')],
                    ['Kody', '200 z ciałem, 204 bez ciała, 400 niepoprawne dane, 404 brak obiektu, 409 konflikt, 500 błąd zapisu'],
                    ['Wersjonowanie i stronicowanie', 'Brak. Endpointy nie są wersjonowane ani stronicowane; odczyt JSON dotyczy stanu skanu, szczegółów uruchomienia i wyszukiwarki']
                ]}
            />

            <H2 id="scan">Skan</H2>
            <RefTable
                head={['Metoda', 'Ścieżka', 'Opis']}
                rows={[
                    ['GET', <code key="1">/api/scan/status</code>, 'Bieżący stan skanu (ScanStatus)'],
                    ['POST', <code key="2">/api/scan/run</code>, <>Rozpoczyna skan całej ewidencji. Ciało: <code>{'{ "scan_type": "full" | "reachability" }'}</code>; brak pola lub nieznana wartość oznacza <code>full</code></>],
                    ['POST', <code key="2b">/api/scan/start</code>, 'Skrót: skan Full całej ewidencji, bez ciała'],
                    ['POST', <code key="3">/api/scan/pause</code>, 'Przełącza wstrzymanie trwającego skanu'],
                    ['POST', <code key="4">/api/scan/cancel</code>, 'Przerywa skan'],
                    ['GET', <code key="5">/api/scans/{'{id}'}</code>, <>Szczegóły uruchomienia (ScanDetail); 404 dla nieznanego numeru. Wymaga odczytu <code>Scan Status</code> (<Link href="/docs/dostep#sciezki">Dostęp i uprawnienia</Link>)</>]
                ]}
            />
            <p>
                Cztery pierwsze zwracają ten sam obiekt <code>ScanStatus</code>; znaczenie pól i przejść opisuje <Link href="/docs/skanowanie#przejscia">Skanowanie</Link>. <code>run</code> i <code>start</code> zwracają 409 z komunikatem tekstowym, gdy trwa już inny skan albo nie ma żadnego celu do skanowania.
            </p>
            <CodeBlock
                lang="json"
                title="ScanStatus"
                code={`{
  "running": true,
  "paused": false,
  "progress": 34.0,
  "targets_done": 87,
  "target_total": 256,
  "hosts_found": 41,
  "current_target": "198.51.100.87",
  "started_at": "November 21, 2026 09:14:02 AM",
  "completed_at": null,
  "scan_id": 12,
  "scan_type": "full",
  "engine": "httpx",
  "alerts_found": 0
}`}
            />
            <RefTable
                head={['Pole', 'Znaczenie']}
                rows={[
                    [<code key="a">scan_id</code>, 'Numer wiersza skanu w tabeli scans: trwającego albo ostatniego; null, dopóki nie uruchomiono żadnego skanu'],
                    [<code key="b">scan_type</code>, t('`full` lub `reachability`')],
                    [<code key="c">engine</code>, t('`httpx`, `masscan` albo `tcp` (przełączenie na sondę TCP zmienia wartość w trakcie skanu)')],
                    [<code key="d">alerts_found</code>, 'Liczba alertów skanu; ustawiana po jego zakończeniu']
                ]}
            />
            <CodeBlock
                lang="json"
                title="ScanDetail (skrót)"
                code={`{
  "id": 12,
  "label": "Produkcja – nocny skan",
  "demo": false,
  "scan_type": "full",
  "scan_type_label": "Full scan test",
  "engine": "httpx",
  "trigger": "scheduled",
  "status": "Completed",
  "started": "Nov 21, 2026 1:00 AM",
  "finished": "Nov 21, 2026 1:04 AM",
  "duration": "4m",
  "targets": ["203.0.113.0", "203.0.113.1", "203.0.113.2", "203.0.113.3", "+252 more"],
  "hosts_total": 256, "alive": 41, "down": 215,
  "services": 41, "technologies": 33, "vulns": 0,
  "alerts": 3, "alerts_new_host": 2, "alerts_host_down": 0,
  "alerts_new_cve": 1, "alerts_open": 3,
  "top_technologies": [{ "name": "Nginx", "hosts": 18 }],
  "top_services": [{ "label": "HTTPS", "hosts": 36 }],
  "error": ""
}`}
            />
            <p>
                Dla wierszy przykładowych <code>id</code> jest ujemne, a <code>demo</code> ma wartość <code>true</code>.
            </p>

            <H2 id="harmonogramy">Harmonogramy</H2>
            <RefTable
                head={['Metoda', 'Ścieżka', 'Odpowiedź']}
                rows={[
                    ['POST', <code key="1">/api/policies</code>, '200, utworzony obiekt; 500 przy błędzie zapisu'],
                    ['PUT', <code key="2">/api/policies/{'{id}'}</code>, '200, zaktualizowany obiekt; 404'],
                    ['DELETE', <code key="3">/api/policies/{'{id}'}</code>, '204 lub 404'],
                    ['POST', <code key="4">/api/policies/{'{id}'}/run</code>, <>Natychmiast uruchamia skan z celami i typem konfiguracji (<code>Run now</code>); zwraca ScanStatus, 404 dla nieznanej konfiguracji albo 409 (trwa inny skan lub brak rozwiązanych celów)</>]
                ]}
            />
            <p>
                Ładunek ma kształt obiektu <code>Policy</code> z <Link href="/docs/skanowanie#czas">Skanowania</Link> (bez <code>id</code>). Pola <code>order</code>, <code>criteria</code> i <code>enabled</code> są opcjonalne; domyślnie pusta lista i <code>true</code>. Brak <code>order</code> lub wartość ≤ 0 przy tworzeniu daje kolejny numer po największym istniejącym, a przy edycji – 1.
            </p>
            <RefTable
                head={['kind', 'value', 'Rola']}
                rows={[
                    [<code key="a">host group</code>, 'Nazwa grupy', 'cel'],
                    [<code key="b">ip address</code>, t('Adres, np. `203.0.113.10`'), 'cel'],
                    [<code key="c">ip range</code>, t('Blok CIDR, np. `198.51.100.0/24`'), 'cel'],
                    [<code key="d">fqdn</code>, t('Nazwa, np. `www.example.com`'), 'cel'],
                    [<code key="t">type</code>, t('`full` lub `reachability`; brak kryterium oznacza `full`'), 'typ skanu'],
                    [<code key="e">frequency</code>, t('`Daily`, `Weekly`, `Monthly` lub `On demand`'), 'harmonogram'],
                    [<code key="f">when</code>, t('`<dzień> <HH:MM>`: `every 01:00`, `mon 22:00` … `sun`, `d1 03:30` … `d28`; bez strefy czasowej'), 'harmonogram']
                ]}
            />
            <p>
                Serwer nie waliduje kryteriów: zapisuje każdą parę <code>kind</code> / <code>value</code>. Starszy rodzaj <code>IP to scan</code> jest nadal odczytywany i wyświetlany jako <code>IP address</code> albo <code>IP range</code>. Wymóg co najmniej jednego celu sprawdza tylko formularz. Wartości celów są interpretowane dopiero przy uruchomieniu skanu (<Link href="/docs/skanowanie#rozwiazywanie">Rozwiązywanie celów</Link>).
            </p>

            <H2 id="alerty">Alerty</H2>
            <RefTable
                head={['Metoda', 'Ścieżka', 'Odpowiedź']}
                rows={[
                    ['POST', <code key="1">/api/alerts/acknowledge</code>, <>Potwierdza wiele alertów. Ciało: <code>{'{ "ids": [12, 13] }'}</code>. Zwraca liczbę zmienionych alertów (liczba JSON)</>],
                    ['POST', <code key="2">/api/alerts/{'{id}'}/acknowledge</code>, 'Potwierdza jeden alert; zwraca 1 albo 0, gdy alert już był potwierdzony lub nie istnieje']
                ]}
            />
            <p>
                Oba wymagają zapisu do strony <code>Alerts</code>. Do potwierdzenia dopisywane są imię i nazwisko administratora oraz czas; cofnięcia nie ma. Lista alertów jest dostępna tylko jako strona HTML (<Link href="/docs/alerty#ekran">Alerty › Ekran Alerts</Link>).
            </p>

            <H2 id="asset">Hosty z Data Explorer</H2>
            <RefTable
                head={['Metoda', 'Ścieżka', 'Odpowiedź']}
                rows={[['PUT', <code key="1">/api/assets/{'{address}'}</code>, '204 po zapisie albo 404, gdy skaner nie zna adresu']]}
            />
            <p>
                Adres w ścieżce należy zakodować (<code>encodeURIComponent</code>). Wszystkie pola ciała są opcjonalne, a pominięte lub <code>null</code> zostawiają dotychczasową wartość. Wymaga zapisu do strony <code>Data Explorer</code>; skutki opisuje <Link href="/docs/data-explorer#edycja">Data Explorer › Tryb edycji</Link>.
            </p>
            <CodeBlock
                lang="json"
                title="Ładunek"
                code={`{
  "title": "Panel klienta",
  "webserver": "nginx",
  "scheme": "https",
  "port": 443,
  "status_code": 200,
  "cdn": "",
  "cname": "",
  "up": true
}`}
            />

            <H2 id="administracja">Administratorzy i role</H2>
            <RefTable
                head={['Metoda', 'Ścieżka', 'Odpowiedź']}
                rows={[
                    ['POST', <code key="1">/api/admins</code>, '200, utworzony administrator; 400 (hasło krótsze niż 8 znaków lub nieistniejąca rola)'],
                    ['PUT', <code key="2">/api/admins/{'{id}'}</code>, '200; 400; 403 dla konta domyślnego; 404'],
                    ['POST', <code key="3">/api/admins/{'{id}'}/toggle</code>, '200; 403 dla konta domyślnego; 404'],
                    ['POST', <code key="4">/api/roles</code>, '200, utworzona rola; 400 przy pustej nazwie'],
                    ['PUT', <code key="5">/api/roles/{'{id}'}</code>, '200; 400; 404'],
                    ['DELETE', <code key="6">/api/roles/{'{id}'}</code>, '204 lub 409, gdy rola jest przypisana administratorowi albo nie istnieje']
                ]}
            />
            <CodeBlock
                lang="jsonc"
                title="Ładunki"
                code={`// POST /api/admins, PUT /api/admins/{id} (w PUT hasło jest opcjonalne)
{ "name": "Jan Kowalski", "email": "jan@example.com", "role": "Analyst", "status": "Active", "password": "min-8-znaków" }

// POST /api/roles, PUT /api/roles/{id}
{
  "name": "Auditor",
  "permissions": [
    { "page": "dashboards", "can_read": true, "can_write": false },
    { "page": "scan_history", "can_read": true, "can_write": false }
  ]
}`}
            />

            <H2 id="wyszukiwarka">Wyszukiwarka</H2>
            <p>
                <code>GET /api/search?q=…&amp;limit=…</code> zasila podpowiedzi w górnym pasku. Indeks obejmuje wyłącznie pozycje menu, przefiltrowane uprawnieniami konta; nie przeszukuje inwentarza ani wyników. <code>limit</code> mieści się w przedziale 1–25 (domyślnie 8). Odpowiedź to lista obiektów{' '}
                <code>title</code>, <code>crumb</code>, <code>href</code>, <code>icon</code>, <code>svg</code>.
            </p>
            <p>Kolejność wyników zależy od dopasowania do tytułu: dokładne, początek tytułu, początek słowa, wszystkie słowa, fragment tytułu, a na końcu fragment nazwy sekcji. Przy równej punktacji wygrywa krótszy tytuł.</p>

            <H2 id="inwentarz">Inwentarz hostów</H2>
            <p>
                Endpointy <code>/api/host-ips</code>, <code>/api/host-ranges</code>, <code>/api/host-fqdns</code>, <code>/api/host-import</code> i <code>/api/host-groups</code> opisuje <Link href="/docs/tagowanie/api#endpointy">Tagowanie › API</Link>.
            </p>
        </DocPage>
    );
}
