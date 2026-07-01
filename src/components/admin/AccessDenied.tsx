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
    <div className="flex min-h-screen flex-col items-center justify-center bg-linen p-6 text-center">
      <ShieldAlert className="mb-4 h-10 w-10 text-terracotta" />
      <h1 className="text-xl font-bold text-charcoal">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {showSignOut && onSignOut && (
        <Button variant="outline" className="mt-6" onClick={onSignOut}>
          Sair e tentar outra conta
        </Button>
      )}
    </div>
  );
}
