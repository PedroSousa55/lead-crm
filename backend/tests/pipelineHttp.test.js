const {test}=require('node:test');const assert=require('node:assert/strict');
Object.assign(process.env,{DB_HOST:'127.0.0.1',DB_PORT:'3306',DB_USER:'test_only',DB_PASSWORD:'',DB_NAME:'test_only',PORT:'3000'});
const clientes=require('../models/clienteModel');const pool=require('../config/database');const app=require('../server');
test('Pipeline HTTP: contrato antigo, filtros e follow-up',async t=>{
 const backup={...clientes};let ultimaConsulta;let plano={id:1,proximo_contato_em:null,proxima_acao:null};
 clientes.listarTodos=async()=>[plano];clientes.listarFiltrados=async dados=>{ultimaConsulta=dados;return {clientes:[plano],total:1,page:dados.page,limit:dados.limit,pipeline:{nao_contatado:1},indicadores:{total:1},opcoes:[],agora:'2026-09-22 10:00:00'};};
 clientes.atualizarFollowup=async(id,dados)=>{if(id!==1)return false;Object.assign(plano,dados);return true;};clientes.buscarPorId=async()=>plano;
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port+'/api/clientes';
 try{
 await t.test('GET sem parâmetros continua retornando array',async()=>assert.ok(Array.isArray(await(await fetch(url)).json())));
 await t.test('GET combina filtros, paginação e ordenação',async()=>{const r=await fetch(url+'?estado=SP&nicho=Academia&page=2&limit=50&sort=nome&status=sem_resposta');assert.equal(r.status,200);assert.equal((await r.json()).limit,50);assert.equal(ultimaConsulta.status,'contatado');assert.equal(ultimaConsulta.estado,'SP');assert.equal(ultimaConsulta.nicho,'Academia');assert.equal(ultimaConsulta.page,2);});
 await t.test('GET rejeita injeção e parâmetros repetidos',async()=>{for(const query of ['sort=DROP%20TABLE','limit=10000','estado=SP&estado=CE'])assert.equal((await fetch(url+'?'+query)).status,400);});
 await t.test('PUT followup valida data, normaliza ação, limpa e informa ausente',async()=>{
 const put=(id,body)=>fetch(url+'/'+id+'/followup',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await put(1,{proximo_contato_em:'2026-02-30T10:00'})).status,400);
 assert.equal((await put(1,{proximo_contato_em:'2026-09-25T10:00',proxima_acao:'  Enviar   proposta  '})).status,200);assert.equal(plano.proximo_contato_em,'2026-09-25 10:00:00');assert.equal(plano.proxima_acao,'Enviar proposta');
 assert.equal((await put(1,{proximo_contato_em:null})).status,200);assert.equal(plano.proximo_contato_em,null);assert.equal(plano.proxima_acao,'Enviar proposta');assert.equal((await put(2,{proxima_acao:''})).status,404);
 });
 }finally{Object.assign(clientes,backup);server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();}
});
