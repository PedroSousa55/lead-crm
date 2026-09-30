const assert=require('node:assert/strict');const pool=require('../config/database');const model=require('../models/dadosModel');
const service=require('../services/backupService');const v=require('../services/backupValidation');const {dados}=require('../test-support/backupFixtures');
const {validarConsulta}=require('../services/clienteConsulta');const exp=require('../services/exportacaoService');
async function main(){
 let c,transacao=false;
 try{
  c=await pool.getConnection();const site=await model.estrutura(c);const antesReal=await model.lerDados(c,site);const hashAntes=v.hash(antesReal);
  // Tabelas TEMPORARY desta conexão ocultam as reais. DELETE/INSERT nunca atingem os dados do usuário.
  await require('../test-support/tabelasBackupTemporarias').criar(c);
  await c.beginTransaction();transacao=true;
  const fixtures=dados();if(site)fixtures.clientes[0].site='https://legado.example';
  for(let i=8;i<=107;i++)fixtures.clientes.push({...fixtures.clientes[0],id:i,nome_empresa:'Teste backup '+i});
  const b=v.criar(fixtures,site);await model.substituir(c,b,site);
  const snapshot=v.criar(await model.lerDados(c,site),site);assert.deepEqual(v.ler(v.serializar(snapshot)),snapshot);
  await c.execute('UPDATE clientes SET nome_empresa = ? WHERE id = ?',['MODIFICADO',7]);
  const alterado=v.criar(await model.lerDados(c,site),site);
  await service.restaurarNaConexao(c,snapshot,service.assinatura(alterado));assert.deepEqual(await model.lerDados(c,site),snapshot.dados);
  const [novo]=await c.execute('INSERT INTO clientes (nome_empresa) VALUES (?)',['Novo após restauração']);assert.ok(novo.insertId>107);
  const [contato]=await c.execute('INSERT INTO prospeccoes (cliente_id,estrategia,mensagem) VALUES (?,?,?)',[novo.insertId,'manual','Teste']);assert.ok(contato.insertId>9);
  const atual=v.criar(await model.lerDados(c,site),site);
  await assert.rejects(service.restaurarNaConexao(c,snapshot,'assinatura_antiga'),/mudaram/);assert.deepEqual(await model.lerDados(c,site),atual.dados);
  await c.query('SAVEPOINT antes_falha');const execute=c.execute.bind(c);let insercoes=0;
  const falhando={execute:async(sql,params)=>{if(sql.startsWith('INSERT INTO clientes')&&++insercoes===2)return execute('INSERT INTO clientes (id,nome_empresa) VALUES (?,?)',[7,'ID duplicado']);return execute(sql,params)}};
  await assert.rejects(service.restaurarNaConexao(falhando,snapshot,service.assinatura(atual)),e=>e.code==='ER_DUP_ENTRY');
  await c.query('ROLLBACK TO SAVEPOINT antes_falha');assert.deepEqual(await model.lerDados(c,site),atual.dados);
  const consulta=validarConsulta({estado:'MA',cidade:'São Luís',page:'2',limit:'25'}).dados;
  const rows=await model.exportarClientes(c,consulta);assert.equal(rows.length,101);
  for(const formato of ['csv','xlsx']){assert.ok(exp.gerar('clientes',rows,formato).buffer.length);assert.ok(exp.gerar('prospeccoes',await model.exportarHistorico(c),formato).buffer.length);}
  await c.rollback();transacao=false;
  await c.execute('DROP TEMPORARY TABLE prospeccoes');await c.execute('DROP TEMPORARY TABLE clientes');await c.execute('DROP TEMPORARY TABLE configuracoes');
  assert.equal(v.hash(await model.lerDados(c,site)),hashAntes);
  console.log('Backup MySQL: round-trip, IDs, datas, relacionamentos, site legado, AUTO_INCREMENT, exportação de 101 filtrados, falha SQL e rollback aprovados. Dados reais intactos.');
 }finally{
  if(c){try{if(transacao)await c.rollback();}finally{c.destroy();}}await pool.end();
 }
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
