-- Corrige comparação de validade: usa ::date para que um cupom com
-- validade = '2026-06-08' seja válido o dia todo e expire somente em '2026-06-09'.
-- Antes, 'validade < now()' expirava o cupom assim que passava meia-noite UTC
-- do mesmo dia configurado.

create or replace function validar_cupom(_codigo text, _valor numeric)
returns table(valido boolean, motivo text, desconto numeric, codigo text)
language plpgsql security definer set search_path = public as $$
declare c cupons%rowtype;
begin
  select * into c from cupons where lower(codigo) = lower(_codigo) limit 1;
  if not found then
    return query select false, 'Cupom não encontrado'::text, 0::numeric, _codigo; return;
  end if;
  if not c.ativo then
    return query select false, 'Cupom inativo'::text, 0::numeric, c.codigo; return;
  end if;
  if c.validade is not null and c.validade::date < current_date then
    return query select false, 'Cupom expirado'::text, 0::numeric, c.codigo; return;
  end if;
  if c.uso_max is not null and c.uso_atual >= c.uso_max then
    return query select false, 'Cupom esgotado'::text, 0::numeric, c.codigo; return;
  end if;
  if c.valor_minimo is not null and _valor < c.valor_minimo then
    return query select false, ('Valor mínimo '||c.valor_minimo)::text, 0::numeric, c.codigo; return;
  end if;
  if c.tipo = 'percentual' then
    return query select true, 'ok'::text, round((_valor * c.valor / 100)::numeric, 2), c.codigo;
  else
    return query select true, 'ok'::text, least(c.valor, _valor), c.codigo;
  end if;
end $$;
