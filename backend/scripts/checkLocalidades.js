const assert=require('node:assert/strict');
const pool=require('../config/database');
const model=require('../models/clienteModel');
const {validarCliente}=require('../controllers/clienteValidation');
const {validarConsulta}=require('../services/clienteConsulta');
const {lerCsv}=require('../services/csvService');
const {lerExcel}=require('../services/excelService');
const {planilha}=require('../test-support/excelFixtures');
const {inserirSemDuplicados}=require('../models/importacaoModel');
const {planejar,aplicar}=require('./normalizarLocalidades');

async function main(){
  let connection,transaction=false;const original=pool.execute;
  try{
    connection=await pool.getConnection();
    const [[table]]=await connection.execute("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clientes'");
    assert.equal(table.ENGINE,'InnoDB');await connection.beginTransaction();transaction=true;pool.execute=connection.execute.bind(connection);
    const prefix='Teste Geografia '+Date.now(),telefone=String(Date.now());
    const r=validarCliente({nome_empresa:prefix,telefone,estado:'Maranhão',cidade:'Sao Luis',possui_site:0});assert.deepEqual(r.erros,{});
    const created=await model.criar(r.dados);let salvo=await model.buscarPorId(created.id);assert.equal(salvo.estado,'MA');assert.equal(salvo.cidade,'São Luís');
    const editado=validarCliente({...r.dados,estado:'minas gerais',cidade:'belo horizonte'});assert.deepEqual(editado.erros,{});
    await model.atualizar(created.id,editado.dados);salvo=await model.buscarPorId(created.id);assert.equal(salvo.estado,'MG');assert.equal(salvo.cidade,'Belo Horizonte');
    assert.ok(validarCliente({...r.dados,cidade:'Belo Horizonte'}).erros.cidade);
    for(const tipo of ['csv','xlsx','xlsm']){
      const rows=[['nome_empresa','telefone','estado','cidade','possui_site'],[prefix+' importado',String(Number(telefone)+1),'maranhao','sao luis',0],[prefix+' inválido',String(Number(telefone)+2),'MA','Belo Horizonte',0]];
      const analise=tipo==='csv'?lerCsv(Buffer.from(rows.map(r=>r.join(';')).join('\n')),'geo.csv'):lerExcel(planilha({Leads:rows},tipo),'geo.'+tipo);
      assert.equal(analise.invalidos,1);const result=await inserirSemDuplicados(connection,analise.validos);
      assert.equal(result.importados,tipo==='csv'?1:0);assert.equal(result.duplicados,tipo==='csv'?0:1);
    }
    for(const q of [{estado:'maranhao'},{cidade:'Sao Luis'},{estado:'ma',cidade:'Sao Luis'}]){
      const consulta=validarConsulta({...q,search:prefix});assert.deepEqual(consulta.erros,[]);const lista=await model.listarFiltrados(consulta.dados,connection);assert.equal(lista.total,1);assert.equal(lista.clientes[0].cidade,'São Luís');
    }
    await connection.execute('UPDATE clientes SET estado=?,cidade=? WHERE id=?',['ma','Sao Luis',created.id]);
    const antes=await model.buscarPorId(created.id);const plano=planejar([antes]);assert.equal(plano.alteracoes.length,1);await aplicar(connection,plano.alteracoes);
    const depois=await model.buscarPorId(created.id);assert.equal(depois.estado,'MA');assert.equal(depois.cidade,'São Luís');
    assert.equal(depois.updated_at,antes.updated_at);assert.equal(depois.status,antes.status);assert.equal(depois.proximo_contato_em,antes.proximo_contato_em);
    await model.excluir(created.id);assert.equal(await model.buscarPorId(created.id),null);
    console.log('Geografia MySQL: cadastro, edição, CSV/XLSX/XLSM, duplicados, filtros e normalização aprovados.');
  }finally{
    pool.execute=original;
    try{if(transaction){await connection.rollback();console.log('Geografia: rollback concluído; nenhum dado fictício mantido.');}}
    finally{if(connection)connection.release();await pool.end();}
  }
}
main().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
