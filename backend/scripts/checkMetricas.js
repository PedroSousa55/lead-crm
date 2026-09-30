const assert=require('node:assert/strict');
const pool=require('../config/database');
const service=require('../services/metricasService');
const dados=require('../models/dadosModel');
const {hash}=require('../services/backupValidation');
async function main(){
 const c=await pool.getConnection();let tx=false;
 try{
  const site=await dados.estrutura(c),antes=hash(await dados.lerDados(c,site));
  await c.beginTransaction();tx=true;
  const nicho='Teste metricas '+Date.now(),ids=[];
  for(let i=0;i<450;i++){
   const [r]=await c.execute('INSERT INTO clientes (nome_empresa,nicho,estado,cidade,status,proximo_contato_em) VALUES (?,?,?,?,?,?)',[
    'Fixture métricas '+i,nicho,i<225?'MA':'MG',i<225?'São Luís':'Belo Horizonte',i===449?'fechado':'nao_contatado',i===0?'2026-09-28 10:00:00':i===1?'2026-09-29 10:00:00':null]);ids.push(r.insertId);
  }
  const contato=async(i,estrategia,resultado,data='2026-09-28 09:00:00',resposta=null)=>c.execute('INSERT INTO prospeccoes (cliente_id,estrategia,variant_id,mensagem,data_contato,resultado,data_resposta) VALUES (?,?,?,?,?,?,?)',[ids[i],estrategia,estrategia+'_01','Fixture',data,resultado,resposta]);
  for(let i=0;i<10;i++)await contato(i,'curiosidade',i===0?'fechado':i===1?'negociacao':i===2?'interessado':'aguardando_resposta',undefined,i<3?'2026-09-28 10:00:00':null);
  await contato(0,'curiosidade','fechado',undefined,'2026-09-28 11:00:00');await contato(0,'curiosidade','fechado',undefined,'2026-09-28 11:30:00');
  for(const [i,date] of [[10,'2026-09-22'],[11,'2026-08-30'],[12,'2026-09-01'],[13,'2026-08-29']])await contato(i,'direta','aguardando_resposta',date+' 09:00:00');
  const clock={execute:(sql,p)=>sql==='SELECT NOW() AS agora'?Promise.resolve([[{agora:'2026-09-28 12:00:00'}]]):c.execute(sql,p)};
  const consultar=f=>service.dashboard(service.validar({nicho,...f}),clock);
  const start=performance.now(),r=await consultar({periodo:'todo'}),ms=Math.round(performance.now()-start);
  assert.equal(r.resumo.leads,450);assert.equal(r.resumo.contatados,14);assert.equal(r.resumo.contatos,16);assert.equal(r.resumo.responderam,3);assert.equal(r.resumo.interessados,3);assert.equal(r.resumo.negociacao,2);assert.equal(r.resumo.fechados,1);assert.equal(r.resumo.sem_historico,1);
  assert.deepEqual(r.followups,{hoje:1,atrasados:1,proximos:1});assert.equal(r.pipeline.find(x=>x.estagio==='fechado').total,1);
  assert.equal(r.taxas.interesse.percentual,100);assert.equal(r.taxas.resposta.percentual,21.4);assert.equal(r.taxas.fechamento.percentual,7.1);
  const e=r.estrategias.find(x=>x.estrategia==='curiosidade');assert.equal(e.contatados,10);assert.equal(e.responderam,3);assert.equal(e.taxa_resposta.percentual,30);assert.equal(e.amostra_pequena,false);assert.equal(r.variantes.find(x=>x.variant_id==='curiosidade_01').contatos,12);
  assert.deepEqual(r.funil.map(x=>x.quantidade),[450,14,3,3,2,1]);assert.equal(r.estados.length,2);assert.equal(r.nichos.length,1);
  for(const [periodo,n] of [['hoje',10],['7d',11],['30d',13],['mes',12]])assert.equal((await consultar({periodo})).resumo.contatados,n);
  assert.equal((await consultar({periodo:'personalizado',inicio:'2026-09-22',fim:'2026-09-22'})).resumo.contatados,1);
  assert.equal((await consultar({estado:'MA',cidade:'São Luís'})).resumo.leads,225);
  const vazio=await consultar({estado:'AC'});assert.equal(vazio.resumo.leads,0);assert.equal(vazio.taxas.resposta.percentual,0);assert.ok(!JSON.stringify(vazio).includes('NaN'));
  // Resposta hoje a contato antigo entra na série temporal, mas não na coorte de contatos de hoje.
  await c.execute('UPDATE prospeccoes SET resultado=?,data_resposta=? WHERE cliente_id=?',['respondeu','2026-09-28 11:00:00',ids[13]]);
  let hoje=await consultar({periodo:'hoje'});assert.equal(hoje.resumo.responderam,3);assert.equal(hoje.evolucao.find(x=>x.periodo==='2026-09-28').respostas,4);
  // Outra estratégia não herda a resposta da Curiosidade; repetição não infla o total global.
  await contato(0,'direta','aguardando_resposta');hoje=await consultar({periodo:'hoje'});assert.equal(hoje.resumo.contatados,10);assert.equal(hoje.estrategias.find(x=>x.estrategia==='direta').responderam,0);
  await contato(14,'manual','aguardando_resposta','2026-09-29 00:00:00');assert.equal((await consultar({periodo:'hoje'})).resumo.contatados,10);
  // Estágio atual sem data só completa o funil em Todo o período e exige histórico.
  await c.execute('UPDATE clientes SET status=? WHERE id=?',['fechado',ids[9]]);
  assert.equal((await consultar({periodo:'todo'})).resumo.fechados,2);assert.equal((await consultar({periodo:'hoje'})).resumo.fechados,1);
  await c.execute('UPDATE clientes SET nao_contatar=1 WHERE id=?',[ids[0]]);assert.equal((await consultar({})).followups.hoje,0);
  await c.rollback();tx=false;assert.equal(hash(await dados.lerDados(c,site)),antes);
  console.log(`Métricas MySQL: 450 leads, contagens únicas, taxas, funil, estratégias/variantes, períodos, filtros e vazio aprovados (${ms} ms). Rollback confirmado; dados reais intactos.`);
 }finally{try{if(tx)await c.rollback();}finally{c.release();await pool.end();}}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
