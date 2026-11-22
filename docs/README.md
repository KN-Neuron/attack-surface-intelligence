# Dokumentacja Visibly

Dokumentacja techniczna aplikacji Visibly z repozytorium `attack-surface-intelligence` w katalogu `main-project/docs`: inwentarz hostów, tagowanie, skanowanie (typy skanów, harmonogram), Custom Signatures, wyniki, Data Explorer, DefectDojo, alerty, uprawnienia i API. Paleta „Nightshade” jest wspólna z aplikacją (zob. stronę *Design System › Kolory i tokeny*).

**Stack (wszystko open source):** Next.js 16.4 · React 19 · Tailwind CSS v4 · Radix UI (`radix-ui`) · komponenty w konwencji shadcn/ui · lucide-react · Shiki. Asystent działa lokalnie: BM25 + Ollama / LM Studio.

## Wymagania

- Node.js 22 (obrazy Dockera używają `node:22-bookworm-slim`)
- Opcjonalnie Ollama albo LM Studio, jeśli ma działać asystent

## Uruchomienie

```bash
npm install
npm run dev      # http://localhost:3000/docs
npm run build && npm start
```

Katalog główny przekierowuje na `/docs`.

Przycisk „?” w aplikacji otwiera ten serwis; adres ustawia zmienna `DOCS_URL` po stronie aplikacji (domyślnie `http://localhost:3000/docs`).

## Struktura

- `src/app/docs/**` – strony dokumentacji (TSX), po jednej na temat
- `src/lib/nav.ts` – nawigacja boczna i kolejność stron (decyduje też o przyciskach „Poprzednia / Następna”)
- `src/components/docs` – elementy szkieletu (górny pasek, menu, spis treści) i statyczne podglądy interfejsu (`ui-mocks.tsx`)
- `src/components/ui` – komponenty UI (Radix + Tailwind)
- `src/components/assistant` – panel „Asystent” (rozwijany z prawej; na telefonie zajmuje cały ekran)
- `src/lib/rag` – wyszukiwanie BM25 (polska tokenizacja), prompt systemowy i warstwa dostawcy modelu (`llm.ts`: Ollama / LM Studio)
- `src/app/api/assistant/route.ts` – endpoint RAG: retrieval → model → strumień NDJSON
- `scripts/build-rag-index.mjs` – buduje indeks `src/data/rag-index.json` ze zbudowanych stron
- `src/app/globals.css` – tokeny kolorów `zs-*` (`@theme`), odpowiadające zmiennym CSS aplikacji

## Zasady pisania stron

- Każdy fakt opisujemy raz, w sekcji, do której należy; gdzie indziej dajemy odnośnik do kotwicy (`<Link href="/docs/…#id">`).
- Strona to `DocPage` z `href`, `title`, `lead` i `toc`; nagłówki przez `H2` / `H3` (identyfikator = kotwica w spisie treści i w odnośnikach).
- Tabele referencyjne przez `RefTable`; fragmenty w odwrotnych apostrofach w komórkach przez `t('…')` z `components/docs/inline`.
- Nową stronę dodaj do `src/lib/nav.ts`, inaczej nie pojawi się w menu ani w wyszukiwarce.
- Zmiana treści wymaga przebudowania indeksu asystenta (patrz niżej).

## Asystent (RAG + model lokalny)

Asystent odpowiada wyłącznie na podstawie treści tej dokumentacji i podaje źródła (linki do sekcji). Działa w trzech krokach: indeks fragmentów → wyszukiwanie BM25 → lokalny model przez Ollama (domyślnie) albo LM Studio.

```bash
ollama pull gemma3:1b          # mały model, ok. 0,8 GB
cp .env.example .env.local     # opcjonalnie: OLLAMA_URL, ASSISTANT_MODEL…
npm run build && npm run rag:index   # indeks budowany jest z wyrenderowanych stron
npm run build && npm start
```

- Po każdej zmianie treści stron uruchom ponownie `npm run build && npm run rag:index`, a potem `npm run build` jeszcze raz (indeks jest importowany do aplikacji). Do czasu pierwszego zbudowania indeks jest pusty, więc asystent niczego nie znajdzie.
- Obraz Dockera robi dokładnie tę sekwencję: `build → rag:index → build`.
- Bez modelu asystent przechodzi w tryb wyszukiwania: pokazuje najtrafniejsze fragmenty bez generowania odpowiedzi.
- Inny model: `ASSISTANT_MODEL=gemma3:4b` (lub inny model z Ollamy). Dane nie opuszczają Twojej maszyny.
- **LM Studio zamiast Ollamy:** w LM Studio włącz serwer (Developer → Start server), a w `.env.local` ustaw
  `ASSISTANT_PROVIDER=lmstudio` (opcjonalnie `LMSTUDIO_URL` i `ASSISTANT_MODEL`). Bez `ASSISTANT_MODEL`
  aplikacja wybiera pierwszy model czatu z `/v1/models`, najchętniej Gemmę.
- Pytania spoza dokumentacji są odrzucane przed wywołaniem modelu.

## Wdrożenie

`railway.toml` buduje obraz z `Dockerfile` i sprawdza `/docs`. Runtime używa `output: "standalone"` z Next.js, a aplikacja nasłuchuje na `PORT` (domyślnie 3000).
