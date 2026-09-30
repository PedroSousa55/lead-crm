const assert = require('node:assert/strict');
const pool = require('../config/database');
const model = require('../models/clienteModel');
const prospeccoes = require('../models/prospeccaoModel');
const { validarCliente } = require('../controllers/clienteValidation');
const { lerCsv } = require('../services/csvService');
const { lerExcel } = require('../services/excelService');
const { planilha } = require('../test-support/excelFixtures');
const { inserirSemDuplicados } = require('../models/importacaoModel');

async function check() {
  let connection;
  let transaction = false;
  const original = pool.execute;
  try {
    connection = await pool.getConnection();
    const [tables] = await connection.execute(
      'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', ['clientes']
    );
    assert.equal(tables[0]?.ENGINE, 'InnoDB', 'O teste exige InnoDB para reverter as alterações.');
    await connection.beginTransaction();
    transaction = true;
    pool.execute = connection.execute.bind(connection);
    const { dados } = validarCliente({ nome_empresa: "Teste CRUD D'Ávila", telefone: '0000000000' });
    const created = await model.criar(dados);
    const cliente = await model.buscarPorId(created.id);
    assert.equal(cliente.nome_empresa, dados.nome_empresa);
    assert.equal(cliente.status, 'nao_contatado');
    assert.equal(cliente.possui_site, null);
    assert.equal(Object.hasOwn(cliente, 'site'), false);
    const classificado = validarCliente({ ...dados, possui_site: 1, instagram: '@empresa_teste' }).dados;
    assert.equal(await model.atualizar(created.id, classificado), true);
    const perfil = await model.buscarPorId(created.id);
    assert.equal(perfil.possui_site, 1);
    assert.equal(perfil.instagram, 'https://www.instagram.com/empresa_teste/');
    assert.ok(cliente.created_at);
    assert.ok((await model.listarTodos()).some(row => row.id === created.id));
    assert.equal(await model.atualizar(created.id, { ...dados, status: 'interessado' }), true);
    assert.equal(await model.atualizar(created.id, { ...dados, status: 'interessado' }), true);
    const updated = await model.buscarPorId(created.id);
    assert.equal(updated.status, 'interessado');
    assert.equal(updated.created_at, cliente.created_at);
    assert.equal(updated.ultima_data_contato, cliente.ultima_data_contato);
    const mensagemExata = '  Olá, mensagem editada!\nCom acento & espaços.  ';
    const contatoId = await prospeccoes.registrarNaConexao(connection, created.id, {mensagem:mensagemExata, estrategia:'direta', variant_id:'direta_01'});
    let historico = await prospeccoes.listar(created.id, connection);
    assert.equal(historico.length,1);
    assert.equal(historico[0].mensagem,mensagemExata);
    assert.equal(historico[0].resultado,'aguardando_resposta');
    assert.equal(historico[0].variant_id,'direta_01');
    for(const resultado of ['respondeu','interessado','nao_interessado']) {
      await prospeccoes.resultadoNaConexao(connection,created.id,contatoId,resultado);
      historico=await prospeccoes.listar(created.id,connection);
      assert.equal(historico[0].resultado,resultado); assert.ok(historico[0].data_resposta);
    }
    await prospeccoes.resultadoNaConexao(connection,created.id,contatoId,'nao_contatar');
    assert.equal((await model.buscarPorId(created.id)).nao_contatar,1);
    await assert.rejects(prospeccoes.registrarNaConexao(connection,created.id,{mensagem:'nova',estrategia:'manual',variant_id:null}),e=>e.status===409);
    await prospeccoes.resultadoNaConexao(connection,created.id,contatoId,'interessado');
    assert.equal((await model.buscarPorId(created.id)).nao_contatar,1);
    const metricas=await prospeccoes.metricas(connection);
    assert.ok(Number(metricas.totais.respostas)>=1);
    assert.ok(metricas.porVariante.some(v=>v.variant_id==='direta_01'));
    console.log('Histórico, mensagem exata, resultados, bloqueio persistente e métricas validados.');
    const contatado = await model.buscarPorId(created.id);
    assert.equal(contatado.status, 'nao_contatar');
    assert.ok(contatado.ultima_data_contato);
    assert.equal(contatado.telefone, dados.telefone);
    const [[relogio]] = await connection.execute('SELECT CURRENT_TIMESTAMP AS agora');
    assert.ok(Math.abs(new Date(relogio.agora) - new Date(contatado.ultima_data_contato)) < 5000);
    assert.equal(await model.atualizar(created.id, { ...dados, status: 'negociacao', gancho_verificado:'Perfil possui botão de WhatsApp' }), true);
    assert.equal((await model.buscarPorId(created.id)).gancho_verificado,'Perfil possui botão de WhatsApp');
    assert.equal((await model.buscarPorId(created.id)).nao_contatar,1);
    assert.equal((await model.buscarPorId(created.id)).ultima_data_contato, contatado.ultima_data_contato);
    console.log('Status e última data de contato persistidos no MySQL, sem modificar telefone.');
    const telefoneNovo = String(Date.now());
    const telefoneAntigo = String(Number(telefoneNovo) + 1);
    await model.atualizar(created.id, { ...dados, telefone: '(' + telefoneAntigo.slice(0, 2) + ') ' + telefoneAntigo.slice(2) });
    const csv = 'nome_empresa,telefone,possui_site,instagram\nDuplicado antigo,' + telefoneAntigo + ',0,\nNovo CSV,' + telefoneNovo + ',0,@empresa_teste\nDuplicado interno,' + telefoneNovo + ',0,\n,123,0,\nCom site,' + String(Number(telefoneNovo) + 2) + ',1,';
    const analise = lerCsv(Buffer.from(csv), 'teste.csv');
    assert.equal(analise.invalidos, 1);
    assert.equal(analise.descartados, 1);
    assert.ok(analise.ignorados.some(r => r.motivos.includes('Empresa possui site')));
    const importacao = await inserirSemDuplicados(connection, analise.validos);
    assert.equal(importacao.importados, 1);
    const [descartados] = await connection.execute('SELECT id FROM clientes WHERE telefone = ?', [String(Number(telefoneNovo) + 2)]);
    assert.equal(descartados.length, 0);
    assert.equal(importacao.duplicados, 2);
    assert.equal((await model.buscarPorId(created.id)).nome_empresa, dados.nome_empresa);
    assert.equal((await inserirSemDuplicados(connection, analise.validos)).duplicados, 3);
    console.log('CSV e duplicidade validados no MySQL real.');
    const telefoneExcel = String(Number(telefoneNovo) + 3);
    const abas = { Leads: [['Empresa','WhatsApp','Tem site','Instagram'],
      ['Duplicado CSV', telefoneNovo,0,''],['Novo Excel',telefoneExcel,0,'@excel_teste'],
      ['Duplicado Excel',telefoneExcel,0,''],['Com site',String(Number(telefoneNovo)+4),1,''],['',String(Number(telefoneNovo)+5),0,'']],
      Outra: [['Empresa','WhatsApp'],['Não importar esta aba',String(Number(telefoneNovo)+6)]] };
    for (const tipo of ['xlsx','xlsm']) {
      const excel = lerExcel(planilha(abas,tipo,tipo==='xlsm'), 'teste.'+tipo, 'Leads');
      assert.equal(excel.invalidos,1); assert.equal(excel.descartados,1);
      const resultado = await inserirSemDuplicados(connection,excel.validos);
      assert.equal(resultado.importados,tipo==='xlsx'?1:0);
      assert.equal(resultado.duplicados,tipo==='xlsx'?2:3);
    }
    const [excelSalvo] = await connection.execute('SELECT instagram FROM clientes WHERE telefone = ?', [telefoneExcel]);
    assert.equal(excelSalvo[0].instagram,'https://www.instagram.com/excel_teste/');
    const [outraAba] = await connection.execute('SELECT id FROM clientes WHERE telefone = ?', [String(Number(telefoneNovo)+6)]);
    assert.equal(outraAba.length,0);
    console.log('XLSX/XLSM, seleção de aba, descarte e duplicidade entre formatos validados no MySQL real.');
    assert.equal(await model.excluir(created.id), true);
    assert.equal(await model.buscarPorId(created.id), null);
    assert.equal((await prospeccoes.listar(created.id,connection)).length,0);
    assert.equal(await model.excluir(created.id), false);
    console.log('CRUD validado no MySQL.');
  } catch (error) {
    console.error('Falha no teste do CRUD:', error.code || 'Confira o schema e as permissões do usuário.');
    process.exitCode = 1;
  } finally {
    pool.execute = original;
    try {
      if (transaction) {
        await connection.rollback();
        console.log('Transação revertida; nenhum cliente de teste foi mantido.');
      }
    } finally {
      if (connection) connection.release();
      await pool.end();
    }
  }
}
check().catch(() => { console.error('Falha ao finalizar o teste do banco.'); process.exitCode = 1; });
