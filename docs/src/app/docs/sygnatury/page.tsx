import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';
import { t } from '@/components/docs/inline';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Custom Signatures' };

export default function Page() {
    return (
        <DocPage
            href="/docs/sygnatury"
            title="Custom Signatures"
            lead="Custom Signatures to reguły operatora dopasowywane do danych przechwyconych przez skan Full. Dopasowanie tworzy alert Signature match i może zostać wysłane do DefectDojo."
            toc={[
                { id: 'ekran', label: 'Ekran i model' },
                { id: 'kryteria', label: 'Kryteria' },
                { id: 'operatory', label: 'Operatory', level: 3 },
                { id: 'laczenie', label: 'Tryb All i Any' },
                { id: 'predefiniowana', label: 'Sygnatura predefiniowana' },
                { id: 'dzialanie', label: 'Kiedy sygnatury działają' },
                { id: 'alerty', label: 'Alerty i duplikaty' },
                { id: 'uprawnienia', label: 'Uprawnienia' },
                { id: 'api', label: 'API' }
            ]}
        >
            <H2 id="ekran">Ekran i model</H2>
            <p>
                Ekran <code>Custom Signatures</code> (w menu: Scanning › Custom Signatures) zawiera tabelę <code>Name</code>, <code>Severity</code>, <code>Match</code>, <code>Criteria</code>, <code>Status</code> i <code>Actions</code>. Przycisk <code>Add signature</code> otwiera formularz:
            </p>
            <RefTable
                head={['Pole', 'Znaczenie']}
                rows={[
                    [t('`Name`'), 'Nazwa reguły; wymagana'],
                    [t('`Description`'), 'Krótki opis widoczny pod nazwą w tabeli'],
                    [t('`Severity`'), t('`Info`, `Medium` (domyślnie), `High` albo `Critical`; trafia do alertu i do DefectDojo')],
                    [t('`Match`'), t('`All criteria must match` albo `Any criterion matches`')],
                    [t('`Enabled`'), 'Wyłączona sygnatura nie jest uruchamiana podczas skanów'],
                    [t('`Criteria`'), 'Lista warunków; przycisk `Add criterion` dodaje kolejny wiersz']
                ]}
            />
            <p>
                Każda reguła przechowuje nazwę, opis, ważność, stan, tryb dopasowania i listę kryteriów. ID jest przypisywane przez serwer; edycja nadpisuje wszystkie pola zwykłej sygnatury.
            </p>
            <CodeBlock
                lang="json"
                title="Kształt sygnatury (JSON strony i API)"
                code={`{
  "id": 4,
  "name": "Exposed debug header",
  "description": "Flags a response that leaks a debug token",
  "severity": "High",
  "enabled": true,
  "predefined": false,
  "match_mode": "all",
  "criteria": [
    { "source": "http_header", "operator": "not_empty", "name": "x-debug-token", "value": "" },
    { "source": "status_code", "operator": "eq", "name": "", "value": "200" }
  ]
}`}
            />

            <H2 id="kryteria">Kryteria</H2>
            <p>
                Kryterium ma cztery pola: <code>source</code> (co sprawdza), <code>operator</code>, <code>name</code> (nazwa nagłówka lub cookie dla źródeł nazwanych) i <code>value</code>. Dostępne źródła:
            </p>
            <RefTable
                head={['source', 'Etykieta w formularzu', 'Sprawdzana wartość']}
                rows={[
                    [<code key="1">http_header</code>, 'HTTP header', t('Wartość nagłówka o nazwie `name`; nazwa jest porównywana bez wielkości liter, a `_` i `-` są równoważne')],
                    [<code key="2">cookie</code>, 'Cookie value', t('Wartość cookie, której nazwa zawiera `name` (format `name=wartość`)')],
                    [<code key="3">cookie_name</code>, 'Cookie name', 'Nazwy wszystkich cookies w odpowiedzi, połączone spacjami'],
                    [<code key="4">title</code>, 'Page title', 'Tytuł strony (znacznik title)'],
                    [<code key="5">server</code>, 'Server', t('Nagłówek `Server` zapisany jako serwer WWW')],
                    [<code key="6">technology</code>, 'Technology', 'Wszystkie wykryte technologie, połączone spacjami (nazwa i wersja)'],
                    [<code key="7">url</code>, 'URL', 'Adres odpowiedzi zapisany przez httpx'],
                    [<code key="8">status_code</code>, 'HTTP status', 'Kod statusu odpowiedzi HTTP (liczba)']
                ]}
            />
            <p>
                Źródła <code>http_header</code>, <code>cookie</code> i <code>cookie_name</code> wymagają nazwy. Kryterium bez nazwy jest odrzucane przy zapisie, podobnie jak nieznane źródło, więc w tabeli nie pojawia się reguła, która nigdy nie zadziała.
            </p>

            <H3 id="operatory">Operatory</H3>
            <RefTable
                head={['Typ źródła', 'Operatory']}
                rows={[
                    ['tekst, cookie, tytuł, serwer, technologie, URL', t('`contains`, `does not contain`, `equals`, `starts with`, `is present` (`not_empty`), `is absent` (`empty`)')],
                    [<code key="2">status_code</code>, t('`=`, `≠`, `>`, `<` (wartość musi być liczbą)')]
                ]}
            />
            <ul>
                <li>Porównania tekstowe są bez rozróżniania wielkości liter; spacje na początku i końcu wartości są obcinane.</li>
                <li>Brak nagłówka o podanej nazwie spełnia warunek <code>is empty</code>, a nie spełnia <code>is not empty</code>.</li>
                <li>Niepoprawna lub pusta wartość liczbowa nigdy nie pasuje.</li>
            </ul>

            <H3 id="laczenie">Tryb All i Any</H3>
            <ul>
                <li><code>All criteria must match</code> (domyślnie): każde kryterium musi być spełnione dla tego samego przechwycenia.</li>
                <li><code>Any criterion matches</code>: wystarczy jedno spełnione kryterium; używaj go dla listy alternatywnych wskaźników.</li>
                <li>Sygnatura bez żadnego kryterium nigdy nie zadziała.</li>
            </ul>

            <H2 id="predefiniowana">Sygnatura predefiniowana</H2>
            <p>
                Przy pierwszym uruchomieniu powstaje sygnatura <code>Interesting cookie/header</code> (ważność <code>Info</code>, tryb <code>Any</code>, włączona). Sprawdza obecność nagłówków typowych dla frameworków i debugowania (<code>x-debug-token</code>, <code>x-powered-by</code>, <code>x-aspnet-version</code>, <code>x-runtime</code>, <code>server-timing</code>, <code>x-elastic-product</code>…) oraz nazwy cookies sesyjnych (<code>jsessionid</code>, <code>phpsessid</code>, <code>laravel_session</code>, <code>wp-settings</code>, <code>django_session</code>…).
            </p>
            <ul>
                <li>Ma znacznik <code>Predefined</code>; można zmienić jej nazwę, opis, ważność i stan, ale <strong>nie kryteria</strong>.</li>
                <li>Nie można jej usunąć: przycisk <code>Remove</code> nie jest pokazany, a API zwraca <code>409</code>.</li>
                <li>Sygnatura predefiniowana jest instalowana raz; restart aplikacji nie nadpisuje jej stanu, więc wyłączenie przez operatora przetrwa restart.</li>
            </ul>

            <H2 id="dzialanie">Kiedy sygnatury działają</H2>
            <p>
                Po zakończeniu każdego skanu aplikacja uruchamia wszystkie włączone sygnatury na przechwyceniach <strong>tego skanu</strong> (<code>scan_host_captures</code>). Trafienie tworzy alert i zwiększa licznik alertów skanu.
            </p>
            <ul>
                <li>Sensowne dane do dopasowania pochodzą ze skanu <strong>Full</strong>: tylko on zapisuje nagłówki, cookies, tytuł, technologie i status.</li>
                <li>Skan Reachability zapisuje wyłącznie stan Up/Down i czasy, więc praktycznie nie ma czym dopasować się do reguł tekstowych.</li>
                <li>Sygnatury działają także dla skanu przerwanego albo zakończonego błędem: oceniane jest to, co zdążył zapisać.</li>
                <li>Zmiana sygnatury nie przelicza wcześniejszych skanów; nowe kryteria zadziałają od następnego skanu.</li>
            </ul>

            <H2 id="alerty">Alerty i duplikaty</H2>
            <p>
                Trafienie trafia na stronę <Link href="/docs/alerty">Alerts</Link> jako typ <code>Signature match</code>. Treść alertu to <code>Matched signature: &lt;nazwa&gt;</code>, a w polu detail znajdują się tylko te kryteria, które faktycznie zostały spełnione (np. <code>HTTP header `x-debug-token` is present; HTTP status = 200</code>).
            </p>
            <ul>
                <li>Ważność alertu pochodzi z sygnatury.</li>
                <li>Alert nie powstaje ponownie, jeśli w tabeli istnieje już alert o tym samym typie, hoście i identyfikatorze szczegółu — <strong>także potwierdzony</strong>. Ten sam host i ten sam zestaw spełnionych kryteriów zgłasza się więc raz.</li>
                <li>Alerty <code>Signature match</code> potwierdza się i filtruje tak samo jak pozostałe (<Link href="/docs/alerty#potwierdzanie">Alerty › Potwierdzanie</Link>).</li>
                <li>Zakończone skany Full z trafieniami mogą zostać wypchnięte do DefectDojo, jeśli w ustawieniach włączono <code>Push custom signature matches</code> (<Link href="/docs/defectdojo#push">DefectDojo › Wysyłanie findingów</Link>).</li>
            </ul>

            <H2 id="uprawnienia">Uprawnienia</H2>
            <p>
                Ekran i endpointy <code>/api/signatures</code> korzystają z klucza <code>signatures</code>. W rolach startowych tylko <strong>Super Admin</strong> ma odczyt i zapis; <strong>Scan Operator</strong> i <strong>Analyst</strong> nie mają dostępu, dopóki rola własna nie nada go w <Link href="/docs/dostep#role-edycja">Admin management</Link>. Bez uprawnienia zapisu tabela jest tylko do odczytu (brak akcji <code>Edit</code> / <code>Remove</code> i przycisku <code>Add signature</code>).
            </p>

            <H2 id="api">API</H2>
            <RefTable
                head={['Metoda', 'Ścieżka', 'Odpowiedź']}
                rows={[
                    ['POST', <code key="1">/api/signatures</code>, '200, utworzona sygnatura; 400 przy błędzie zapisu'],
                    ['PUT', <code key="2">/api/signatures/{'{id}'}</code>, '200, zaktualizowana sygnatura; 404'],
                    ['DELETE', <code key="3">/api/signatures/{'{id}'}</code>, <>204; 404; 409 dla sygnatury predefiniowanej</>]
                ]}
            />
            <p>
                Ładunek to <code>name</code>, opcjonalne <code>description</code>, <code>severity</code> (domyślnie <code>Medium</code>), <code>enabled</code> (domyślnie <code>true</code>), <code>match_mode</code> (<code>all</code> lub <code>any</code>; inne wartości stają się <code>all</code>) oraz <code>criteria</code>. Pełny opis ładunku i wspólne zasady API zawiera <Link href="/docs/api#sygnatury">API HTTP › Sygnatury</Link>.
            </p>
            <Callout type="note" title="Widoczność danych">
                Panel asystenta i tabela sygnatur działają na tych samych danych. Sygnatury nie wysyłają żadnych żądań do hostów; tylko oceniają to, co zapisał skan.
            </Callout>
        </DocPage>
    );
}
