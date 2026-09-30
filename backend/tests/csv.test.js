const { test } = require('node:test');
const assert = require('node:assert/strict');
const { lerCsv } = require('../services/csvService');
Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_USER: 'test_only', DB_PASSWORD: '', DB_NAME: 'test_only', PORT: '3000' });
const pool = require('../config/database');
const model = require('../models/importacaoModel');
const app = require('../server');
const header = 'nome_empresa,telefone,possui_site,instagram,status';
const arquivo = header + '\nEmpresa A,(31) 99715-0594,nao,,\nEmpresa B,31997150595,0,@empresa_b,interessado';
const parse = text => lerCsv(Buffer.from(text), 'clientes.csv');

test('CSV: múltiplos registros, telefone, classificação e status padrão', () => {
  const result = parse(arquivo);
  assert.equal(result.processados, 2);
  assert.equal(result.validos[0].dados.telefone, '31997150594');
  assert.equal(result.validos[0].dados.possui_site, 0);
  assert.equal(Object.hasOwn(result.validos[0].dados, 'site'), false);
  assert.equal(result.validos[0].dados.status, 'nao_contatado');
  assert.equal(result.validos[1].dados.instagram, 'https://www.instagram.com/empresa_b/');
  assert.equal(result.validos[1].dados.possui_site, 0);
});
test('CSV: BOM, ponto e vírgula, aspas, linhas múltiplas e Instagram', () => {
  const result = parse('\uFEFFnome_empresa;telefone;instagram;observacoes\r\n"Empresa; A";+55 (31) 99715-0594;https://www.instagram.com/empresa/;"uma linha\nsegunda ""linha"""\r\n');
  assert.equal(result.validos[0].dados.nome_empresa, 'Empresa; A');
  assert.equal(result.validos[0].dados.telefone, '5531997150594');
  assert.equal(result.validos[0].dados.possui_site, null);
  assert.equal(result.validos[0].dados.instagram, 'https://www.instagram.com/empresa/');
  assert.equal(result.validos[0].dados.observacoes, 'uma linha\nsegunda "linha"');
  assert.equal(result.validos[0].linha, 3);
});
test('CSV: mistura de linhas válidas, campos faltantes e dados inválidos', () => {
  const result = parse(header + '\nBoa,31997150594,0,Não tem,\n,31997150595,0,,\nSem telefone,,0,,\nCurto,123,0,,\nStatus,31997150596,0,,errado\nSite,31997150597,talvez,,\nURL,31997150598,1,Sem site,\nColunas,31997150599\nRepetido,11111111111,0,,');
  assert.equal(result.processados, 9);
  assert.equal(result.validos.length, 1);
  assert.equal(result.ignorados.length, 8);
  assert.equal(result.invalidos, 7);
  assert.equal(result.descartados, 1);
  assert.equal(Object.hasOwn(result.validos[0].dados, 'site'), false);
  assert.deepEqual(result.ignorados.map(r => r.linha), [3,4,5,6,7,8,9,10]);
});
test('CSV: cabeçalhos, conteúdo binário, codificação, extensão, tamanho e estrutura', () => {
  for (const text of ['', 'a,b\nx,y', 'nome_empresa,telefone,telefone\nx,1,2', 'nome_empresa,telefone,extra\nx,1,2',
    'nome_empresa,telefone\n"aspas sem fim,123', 'nome_empresa,telefone\nEmpresa,123\u0000', 'nome_empresa,telefone\n']) {
    assert.throws(() => parse(text));
  }
  assert.throws(() => lerCsv(Buffer.from(arquivo), 'arquivo.exe'));
  assert.throws(() => lerCsv(Buffer.from([0xff,0xfe]), 'arquivo.csv'), /UTF-8/);
  assert.throws(() => lerCsv(Buffer.alloc(1024 * 1024 + 1), 'arquivo.csv'), /1 MB/);
  assert.throws(() => parse('nome_empresa,telefone\n' + 'Empresa,31997150594\n'.repeat(1001)), /1.000/);
});
test('Modelo: ignora telefone antigo formatado e duplicados dentro do lote', async () => {
  const inserts = [];
  const connection = { execute: async (sql, params) => {
    if (sql.startsWith('SELECT')) return [[{ telefone: '(31) 99715-0594' }]];
    assert.equal((sql.match(/\?/g) || []).length, params.length);
    inserts.push(params);
    return [{ insertId: 123 }];
  } };
  const analise = parse(arquivo + '\nEmpresa B repetida,31997150595,0,,');
  const result = await model.inserirSemDuplicados(connection, analise.validos);
  assert.equal(result.importados, 1);
  assert.equal(result.duplicados, 2);
  assert.deepEqual(result.ignorados.map(r => r.linha), [2,4]);
  assert.equal(inserts.length, 1);
});

