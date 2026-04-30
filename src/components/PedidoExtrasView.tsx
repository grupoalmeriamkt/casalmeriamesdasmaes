import { Image as ImageIcon, Download } from "lucide-react";
import { formatBRL } from "@/store/pedido";
import { Button } from "@/components/ui/button";

export type CartaoView = { nome: string; preco: number; mensagem: string };
export type PolaroidView = {
  nome: string;
  preco: number;
  arquivoUrl: string;
  arquivoNome: string;
};

type Props = {
  cartoes?: CartaoView[];
  polaroids?: PolaroidView[];
  /** admin: mostra miniatura + botão de download. cliente: só confirmação. */
  variant?: "admin" | "cliente";
};

export function PedidoExtrasView({
  cartoes = [],
  polaroids = [],
  variant = "cliente",
}: Props) {
  if (cartoes.length === 0 && polaroids.length === 0) return null;

  return (
    <div className="space-y-3">
      {cartoes.length > 0 && (
        <div className="space-y-2">
          {cartoes.map((c, i) => (
            <div key={`c-${i}`} className="rounded-lg bg-linen p-3 ring-1 ring-border">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-charcoal">
                  💌 {c.nome}
                </p>
                <span className="text-sm font-semibold text-charcoal">
                  {formatBRL(c.preco)}
                </span>
              </div>
              {c.mensagem && (
                <p className="mt-2 border-l-2 border-terracotta pl-3 text-sm italic text-charcoal/80">
                  &ldquo;{c.mensagem}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {polaroids.length > 0 && (
        <div className="space-y-2">
          {polaroids.map((p, i) => (
            <div
              key={`p-${i}`}
              className="rounded-lg bg-linen p-3 ring-1 ring-border"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-charcoal">
                  📸 {p.nome}
                </p>
                <span className="text-sm font-semibold text-charcoal">
                  {formatBRL(p.preco)}
                </span>
              </div>

              {variant === "admin" ? (
                <div className="mt-2 flex items-center gap-3">
                  {p.arquivoUrl && (
                    <a
                      href={p.arquivoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <img
                        src={p.arquivoUrl}
                        alt={p.arquivoNome || "Foto polaroid"}
                        className="h-24 w-24 rounded-md object-cover ring-1 ring-border"
                      />
                    </a>
                  )}
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">
                      {p.arquivoNome || "foto.jpg"}
                    </p>
                    {p.arquivoUrl && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="mt-1"
                      >
                        <a
                          href={p.arquivoUrl}
                          download={p.arquivoNome || "polaroid.jpg"}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download className="mr-1 h-3 w-3" /> Baixar foto
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 inline-flex items-center gap-2 text-sm text-olive">
                  <ImageIcon className="h-4 w-4" />
                  Foto enviada com sucesso
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
