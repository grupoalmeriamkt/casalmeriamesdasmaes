import type { LucideIcon } from "lucide-react";
import { ExternalLink, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { UserProfileWidget } from "@/components/admin/UserProfileWidget";
import { cn } from "@/lib/utils";

export type AdminTabId =
  | "dashboard"
  | "textos"
  | "cestas"
  | "campanhas"
  | "pedidos"
  | "pedidos-central"
  | "cozinha"
  | "emails"
  | "cupons"
  | "configuracoes";

export type AdminNavItem = {
  id: AdminTabId;
  label: string;
  shortLabel?: string;
  Icon: LucideIcon;
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

type AdminLayoutProps = {
  groups: AdminNavGroup[];
  activeId: AdminTabId;
  onNavigate: (id: AdminTabId) => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function AdminLayout({
  groups,
  activeId,
  onNavigate,
  menuOpen,
  onMenuOpenChange,
  children,
}: AdminLayoutProps) {
  const activeLabel =
    groups.flatMap((g) => g.items).find((i) => i.id === activeId)?.label ?? "Admin";

  return (
    <div className="admin-shell flex min-h-[100dvh] bg-[#f2f2f7]">
      {menuOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] md:hidden"
          onClick={() => onMenuOpenChange(false)}
        />
      )}

      <aside
        className={cn(
          "admin-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(88vw,20rem)] flex-col border-r border-black/5 bg-white/90 shadow-elevated backdrop-blur-xl transition-transform duration-300 ease-out md:static md:z-auto md:w-64 md:translate-x-0 md:shadow-none",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <div>
            <Logo />
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Administração
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full md:hidden"
            onClick={() => onMenuOpenChange(false)}
            aria-label="Fechar navegação"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="admin-nav-group-title">{group.title}</p>
              <div className="mt-1.5 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.Icon;
                  const active = activeId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      className={cn("admin-nav-item", active && "admin-nav-item-active")}
                    >
                      <Icon
                        className="h-[18px] w-[18px] shrink-0"
                        strokeWidth={active ? 2.25 : 2}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-black/5 p-3">
          <Button
            asChild
            variant="outline"
            className="h-11 w-full justify-start rounded-xl border-black/8 bg-white text-charcoal shadow-none hover:bg-black/[0.03]"
          >
            <a href="/" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Ver site
            </a>
          </Button>
          <div className="rounded-xl border border-black/5 bg-white px-2 py-1.5">
            <UserProfileWidget />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="admin-mobile-header sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-black/5 bg-white/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            onClick={() => onMenuOpenChange(true)}
            aria-label="Abrir navegação"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-charcoal">{activeLabel}</p>
          </div>
          <div className="h-10 w-10 shrink-0" aria-hidden />
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AdminCard({
  className,
  children,
  padding = "default",
}: {
  className?: string;
  children: React.ReactNode;
  padding?: "none" | "sm" | "default";
}) {
  return (
    <div
      className={cn(
        "admin-card",
        padding === "sm" && "p-4",
        padding === "default" && "p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-charcoal sm:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function AdminSegmentedTabs({
  value,
  onValueChange,
  items,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: { id: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("admin-segmented-scroll", className)}>
      <div className="admin-segmented" role="tablist" aria-label="Subseções">
        {items.map((item) => {
          const active = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onValueChange(item.id)}
              className={cn("admin-segmented-item", active && "admin-segmented-item-active")}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AdminEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="admin-empty-state">
      <p className="text-sm font-medium text-charcoal">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
