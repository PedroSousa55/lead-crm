const { test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { zipSync } = require('fflate');
const { lerExcel } = require('../services/excelService');
const { lerCsv } = require('../services/csvService');
const { planilha, header, linhas } = require('../test-support/excelFixtures');
Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_USER: 'test_only', DB_PASSWORD: '', DB_NAME: 'test_only', PORT: '3000' });
const model = require('../models/importacaoModel');
const service = require('../services/importacaoService');
const pool = require('../config/database');
const app = require('../server');
for (const tipo of ['xlsx','xlsm']) {
  test('Excel ' + tipo + ': aba única, aliases, validação compartilhada, Instagram e duplicados', async () => {
    const buffer = planilha({ Leads: linhas }, tipo, tipo === 'xlsm');
    const original = Buffer.from(buffer);
    const result = lerExcel(buffer, 'leads.' + tipo);
    assert.deepEqual(buffer, original);
    assert.equal(result.aba, 'Leads');
    assert.equal(result.processados, 5);
    assert.equal(result.invalidos, 1);
    assert.equal(result.descartados, 1);
    assert.equal(result.validos[0].dados.telefone, '31997150594');
    assert.equal(result.validos[0].dados.instagram, 'https://www.instagram.com/academiateste/');
    assert.equal(result.validos[2].dados.instagram, 'https://www.instagram.com/clinicateste/');
    const csv = lerCsv(Buffer.from(linhas.map(r => r.join(';')).join('\n')), 'leads.csv');
    for (const campo of ['validos','ignorados','previa','processados']) assert.deepEqual(result[campo], csv[campo]);
    const inseridos = [];
    const outcome = await model.inserirSemDuplicados({ execute: async (sql, params) => {
      if (sql.startsWith('SELECT')) return [[{ telefone: '(31) 99715-0597' }]];
      inseridos.push(params); return [{insertId: 1}];
    } }, result.validos);
    assert.equal(outcome.importados, 1);
    assert.equal(outcome.duplicados, 2);
    assert.equal(inseridos.length, 1);
  });
}
test('Excel: múltiplas abas exigem escolha e nunca são combinadas', async () => {
  const buffer = planilha({ Instruções: [['Texto']], Leads: linhas, Outros: [header, ['Estética B','31997150598']] });
  const r = lerExcel(buffer, 'leads.xlsx');
  assert.equal(r.requerAba, true);
  assert.equal(r.abas.length, 3);
  assert.equal(r.abas[0].valida, false);
  assert.equal(lerExcel(buffer, 'leads.xlsx', 'Outros').processados, 1);
  assert.throws(() => lerExcel(buffer, 'leads.xlsx', 'Instruções'), /aba válida/);
  assert.throws(() => lerExcel(buffer, 'leads.xlsx', ['Leads']), /aba válida/);
  await assert.rejects(service.importar(buffer, 'leads.xlsx'), /Escolha uma aba/);
  assert.equal(lerExcel(planilha({ Vazia: [], Leads: linhas }), 'leads.xlsx').aba, 'Leads');
});
test('Excel: fórmulas não são executadas nem importadas, linhas vazias mantêm numeração', () => {
  const buffer = planilha({ Leads: [header, [], ['Boa','31997150594'], ['Fórmula', {t:'n',f:'123+456',v:31997150595}], ['Erro',{t:'e',v:7}]] });
  const r = lerExcel(buffer, 'leads.xlsx');
  assert.equal(r.processados, 3);
  assert.equal(r.validos[0].linha, 3);
  assert.equal(r.invalidos, 2);
  assert.match(r.ignorados[0].motivos[0], /fórmula/);
});
test('Excel: cabeçalhos equivalentes e rejeição de colunas ambíguas, site e cabeçalho ausente', () => {
  for (const cab of [['Empresa','Telefone','WhatsApp'], ['Empresa','WhatsApp','site'], ['Empresa']]) {
    assert.throws(() => lerExcel(planilha({Leads: [cab, ['A','31997150594','0']]}), 'a.xlsx'), /aba válida/);
  }
  const r = lerCsv(Buffer.from(' EMPRESA ; WhatsApp ; POSSUI SITE ; OBSERVAÇÕES\nA;31997150594;não;nota'), 'a.csv');
  assert.equal(r.validos[0].dados.observacoes, 'nota');
});
test('Excel: assinatura, corrupção e limites de tamanho, linhas e pacote ZIP', () => {
  for (const buf of [Buffer.from('nome_empresa,telefone\nA,31997150594'), Buffer.from('PK'), Buffer.from('PK123456')]) {
    assert.throws(() => lerExcel(buf, 'a.xlsx'), /Excel inválido/);
  }
  assert.throws(() => lerExcel(Buffer.alloc(5*1024*1024+1), 'a.xlsm'), /5 MB/);
  assert.throws(() => lerExcel(planilha({Leads: [header, ...Array.from({length:1001},()=>['A','31997150594'])]}), 'a.xlsx'), /1.000/);
  const zip = Buffer.from(zipSync({'[Content_Types].xml': new Uint8Array(21*1024*1024), 'xl/workbook.xml':new Uint8Array(1)}));
  assert.throws(() => lerExcel(zip, 'a.xlsx'), /20 MB/);
});
test('Excel HTTP: listar abas, prévia, importar apenas a escolhida, erros e MIME', async () => {
  const original = model.importar;
  let dados;
  model.importar = async registros => { dados = registros; return {importados:registros.length,duplicados:0,ignorados:[]}; };
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/clientes/importacao';
  const body = planilha({Leads:linhas, Outra:[header,['Outra','31997150599']]},'xlsm',true);
  const enviar = (path, payload=body) => fetch(base+path,{method:'POST',headers:{'Content-Type':'application/vnd.ms-excel.sheet.macroEnabled.12','X-CSV-Name':'leads.xlsm'},body:payload});
  try {
    let r = await enviar('/previa'); assert.equal(r.status,200); assert.equal((await r.json()).requerAba,true); assert.equal(dados,undefined);
    r = await enviar('/previa?aba=Outra'); assert.equal((await r.json()).processados,1); assert.equal(dados,undefined);
    r = await enviar(''); assert.equal(r.status,400); assert.equal(dados,undefined);
    r = await enviar('?aba=Outra'); assert.equal(r.status,200); assert.equal((await r.json()).importados,1); assert.equal(dados[0].dados.nome_empresa,'Outra');
    r = await enviar('/previa?aba=inexistente'); assert.equal(r.status,400);
    r = await enviar('/previa',Buffer.from('csv renomeado')); assert.equal(r.status,400);
    r = await enviar('/previa',Buffer.alloc(5*1024*1024+1)); assert.equal(r.status,413);
  } finally { model.importar=original; server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); await pool.end(); }
});

test('Gancho: CSV/XLSX/XLSM compartilham campo opcional, alias e limite',()=>{
  const rows=[['Empresa','WhatsApp','Gancho verificado'],['A','31997150594','Perfil possui botão de WhatsApp'],['B','31997150595',''],['C','31997150596','a'.repeat(1001)]];
  for(const tipo of ['csv','xlsx','xlsm']) {
    const r=tipo==='csv'?lerCsv(Buffer.from(rows.map(r=>r.join(';')).join('\n')),'a.csv'):lerExcel(planilha({Leads:rows},tipo),'a.'+tipo);
    assert.equal(r.validos[0].dados.gancho_verificado,rows[1][2]);assert.equal(r.validos[1].dados.gancho_verificado,null);assert.equal(r.invalidos,1);
    assert.match(r.ignorados[0].motivos[0],/gancho_verificado/);
  }
});
