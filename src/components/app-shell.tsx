import Link from "next/link";
import { LayoutDashboard, Inbox, Calendar, FolderOpen, MessageSquare, BarChart3, BookOpen, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requests", label: "Requests", icon: Inbox },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/repository", label: "Repository", icon: FolderOpen },
  { href: "/chat", label: "Ask the hub", icon: MessageSquare },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/wiki", label: "Wiki", icon: BookOpen },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export function AppShell({
  user,
  children,
}: {
  user: { name?: string | null; email: string; image?: string | null };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-[var(--color-background)]">
      <aside className="w-60 shrink-0 border-r border-[var(--color-border)] flex flex-col">
        <div className="h-14 px-5 flex items-center gap-2 border-b border-[var(--color-border)]">
          <Sparkles className="size-5 text-[var(--color-primary)]" />
          <span className="font-semibold tracking-tight">Asset Hub</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-[var(--color-border)] flex items-center gap-2">
          <div className="size-8 rounded-full bg-[var(--color-muted)] flex items-center justify-center text-xs font-medium overflow-hidden">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name ?? user.email} className="size-full object-cover" />
            ) : (
              (user.name ?? user.email).slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="text-xs leading-tight min-w-0">
            <div className="font-medium truncate">{user.name ?? user.email}</div>
            <div className="text-[var(--color-muted-foreground)] truncate">{user.email}</div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-[var(--color-border)] flex items-center px-6 gap-4">
          <div className="text-sm text-[var(--color-muted-foreground)]">⌘K to search</div>
          <div className="ml-auto">
            <Link
              href="/requests/new"
              className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90"
            >
              + New brief
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
