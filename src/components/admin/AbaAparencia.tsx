import { useAdmin } from "@/store/admin";
import { AdminSection, AdminField } from "./AdminField";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Palette } from "lucide-react";
import { ImageUpload } from "./ImageUpload";

export function AbaAparencia() {
  const tema = useAdmin((s) => s.tema);
  const setTema = useAdmin((s) => s.setTema);

  const ColorField = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <AdminField label={label}>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm"
        />
      </div>
    </AdminField>
  );

  return (
    <AdminSection
      title="Aparência"
      icon={<Palette className="h-5 w-5" />}
      description="Personalize o tema visual do site. Alterações aparecem no preview ao lado."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <ColorField
          label="Cor primária (azul charcoal)"
          value={tema.primary}
          onChange={(v) => setTema({ primary: v })}
        />
        <ColorField
          label="Cor de destaque (terracotta)"
          value={tema.accent}
          onChange={(v) => setTema({ accent: v })}
        />
        <ColorField
          label="Cor de fundo"
          value={tema.background}
          onChange={(v) => setTema({ background: v })}
        />
        <div className="md:col-span-2 grid gap-5 md:grid-cols-2">
          <ImageUpload
            label="Logo principal (fundo claro)"
            value={tema.logoUrl ?? ""}
            onChange={(url) => setTema({ logoUrl: url })}
            folder="aparencia"
            previewClassName="h-24 w-auto bg-linen p-2"
            aspect={3}
            aspectHint="Usada sobre fundos claros · recorte ajustável · WebP automático"
          />
          <div className="rounded-lg bg-charcoal p-1">
            <ImageUpload
              label="Logo em contraste (fundo escuro) — opcional"
              value={tema.logoUrlAlt ?? ""}
              onChange={(url) => setTema({ logoUrlAlt: url })}
              folder="aparencia"
              previewClassName="h-24 w-auto p-2"
              aspect={3}
              aspectHint="Usada em rodapé / áreas escuras. Se vazio, usa a logo principal."
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <div>
          <Label className="text-sm font-medium text-charcoal">Modo escuro</Label>
          <p className="text-xs text-muted-foreground">
            Aplica o tema escuro globalmente.
          </p>
        </div>
        <Switch
          checked={tema.modo === "escuro"}
          onCheckedChange={(v) => setTema({ modo: v ? "escuro" : "claro" })}
        />
      </div>

      <div className="rounded-2xl border border-border bg-linen p-6">
        <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
          Preview
        </p>
        <div
          className="rounded-xl p-6 shadow-soft"
          style={{ background: tema.background }}
        >
          <h3
            className="text-2xl font-bold"
            style={{ color: tema.primary }}
          >
            Casa Almeria
          </h3>
          <p className="mt-1 text-sm" style={{ color: tema.primary }}>
            Café da manhã <span style={{ color: tema.accent }}>artesanal</span>
          </p>
          <button
            className="mt-4 rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wider"
            style={{ background: tema.accent, color: tema.primary }}
          >
            Botão de exemplo
          </button>
        </div>
      </div>
    </AdminSection>
  );
}