test('CSV: descarta Sim/1 sem reservar telefone; normaliza Instagram e rejeita coluna site', () => {
  const r = parse(header + '\nCom site,31997150594,sim,@descartar,\nSem site,31997150594,0,@importar,\nOutro com site,,1,,\nNão informado,31997150595,,https://www.instagram.com/existente/,');
  assert.equal(r.descartados, 2);
  assert.equal(r.invalidos, 0);
  assert.equal(r.validos.length, 2);
  assert.equal(r.validos[0].dados.instagram, 'https://www.instagram.com/importar/');
  assert.equal(r.validos[1].dados.instagram, 'https://www.instagram.com/existente/');
  assert.ok(r.ignorados.every(row => row.tipo === 'descartado' && row.motivos[0] === 'Empresa possui site'));
  assert.equal(r.previa[0].motivos[0], 'Empresa possui site');
  assert.throws(() => parse('nome_empresa,telefone,site\nEmpresa,31997150594,https://example.com'), /cabeçalho/);
});

test('HTTP: prévia não grava; importação valida, conta e rejeita arquivos indevidos', async () => {
  const original = model.importar;
  let chamadas = 0;
  model.importar = async registros => {
    chamadas++;
    return model.inserirSemDuplicados({ execute: async (sql) => sql.startsWith('SELECT')
      ? [[{ telefone: '(31) 99715-0594' }]] : [{ insertId: 9 }] }, registros);
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/clientes/importacao';
  const enviar = (path, body = arquivo, headers = {}) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'text/csv', 'X-CSV-Name': 'clientes.csv', ...headers }, body,
  });
  try {
    let r = await enviar('/previa');
    assert.equal(r.status, 200);
    assert.equal((await r.json()).processados, 2);
    assert.equal(chamadas, 0);
    r = await enviar('', arquivo + '\n,31997150596,0,,\nCom site,31997150597,1,@descartar,');
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.processados, 4);
    assert.equal(result.importados, 1);
    assert.equal(result.duplicados, 1);
    assert.equal(result.invalidos, 1);
    assert.equal(result.descartados, 1);
    assert.equal(result.ignorados[2].motivos[0], 'Empresa possui site');
    assert.deepEqual(result.ignorados.map(r => r.linha), [2,4,5]);
    assert.equal(chamadas, 1);
    assert.equal((await enviar('', arquivo, { 'Content-Type': 'application/octet-stream' })).status, 415);
    assert.equal((await enviar('', arquivo, { 'X-CSV-Name': 'falso.xlsx' })).status, 400);
    assert.equal((await enviar('', 'não é csv')).status, 400);
    assert.equal((await enviar('', 'x'.repeat(1024 * 1024 + 1))).status, 413);
    model.importar = async () => { throw new Error('segredo'); };
    r = await enviar('');
    assert.equal(r.status, 503);
    assert.doesNotMatch(await r.text(), /segredo/);
  } finally {
    model.importar = original;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});

test('Importação: rollback em falha e liberação do lock/conexão', async () => {
  const original = pool.getConnection;
  const events = [];
  pool.getConnection = async () => ({
    execute: async sql => {
      if (sql.includes('GET_LOCK')) return [[{ adquirido: 1 }]];
      if (sql.includes('RELEASE_LOCK')) { events.push('unlock'); return [[]]; }
      if (sql.startsWith('SELECT telefone')) return [[]];
      throw new Error('falha insert');
    },
    query: async () => {}, beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'), rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
  });
  try {
    await assert.rejects(model.importar(parse(arquivo).validos), /falha insert/);
    assert.deepEqual(events, ['begin', 'rollback', 'unlock', 'release']);
  } finally { pool.getConnection = original; }
});
