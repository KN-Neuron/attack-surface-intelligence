import type { Metadata } from 'next';
import { t } from '@/components/docs/inline';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { RefTable } from '@/components/ui/ref-table';
import { TagInputMock } from '@/components/docs/ui-mocks';

export const metadata: Metadata = { title: 'Operacje na tagach' };

export default function Page() {
    return (
        <DocPage
            href="/docs/tagowanie/operacje"
            title="Operacje na tagach"
            lead={<>Jak nadawać, zmieniać i wyszukiwać tagi w interfejsie. Zapis wymaga uprawnienia zapisu do strony Host management (<Link href="/docs/dostep#role">Dostęp i uprawnienia</Link>).</>}
            toc={[
                { id: 'pole', label: 'Pole tagów' },
                { id: 'dodawanie', label: 'Tagi przy dodawaniu' },
                { id: 'edycja', label: 'Zmiana i usunięcie tagu' },
                { id: 'import', label: 'Tagi w imporcie' },
                { id: 'grupy', label: 'Tagi grup' },
                { id: 'wyszukiwanie', label: 'Wyszukiwanie po tagach' }
            ]}
        >
            <H2 id="pole">Pole tagów</H2>
            <p>
                To samo pole <code>Tags (optional)</code> występuje w oknach <code>Add IPs</code>, <code>Add IP range</code>, <code>Add FQDN</code>, <code>Edit …</code>, <code>Import preview</code>, <code>New host group</code> i <code>Edit host group</code>.
            </p>
            <TagInputMock />
            <RefTable
                head={['Zachowanie', 'Szczegóły']}
                rows={[
                    ['Dodanie tagu', t('Wpisz tekst i kliknij `Add` albo naciśnij `Enter` (nie wysyła formularza). Tag pojawia się jako chip')],
                    ['Normalizacja', 'Obcięcie białych znaków na początku i końcu; pusty tekst jest ignorowany'],
                    ['Duplikaty', t('Tag identyczny z już dodanym jest ignorowany; `prod` i `Prod` są różne')],
                    ['Usunięcie', 'Krzyżyk na chipie'],
                    ['Zapis', t('Tagi zapisują się dopiero przyciskiem `Save` (lub `Confirm` w imporcie); tekst wpisany w pole, ale niedodany przyciskiem `Add`, jest pomijany')]
                ]}
            />

            <H2 id="dodawanie">Tagi przy dodawaniu</H2>
            <p>
                W oknach dodawania (<Link href="/docs/hosty#dodawanie">Host management › Dodawanie wpisów</Link>) jeden zestaw tagów jest nadawany <strong>wszystkim</strong> pozycjom z danego zapisu. Aby nadać różnym adresom różne tagi, zapisz je osobno.
            </p>
            <p>
                Tagi dostają tylko wpisy nowo utworzone. Wartość już obecna w ewidencji jest pomijana razem z tagami i zachowuje dotychczasowe. Aby dopisać tag istniejącemu wpisowi, użyj <Link href="#edycja">Edit</Link>.
            </p>

            <H2 id="edycja">Zmiana i usunięcie tagu</H2>
            <ol>
                <li>
                    W zakładce <code>IPs</code>, <code>IP ranges</code> lub <code>FQDNs</code> kliknij <code>Edit</code> w wierszu wpisu.
                </li>
                <li>
                    Okno pokazuje wartość i aktualne tagi jako chipy. Dodaj nowy tag albo usuń istniejący krzyżykiem.
                </li>
                <li>
                    Kliknij <code>Save</code>.
                </li>
            </ol>
            <p>
                Zapis <strong>zastępuje</strong> całą listę tagów zawartością okna: usunięcie wszystkich chipów zostawia wpis bez tagów. Edycja dotyczy jednego wpisu naraz; nie ma operacji zmieniającej tag na wielu istniejących wpisach (do porządkowania hurtowego służy SQL, <Link href="/docs/tagowanie/konwencje#higiena">Konwencje › Higiena</Link>).
            </p>

            <H2 id="import">Tagi w imporcie</H2>
            <p>
                Przebieg importu, format pliku i liczniki opisuje <Link href="/docs/hosty#import">Host management › Import z pliku CSV</Link>. Z punktu widzenia tagów:
            </p>
            <ul>
                <li>
                    Pole tagów jest w oknie <code>Import preview</code>, czyli po wybraniu pliku, a przed <code>Confirm</code>. Tagi dodaje się więc, już znając liczbę nowych wpisów.
                </li>
                <li>Ten sam zestaw tagów dostają wszystkie nowe wpisy z pliku, bez względu na typ (IP, zakres, FQDN).</li>
                <li>
                    Pozycje policzone jako <code>Duplicates</code> nie dostają tagów z importu. Jeśli plik zawiera adresy już obecne w ewidencji, po imporcie nadal mają one tylko swoje wcześniejsze tagi.
                </li>
                <li>
                    Po <code>Confirm</code> okno <code>Import complete</code> nie pokazuje już pola tagów; aby je zmienić, użyj <code>Edit</code> na wpisach.
                </li>
            </ul>
            <Callout type="tip" title="Tag partii importu">
                Tag w rodzaju <code>import:2026-11</code> pozwala później wyszukać wszystkie wpisy z jednego pliku i sprawdzić, które adresy pochodzą z danego źródła.
            </Callout>

            <H2 id="grupy">Tagi grup</H2>
            <p>
                Okna <code>New host group</code> i <code>Edit host group</code> mają to samo pole tagów. Tagi grupy opisują samą grupę (np. strefę sieci), są widoczne w kolumnie <code>Tags</code> zakładki <code>Host groups</code> i można je zmienić przez <code>Edit</code> grupy. Nie są przekazywane członkom ani przejmowane od nich.
            </p>
            <p>
                Listy wyboru członków w oknie grupy pokazują tylko wartości, bez tagów, a ich filtr dopasowuje wyłącznie tekst wartości. Jak zbudować grupę z wpisów o danym tagu, opisuje <Link href="/docs/tagowanie#scheduling">Przegląd › Scan Scheduling</Link>.
            </p>

            <H2 id="wyszukiwanie">Wyszukiwanie po tagach</H2>
            <p>
                Pole wyszukiwania nad każdą tabelą (<code>Search IPs…</code>, <code>Search ranges…</code>, <code>Search FQDNs…</code>, <code>Search groups…</code>) dopasowuje wpisany tekst do całego tekstu wiersza, więc obejmuje także tagi.
            </p>
            <ul>
                <li>Dopasowanie jest fragmentem tekstu, bez względu na wielkość liter, i działa od razu w trakcie pisania.</li>
                <li>Filtr obejmuje wszystkie wiersze tabeli, nie tylko bieżącą stronę; stopka pokazuje liczbę dopasowanych wierszy.</li>
                <li>
                    Wyszukiwanie obejmuje też wartość i datę dodania, więc fraza <code>10.0</code> dopasuje adresy, a nie tylko tagi.
                </li>
                <li>Każda zakładka ma własne pole: wpisy z tagiem w zakresach i w FQDN wyszukujesz osobno.</li>
                <li>
                    Wyszukiwarka w górnym pasku aplikacji przeszukuje tylko menu, nie ewidencję.
                </li>
            </ul>
        </DocPage>
    );
}
