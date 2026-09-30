const {validarConsulta}=require('./clienteConsulta');
const model=require('../models/metricasModel');
const pool=require('../config/database');
const ESTRATEGIAS={curiosidade:'Curiosidade',oportunidade:'Oportunidade',problema_sutil:'Problema sutil',visualizacao:'Benefício / Visualização',demonstracao:'Demonstração',pergunta:'Pergunta',autoridade:'Autoridade leve',direta:'Direta'};
function erro(message){return Object.assign(new Error(message),{status:400});}
function dia(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='1000-01-01'&&v<='9998-12-31'&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}
function validar(query){
 for(const [k,v] of Object.entries(query))if(!['periodo','inicio','fim','nicho','estado','cidade'].includes(k)||typeof v!=='string')throw erro('Filtro de dashboard inválido: '+k);
 const periodo=query.periodo||'todo';if(!['todo','hoje','7d','30d','mes','personalizado'].includes(periodo))throw erro('Período inválido.');
 if(periodo==='personalizado'&&(!dia(query.inicio)||!dia(query.fim)||query.inicio>query.fim))throw erro('Informe um intervalo válido: data inicial até data final.');
 if(periodo!=='personalizado'&&(query.inicio||query.fim))throw erro('Datas só podem ser usadas no período personalizado.');
 const {dados,erros}=validarConsulta(Object.fromEntries(['nicho','estado','cidade'].filter(k=>query[k]).map(k=>[k,query[k]])));
 if(erros.length)throw erro(erros.join(' '));return {...dados,periodo,inicio:query.inicio,fim:query.fim};
}
function janela(f,agora){
 const hoje=agora.slice(0,10);const add=(d,n)=>{const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
 let inicio=null,fim=null;
 if(f.periodo!=='todo'){
  inicio=f.periodo==='personalizado'?f.inicio:f.periodo==='mes'?hoje.slice(0,7)+'-01':add(hoje,f.periodo==='7d'?-6:f.periodo==='30d'?-29:0);
  fim=add(f.periodo==='personalizado'?f.fim:hoje,1);
 }
 return {inicio:inicio?inicio+' 00:00:00':null,fim_exclusivo:fim?fim+' 00:00:00':null,agora,agrupamento:inicio&&(Date.parse(fim)-Date.parse(inicio))/86400000<=45?'dia':'mes'};
}
function taxa(n,d){return {numerador:n,denominador:d,percentual:d?Math.round(n/d*1000)/10:0};}
function enriquecer(row){const r={...row};for(const k of ['leads','contatados','contatos','responderam','interessados','negociacao','fechados','sem_historico'])r[k]=Number(r[k]||0);r.taxa_resposta=taxa(r.responderam,r.contatados);return r;}
async function dashboard(f,conexao){
 const c=conexao||await pool.getConnection();let transacao=false;
 try{
  if(!conexao){await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await c.beginTransaction();transacao=true;}
  const [[clock]]=await c.execute('SELECT NOW() AS agora');const periodo=janela(f,clock.agora);
  const raw=await model.agregar(c,f,periodo),resumo=enriquecer(raw.resumo);
  const existentes=raw.estrategias.map(enriquecer);
  const estrategias=Object.entries(ESTRATEGIAS).map(([estrategia,nome])=>({...enriquecer(existentes.find(e=>e.estrategia===estrategia)||{}),estrategia,nome}));
  for(const e of existentes)if(!Object.hasOwn(ESTRATEGIAS,e.estrategia))estrategias.push({...e,nome:e.estrategia==='manual'?'Manual / sem abordagem atribuída':e.estrategia+' (legada)'});
  const result={periodo,resumo,taxas:{resposta:taxa(resumo.responderam,resumo.contatados),interesse:taxa(resumo.interessados,resumo.responderam),fechamento:taxa(resumo.fechados,resumo.contatados)},funil:['leads','contatados','responderam','interessados','negociacao','fechados'].map(etapa=>({etapa,quantidade:resumo[etapa]})),estrategias:estrategias.map(e=>({...e,amostra_pequena:e.contatados<10})),variantes:raw.variantes.map(enriquecer),nichos:raw.nichos.map(enriquecer),estados:raw.estados.map(enriquecer),pipeline:raw.pipeline.map(r=>({...r,total:Number(r.total)})),followups:Object.fromEntries(Object.entries(raw.followups).map(([k,n])=>[k,Number(n)])),evolucao:raw.evolucao.reverse().map(r=>({...r,contatos:Number(r.contatos),respostas:Number(r.respostas),fechados:Number(r.fechados)})),opcoes:raw.opcoes};
  if(transacao){await c.commit();transacao=false;}return result;
 }finally{try{if(transacao)await c.rollback();}finally{if(!conexao)c.release();}}
}
module.exports={validar,janela,taxa,dashboard,ESTRATEGIAS};
