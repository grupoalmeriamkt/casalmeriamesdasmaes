import { useState } from "react";
import { LogOut, MoreHorizontal, UserPen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(user: { email?: string | null; user_metadata?: Record<string, unknown> }): string {
  const name = user.user_metadata?.full_name as string | undefined;
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (user.email?.[0] ?? "?").toUpperCase();
}

export function UserProfileWidget() {
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const openProfile = () => {
    setDisplayName((user.user_metadata?.full_name as string) ?? "");
    setNewPassword("");
    setConfirmPassword("");
    setProfileOpen(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin";
  };

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const updates: Parameters<typeof supabase.auth.updateUser>[0] = {};
      updates.data = { full_name: displayName.trim() || null };
      if (newPassword) updates.password = newPassword;

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      toast.success(newPassword ? "Perfil e senha atualizados." : "Perfil atualizado.");
      setProfileOpen(false);
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const avatarLetters = initials(user);
  const email = user.email ?? "";
  const name = (user.user_metadata?.full_name as string | undefined)?.trim();

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-charcoal text-xs font-semibold text-white">
          {avatarLetters}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          {name && (
            <p className="truncate text-xs font-medium text-charcoal">{name}</p>
          )}
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-charcoal/60 hover:text-charcoal"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={openProfile}>
              <UserPen className="mr-2 h-4 w-4" />
              Editar perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialog de edição de perfil */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="up-email">E-mail</Label>
              <Input id="up-email" value={email} disabled className="bg-muted/50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="up-name">Nome de exibição</Label>
              <Input
                id="up-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome"
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="up-password">Nova senha</Label>
              <Input
                id="up-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Deixe em branco para não alterar"
                autoComplete="new-password"
              />
            </div>

            {newPassword && (
              <div className="space-y-1.5">
                <Label htmlFor="up-confirm">Confirmar nova senha</Label>
                <Input
                  id="up-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                />
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-charcoal text-white hover:bg-charcoal/90"
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
