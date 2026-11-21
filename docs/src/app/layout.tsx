import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: {
        default: 'Dokumentacja Visibly',
        template: '%s · Visibly'
    },
    description: 'Dokumentacja techniczna aplikacji Visibly: inwentarz hostów, tagowanie, skanowanie, uprawnienia i API.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pl" className="dark">
            <body className="min-h-screen bg-zs-bg text-zs-text">
                {children}
            </body>
        </html>
    );
}
