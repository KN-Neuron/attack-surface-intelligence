import type { Hit } from './search';

export const SYSTEM_PROMPT = `Jesteś asystentem dokumentacji technicznej aplikacji Visibly (inwentaryzacja powierzchni ataku).
Zasady:
- Odpowiadaj po polsku, zwięźle: najwyżej 5 zdań albo krótka lista.
- Korzystaj WYŁĄCZNIE z fragmentów dokumentacji podanych w wiadomości użytkownika.
- Jeśli odpowiedzi nie ma we fragmentach, napisz dokładnie: "Nie znalazłem tego w dokumentacji."
- Nie wymyślaj nazw przycisków, pól ani kroków, których nie ma we fragmentach.
- Nazwy elementów interfejsu zostaw w oryginale (np. Import hosts).
- Po informacji dodaj numer źródła w nawiasie kwadratowym, np. [1].`;

export function buildUserMessage(question: string, hits: Hit[]) {
    const context = hits.map((h, i) => `[${i + 1}] ${h.page} › ${h.section}\n${h.text}`).join('\n\n');
    return `Fragmenty dokumentacji:\n\n${context}\n\nPytanie: ${question}`;
}
