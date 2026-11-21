import type { Metadata } from 'next';
import Link from 'next/link';
import { DocPage } from '@/components/docs/doc-page';
import { H2, H3 } from '@/components/docs/headings';
import { Callout } from '@/components/ui/callout';
import { RefTable } from '@/components/ui/ref-table';
import { t } from '@/components/docs/inline';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Dostęp i uprawnienia' };

export default function Page() {
    return (
        <DocPage
            href="/docs/dostep"
            title="Dostęp i uprawnienia"
            lead="Logowanie i sesje, role i ich uprawnienia oraz zarządzanie kontami administratorów na ekranie Admin management."
            toc={[
                { id: 'logowanie', label: 'Logowanie i sesje' },
                { id: 'rbac', label: 'Model uprawnień' },
                { id: 'sciezki', label: 'Mapowanie ścieżek', level: 3 },
                { id: 'role', label: 'Role' },
                { id: 'kto-co', label: 'Kto może co zrobić', level: 3 },
                { id: 'konta', label: 'Admin management' },
                { id: 'konta-dodawanie', label: 'Konta administratorów', level: 3 },
                { id: 'role-edycja', label: 'Zarządzanie rolami', level: 3 },
                { id: 'administratorzy', label: 'Reguły kont' }
            ]}
        >
            <H2 id="logowanie">Logowanie i sesje</H2>
            <RefTable
                head={['Element', 'Zachowanie']}
                rows={[
                    ['Formularz', t('Pola `email`, `password` i opcjonalne `remember`. E-mail jest sprowadzany do małych liter')],
                    ['Weryfikacja', t('Hasło sprawdzane przez bcrypt. Konto ze statusem innym niż `Active` nie może się zalogować')],
                    ['Token sesji', t('Dwa UUID v4 sklejone w 64 znaki szesnastkowe, zapisane w tabeli `sessions` razem z czasem wygaśnięcia')],
                    ['Ciasteczko', t('Nazwa `asi_session`, `HttpOnly`, `SameSite=Lax`, ścieżka `/`')],
                    ['Czas życia', t('24 godziny; 30 dni po zaznaczeniu `remember`')],
                    ['Ważność sesji', t('Sesja liczy się tylko wtedy, gdy nie wygasła, a konto jest `Active`: wyłączenie konta unieważnia jego sesje natychmiast')],
                    ['Brak sesji', t('Strony przekierowują na `/login`, endpointy `/api/*` zwracają 401')],
                    ['Wylogowanie', t('`POST /logout` usuwa sesję z bazy i ciasteczko, po czym przekierowuje na `/login`')]
                ]}
            />
            <Callout type="warning" title="Ciasteczko bez flagi Secure">
                Ciasteczko sesji nie ma atrybutu <code>Secure</code>. Przy wdrożeniu za HTTPS dodaj go przy tworzeniu ciasteczka w <code>src/auth.rs</code>.
            </Callout>
            <p>
                <strong>Konto domyślne.</strong> Przy pustej tabeli <code>admins</code> powstaje konto <code>admin@hacknation.pl</code> z rolą <code>Super Admin</code>, a jego hasło początkowe jest zdefiniowane w stałej <code>DEFAULT_ADMIN_PASSWORD</code> w <code>src/db.rs</code>. Konto ma flagę <code>is_default</code>: omija macierz uprawnień (ma pełen dostęp), a API nie pozwala go
                edytować ani wyłączyć. Hasła nie zmienia się z poziomu aplikacji: zmień stałą przed pierwszym uruchomieniem na pustej bazie albo podmień skrót bcrypt w tabeli <code>admins</code>.
            </p>

            <H2 id="rbac">Model uprawnień</H2>
            <p>
                Uprawnienia są przypisane do <strong>stron</strong> (kluczy), a nie do akcji. Każda strona ma dwie niezależne flagi: odczyt i zapis. Middleware <code>guard</code> wybiera flagę po metodzie HTTP: <code>GET</code>, <code>HEAD</code> i <code>OPTIONS</code> wymagają odczytu, pozostałe metody wymagają zapisu. Zapis nie implikuje odczytu.
            </p>
            <H3 id="sciezki">Mapowanie ścieżek</H3>
            <RefTable
                head={['Klucz', 'Etykieta', 'Ścieżki (prefiks)']}
                rows={[
                    [<code key="1">dashboards</code>, 'Dashboards', <code key="1a">/dashboards</code>],
                    [<code key="2">scan_management</code>, 'Scan Management', <><code>/scanning/management</code>, <code>/api/scan</code></>],
                    [<code key="3">policies</code>, 'Scan Scheduling', <><code>/scanning/policies</code>, <code>/api/policies</code></>],
                    [<code key="4">compare</code>, 'Compare Scans', <code key="4a">/scanning/compare-scans</code>],
                    [<code key="5">host_management</code>, 'Host management', <><code>/host-management</code>, <code>/api/host-</code></>],
                    [<code key="6">data_explorer</code>, 'Data Explorer', <code key="6a">/log-center/data-explorer</code>],
                    [<code key="7">scan_history</code>, 'Scan Results', <code key="7a">/log-center/scan-history</code>],
                    [<code key="8">admin_management</code>, 'Admin management', <><code>/admin-management</code>, <code>/api/admins</code>, <code>/api/roles</code></>],
                    [<code key="9">settings</code>, 'Settings', <code key="9a">/settings</code>]
                ]}
            />
            <p>
                Ścieżki bez klucza (<code>/</code>, <code>/logout</code>, <code>/api/search</code>) wymagają tylko ważnej sesji.
            </p>
            <RefTable
                head={['Sytuacja', 'Odpowiedź']}
                rows={[
                    ['Strona bez wymaganej flagi', 'Przekierowanie na pierwszą dozwoloną stronę; gdy konto nie ma żadnych uprawnień, strona „No access” z kodem 403'],
                    [t('Endpoint `/api/*` bez wymaganej flagi'), '403'],
                    ['Menu boczne', 'Pokazuje tylko strony, do których konto ma odczyt'],
                    ['Wyszukiwarka w górnym pasku', 'Wyniki są filtrowane tą samą regułą']
                ]}
            />

            <H2 id="role">Role</H2>
            <p>
                Rola to nazwa i macierz uprawnień (JSONB w tabeli <code>roles</code>). Administrator dziedziczy macierz swojej roli; jest ona odczytywana przy każdym żądaniu, więc zmiana roli działa od razu.
            </p>
            <RefTable
                head={['Rola', 'Dostęp', 'Zapis']}
                rows={[
                    [<code key="a">Super Admin</code>, 'Wszystkie strony', <Badge key="a1" variant="success">tak</Badge>],
                    [<code key="b">Scan Operator</code>, 'Dashboards, Scan Management, Scan Scheduling, Compare Scans, Host management', <Badge key="b1" variant="success">tak</Badge>],
                    [<code key="c">Analyst</code>, 'Dashboards, Data Explorer, Scan Results, Host management', <Badge key="c1">tylko odczyt</Badge>]
                ]}
            />
            <p>
                To role startowe, tworzone przy pierwszym uruchomieniu na pustej bazie. Administrator z uprawnieniem do Admin management może zmienić ich macierz, dodać własne role albo usunąć nieużywane (<Link href="#role-edycja">Zarządzanie rolami</Link>), więc w konkretnej instalacji zakres ról może być inny.
            </p>

            <H3 id="kto-co">Kto może co zrobić</H3>
            <p>Uprawnienia ról startowych przełożone na zadania z tej dokumentacji:</p>
            <RefTable
                head={['Zadanie', 'Super Admin', 'Scan Operator', 'Analyst']}
                rows={[
                    ['Przeglądać ewidencję, grupy i tagi', 'tak', 'tak', 'tak'],
                    ['Dodawać, edytować, importować i usuwać wpisy, grupy i tagi', 'tak', 'tak', 'nie'],
                    ['Przeglądać i zmieniać konfiguracje w Scan Scheduling', 'tak', 'tak', 'nie'],
                    ['Uruchamiać, wstrzymywać i przerywać skan (Scan Management)', 'tak', 'tak', 'nie'],
                    ['Przeglądać Scan Results', 'tak', 'nie', 'tak'],
                    ['Porównywać skany (Compare Scans)', 'tak', 'tak', 'nie'],
                    ['Przeglądać Data Explorer', 'tak', 'nie', 'tak'],
                    ['Przeglądać dashboardy, w tym Latest Scan summary', 'tak', 'tak', 'tak'],
                    ['Zarządzać kontami administratorów i rolami', 'tak', 'nie', 'nie']
                ]}
            />
            <p>
                Uprawnienia są sprawdzane po stronie serwera przy każdym żądaniu, nie tylko w menu: konto bez zapisu do strony dostanie błąd przy próbie zapisu, nawet jeśli widzi przycisk.
            </p>

            <H2 id="konta">Admin management</H2>
            <p>
                Ekran <code>Admin management</code> ma dwie zakładki: <code>Accounts</code> (konta administratorów) i <code>Roles</code> (role i ich uprawnienia). Wszystkie operacje na nim wymagają uprawnienia zapisu do strony <code>Admin management</code>.
            </p>
            <H3 id="konta-dodawanie">Konta administratorów</H3>
            <p>
                Tabela <code>Accounts</code> ma kolumny <code>Name</code>, <code>Email</code>, <code>Role</code>, <code>Status</code>, <code>Last login</code> i <code>Actions</code>.
            </p>
            <ol>
                <li>
                    Kliknij <code>Add Admin</code>.
                </li>
                <li>
                    Wypełnij <code>Full name</code>, <code>Email</code>, wybierz <code>Role</code> i <code>Status</code> (<code>Active</code> lub <code>Disabled</code>) i ustaw <code>Password</code> (co najmniej 8 znaków).
                </li>
                <li>
                    Kliknij <code>Save</code>. Konto dziedziczy uprawnienia wybranej roli.
                </li>
            </ol>
            <ul>
                <li>
                    <code>Edit</code> zmienia imię i nazwisko, e-mail, rolę, status i opcjonalnie hasło; puste pole <code>Password</code> zostawia dotychczasowe hasło.
                </li>
                <li>
                    <code>Disable</code> / <code>Enable</code> przełącza status. Wyłączone konto nie może się zalogować, a jego otwarte sesje przestają działać od razu.
                </li>
                <li>Kont nie usuwa się z poziomu aplikacji; nieużywane konto wyłącz.</li>
                <li>
                    Konto domyślne (oznaczone <code>Default</code>) nie ma akcji edycji ani wyłączenia.
                </li>
            </ul>
            <H3 id="role-edycja">Zarządzanie rolami</H3>
            <ol>
                <li>
                    W zakładce <code>Roles</code> kliknij <code>Add Role</code> albo <code>Edit</code> przy istniejącej roli.
                </li>
                <li>
                    Wpisz <code>Role name</code> i w tabeli <code>Permissions</code> zaznacz dla każdej strony <code>Read</code> (strona jest widoczna) i opcjonalnie <code>Write</code> (tworzenie, edycja i usuwanie na tej stronie). <code>Write</code> można zaznaczyć tylko razem z <code>Read</code>.
                </li>
                <li>
                    Kliknij <code>Save</code>. Zmiana działa od następnego żądania każdego przypisanego konta.
                </li>
            </ol>
            <ul>
                <li>
                    Kolumna <code>Permissions</code> pokazuje strony z oznaczeniem <code>R</code> (odczyt) lub <code>RW</code> (odczyt i zapis), a <code>Accounts</code> liczbę przypisanych kont.
                </li>
                <li>
                    <code>Remove</code> jest nieaktywny, dopóki do roli przypisane jest jakiekolwiek konto: najpierw zmień rolę tych kont.
                </li>
            </ul>
            <ul>
                <li>Administrator przechowuje rolę po nazwie. Zmiana nazwy roli aktualizuje przypisanych administratorów w jednej transakcji.</li>
                <li>
                    Usunięcie roli, do której ktoś jest przypisany, kończy się odpowiedzią 409. Pozostałe endpointy ról opisuje <Link href="/docs/api#administracja">API HTTP</Link>.
                </li>
            </ul>

            <H2 id="administratorzy">Reguły kont</H2>
            <RefTable
                head={['Zasada', 'Szczegóły']}
                rows={[
                    ['Utworzenie', 'Wymaga hasła o długości co najmniej 8 znaków (po obcięciu białych znaków) i istniejącej roli; błąd to 400'],
                    ['Edycja', 'Hasło jest opcjonalne: puste lub pominięte zostawia dotychczasowe. Nieistniejąca rola to 400'],
                    ['Status', t('Wartości `Active` i `Disabled`. Przełączenie zmienia jedną na drugą')],
                    ['Konto domyślne', 'Edycja i przełączenie zwracają 403'],
                    ['Adres e-mail', t('Unikalny i zapisywany małymi literami. Adres już użyty przez inne konto kończy zapis komunikatem `Could not save the administrator. Please try again.`')],
                    ['Hasła', 'Przechowywane jako skrót bcrypt z domyślnym kosztem; nigdy w postaci jawnej']
                ]}
            />
        </DocPage>
    );
}
