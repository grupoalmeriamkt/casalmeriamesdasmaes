import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

type Props = {
  title?: string;
  description?: string;
  showSignOut?: boolean;
  onSignOut?: () => void;
};

export function AccessDenied({
  title = "Sem permissão",
  description = "Sua conta não tem acesso a esta área.",
  showSignOut = false,
  onSignOut,
}: Props) {
  return (
    <div className="admin-shell flex min-h-[100dvh] flex-col items-center justify-center bg-[#f2f2f7] p-6 text-center">
      <div className="admin-card max-w-md p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-terracotta/10">
          <ShieldAlert className="h-7 w-7 text-terracotta" />
        </div>
        <h1 className="text-xl font-semibold text-charcoal">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {showSignOut && onSignOut && (
          <Button variant="outline" className="mt-6 h-11 w-full rounded-xl" onClick={onSignOut}>
            Sair e tentar outra conta
          </Button>
        )}
      </div>
    </div>
  );
}
