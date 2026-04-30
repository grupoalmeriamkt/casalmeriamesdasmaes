import { useAdmin, type Campanha } from "@/store/admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Truck, Store, Clock, Calendar, Megaphone } from "lucide-react";

type Props = { campanha: Campanha };

export function CampanhaForm({ campanha }: Props) {
  const setCampanha = useAdmin((s) => s.setCampanha);
  const setQuiz = useAdmin((s) => s.setCampanhaQuiz);
  const unidades = useAdmin((s) => s.unidades);
  const cestas = useAdmin((s) => s.cestas);

  const quiz = campanha.quiz;
  const restr = quiz.restricaoRaio;

  const toggleUnidade = (id: string, checked: boolean) => {
    const set = new Set(quiz.unidadeIds);
    if (checked) set.add(id);
    else set.delete(id);
    setQuiz(campanha.id, { unidadeIds: Array.from(set) });
  };

  return (
    <div className="space-y-6">
      {/* Dados básicos */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-charcoal" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-charcoal">
            Dados da campanha
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={campanha.nome}
              onChange={(e) => setCampanha(campanha.id, { nome: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Slug do link (/q/...)</Label>
            <Input
              value={campanha.slug}
              onChange={(e) =>
                setCampanha(campanha.id, {
                  slug: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-"),
                })
              }
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Status</Label>
            <Select
              value={campanha.status}
              onValueChange={(v) =>
                setCampanha(campanha.id, { status: v as "ativa" | "pausada" })
              }
            >
              <SelectTrigger className="max-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="pausada">Pausada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Quiz config */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-charcoal">
          Configuração do Quiz
        </h3>

        <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-charcoal" />
              <span className="text-sm font-medium text-charcoal">Delivery</span>
            </div>
            <Switch
              checked={quiz.delivery}
              onCheckedChange={(v) => setQuiz(campanha.id, { delivery: v })}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Restrição por raio</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={restr.ativo}
                  onCheckedChange={(v) =>
                    setQuiz(campanha.id, {
                      restricaoRaio: { ...restr, ativo: v },
                    })
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Bloquear endereços fora do raio
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Unidade base</Label>
              <Select
                value={restr.unidadeBaseId}
                onValueChange={(v) =>
                  setQuiz(campanha.id, {
                    restricaoRaio: { ...restr, unidadeBaseId: v },
                  })
                }
                disabled={!restr.ativo}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Raio (km)</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={restr.raioKm}
                disabled={!restr.ativo}
                onChange={(e) =>
                  setQuiz(campanha.id, {
                    restricaoRaio: {
                      ...restr,
                      raioKm: Math.max(1, Number(e.target.value) || 1),
                    },
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-charcoal" />
              <span className="text-sm font-medium text-charcoal">
                Retirada na loja
              </span>
            </div>
            <Switch
              checked={quiz.retirada}
              onCheckedChange={(v) => setQuiz(campanha.id, { retirada: v })}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Unidades disponíveis para esta campanha
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastre unidades em Configurações → Unidades.
            </p>
            <div className="mt-2 space-y-2">
              {unidades.length === 0 && (
                <p className="text-xs text-terracotta">
                  Nenhuma unidade cadastrada.
                </p>
              )}
              {unidades.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
                  <Switch
                    checked={quiz.unidadeIds.includes(u.id)}
                    onCheckedChange={(v) => toggleUnidade(u.id, v)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-charcoal">
                      {u.nome}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.endereco || "Sem endereço"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Datas */}
        <div className="rounded-lg border border-border/60 bg-background/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-charcoal" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-charcoal">
              Dias disponíveis
            </h4>
          </div>
          <div className="space-y-2">
            {quiz.datas.map((d, i) => (
              <div
                key={d.id}
                className="grid gap-2 rounded-md border border-border bg-card p-2 md:grid-cols-[auto_1fr_auto]"
              >
                <Switch
                  checked={d.ativa}
                  onCheckedChange={(v) =>
                    setQuiz(campanha.id, {
                      datas: quiz.datas.map((x, idx) =>
                        idx === i ? { ...x, ativa: v } : x,
                      ),
                    })
                  }
                />
                <Input
                  value={d.label}
                  onChange={(e) =>
                    setQuiz(campanha.id, {
                      datas: quiz.datas.map((x, idx) =>
                        idx === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setQuiz(campanha.id, {
                      datas: quiz.datas.filter((_, idx) => idx !== i),
                    })
                  }
                  className="text-terracotta hover:bg-terracotta/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-2 border-dashed"
            onClick={() =>
              setQuiz(campanha.id, {
                datas: [
                  ...quiz.datas,
                  { id: `d-${Date.now()}`, label: "Nova data", ativa: true },
                ],
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar data
          </Button>
        </div>

        {/* Horários */}
        <div className="rounded-lg border border-border/60 bg-background/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-charcoal" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-charcoal">
              Janelas de horário
            </h4>
          </div>
          <div className="space-y-2">
            {quiz.horarios.map((h, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-md border border-border bg-card p-2 md:grid-cols-[auto_1fr_auto]"
              >
                <Switch
                  checked={h.ativo}
                  onCheckedChange={(v) =>
                    setQuiz(campanha.id, {
                      horarios: quiz.horarios.map((x, idx) =>
                        idx === i ? { ...x, ativo: v } : x,
                      ),
                    })
                  }
                />
                <Input
                  value={h.label}
                  onChange={(e) =>
                    setQuiz(campanha.id, {
                      horarios: quiz.horarios.map((x, idx) =>
                        idx === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setQuiz(campanha.id, {
                      horarios: quiz.horarios.filter((_, idx) => idx !== i),
                    })
                  }
                  className="text-terracotta hover:bg-terracotta/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-2 border-dashed"
            onClick={() =>
              setQuiz(campanha.id, {
                horarios: [
                  ...quiz.horarios,
                  { label: "Nova janela", ativo: true },
                ],
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar janela
          </Button>
        </div>
      </div>

      {/* Upsell */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-charcoal">
            Upsell
          </h3>
          <Switch
            checked={campanha.upsellAtivo}
            onCheckedChange={(v) =>
              setCampanha(campanha.id, { upsellAtivo: v })
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Quando habilitado, exibe um produto sugerido durante o Quiz.
        </p>
        {campanha.upsellAtivo && (
          <div className="space-y-1.5">
            <Label>Produto exibido como upsell</Label>
            <Select
              value={campanha.upsellProdutoId ?? ""}
              onValueChange={(v) =>
                setCampanha(campanha.id, { upsellProdutoId: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {cestas
                  .filter((c) => !c.arquivado && c.ativo)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
