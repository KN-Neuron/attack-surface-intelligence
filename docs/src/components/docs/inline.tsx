import * as React from 'react';

/** Zamienia fragmenty w odwrotnych apostrofach na <code> (do komórek tabel i krótkich opisów). */
export function t(text: string): React.ReactNode {
    const parts = text.split('`');
    return (
        <>
            {parts.map((p, i) =>
                i % 2 ? (
                    <code key={i}>{p}</code>
                ) : (
                    <React.Fragment key={i}>{p}</React.Fragment>
                )
            )}
        </>
    );
}
