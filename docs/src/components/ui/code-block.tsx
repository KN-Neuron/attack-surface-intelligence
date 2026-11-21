import { codeToHtml } from 'shiki';
import { CopyButton } from './copy-button';

export async function CodeBlock({ code, lang = 'bash', title }: { code: string; lang?: string; title?: string }) {
    'use cache';
    const html = await codeToHtml(code.trim(), { lang, theme: 'github-dark-dimmed' });
    return (
        <div className="group/code my-5 overflow-hidden rounded-lg border border-zs-border bg-zs-deep/70">
            <div className="flex items-center justify-between border-b border-zs-border bg-zs-surface px-4 py-2 text-xs text-zs-muted">
                <span className="font-mono">{title ?? lang}</span>
                <CopyButton text={code.trim()} />
            </div>
            <div
                className="overflow-x-auto p-4 text-[13px] leading-6 [&_pre]:!bg-transparent [&_pre]:m-0 [&_code]:font-mono"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}
