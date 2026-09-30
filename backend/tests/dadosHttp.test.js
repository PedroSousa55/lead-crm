const {test}=require('node:test');const assert=require('node:assert/strict');
Object.assign(process.env,{DB_HOST:'127.0.0.1',DB_PORT:'3306',DB_USER:'test_only',DB_PASSWORD:'',DB_NAME:'test_only',PORT:'3000'});
const app=require('../server'),pool=require('../config/database'),model=require('../models/dadosModel'),v=require('../services/backupValidation');const {backup}=require('../test-support/backupFixtures');
test('Dados HTTP: download, validação, confirmação e restauração transacional',async t=>{
 const originalModel={...model},original=pool.getConnection;let atual=backup().dados,antes,commits=0,rollbacks=0,falha=false;
 const c={query:async()=>{},beginTransaction:async()=>{antes=structuredClone(atual)},commit:async()=>{commits++},rollback:async()=>{rollbacks++;atual=antes},release:()=>{}};
 pool.getConnection=async()=>c;model.estrutura=async()=>false;model.lerDados=async()=>structuredClone(atual);
 model.substituir=async(c,b)=>{atual=structuredClone(b.dados);if(falha){atual.clientes=[];throw Error('SQL_FAILURE')}};
 model.exportarClientes=async()=>atual.clientes;model.exportarHistorico=async()=>atual.prospeccoes;
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port+'/api/';
 const post=(path,b=backup(),headers={})=>fetch(url+'backup/'+path,{method:'POST',headers:{'Content-Type':'application/octet-stream',...headers},body:Buffer.isBuffer(b)?b:v.serializar(b)});
 const confirmar=async(b,extra={})=>{const s=await post('seguranca',b);assert.equal(s.status,200);return post('restaurar',b,{'X-Restauracao-Token':s.headers.get('X-Restauracao-Token'),'X-Confirmacao':'RESTAURAR',...extra});};
 try{
 await t.test('GET backups e exportações não modificam dados; prévia apenas valida',async()=>{
  const antes=structuredClone(atual);for(const path of ['backup','exportacao/clientes?formato=csv','exportacao/clientes?formato=xlsx','exportacao/prospeccoes?formato=csv']){const r=await fetch(url+path);assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/attachment/);if(path==='backup')v.validar(await r.json());else await r.arrayBuffer();}
  assert.equal((await post('validar')).status,200);assert.deepEqual(atual,antes);
 });
 await t.test('arquivo inválido, excesso e MIME indevido não iniciam transação',async()=>{
  const n=commits;assert.equal((await post('validar',Buffer.from('{}'))).status,400);assert.equal((await post('restaurar',Buffer.from('{'))).status,400);
  assert.equal((await post('validar',Buffer.alloc(v.LIMITE+1))).status,413);assert.equal((await post('validar',Buffer.from('{}'),{'Content-Type':'text/plain'})).status,415);assert.equal(commits,n);
 });
 await t.test('sem token ou sem confirmação forte nunca restaura',async()=>{
  assert.equal((await post('restaurar')).status,409);assert.equal((await confirmar(backup(),{'X-Confirmacao':'sim'})).status,409);
 });
 await t.test('token vinculado ao backup; alterações posteriores do banco bloqueiam restauração',async()=>{
  const b=backup(),s=await post('seguranca',b);atual.clientes[0].observacoes='Edição concorrente';
  const r=await post('restaurar',b,{'X-Restauracao-Token':s.headers.get('X-Restauracao-Token'),'X-Confirmacao':'RESTAURAR'});assert.equal(r.status,409);assert.match((await r.json()).erro,/mudaram/);assert.equal(atual.clientes[0].observacoes,'Edição concorrente');
  const next=await post('seguranca',b),outro=v.criar({clientes:[],prospeccoes:[]});assert.equal((await post('restaurar',outro,{'X-Restauracao-Token':next.headers.get('X-Restauracao-Token'),'X-Confirmacao':'RESTAURAR'})).status,409);
 });
 await t.test('falha no meio restaura estado anterior e não expõe SQL',async()=>{
  const antes=structuredClone(atual);falha=true;const n=rollbacks,r=await confirmar(backup());assert.equal(r.status,500);assert.equal((await r.json()).erro,'Falha na restauração. Nenhum dado foi alterado.');assert.equal(rollbacks,n+1);assert.deepEqual(atual,antes);falha=false;
 });
 await t.test('sucesso preserva IDs e histórico; token só pode ser usado uma vez',async()=>{
  const b=backup(),s=await post('seguranca',b),headers={'X-Restauracao-Token':s.headers.get('X-Restauracao-Token'),'X-Confirmacao':'RESTAURAR'};
  assert.equal((await post('restaurar',b,headers)).status,200);assert.deepEqual(atual,b.dados);assert.equal((await post('restaurar',b,headers)).status,409);
 });
 await t.test('backup vazio pode ser restaurado após todas as confirmações',async()=>{
  assert.equal((await confirmar(v.criar({clientes:[],prospeccoes:[]}))).status,200);assert.deepEqual(atual,{clientes:[],prospeccoes:[]});
 });
 await t.test('autorização expirada exige nova cópia de segurança',async()=>{
  const b=backup(),s=await post('seguranca',b),now=Date.now;
  try{Date.now=()=>now()+11*60*1000;assert.equal((await post('restaurar',b,{'X-Restauracao-Token':s.headers.get('X-Restauracao-Token'),'X-Confirmacao':'RESTAURAR'})).status,409);}finally{Date.now=now;}
 });
 await t.test('resposta perdida no COMMIT informa incerteza sem afirmar que nada mudou',async()=>{
  const commit=c.commit;const b=backup(),s=await post('seguranca',b);
  try{c.commit=async()=>{throw Error('CONEXAO_PERDIDA')};const r=await post('restaurar',b,{'X-Restauracao-Token':s.headers.get('X-Restauracao-Token'),'X-Confirmacao':'RESTAURAR'});assert.equal(r.status,500);assert.match((await r.json()).erro,/confirmar a conclusão/);}finally{c.commit=commit;}
 });
 }finally{Object.assign(model,originalModel);pool.getConnection=original;server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();}
});
