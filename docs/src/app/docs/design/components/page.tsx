import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { RefTable } from '@/components/ui/ref-table';
import { t } from '@/components/docs/inline';

export const metadata: Metadata = { title: 'Komponenty aplikacji' };

export default function Page() {
    return (
        <DocPage
            href="/docs/design/components"
            title="Komponenty aplikacji"
            lead="Klocki interfejsu Visibly: klasy CSS ze static/app.css i atrybuty data-*, którymi static/app.js wiąże zachowanie. Interfejs nie używa frameworka: komponent to fragment HTML z klasą."
            toc={[
                { id: 'klasy', label: 'Klasy CSS' },
                { id: 'uklad', label: 'Układ strony', level: 3 },
                { id: 'kontrolki', label: 'Kontrolki', level: 3 },
                { id: 'znaczniki', label: 'Znaczniki i wskaźniki', level: 3 },
                { id: 'okna', label: 'Zakładki i okna', level: 3 },
                { id: 'data', label: 'Atrybuty data-*' },
                { id: 'zasady', label: 'Zasady rozszerzania' }
            ]}
        >
            <H2 id="klasy">Klasy CSS</H2>
            <p>
                Kolory pochodzą ze zmiennych CSS opisanych w <Link href="/docs/design/theming#aplikacja">Kolory i tokeny</Link>; poniżej tylko rola każdej klasy.
            </p>

            <H3 id="uklad">Układ strony</H3>
            <RefTable
                head={['Klasa', 'Rola']}
                rows={[
                    [<code key="1">.page-head</code>, t('Nagłówek strony: `h1`, rozpórka `.spacer` i akcje po prawej (wyszukiwarka, przycisk główny)')],
                    [<code key="2">.page-body</code>, 'Treść strony pod nagłówkiem'],
                    [<code key="3">.card</code>, t('Panel z ramką; nagłówek `.card-head` zawiera `h2`, rozpórkę i opcjonalną notatkę `.card-note`')],
                    [<code key="4">.tile</code>, t('Kafelek z wartością i etykietą; układ kafelków w siatce `.bento` (Latest Scan summary)')],
                    [<code key="5">.tbl</code>, t('Tabela w kontenerze `.tbl-wrap`. Komórki pomocnicze: `.strong-cell`, `.mono`, `.muted`, `.empty-cell`, wyrównanie `.right`')],
                    [<code key="6">.screen-redesign</code>, t('Klasa na `body` włączająca reguły nowych ekranów (`{% block bodyclass %}`)')]
                ]}
            />

            <H3 id="kontrolki">Kontrolki</H3>
            <RefTable
                head={['Klasa', 'Rola']}
                rows={[
                    [<code key="1">.btn</code>, t('Przycisk; warianty `.btn.primary` (akcja główna, kolor marki) i `.btn.danger`')],
                    [<code key="2">.link-btn</code>, t('Akcja tekstowa w wierszu tabeli; `.danger-link` dla usuwania')],
                    [<code key="3">.icon-btn</code>, t('Przycisk z samą ikoną; `.subtle` dla zamknięcia okna')],
                    [<code key="4">.search-box</code>, 'Pole wyszukiwania z ikoną'],
                    [<code key="5">.field</code>, t('Pole formularza: `.field-label`, kontrolka i `.field-hint`')],
                    [<code key="6">.switch</code>, 'Przełącznik dwustanowy (np. Enabled)'],
                    [<code key="7">.check-list</code>, t('Lista pól wyboru z `.check-row`; z `.scroll` ma ograniczoną wysokość')],
                    [<code key="8">.tag-input</code>, t('Pole tagów: wpis, przycisk `Add` i kontener chipów (`Tagowanie › Operacje`)')]
                ]}
            />

            <H3 id="znaczniki">Znaczniki i wskaźniki</H3>
            <RefTable
                head={['Klasa', 'Rola']}
                rows={[
                    [<code key="1">.badge</code>, t('Mała etykieta statusu; `.blocked` i `.warn` zmieniają kolor')],
                    [<code key="2">.pill</code>, t('Wskaźnik stanu sterowany atrybutem `data-state` (`running`, `paused`, `idle`)')],
                    [<code key="3">.severity</code>, t('Poziom ważności z wariantem `.sev-Critical`, `.sev-High`, `.sev-Medium` lub `.sev-Info`')],
                    [<code key="4">.host-chip</code>, t('Chip w kontenerze `.host-chips`: adres, wartość grupy lub tag; `.chip-x` usuwa chip w polu tagów')],
                    [<code key="5">.criteria-chip</code>, t('Para `kind` / `value` kryterium harmonogramu (`.criteria-kind`)')],
                    [<code key="6">.progress</code>, t('Pasek postępu; szerokość wypełnienia z własności `--p`')],
                    [<code key="7">.delta-pill</code>, t('Różnica w porównaniu skanów, w wariantach `delta-better`, `delta-worse`, `delta-same`')],
                    [<code key="8">.mini-bar</code>, 'Słupek względnej liczności w tabelach dashboardu']
                ]}
            />

            <H3 id="okna">Zakładki i okna</H3>
            <RefTable
                head={['Klasa', 'Rola']}
                rows={[
                    [<code key="1">.tabs-bar</code>, t('Pasek zakładek `.tab-link` (aktywna: `.active`) z kontekstowymi przyciskami po prawej, za `.tab-spacer` (Host inventory)')],
                    [<code key="2">.vuln-tabs</code>, 'Płaski pasek filtrów ważności z licznikami (Vulnerable versions)'],
                    [<code key="3">.modal-backdrop</code>, t('Tło okna; zawartość w `.modal` z sekcjami `.modal-head`, `.modal-body`, `.modal-foot`; `.modal-wide` poszerza okno')]
                ]}
            />

            <H2 id="data">Atrybuty data-*</H2>
            <p>
                Zachowanie jest przypinane atrybutami, więc przebudowa wyglądu nie psuje skryptu, dopóki atrybuty zostają na miejscu.
            </p>
            <RefTable
                head={['Atrybut', 'Efekt']}
                rows={[
                    [<code key="1">data-open-modal=&quot;id&quot;</code>, t('Otwiera okno o danym `id`; dla okien dodawania, importu i grupy czyści formularz')],
                    [<code key="2">data-close-modal</code>, 'Zamyka najbliższe okno. Okno zamykają też Esc i kliknięcie w tło'],
                    [<code key="3">data-static-modal</code>, 'Na oknie: wyłącza zamykanie Esc i kliknięciem w tło (podsumowanie importu)'],
                    [<code key="4">data-tabs, data-tab, data-tab-panel, data-tab-show</code>, t('Pasek zakładek przełącza panele; elementy z `data-tab-show` są widoczne tylko przy wskazanej zakładce. Wybór jest pamiętany w `sessionStorage` (`asi.tab.<nazwa>`)')],
                    [<code key="5">data-table-filter=&quot;id tabeli&quot;</code>, 'Na polu wyszukiwania: filtruje wiersze wskazanej tabeli po tekście całego wiersza'],
                    [<code key="6">data-pager</code>, t('Stopka tabeli sterująca najbliższą tabelą w karcie: rozmiar strony, zakres, nawigacja; współpracuje z filtrem')],
                    [<code key="7">data-sev-filter, data-sev</code>, t('Przyciski filtrujące wiersze po atrybucie `data-sev` (Vulnerable versions)')],
                    [<code key="8">data-tag-entry, data-tag-add, data-tag-chips</code>, <>Pole, przycisk i kontener chipów pola tagów (<Link href="/docs/tagowanie/operacje#pole">Operacje na tagach</Link>)</>],
                    [<code key="9">data-host-add, data-host-edit, data-host-import</code>, t('Formularze inwentarza; adres endpointu w `data-endpoint`. Przyciski wierszy: `data-edit`, `data-delete`; chipy tagów niosą `data-tag`')],
                    [<code key="10">data-group-form</code>, 'Formularz nowej grupy hostów'],
                    [<code key="11">data-theme-choice</code>, t('Przycisk motywu (`light`, `dark`) na ekranie Settings')]
                ]}
            />

            <H2 id="zasady">Zasady rozszerzania</H2>
            <ul>
                <li>Używaj zmiennych CSS zamiast stałych kolorów, aby oba motywy działały bez dodatkowych reguł.</li>
                <li>
                    Nowy komponent bazuj na istniejących klasach (<code>.card</code>, <code>.tbl</code>, <code>.btn</code>); nowe reguły dopisuj pod klasą <code>.screen-redesign</code>, jeśli dotyczą tylko nowych ekranów.
                </li>
                <li>
                    Zachowuj istniejące identyfikatory i atrybuty <code>data-*</code> przy zmianach wyglądu.
                </li>
            </ul>
        </DocPage>
    );
}
