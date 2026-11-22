import type { Metadata } from 'next';
import { t } from '@/components/docs/inline';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';

export const metadata: Metadata = { title: 'API tagowania i inwentarza' };

export default function Page() {
    return (
        <DocPage
            href="/docs/tagowanie/api"
            title="API tagowania i inwentarza"
            lead={
                <>
                    Endpointy operujące na wpisach inwentarza, grupach i imporcie. Zasady wspólne dla całego API (sesja, uprawnienia, kody odpowiedzi) opisuje strona <Link href="/docs/api#konwencje">API HTTP</Link>.
                </>
            }
            toc={[
                { id: 'endpointy', label: 'Endpointy' },
                { id: 'ksztalty', label: 'Kształty JSON' },
                { id: 'wpisy', label: 'Dodawanie i edycja', level: 3 },
                { id: 'import', label: 'Import', level: 3 },
                { id: 'grupa', label: 'Grupa', level: 3 },
                { id: 'semantyka', label: 'Semantyka po stronie serwera' },
                { id: 'przyklady', label: 'Przykłady' }
            ]}
        >
            <H2 id="endpointy">Endpointy</H2>
            <p>
                Wszystkie wymagają uprawnienia do zapisu w sekcji Host management. Aplikacja nie ma endpointów <code>GET</code> dla inwentarza ani grup: dane są renderowane po stronie serwera w stronach HTML (<code>/host-management</code>, zakładki IPs, IP ranges, FQDNs i Host groups).
            </p>
            <RefTable
                head={['Metoda', 'Ścieżka', 'Ładunek', 'Odpowiedź']}
                rows={[
                    ['POST', <code key="1">/api/host-ips</code>, 'NewHostEntries', '200, liczba dodanych wpisów'],
                    ['POST', <code key="2">/api/host-ranges</code>, 'NewHostEntries', '200, liczba dodanych wpisów'],
                    ['POST', <code key="3">/api/host-fqdns</code>, 'NewHostEntries', '200, liczba dodanych wpisów'],
                    ['PUT', <code key="4">/api/host-ips/{'{id}'}</code>, 'EditHostEntry', '204 lub 404'],
                    ['PUT', <code key="5">/api/host-ranges/{'{id}'}</code>, 'EditHostEntry', '204 lub 404'],
                    ['PUT', <code key="6">/api/host-fqdns/{'{id}'}</code>, 'EditHostEntry', '204 lub 404'],
                    ['DELETE', <code key="7">/api/host-ips|ranges|fqdns/{'{id}'}</code>, 'brak', '204 lub 404'],
                    ['POST', <code key="8">/api/host-import/preview</code>, 'ImportHosts', '200, ImportPreview'],
                    ['POST', <code key="9">/api/host-import</code>, 'ImportHosts', '200, ImportSummary'],
                    ['POST', <code key="10">/api/host-groups</code>, 'NewGroup', '200, utworzona grupa; 500 przy błędzie zapisu'],
                    ['PUT', <code key="11">/api/host-groups/{'{id}'}</code>, 'NewGroup', '200, zaktualizowana grupa lub 404'],
                    ['DELETE', <code key="12">/api/host-groups/{'{id}'}</code>, 'brak', '204 lub 404; wpisy ewidencji zostają']
                ]}
            />

            <H2 id="ksztalty">Kształty JSON</H2>
            <H3 id="wpisy">Dodawanie i edycja wpisów</H3>
            <CodeBlock
                lang="json"
                title="NewHostEntries (POST)"
                code={`{
  "values": ["203.0.113.10", "203.0.113.11"],
  "tags": ["env:prod", "role:edge"]
}`}
            />
            <CodeBlock
                lang="json"
                title="EditHostEntry (PUT)"
                code={`{
  "value": "203.0.113.12",
  "tags": ["env:prod"]
}`}
            />
            <H3 id="import">Import</H3>
            <CodeBlock
                lang="json"
                title="ImportHosts (podgląd i import)"
                code={`{
  "entries": ["203.0.113.10", "198.51.100.0/24", "api.example.com"],
  "tags": ["import:2026-11"]
}`}
            />
            <CodeBlock
                lang="json"
                title="ImportPreview (odpowiedź podglądu)"
                code={`{ "ips": 24, "ranges": 3, "fqdns": 11, "duplicates": 5, "skipped": 2 }`}
            />
            <CodeBlock
                lang="json"
                title="ImportSummary (odpowiedź importu)"
                code={`{ "ips": 24, "ranges": 3, "fqdns": 11, "duplicates": 5, "skipped": 2 }`}
            />
            <p>
                W podglądzie <code>ips</code>, <code>ranges</code> i <code>fqdns</code> oznaczają wpisy, które <em>przybędą</em> (po odjęciu istniejących w bazie), <code>duplicates</code> – pozycje powtórzone w pliku lub już obecne w bazie, a <code>skipped</code> – pozycje, których nie rozpoznano (<Link href="/docs/hosty#klasyfikacja">Host management › Klasyfikacja</Link>). W podsumowaniu importu
                te trzy pola oznaczają wpisy faktycznie dodane, a <code>duplicates</code> – pozycje rozpoznane, ale już obecne.
            </p>
            <H3 id="grupa">Grupa</H3>
            <CodeBlock
                lang="json"
                title="NewGroup (POST) i odpowiedź HostGroup"
                code={`{
  "name": "Perimeter DMZ",
  "ips": ["203.0.113.10"],
  "ranges": ["198.51.100.0/24"],
  "fqdns": [],
  "tags": ["perimeter", "dmz"]
}`}
            />
            <p>
                Odpowiedź ma te same pola oraz <code>id</code>. Pominięte listy są traktowane jako puste.
            </p>

            <H2 id="semantyka">Semantyka po stronie serwera</H2>
            <p>Serwer normalizuje tagi tak samo jak interfejs: obcina białe znaki, usuwa puste wartości i powtórzenia (zachowując pierwsze wystąpienie). Wielkość liter pozostaje znacząca.</p>
            <RefTable
                head={['Zagadnienie', 'Zachowanie']}
                rows={[
                    ['Normalizacja tagów', 'Obcięcie białych znaków, usunięcie pustych i powtórzonych wartości; kolejność pierwszych wystąpień zachowana'],
                    [t('Pominięte `tags`'), 'Traktowane jak pusta lista'],
                    ['POST wpisów', 'Tagi otrzymują tylko wpisy nowo utworzone; duplikaty są pomijane razem z tagami'],
                    ['PUT wpisu', 'Pełna podmiana wartości i tagów; zmiana wartości propaguje się do grup'],
                    ['Wartości FQDN', 'Zamieniane na małe litery w POST, PUT i imporcie'],
                    ['Walidacja formatu', 'Wyłącznie w imporcie (klasyfikacja); POST i PUT jej nie wykonują'],
                    ['Błędy zapisu w POST', 'Brak kodu błędu: nieudane wstawienie nie zwiększa zwróconej liczby'],
                    ['Kolizja przy PUT', 'Zmiana na wartość, która już istnieje, kończy się 404, tak jak brak wpisu'],
                    ['Spójność', 'Wstawienia odbywają się pojedynczo, bez transakcji; przy awarii zapis może być częściowy'],
                    ['Niepoprawny JSON', 'Odrzucany przez Axum przed handlerem (400, 415 lub 422)']
                ]}
            />

            <H2 id="przyklady">Przykłady</H2>
            <p>
                API używa ciasteczka sesji. Poniżej logowanie do pliku <code>cookies.txt</code> (dane konta podstawiają zmienne <code>EMAIL</code> i <code>PASSWORD</code>), a potem wywołania.
            </p>
            <CodeBlock
                lang="bash"
                code={`curl -c cookies.txt -d "email=$EMAIL" -d "password=$PASSWORD" http://localhost:8080/login

# dodanie dwóch adresów z tagami
curl -b cookies.txt -H 'Content-Type: application/json' \\
  -d '{"values":["203.0.113.10","203.0.113.11"],"tags":["env:prod","role:edge"]}' \\
  http://localhost:8080/api/host-ips
# 2

# podgląd, a następnie import tej samej listy
curl -b cookies.txt -H 'Content-Type: application/json' \\
  -d '{"entries":["203.0.113.10","198.51.100.0/24","api.example.com"],"tags":["import:2026-11"]}' \\
  http://localhost:8080/api/host-import/preview
# {"ips":0,"ranges":1,"fqdns":1,"duplicates":1,"skipped":0}`}
            />
        </DocPage>
    );
}
