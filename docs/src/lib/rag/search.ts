import index from '@/data/rag-index.json';

export type Chunk = { id: string; page: string; section: string; href: string; text: string };
export type Hit = Chunk & { score: number };

const chunks = index.chunks as Chunk[];

// Zbite, bez polskich znaków (tekst jest najpierw normalizowany).
const STOP = new Set(
    'a aby albo ale bo by byc co czy dla do go i ich ja jak jaki jaka jakie jest juz ma mi mnie moze na nad nie o od po pod przez sie sa to tu w we z za ze ten ta te tym oraz czym gdzie kiedy ktory ktora ktore mozna trzeba jesli gdy tez tylko wiec mam masz moj twoj ci mu jej jego im nam wam'.split(
        ' '
    )
);

/** Wyjątki, których prefiks nie łączy (okno / okna / oknie / okien). */
const ALIASES: Record<string, string> = { okna: 'okno', okni: 'okno', okie: 'okno' };

/** Mała „stemizacja” dla polszczyzny: prefiks 4 znaków łączy większość form (dodać/dodawanie, tunel/tunele). */
const stem = (t: string) => {
    const s = t.length > 4 ? t.slice(0, 4) : t;
    return ALIASES[s] ?? s;
};

export function tokenize(text: string): string[] {
    const folded = text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');
    return (folded.match(/[a-z0-9]+/g) ?? []).filter((t) => !STOP.has(t) && (t.length > 1 || /\d/.test(t))).map(stem);
}

// ---- BM25 (liczone raz przy starcie) ----
const K1 = 1.4;
const B = 0.75;
// Odsiewa przypadkowe trafienia przy pytaniach spoza tematu dokumentacji.
const MIN_SCORE = 3.5;
const MIN_COVERAGE = 0.4;

const docs = chunks.map((c) => {
    // Nagłówek sekcji liczy się podwójnie — trafienie w tytuł jest cenniejsze niż w treść.
    const tokens = tokenize(`${c.page} ${c.section} ${c.section} ${c.text}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { tf, len: tokens.length };
});
const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(docs.length, 1);
const df = new Map<string, number>();
for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);

export function search(query: string, k = 4): Hit[] {
    const q = [...new Set(tokenize(query))];
    if (!q.length) return [];
    const N = docs.length;
    const scored = docs.map((d, i) => {
        let score = 0;
        let matched = 0;
        for (const t of q) {
            const f = d.tf.get(t);
            if (!f) continue;
            matched++;
            const n = df.get(t) ?? 0;
            const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
            score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / avgLen));
        }
        return { ...chunks[i], score, coverage: matched / q.length };
    });
    const hits = scored.filter((h) => h.score > 0 && h.coverage >= MIN_COVERAGE).sort((a, b) => b.score - a.score);
    if (!hits.length || hits[0].score < MIN_SCORE) return [];
    // Odetnij ogon znacząco słabszych trafień.
    return hits.filter((h) => h.score >= hits[0].score * 0.35).slice(0, k);
}

export const chunkCount = chunks.length;
