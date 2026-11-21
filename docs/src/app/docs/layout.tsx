import { Topbar } from '@/components/docs/topbar';
import { SidebarNav } from '@/components/docs/sidebar-nav';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AssistantProvider } from '@/components/assistant/assistant-provider';
import { AssistantShell } from '@/components/assistant/assistant-shell';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    return (
        <TooltipProvider>
            <AssistantProvider>
                <div className="min-h-screen">
                    <Topbar />
                    <AssistantShell>
                        <aside className="sticky top-[52px] hidden h-[calc(100vh-52px)] w-[272px] shrink-0 overflow-y-auto border-r border-zs-border bg-zs-side p-3 lg:block">
                            <SidebarNav />
                        </aside>
                        <main className="min-w-0 flex-1">{children}</main>
                    </AssistantShell>
                </div>
            </AssistantProvider>
        </TooltipProvider>
    );
}
