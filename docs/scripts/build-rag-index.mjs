#!/usr/bin/env node
/**
 * Buduje indeks RAG z gotowego HTML-a dokumentacji (wynik `npm run build`).
 * Użycie:  npm run build && npm run rag:index
 * Wynik:   src/data/rag-index.json  (chunki: strona, sekcja, link z kotwicą, tekst)
 */
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = join(ROOT, '.next', 'server', 'app');
const OUT = join(ROOT, 'src', 'data', 'rag-index.json');
const MAX_CHARS = 900;

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

let files;
try {
    files = walk(APP_DIR).filter((f) => f.endsWith('.html') && relative(APP_DIR, f).startsWith('docs'));
} catch {
    console.error('Brak katalogu .next/server/app — najpierw uruchom `npm run build`.');
    process.exit(1);
}

const BLOCK = new Set(['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'tr', 'table', 'section', 'figure', 'figcaption', 'pre', 'br', 'dt', 'dd', 'button', 'header']);
const SKIP = new Set(['svg', 'script', 'style', 'noscript', 'kbd']);

function textOf(node) {
    let out = '';
    const visit = (n) => {
        if (n.type === 'text') out += n.data;
        else if (n.type === 'tag') {
            if (SKIP.has(n.name)) {
                if (n.name === 'kbd') out += n.children.map((c) => c.data ?? '').join('');
                return;
            }
            if (n.name === 'td' || n.name === 'th') out += ' ';
            n.children?.forEach(visit);
            if (BLOCK.has(n.name)) out += '\n';
            if (n.name === 'td' || n.name === 'th') out += ' | ';
        }
    };
    visit(node);
    return out
        .replace(/[ \t]+/g, ' ')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n');
}

function tableToText($, table) {
    const heads = $(table)
        .find('thead th')
        .map((_, th) => $(th).text().trim())
        .get();
    return $(table)
        .find('tbody tr')
        .map((_, tr) => {
            const cells = $(tr)
                .find('td')
                .map((__, td) => $(td).text().replace(/\s+/g, ' ').trim())
                .get();
            return '- ' + cells.map((c, i) => (heads[i] ? `${heads[i]}: ${c}` : c)).join('; ');
        })
        .get()
        .join('\n');
}

function routeOf(file) {
    const rel = relative(APP_DIR, file).replace(/\.html$/, '');
    return '/' + rel.split('\\').join('/');
}

function splitText(text) {
    if (text.length <= MAX_CHARS) return [text];
    const parts = [];
    let cur = '';
    for (const line of text.split('\n')) {
        if (cur && (cur + '\n' + line).length > MAX_CHARS) {
            parts.push(cur);
            cur = line;
        } else cur = cur ? cur + '\n' + line : line;
    }
    if (cur) parts.push(cur);
    return parts;
}

const chunks = [];

for (const file of files.sort()) {
    const route = routeOf(file);
    const $ = cheerio.load(readFileSync(file, 'utf8'));
    const article = $('article').first();
    if (!article.length) continue;

    const page = article.find('h1').first().text().trim();
    const lead = article.children('p').filter((_, p) => ($(p).attr('class') ?? '').includes('text-lg')).first().text().trim();

    let section = 'Wstęp';
    let anchor = '';
    let buf = lead ? [lead] : [];

    const flush = () => {
        const text = buf.join('\n').trim();
        buf = [];
        if (!text) return;
        splitText(text).forEach((t, i) => {
            chunks.push({
                id: `${route}#${anchor || 'start'}-${i}`,
                page,
                section,
                href: anchor ? `${route}#${anchor}` : route,
                text: t
            });
        });
    };

    article.find('.prose-zs').first().children().each((_, el) => {
        const tag = el.name;
        if (tag === 'h2' || tag === 'h3') {
            flush();
            section = $(el).clone().children('a').remove().end().text().trim();
            anchor = $(el).attr('id') ?? '';
            return;
        }
        if (tag === 'figure' || $(el).is('[data-rag-skip]')) return; // makiety i podglądy UI — nie są treścią
        if ($(el).is('[data-faq]')) {
            const t = textOf($(el).find('dl').get(0));
            if (t) buf.push(t);
            return;
        }
        const $el = $(el);
        if ($el.find('table').length) {
            buf.push(tableToText($, $el.find('table').first()));
            return;
        }
        if ($el.is('div') && $el.find('pre').length) {
            const title = $el.find('span.font-mono').first().text().trim();
            const code = $el.find('pre').text().replace(/\s+\n/g, '\n').trim().slice(0, 500);
            buf.push(`Przykład kodu${title ? ` (${title})` : ''}:\n${code}`);
            return;
        }
        const t = textOf(el);
        if (t) buf.push(t);
    });
    flush();
}

if (chunks.length === 0) {
    console.error('Nie znaleziono żadnej treści (czy build się powiódł?) — indeks NIE został nadpisany.');
    process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), chunks }, null, 2) + '\n');
console.log(`Zapisano ${chunks.length} fragmentów z ${files.length} stron → ${relative(ROOT, OUT)}`);
