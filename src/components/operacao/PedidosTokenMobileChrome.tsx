import {
  CalendarDays,
  Filter,
  LayoutList,
  MoreHorizontal,
  RefreshCw,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type PedidosMobileView = "planilha" | "calendario" | "lista" | "kanban";

type NavProps = {
  view: PedidosMobileView;
  onChange: (view: PedidosMobileView) => void;
};

const NAV_ITEMS: { id: PedidosMobileView; label: string; Icon: typeof Table2 }[] = [
  { id: "planilha", label: "Planilha", Icon: Table2 },
  { id: "calendario", label: "Calendário", Icon: CalendarDays },
  { id: "lista", label: "Lista", Icon: LayoutList },
];

export function PedidosTokenMobileHeader({
  title,
  subtitle,
  carregando,
  filtrosAtivos,
  onRefresh,
  onOpenFilters,
  onOpenActions,
}: {
  title: string;
  subtitle: string;
  carregando: boolean;
  filtrosAtivos: boolean;
  onRefresh: () => void;
  onOpenFilters: () => void;
  onOpenActions: () => void;
}) {
  return (
    <header className="pedidos-mobile-header sticky top-0 z-40 border-b border-black/8 bg-white/90 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-charcoal">{title}</h1>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={onRefresh}
          disabled={carregando}
          aria-label="Atualizar"
        >
          <RefreshCw className={cn("h-5 w-5", carregando && "animate-spin")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-10 w-10 shrink-0 rounded-full",
            filtrosAtivos && "bg-charcoal/5",
          )}
          onClick={onOpenFilters}
          aria-label="Filtros"
        >
          <Filter className="h-5 w-5" />
          {filtrosAtivos && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-terracotta" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={onOpenActions}
          aria-label="Mais ações"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

export function PedidosTokenMobileSearch({
  value,
  onChange,
  count,
  showCount = true,
}: {
  value: string;
  onChange: (value: string) => void;
  count: number;
  showCount?: boolean;
}) {
  return (
    <div className="sticky top-[4.25rem] z-30 border-b border-black/6 bg-[#f2f2f7]/95 px-4 py-2 backdrop-blur-xl">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar cliente, telefone…"
        className="h-11 w-full rounded-xl border border-black/8 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-charcoal/20"
      />
      {showCount && (
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          {count} pedido{count !== 1 ? "s" : ""} visíveis
        </p>
      )}
    </div>
  );
}

export function PedidosTokenMobileNav({ view, onChange }: NavProps) {
  return (
    <nav
      className="pedidos-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-black/8 bg-white/95 backdrop-blur-xl"
      aria-label="Navegação de visualizações"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "flex min-h-11 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-colors",
                active ? "text-charcoal" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function PedidosTokenMobileSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function PedidosTokenMobileChips({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide [-webkit-overflow-scrolling:touch]">
      {children}
    </div>
  );
}

export function PedidosTokenMobileChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-charcoal text-white" : "bg-white text-charcoal ring-1 ring-black/8",
      )}
    >
      {children}
    </button>
  );
}
