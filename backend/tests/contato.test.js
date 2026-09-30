const { test } = require('node:test');
const assert = require('node:assert/strict');
Object.assign(process.env, { DB_HOST:'127.0.0.1', DB_PORT:'3306', DB_USER:'test_only', DB_PASSWORD:'', DB_NAME:'test_only', PORT:'3000' });
const pool = require('../config/database');
const app = require('../server');

test('Contato HTTP: histórico transacional, mensagem exata, resultados, bloqueio e erros', async t => {
  const originalExecute = pool.execute, originalConnection = pool.getConnection;
  const inicial = { id: 7, nome_empresa: 'Empresa', telefone:'31997150594', status:'interessado', ultima_data_contato:null, observacoes:'Preservar', nao_contatar:0 };
  let clientes = [inicial, {...inicial, id:8}], historico = [], falhar = '', events = [], snapshot;
  async function execute(sql, params = []) {
    assert.equal((sql.match(/\?/g) || []).length, params.length);
    if (falhar === 'todos' || (falhar && sql.startsWith(falhar))) throw Object.assign(new Error('segredo'),{code:'ERRO_TESTE'});
    if (sql.startsWith('SELECT') && sql.includes('FROM clientes')) return [clientes.filter(c=>c.id===params[0]).map(c=>({...c}))];
    if (sql.startsWith('SELECT') && sql.includes('FROM prospeccoes')) {
      const rows = sql.includes('WHERE id = ?') ? historico.filter(c=>c.id===params[0] && c.cliente_id===params[1]) : historico.filter(c=>c.cliente_id===params[0]);
      return [rows.map(c=>({...c})).reverse()];
    }
    if(sql.startsWith('INSERT INTO prospeccoes')) {
      const id=historico.length+1;
      historico.push({id,cliente_id:params[0],canal:params[1],estrategia:params[2],variant_id:params[3],mensagem:params[4],resultado:params[5],data_contato:'2026-09-22 12:00:00',data_resposta:null});
      return [{insertId:id}];
    }
    if(sql.startsWith('UPDATE clientes SET status')) {
      const cliente=clientes.find(c=>c.id===params[1]);
      if(sql.includes('ultima_data_contato')) {cliente.status=cliente.nao_contatar?'nao_contatar':cliente.status==='fechado'?'fechado':params[0];cliente.ultima_data_contato='2026-09-22 12:00:00';}
      else if(!cliente.nao_contatar)cliente.status=params[0];
    } else if(sql.startsWith('UPDATE clientes SET nao_contatar')) {
      Object.assign(clientes.find(c=>c.id===params[0]),{nao_contatar:1,status:'nao_contatar'});
    } else if(sql.startsWith('UPDATE prospeccoes')) {
      const c=historico.find(c=>c.id===params[4] && c.cliente_id===params[5]); c.resultado=params[0];
      if(params[1]) c.data_resposta ||= '2026-09-22 12:30:00';
      else if(params[0]==='aguardando_resposta') c.data_resposta=null;
    } else assert.fail('SQL inesperado: '+sql);
    return [{affectedRows:1}];
  }
  pool.execute=execute;
  pool.getConnection=async()=>({
    execute,
    beginTransaction:async()=>{events.push('begin');snapshot=structuredClone({clientes,historico});},
    commit:async()=>events.push('commit'),
    rollback:async()=>{events.push('rollback');({clientes,historico}=snapshot);},
    release:()=>events.push('release')
  });
  const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/clientes';
  const req=(method,path,body)=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const mensagem='  Olá! Mensagem editada.\nVocê & eu 😀  ';
  const body={mensagem,estrategia:'beneficio',variant_id:'beneficio_02'};
  try {
    await t.test('GET não grava; POST captura mensagem, variante e atualiza status/data sem alterar telefone',async()=>{
      const antes=await (await req('GET','/7')).json(); assert.equal(antes.ultima_data_contato,null); assert.equal(historico.length,0);
      assert.equal((await req('POST','/7/contato')).status,400);
      const r=await req('POST','/7/contato',body); assert.equal(r.status,200);
      const c=await r.json(); assert.equal(c.status,'contatado'); assert.ok(c.ultima_data_contato); assert.equal(c.telefone,inicial.telefone); assert.equal(c.observacoes,'Preservar');
      assert.equal(historico.length,1); assert.equal(historico[0].mensagem,mensagem); assert.equal(historico[0].estrategia,'beneficio'); assert.equal(historico[0].variant_id,'beneficio_02');
      assert.equal(historico[0].resultado,'aguardando_resposta'); assert.equal(historico[0].data_resposta,null); assert.equal(historico[0].canal,'whatsapp');
      assert.deepEqual(events,['begin','commit','release']);
    });
    await t.test('validação de mensagem e metadados antes de transação',async()=>{
      const antes=events.length;
      for(const b of [null,[],{}, {...body,mensagem:' '},{...body,mensagem:123},{...body,mensagem:'x'.repeat(10001)}, {...body,estrategia:'automatica'}, {...body,estrategia:'constructor'},{...body,variant_id:'direta_01'},{...body,variant_id:'beneficio_99'}, {...body,confirmar_nao_contatar:'true'}]) {
        assert.equal((await req('POST','/7/contato',b)).status,400);
      }
      assert.equal(events.length,antes);
      for(const id of ['0','-1','abc','4294967296','1%20OR%201=1']) assert.equal((await req('POST','/'+id+'/contato',body)).status,400);
      assert.equal((await req('POST','/999/contato',body)).status,404);
    });
    await t.test('histórico isolado por cliente e mensagem manual sem atribuição inventada',async()=>{
      assert.equal((await req('POST','/8/contato',{mensagem:'Manual'})).status,200);
      const h=await (await req('GET','/8/prospeccoes')).json(); assert.equal(h.length,1); assert.equal(h[0].estrategia,'manual'); assert.equal(h[0].variant_id,null);
      assert.equal((await (await req('GET','/7/prospeccoes')).json()).length,1);
      assert.equal((await req('GET','/999/prospeccoes')).status,404);
      assert.equal((await req('PUT','/8/prospeccoes/1',{resultado:'interessado'})).status,404);
      assert.equal((await req('PUT','/7/prospeccoes/1',{resultado:'qualquer'})).status,400);
    });
    await t.test('respondeu, interessado e não interessado preservam primeira data de resposta e mensagem',async()=>{
      for(const resultado of ['respondeu','interessado','nao_interessado','negociacao','fechado']) {
        assert.equal((await req('PUT','/7/prospeccoes/1',{resultado})).status,200);
        const h=await (await req('GET','/7/prospeccoes')).json();
        assert.equal(clientes[0].status,resultado==='nao_interessado'?'descartado':resultado);
        assert.equal(h[0].resultado,resultado); assert.equal(h[0].data_resposta,'2026-09-22 12:30:00'); assert.equal(h[0].mensagem,mensagem);
      }
      assert.equal((await req('PUT','/7/prospeccoes/1',{resultado:'aguardando_resposta'})).status,200);
      assert.equal(historico[0].data_resposta,null);
    });
    await t.test('não contatar persiste mesmo ao reclassificar histórico e exige confirmação real',async()=>{
      assert.equal((await req('PUT','/7/prospeccoes/1',{resultado:'nao_contatar'})).status,200);
      assert.equal(clientes[0].nao_contatar,1);
      await req('PUT','/7/prospeccoes/1',{resultado:'interessado'});
      assert.equal(clientes[0].nao_contatar,1);
      const total=historico.length;
      assert.equal((await req('POST','/7/contato',body)).status,409);
      assert.equal(historico.length,total);
      assert.equal((await req('POST','/7/contato',{...body,confirmar_nao_contatar:true})).status,200);
      assert.equal(clientes[0].nao_contatar,1);
      assert.equal(historico.length,total+1);
      await req('POST','/8/nao-contatar'); assert.equal(clientes[1].nao_contatar,1);
    });
    await t.test('falha após INSERT reverte histórico e atualização de status; erro sem segredo',async()=>{
      const total=historico.length; events=[];
      falhar='UPDATE clientes SET status';
      const r=await req('POST','/8/contato',{mensagem:'Não persistir',confirmar_nao_contatar:true});
      assert.equal(r.status,503); assert.doesNotMatch(await r.text(),/segredo/);
      assert.equal(historico.length,total); assert.deepEqual(events,['begin','rollback','release']);
      falhar='todos'; assert.equal((await req('GET','/7/prospeccoes')).status,503);
      falhar='';
    });
    await t.test('5.2: oito estratégias são aceitas via HTTP e preservadas no histórico',async()=>{
      for(const estrategia of ['curiosidade','oportunidade','problema_sutil','visualizacao','demonstracao','pergunta','autoridade','direta']) {
        const mensagem='  Texto revisado '+estrategia+'\nAcentos & espaços  ';
        const r=await req('POST','/7/contato',{mensagem,estrategia,variant_id:estrategia+'_01',confirmar_nao_contatar:true});
        assert.equal(r.status,200);const h=historico.at(-1);assert.equal(h.estrategia,estrategia);assert.equal(h.variant_id,estrategia+'_01');assert.equal(h.mensagem,mensagem);
      }
    });
  } finally { pool.execute=originalExecute;pool.getConnection=originalConnection;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pool.end(); }
});

