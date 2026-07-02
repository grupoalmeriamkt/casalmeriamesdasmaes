import { z } from "zod";

export const manualOrderItemSchema = z.object({
  produto_id: z.string().min(1),
  produto_tipo: z.enum(["cesta", "sobremesa"]),
  nome: z.string().min(1),
  preco: z.number().nonnegative(),
  quantidade: z.number().int().positive(),
});

export const manualOrderSchema = z
  .object({
    cliente: z.object({
      nome: z.string().trim().min(3, "Nome muito curto"),
      whatsapp: z.string().trim().min(10, "WhatsApp invalido"),
      email: z.union([z.string().trim().email("E-mail invalido"), z.literal("")]).optional(),
      cpf: z.string().trim().optional(),
    }),
    itens: z.array(manualOrderItemSchema).min(1, "Selecione ao menos um produto"),
    tipo: z.enum(["delivery", "retirada"]),
    enderecoOuUnidade: z.string().trim().min(1, "Informe o endereco ou unidade"),
    unidadeId: z.string().nullable().optional(),
    data: z.string().nullable().optional(),
    horario: z.string().nullable().optional(),
    observacoes: z.string().optional(),
  })
  .refine((v) => (v.tipo === "retirada" ? !!v.unidadeId : true), {
    message: "Selecione a unidade de retirada",
    path: ["unidadeId"],
  });

export type ManualOrderParsed = z.infer<typeof manualOrderSchema>;

/** CPF obrigatorio para gerar o link (Asaas exige cpfCnpj). Aceita 11 digitos ou formatado. */
export const cpfParaLinkSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF invalido");
