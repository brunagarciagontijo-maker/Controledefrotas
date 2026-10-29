-- Conferido contra os dois inventarios locais e as regras da aplicacao.
-- Executar manualmente no SQL Editor do projeto original conferido.
-- Retorna somente contagens; nenhum ID, nome, documento ou URL e exportado.
-- Os checks com sufixo "preserved" sao totais de referencia, nao comprovam backup.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';

-- Status confirmados por hashes das constraints validadas do inventario:
-- vehicles: Ativo / Inativo / Em Manut.
-- operational_movements: Em aberto / Concluida.
-- vehicle_records: Em uso / Devolvido; access_records: Em aberto / Concluido.
-- Uma saida operacional vincula vehicle_id e guarda uma copia da placa.
-- O frontend tambem cruza placas. Considerar ambas as identidades evita omitir
-- conflito se uma placa tiver sido editada; o check especifico abaixo o evidencia.
WITH vehicle_state AS (
  SELECT v.id,v.in_patio,
    EXISTS (
      SELECT 1 FROM public.operational_movements m
      WHERE m.status='Em aberto'
        AND (m.vehicle_id=v.id OR upper(btrim(m.vehicle_plate))=upper(btrim(v.plate)))
    ) AS has_open_movement,
    EXISTS (
      SELECT 1 FROM public.vehicle_records r
      WHERE r.status='Em uso' AND upper(btrim(r.vehicle_plate))=upper(btrim(v.plate))
    ) AS has_open_record
  FROM public.vehicles v
)
SELECT 'duplicate_vehicle_plates' AS check_name,count(*) AS problems
FROM (
  SELECT upper(btrim(plate)) FROM public.vehicles
  GROUP BY upper(btrim(plate)) HAVING count(*)>1
) q
UNION ALL
SELECT 'duplicate_open_movements',count(*)
FROM (
  SELECT vehicle_id FROM public.operational_movements WHERE status='Em aberto'
  GROUP BY vehicle_id HAVING count(*)>1
) q
UNION ALL
SELECT 'duplicate_open_movement_plates',count(*)
FROM (
  SELECT upper(btrim(vehicle_plate)) FROM public.operational_movements WHERE status='Em aberto'
  GROUP BY upper(btrim(vehicle_plate)) HAVING count(*)>1
) q
UNION ALL
SELECT 'duplicate_open_records',count(*)
FROM (
  SELECT upper(btrim(vehicle_plate)) FROM public.vehicle_records WHERE status='Em uso'
  GROUP BY upper(btrim(vehicle_plate)) HAVING count(*)>1
) q
UNION ALL
-- Numero de veiculos cadastrados com saida aberta nos dois fluxos, sem multiplicar joins.
SELECT 'open_in_both_flows',count(*) FROM vehicle_state
WHERE has_open_movement AND has_open_record
UNION ALL
-- Divergencia: indica presenca/disponibilidade no patio apesar de uma saida aberta.
-- Nao confundir status administrativo com localizacao fisica: mesmo inativo ou
-- em manutencao pode estar no patio. Disponivel para sair exige ainda status Ativo.
SELECT 'patio_state_mismatch',count(*) FROM vehicle_state
WHERE in_patio IS TRUE AND (has_open_movement OR has_open_record)
UNION ALL
-- Somente revisao: a flag pode ter sido desligada manualmente. Ausencia de saida
-- aberta NAO comprova presenca fisica nem autoriza mudar in_patio para true.
SELECT 'patio_outside_without_open_movement',count(*) FROM vehicle_state
WHERE in_patio IS FALSE AND NOT (has_open_movement OR has_open_record)
UNION ALL
-- Pode resultar de edicao da placa; revisar identidade, sem reescrever historico.
SELECT 'open_movement_vehicle_plate_mismatch',count(*)
FROM public.operational_movements m JOIN public.vehicles v ON v.id=m.vehicle_id
WHERE m.status='Em aberto'
  AND upper(btrim(m.vehicle_plate)) IS DISTINCT FROM upper(btrim(v.plate))
UNION ALL
SELECT 'orphan_movement_vehicle',count(*) FROM public.operational_movements m
WHERE NOT EXISTS(SELECT 1 FROM public.vehicles v WHERE v.id=m.vehicle_id)
UNION ALL
SELECT 'orphan_access_person',count(*) FROM public.access_records a
WHERE NOT EXISTS(SELECT 1 FROM public.people p WHERE p.id=a.person_id)
UNION ALL
-- URL HTTP(S) persistida pode ser publica, privada ou assinada; nao comprova exposicao.
SELECT 'persisted_document_http_urls',count(*) FROM public.people
WHERE cnh_file_url ~* '^https?://'
UNION ALL
SELECT 'existing_records_preserved',count(*) FROM public.vehicle_records
UNION ALL
SELECT 'existing_movements_preserved',count(*) FROM public.operational_movements
UNION ALL
SELECT 'existing_accesses_preserved',count(*) FROM public.access_records;
ROLLBACK;
