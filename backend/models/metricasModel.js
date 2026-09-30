const {montarConsulta,ESTAGIO,ATIVO}=require('../services/clienteConsulta');
const nivel=campo=>`CASE ${campo} WHEN 'fechado' THEN 4 WHEN 'negociacao' THEN 3 WHEN 'interessado' THEN 2 WHEN 'respondeu' THEN 1 WHEN 'nao_interessado' THEN 1 ELSE 0 END`;
function contexto(f,j){
 const filtro=montarConsulta(f);
 // Coorte = clientes com contato no período. Estoque não recebe filtro de data.
 // Apenas Todo o período usa estágio atual como evidência sem data, nunca como contato inventado.
 return {params:[j.inicio,j.fim_exclusivo,j.agora,...filtro.params],sql:`WITH janela AS (SELECT CAST(? AS DATETIME) inicio, CAST(? AS DATETIME) fim, CAST(? AS DATETIME) agora),
 selecionados AS (SELECT id,nicho,estado,cidade,status,nao_contatar,proximo_contato_em FROM clientes ${filtro.where}),
 eventos AS (SELECT p.*, (j.inicio IS NULL OR (p.data_contato>=j.inicio AND p.data_contato<j.fim)) AS no_periodo,
 ((j.inicio IS NULL AND (p.data_resposta IS NOT NULL OR ${nivel('p.resultado')}>0)) OR (p.data_resposta>=j.inicio AND p.data_resposta<j.fim)) AS resposta_periodo
 FROM prospeccoes p JOIN selecionados c ON c.id=p.cliente_id CROSS JOIN janela j),
 grupos AS (SELECT c.*,COUNT(p.id) AS historico,COALESCE(SUM(p.no_periodo),0) AS contatos,
 COALESCE(MAX(p.no_periodo AND p.resposta_periodo),0) AS evidencia_resposta,
 GREATEST(COALESCE(MAX(CASE WHEN p.no_periodo AND p.resposta_periodo THEN ${nivel('p.resultado')} ELSE 0 END),0),
 CASE WHEN (SELECT inicio FROM janela) IS NULL AND COUNT(p.id)>0 THEN ${nivel('c.status')} ELSE 0 END) AS nivel
 FROM selecionados c LEFT JOIN eventos p ON p.cliente_id=c.id GROUP BY c.id,c.nicho,c.estado,c.cidade,c.status,c.nao_contatar,c.proximo_contato_em),
 metricas AS (SELECT *,contatos>0 AS contatados,contatos>0 AND (evidencia_resposta OR nivel>=1) AS responderam,
 contatos>0 AND nivel>=2 AS interessados,contatos>0 AND nivel>=3 AS negociacao,contatos>0 AND nivel>=4 AS fechados FROM grupos)`};
}
const medidas=`COUNT(*) AS leads,COALESCE(SUM(contatados),0) AS contatados,COALESCE(SUM(contatos),0) AS contatos,COALESCE(SUM(responderam),0) AS responderam,COALESCE(SUM(interessados),0) AS interessados,COALESCE(SUM(negociacao),0) AS negociacao,COALESCE(SUM(fechados),0) AS fechados`;
async function agregar(c,f,j){
 const ctx=contexto(f,j),query=async(sql)=>{const [r]=await c.execute(ctx.sql+' '+sql,ctx.params);return r;};
 const [resumo]=await query(`SELECT ${medidas},COALESCE(SUM(historico=0 AND status IN ('respondeu','interessado','negociacao','fechado')),0) AS sem_historico FROM metricas`);
 const pipeline=await query(`SELECT (${ESTAGIO}) AS estagio,COUNT(*) AS total FROM selecionados GROUP BY estagio`);
 const [followups]=await query(`SELECT COALESCE(SUM(proximo_contato_em>=DATE(j.agora) AND proximo_contato_em<DATE(j.agora)+INTERVAL 1 DAY),0) hoje,
 COALESCE(SUM(proximo_contato_em<j.agora),0) atrasados,COALESCE(SUM(proximo_contato_em>=DATE(j.agora)+INTERVAL 1 DAY AND proximo_contato_em<DATE(j.agora)+INTERVAL 8 DAY),0) proximos FROM selecionados CROSS JOIN janela j WHERE ${ATIVO}`);
 const agrupar=col=>query(`SELECT COALESCE(NULLIF(TRIM(${col}),''),'Não informado') AS grupo,${medidas} FROM metricas GROUP BY grupo ORDER BY leads DESC,grupo`);
 const nichos=await agrupar('nicho'),estados=await agrupar('estado');
 const desempenho=cols=>query(`SELECT ${cols},COUNT(DISTINCT cliente_id) contatados,COUNT(*) contatos,
 COUNT(DISTINCT CASE WHEN resposta_periodo THEN cliente_id END) responderam,
 COUNT(DISTINCT CASE WHEN resposta_periodo AND ${nivel('resultado')}>=2 THEN cliente_id END) interessados,
 COUNT(DISTINCT CASE WHEN resposta_periodo AND resultado='fechado' THEN cliente_id END) fechados
 FROM eventos WHERE no_periodo GROUP BY ${cols} ORDER BY contatados DESC,${cols}`);
 const estrategias=await desempenho('estrategia'),variantes=await desempenho('estrategia,variant_id');
 const fmt=j.agrupamento==='dia'?'%Y-%m-%d':'%Y-%m';
 // Sem data de fechamento: a série abaixo agrupa resultados Fechado pela data do CONTATO, explicitamente rotulada na UI.
 const evolucao=await query(`SELECT periodo,SUM(contatos) contatos,SUM(respostas) respostas,SUM(fechados) fechados FROM (
 SELECT DATE_FORMAT(data_contato,'${fmt}') periodo,COUNT(*) contatos,0 respostas,COUNT(DISTINCT CASE WHEN resultado='fechado' THEN cliente_id END) fechados FROM eventos WHERE no_periodo GROUP BY periodo
 UNION ALL SELECT DATE_FORMAT(data_resposta,'${fmt}') periodo,0 contatos,COUNT(DISTINCT cliente_id) respostas,0 fechados FROM eventos WHERE data_resposta IS NOT NULL AND resposta_periodo GROUP BY periodo
 ) series GROUP BY periodo ORDER BY periodo DESC LIMIT 36`);
 const [opcoes]=await c.execute("SELECT DISTINCT nicho FROM clientes WHERE NULLIF(TRIM(nicho),'') IS NOT NULL ORDER BY nicho");
 return {resumo,pipeline,followups,nichos,estados,estrategias,variantes,evolucao,opcoes};
}
module.exports={agregar,contexto};
