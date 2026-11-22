import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';
import { t } from '@/components/docs/inline';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
    return (
        <DocPage
            href="/docs/ustawienia"
            title="Settings"
            lead="Ekran Settings ma dwie działające sekcje: motyw interfejsu (per przeglądarka) oraz strojenie skanera httpx (wspólne dla całej instalacji, zapisane w bazie)."
            toc={[
                { id: 'ekran', label: 'Ekran' },
                { id: 'motyw', label: 'Appearance' },
                { id: 'skaner', label: 'HTTP scanner' },
                { id: 'wplyw', label: 'Wpływ na skan' },
                { id: 'uprawnienia', label: 'Uprawnienia i API' },
                { id: 'stare', label: 'Sekcja Scanning' }
            ]}
        >
            <H2 id="ekran">Ekran</H2>
            <p>
                <code>Settings</code> (w menu: Administracja › Settings) składa się z trzech kart: <code>Appearance</code>, <code>Scanning</code> i <code>HTTP scanner</code>. Zapis ustawień skanera wymaga uprawnienia zapisu do klucza <code>settings</code>; bez niego pola są zablokowane i nie ma przycisku <code>Save scanner settings</code>.
            </p>

            <H2 id="motyw">Appearance</H2>
            <p>
                Przełącznik <code>Light</code> / <code>Dark</code> zmienia motyw natychmiast. Wybór jest zapisany w <code>localStorage</code> przeglądarki pod kluczem <code>asi.theme</code>, więc dotyczy tylko tego urządzenia i przeglądarki, a nie konta administratora. Domyślnie interfejs jest ciemny.
            </p>

            <H2 id="skaner">HTTP scanner</H2>
            <p>
                Wartości są zapisywane w dokumencie <code>scan_settings</code> w tabeli <code>app_data</code> i stosowane do każdego kolejnego uruchomienia httpx.
            </p>
            <RefTable
                head={['Pole', 'Znaczenie', 'Domyślnie', 'Zakres']}
                rows={[
                    [t('`Max requests per second`'), 'Górny limit żądań HTTP wysyłanych przez skaner w ciągu sekundy (httpx `-rate-limit`)', <code key="r">150</code>, '1–10 000'],
                    [t('`Multithreaded scanning`'), 'Czy skaner pracuje równolegle; wyłączenie wymusza jeden wątek i wysyła żądania po kolei', 'włączone', '—'],
                    [t('`Threads`'), 'Liczba równoległych wątków skanera (httpx `-threads`); pole jest nieaktywne przy wyłączonym trybie wielowątkowym', <code key="t">50</code>, '1–500'],
                    [t('`Retries per host`'), 'Liczba ponowień żądania po timeoucie lub zerwaniu połączenia (httpx `-retries`)', <code key="x">2</code>, '0–10']
                ]}
            />
            <ul>
                <li>Po zapisie serwer przycina wartości do powyższych zakresów, więc błędny ładunek nie może zablokować skanu.</li>
                <li>Przy wyłączonym trybie wielowątkowym wartość <code>Threads</code> pozostaje w bazie, ale do httpx trafia <code>1</code>.</li>
                <li><code>Retries per host</code> równe <code>0</code> wyłącza ponowienia.</li>
                <li>Po zapisie przy nagłówku karty pojawia się potwierdzenie <code>Saved</code>.</li>
            </ul>

            <H2 id="wplyw">Wpływ na skan</H2>
            <ul>
                <li>Ustawienia są odczytywane na początku skanu Full; zmiana w trakcie trwającego skanu zadziała dopiero przy następnym uruchomieniu.</li>
                <li>Limit czasu pojedynczego żądania pozostaje stały: <code>10</code> s.</li>
                <li>Skan Reachability (masscan / sonda TCP) nie korzysta z tych ustawień; ma własną szybkość i współbieżność.</li>
                <li>Większa liczba wątków przyspiesza skan, ale zwiększa obciążenie celów; łącz ją z limitem żądań na sekundę.</li>
            </ul>
            <CodeBlock
                lang="json"
                title="PUT /api/settings/scan"
                code={`{
  "max_requests_per_second": 150,
  "threads": 50,
  "multithreaded": true,
  "retries": 2
}`}
            />

            <H2 id="uprawnienia">Uprawnienia i API</H2>
            <p>
                Odczyt strony wymaga odczytu do <code>settings</code>, a zapis — zapisu do <code>settings</code> (<Link href="/docs/dostep#sciezki">Dostęp i uprawnienia</Link>). Endpoint <code>PUT /api/settings/scan</code> zwraca <code>204</code> po zapisie albo <code>500</code> przy błędzie bazy.
            </p>
            <Callout type="note" title="Ustawienia nie są per użytkownik">
                Motyw jest lokalny dla przeglądarki, ale parametry skanera są wspólne dla wszystkich administratorów i wszystkich konfiguracji.
            </Callout>

            <H2 id="stare">Sekcja Scanning</H2>
            <p>
                Karta <code>Scanning</code> nadal zawiera listy <code>Default scan depth</code> i <code>Scan concurrency</code>, ale <strong>nie są one podpięte do serwera</strong>: nie zmieniają zachowania skanów i nie są zapisywane. Rzeczywisty typ skanu wybiera się przy uruchomieniu (<Link href="/docs/skanowanie#sposoby">Skanowanie › Cztery sposoby uruchomienia</Link>), a współbieżność i limit — w karcie <code>HTTP scanner</code> powyżej.
            </p>
            <RefTable
                head={['Element', 'Stan']}
                rows={[
                    [t('`Theme` (`Light` / `Dark`)'), <Badge key="1" variant="success">działa</Badge>],
                    [t('`Max requests per second`, `Multithreaded scanning`, `Threads`, `Retries per host`'), <Badge key="2" variant="success">działa i zapisuje</Badge>],
                    [t('`Default scan depth`, `Scan concurrency` w karcie `Scanning`'), <Badge key="3">statyczne, bez zapisu</Badge>]
                ]}
            />
        </DocPage>
    );
}
