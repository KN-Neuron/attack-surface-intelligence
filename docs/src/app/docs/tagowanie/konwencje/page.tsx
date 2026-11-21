import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { CodeBlock } from '@/components/ui/code-block';
import { RefTable } from '@/components/ui/ref-table';

export const metadata: Metadata = { title: 'Konwencje tagowania' };

export default function Page() {
    return (
        <DocPage
            href="/docs/tagowanie/konwencje"
            title="Konwencje tagowania"
            lead="Model nie wymusza schematu, więc spójność zapewnia konwencja. Poniżej propozycja, która zachowuje wyszukiwalność i nie wymaga rejestru tagów."
            toc={[
                { id: 'wymiary', label: 'Wymiary klasyfikacji' },
                { id: 'nazewnictwo', label: 'Nazewnictwo' },
                { id: 'tag-czy-grupa', label: 'Tag czy grupa' },
                { id: 'przyklad', label: 'Przykładowy inwentarz' },
                { id: 'higiena', label: 'Higiena i zapytania SQL' },
                { id: 'sql-lista', label: 'Lista tagów i liczność', level: 3 },
                { id: 'sql-zmiana', label: 'Zmiana nazwy tagu', level: 3 },
                { id: 'sql-hurt', label: 'Oznaczenie istniejących wpisów', level: 3 }
            ]}
        >
            <H2 id="wymiary">Wymiary klasyfikacji</H2>
            <p>Zamiast jednej płaskiej puli etykiet wydziel kilka wymiarów i zapisuj je jako <code>wymiar:wartość</code>. Każdy wpis może mieć co najwyżej jedną wartość z danego wymiaru. Aplikacja nie wymusza tego schematu: tag bez prefiksu, np. <code>serwery-www</code>, działa tak samo; schemat ułatwia tylko wyszukiwanie i porządek.</p>
            <RefTable
                head={['Wymiar', 'Pytanie, na które odpowiada', 'Przykładowe tagi']}
                rows={[
                    [<code key="1">env</code>, 'W jakim środowisku działa cel?', <code key="1a">env:prod, env:staging, env:dev</code>],
                    [<code key="2">role</code>, 'Jaką funkcję pełni?', <code key="2a">role:edge, role:core, role:db</code>],
                    [<code key="3">owner</code>, 'Kto odpowiada za cel?', <code key="3a">owner:netops, owner:platform</code>],
                    [<code key="4">exposure</code>, 'Czy cel jest widoczny z internetu?', <code key="4a">exposure:external, exposure:internal</code>],
                    [<code key="5">crit</code>, 'Jak ważny jest dla biznesu?', <code key="5a">crit:high, crit:low</code>],
                    [<code key="6">import</code>, 'Z jakiej partii pochodzi wpis?', <code key="6a">import:2026-11, source:cmdb</code>]
                ]}
            />

            <H2 id="nazewnictwo">Nazewnictwo</H2>
            <ul>
                <li>
                    Małe litery ASCII, wyrazy łączone myślnikiem, bez spacji. Wielkość liter ma znaczenie (<Link href="/docs/tagowanie#definicja">Tagowanie › Przegląd</Link>), więc jedna reguła eliminuje duplikaty typu <code>Prod</code> i <code>prod</code>.
                </li>
                <li>
                    Prefiks wymiaru wymusza sensowne grupowanie przy wyszukiwaniu: fraza <code>env:</code> wyświetla wszystkie wpisy mające tag środowiska.
                </li>
                <li>
                    Wartości jednego wymiaru nie powinny zawierać się w sobie nawzajem, bo wyszukiwanie dopasowuje fragment tekstu (<Link href="/docs/tagowanie/operacje#wyszukiwanie">Operacje › Wyszukiwanie</Link>). Zamiast <code>env:prod</code> i <code>env:prod-eu</code> użyj <code>env:prod-eu</code> i <code>env:prod-us</code>.
                </li>
                <li>
                    Tagi są trudne do przemianowania, bo nie ma globalnej zmiany nazwy. Wybieraj nazwy stabilne, a zmienne dane (np. nazwisko właściciela) przenoś na poziom zespołu.
                </li>
            </ul>

            <H2 id="tag-czy-grupa">Tag czy grupa</H2>
            <RefTable
                head={['Potrzeba', 'Użyj', 'Powód']}
                rows={[
                    ['Wskazać zbiór celów w harmonogramie skanowania', 'Grupy', <>Cele harmonogramu to grupy, adresy, zakresy i FQDN, a nie tagi (<Link href="/docs/skanowanie#cele">Skanowanie › Cele</Link>)</>],
                    ['Opisać cel kilkoma niezależnymi cechami', 'Tagi', 'Grupa wymagałaby osobnego zbioru dla każdej kombinacji cech'],
                    ['Wyszukać wpisy po cesze', 'Tagi', 'Filtr tabeli i SQL obejmują tagi; listy członków grupy ich nie pokazują'],
                    ['Oznaczyć pochodzenie importu', 'Tagi', 'Import nadaje jeden zestaw tagów całej partii'],
                    ['Opisać samą grupę (np. strefę sieci)', 'Tagi grupy', 'Ustawiane przy tworzeniu i zmieniane przez Edit grupy; nie dziedziczone przez członków']
                ]}
            />
            <p>
                Grupę z wpisów o danym tagu najprościej zbudować w oknie <code>New group</code> na podstawie wyniku wyszukiwania (<Link href="/docs/tagowanie#scheduling">Przegląd › Scan Scheduling</Link>). Przy dużej liczbie wpisów możesz ją utworzyć przez <Link href="/docs/tagowanie/api#endpointy">API</Link>: lista wartości z zapytania SQL trafia do pola <code>ips</code>, <code>ranges</code> lub <code>fqdns</code> żądania <code>POST /api/host-groups</code>.
            </p>

            <H2 id="przyklad">Przykładowy inwentarz</H2>
            <RefTable
                head={['Wpis', 'Tagi']}
                rows={[
                    [<code key="1">203.0.113.10</code>, <code key="1a">env:prod, role:edge, owner:netops, exposure:external</code>],
                    [<code key="2">198.51.100.0/24</code>, <code key="2a">env:prod, role:core, exposure:internal, crit:high</code>],
                    [<code key="3">staging.example.com</code>, <code key="3a">env:staging, owner:platform, import:2026-11</code>]
                ]}
            />

            <H2 id="higiena">Higiena i zapytania SQL</H2>
            <p>
                Brak rejestru oznacza, że literówka tworzy nowy tag. Przeglądaj zawartość i porządkuj ją w bazie; operacje zmieniające wykonuj w transakcji i powtarzaj dla czterech tabel (<Link href="/docs/tagowanie#gdzie">Tagowanie › Przegląd</Link>).
            </p>
            <H3 id="sql-lista">Lista tagów i liczność</H3>
            <CodeBlock
                lang="sql"
                code={`SELECT tag, count(*) AS entries
FROM (
    SELECT jsonb_array_elements_text(tags) AS tag FROM host_ips
    UNION ALL SELECT jsonb_array_elements_text(tags) FROM host_ranges
    UNION ALL SELECT jsonb_array_elements_text(tags) FROM host_fqdns
    UNION ALL SELECT jsonb_array_elements_text(tags) FROM host_groups
) AS t
GROUP BY tag
ORDER BY entries DESC, tag;`}
            />
            <p>Tagi o liczności 1, różniące się od innych wielkością liter lub jednym znakiem, to zwykle literówki.</p>
            <H3 id="sql-zmiana">Zmiana nazwy tagu</H3>
            <CodeBlock
                lang="sql"
                code={`BEGIN;
UPDATE host_ips
SET tags = (
    SELECT jsonb_agg(CASE WHEN t = 'prod' THEN 'env:prod' ELSE t END)
    FROM jsonb_array_elements_text(tags) AS t
)
WHERE tags ? 'prod';
-- powtórz dla host_ranges, host_fqdns i host_groups
COMMIT;`}
            />
            <Callout type="warning" title="Powtórzenia po zmianie nazwy">
                Jeśli wpis miał już tag docelowy, po zmianie będzie go miał dwukrotnie. Duplikaty nie psują działania, ale warto je usunąć (<code>jsonb_agg(DISTINCT …)</code> usuwa je kosztem kolejności).
            </Callout>
            <H3 id="sql-hurt">Oznaczenie istniejących wpisów</H3>
            <p>Interfejs oznacza hurtowo tylko nowe wpisy (<Link href="/docs/tagowanie/operacje#dodawanie">Operacje › Tagi przy dodawaniu</Link>). Istniejące można oznaczyć w SQL:</p>
            <CodeBlock
                lang="sql"
                code={`UPDATE host_ips
SET tags = tags || '["owner:netops"]'::jsonb
WHERE address LIKE '203.0.113.%'
  AND NOT tags ? 'owner:netops';`}
            />
        </DocPage>
    );
}
