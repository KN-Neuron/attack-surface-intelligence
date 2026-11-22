import type { Metadata } from 'next';
import { t } from '@/components/docs/inline';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';

export const metadata: Metadata = { title: 'DefectDojo' };

export default function Page() {
    return (
        <DocPage
            href="/docs/defectdojo"
            title="DefectDojo"
            lead="Dwukierunkowa integracja z DefectDojo: findingi ze skanów trafiają do zewnętrznego systemu, a findingi z DefectDojo są widoczne w Visibly."
            toc={[
                { id: 'model', label: 'Co robi integracja' },
                { id: 'konfiguracja', label: 'Konfiguracja połączenia' },
                { id: 'mapowanie', label: 'Mapowanie obiektów' },
                { id: 'push', label: 'Wysyłanie findingów' },
                { id: 'auto', label: 'Automatyczna synchronizacja', level: 3 },
                { id: 'pull', label: 'Pobieranie danych' },
                { id: 'aktywnosc', label: 'Aktywność i uprawnienia' },
                { id: 'bezpieczenstwo', label: 'Bezpieczeństwo' },
                { id: 'problemy', label: 'Typowe problemy' }
            ]}
        >
            <H2 id="model">Co robi integracja</H2>
            <p>
                Sekcja <strong>DefectDojo</strong> w menu (pod <em>Data Explorer</em>) łączy Visibly z instancją DefectDojo przez REST API v2. Ma cztery zakładki:
            </p>
            <RefTable
                head={['Zakładka', 'Zawartość']}
                rows={[
                    [<strong key="a">Overview</strong>, 'Liczby findingów według ważności i statusu, rozkład produktów, ostatnie findingi i wynik ostatniej synchronizacji'],
                    [<strong key="b">Findings</strong>, 'Lokalny cache findingów pobranych z DefectDojo: wyszukiwanie, filtr ważności, stronicowanie i odnośnik do DefectDojo'],
                    [<strong key="c">Sync activity</strong>, 'Historia pushów i pulli: liczba wysłanych/utworzonych/zamkniętych findingów, czas, błąd i surowa odpowiedź API'],
                    [<strong key="d">Settings</strong>, 'Adres instancji, token API, mapowanie produktów i przełączniki synchronizacji']
                ]}
            />

            <H2 id="konfiguracja">Konfiguracja połączenia</H2>
            <ol>
                <li>
                    W DefectDojo otwórz menu użytkownika i wybierz <strong>API v2 Token</strong> (w wersji open source: <strong>API v2 Key</strong>).
                </li>
                <li>
                    W Visibly przejdź do <strong>DefectDojo › Settings</strong>, wpisz adres instancji (np. <code>https://defectdojo.example.com</code>) i wklej token.
                </li>
                <li>
                    Zapisz ustawienia i kliknij <strong>Test connection</strong>. Komunikat <code>Connected to DefectDojo</code> oznacza, że adres i token działają.
                </li>
            </ol>
            <p>
                Token jest wysyłany w nagłówku <code>Authorization: Token …</code>. W formularzu widać tylko jego końcówkę; puste pole przy zapisie zachowuje poprzedni token, a opcja <strong>Remove the stored token</strong> go usuwa.
            </p>
            <Callout type="warning" title="Wyłącz weryfikację TLS tylko świadomie">
                Przełącznik <code>Verify TLS</code> domyślnie jest włączony. Wyłącz go wyłącznie dla instancji z certyfikatem podpisanym przez zaufany, lokalny urząd, którego przeglądarka aplikacji nie zna.
            </Callout>

            <H2 id="mapowanie">Mapowanie obiektów</H2>
            <p>
                Visibly odwzorowuje swoje dane na hierarchię DefectDojo: <code>Product Type → Product → Engagement → Test → Finding</code>.
            </p>
            <RefTable
                head={['Visibly', 'DefectDojo']}
                rows={[
                    [<>Konfigurowalny product type (domyślnie <code>Visibly</code>)</>, 'Organizacja/product type'],
                    ['Host group', 'Produkt o nazwie grupy'],
                    ['Host poza grupą', <>Domyślny produkt (domyślnie <code>Visibly Attack Surface</code>)</>],
                    ['Skan + produkt', <>Engagement i Test (<code>Visibly #numer</code>)</>],
                    ['Wykrycie CVE', <>Finding z polem <code>cve</code>, komponentem i wersją</>],
                    ['Dopasowanie custom signature', <>Finding z <code>vuln_id_from_tool</code> i opisem sygnatury</>],
                    ['URL hosta z ostatniego skanu', 'Endpoint findingu (location reference)'],
                    ['Tagi hosta i grupy', 'Tagi findingu']
                ]}
            />
            <p>
                Host może należeć do kilku grup. Wybierana jest pierwsza grupa alfabetycznie, aby mapowanie było powtarzalne. Finding obejmujący kilka hostów tej samej grupy jest wysyłany jako jeden rekord z wieloma endpointami.
            </p>

            <H2 id="push">Wysyłanie findingów</H2>
            <p>
                Push obejmuje <strong>wykrycia CVE</strong> (wersja technologii dopasowana do lokalnej bazy podatności) oraz <strong>dopasowania Custom Signatures</strong>. Findingi <em>New host</em> i <em>Host down</em> nie są wysyłane — opisują zmiany w inwentarzu, a nie podatności.
            </p>
            <ul>
                <li>
                    Wysyłane są tylko skany <strong>Full</strong> ze statusem <strong>Completed</strong>.
                </li>
                <li>
                    Raport jest plikiem JSON w formacie <strong>Generic Findings Import</strong> wysyłanym przez <code>/api/v2/reimport-scan/</code>.
                </li>
                <li>
                    Pierwszy push tworzy product type, produkt, engagement i test. Kolejny push tego samego skanu trafia do zapisanego <code>test_id</code>, więc nie tworzy duplikatów.
                </li>
                <li>
                    Pole <code>unique_id_from_tool</code> ma postać <code>visibly:produkt:cve:…</code> lub <code>visibly:produkt:sig:…</code> i jest stabilne między pushami.
                </li>
                <li>
                    Opcja <strong>Close old findings on re-push</strong> zamyka findingi, których nie ma w nowym raporcie, ale tylko w obrębie tego samego testu.
                </li>
            </ul>
            <CodeBlock
                lang="text"
                title="Przykładowy finding w raporcie"
                code={`{
  "title": "CVE-2023-38408 in OpenSSH 8.9p1",
  "severity": "Critical",
  "description": "…",
  "cve": "CVE-2023-38408",
  "component_name": "OpenSSH",
  "component_version": "8.9p1",
  "unique_id_from_tool": "visibly:core-services:cve:cve-2023-38408:openssh:8-9p1",
  "endpoints": ["https://10.0.4.9"],
  "tags": ["visibly", "cve", "core"]
}`}
            />

            <H3 id="auto">Automatyczna synchronizacja</H3>
            <p>
                Po zakończeniu skanu Full, przy włączonej opcji <strong>Auto-sync after full scans</strong>, Visibly uruchamia push w osobnym zadaniu. Błąd DefectDojo nie zmienia statusu skanu — trafia do zakładki <strong>Sync activity</strong>. Ręczny push wykonasz przyciskiem <strong>Push latest scan</strong> albo wybierając konkretny skan w zakładce <strong>Sync activity</strong>.
            </p>

            <H2 id="pull">Pobieranie danych</H2>
            <p>
                <strong>Pull findings</strong> pobiera findingi przez <code>/api/v2/findings/?related_fields=true</code> i zapisuje je w lokalnej tabeli <code>defectdojo_findings</code>. Dzięki temu zakładki Overview i Findings działają bez odpytywania DefectDojo przy każdym odświeżeniu strony.
            </p>
            <ul>
                <li>
                    Pobieranych jest najnowszych 1000 findingów. Jeśli instancja ma ich więcej, wiadomość w historii synchronizacji podaje łączną liczbę.
                </li>
                <li>
                    Endpointy są rozwiązywane przez <code>/api/v2/location_findings/</code>, a na starszych instancjach przez <code>/api/v2/endpoints/</code>.
                </li>
                <li>
                    Cache jest podmieniany w jednej transakcji. Błąd pobierania zostawia poprzednie dane bez zmian.
                </li>
                <li>
                    Filtry w zakładce Findings działają lokalnie; przycisk <strong>Open</strong> prowadzi do <code>/finding/&lt;id&gt;</code> w DefectDojo.
                </li>
            </ul>

            <H2 id="aktywnosc">Aktywność i uprawnienia</H2>
            <p>
                Każdy push, pull i błąd jest zapisywany w tabeli <code>defectdojo_syncs</code>. Wiersz zawiera liczbę wysłanych, utworzonych, zamkniętych i ponownie otwartych findingów, czas trwania oraz surową odpowiedź API w rozwijanym bloku.
            </p>
            <p>
                Strona korzysta z uprawnienia <code>defectdojo</code>. Domyślnie <strong>Super Admin</strong> ma pełny dostęp, <strong>Scan Operator</strong> może czytać i synchronizować, a <strong>Analyst</strong> tylko czyta. Role własne ustawisz w <Link href="/docs/dostep">Dostęp i uprawnienia</Link>.
            </p>

            <H2 id="bezpieczenstwo">Bezpieczeństwo</H2>
            <ul>
                <li>Token jest przechowywany w bazie po stronie serwera i nigdy nie trafia do HTML ani JSON-a zwracanego przeglądarce.</li>
                <li>Adres instancji jest walidowany: dozwolone są tylko schematy <code>http</code> i <code>https</code>.</li>
                <li>Każde żądanie ma 30-sekundowy limit czasu; błąd połączenia nie blokuje skanu.</li>
                <li>Uprawnienia zapisu do strony są wymagane dla zapisu ustawień, testu połączenia, pushu i pullu; odczyt strony i cache wymaga tylko uprawnienia odczytu.</li>
            </ul>
            <Callout type="warning" title="Token a kopie bazy">
                Token jest częścią konfiguracji zapisanej w bazie. Jeśli wykonujesz kopię bazy lub udostępniasz środowisko, potraktuj ją jak sekret i obróć token w DefectDojo po zakończeniu pracy.
            </Callout>

            <H2 id="problemy">Typowe problemy</H2>
            <RefTable
                head={['Objaw', 'Co sprawdzić']}
                rows={[
                    [<code key="nc">DefectDojo is not configured</code>, <>Czy zapisano adres i token oraz czy przełącznik <strong>Enable DefectDojo</strong> jest włączony</>],
                    [<code key="e401">DefectDojo returned 401</code>, t('Token został unieważniony lub należy do innego użytkownika; wygeneruj nowy w API v2 Token')],
                    [<code key="e403">DefectDojo returned 403</code>, 'Token nie ma prawa tworzyć produktów, engagementów, testów lub findingów'],
                    ['Brak findingów po pushu', 'Czy skan jest Full i Completed oraz czy włączono push CVE i/lub custom signatures'],
                    ['Puste endpointy w Findings', 'Instancja może używać starszego API endpointów; sprawdź odpowiedź w Activity'],
                    ['Brak wyników po pullu', 'Zwiększ limit/uprawnienia tokena lub sprawdź, czy findingi nie są poza najnowszymi 1000']
                ]}
            />
        </DocPage>
    );
}
