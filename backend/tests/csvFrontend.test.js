const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function tela() {
  const nodes = new Map();
  function element() {
    return { children: [], listeners: {}, textContent: '', value: '', hidden: false, disabled: false, files: [],
      append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; },
      addEventListener(name, handler) { this.listeners[name] = handler; } };
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const state = { calls: [], refresh: 0, fail: false, refreshFail: false, delayed: null, excel: false, single: false };
  const preview = { processados: 3, validos: 1, invalidos: 1, descartados: 1,
    previa: [{ linha: 2, dados: { nome_empresa: '<script>não executar</script>', telefone: '31997150594', possui_site: 0 }, motivos: [] }] };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../frontend/csv.js'), 'utf8'), {
    document: { getElementById: get, createElement: element },
    API_BASE_URL: '', ocupado: false, AbortController, AbortSignal,
    executar: async action => action(),
    carregarClientes: async () => { state.refresh++; if (state.refreshFail) throw new Error('offline'); },
    fetch: async (url, opts) => {
      state.calls.push({ url, opts });
      if (state.delayed) await state.delayed;
      if (state.fail) return { ok: false, json: async () => ({ erro: 'Arquivo inválido.' }) };
      const ehPrevia = url.includes('/previa');
      const aba = new URL(url, 'http://localhost').searchParams.get('aba');
      const excel = state.excel ? {abas:[{nome:'Leads',valida:true,registros:3},{nome:'Outra aba',valida:true,registros:3}],aba:aba || (state.single ? 'Leads' : null),requerAba:!aba && !state.single} : {};
      return { ok: true, json: async () => ehPrevia ? {...preview,...excel} : {
        processados: 3, importados: 1, duplicados: 0, invalidos: 1, descartados: 1,
        ignorados: [{ linha: 3, tipo: 'invalido', motivos: ['nome_empresa: Este campo é obrigatório.'] }, { linha: 4, tipo: 'descartado', motivos: ['Empresa possui site'] }],
      } };
    },
  });
  return { state, get, escolher: async (name = 'teste.csv', size = 100) => {
    get('csv-arquivo').files = [{ name, size }];
    await get('csv-arquivo').listeners.change();
  } };
}
test('CSV frontend: prévia segura, confirmação, totais e atualização da lista', async () => {
  const ui = tela();
  await ui.escolher();
  assert.equal(ui.state.calls.length, 1);
  assert.equal(ui.state.calls[0].url, '/api/clientes/importacao/previa');
  assert.equal(ui.state.calls[0].opts.headers['X-CSV-Name'], 'teste.csv');
  assert.match(ui.get('csv-resumo').textContent, /teste.csv.*3 registro/);
  assert.equal(ui.get('csv-registros').children[0].children[1].textContent, '<script>não executar</script>');
  await ui.get('csv-importar').listeners.click();
  assert.equal(ui.state.calls[1].url, '/api/clientes/importacao');
  assert.equal(ui.get('csv-resultado').hidden, false);
  assert.match(ui.get('csv-totais').textContent, /Processados: 3\nImportados: 1\nDuplicados: 0\nInválidos: 1\nIgnorados \(possui site\): 1/);
  assert.match(ui.get('csv-ignorados').children[0].textContent, /Linha 3/);
  assert.match(ui.get('csv-ignorados').children[1].textContent, /Ignorado: Empresa possui site/);
  assert.equal(ui.state.refresh, 1);
  await ui.get('csv-importar').listeners.click();
  assert.equal(ui.state.calls.length, 2);
});
test('CSV frontend: cancelamento, resposta atrasada e limites locais', async () => {
  const ui = tela();
  await ui.escolher('arquivo.exe');
  await ui.escolher('arquivo.csv', 1024 * 1024 + 1);
  assert.equal(ui.state.calls.length, 0);
  let release;
  ui.state.delayed = new Promise(resolve => { release = resolve; });
  const pending = ui.escolher();
  ui.get('csv-cancelar').listeners.click();
  release();
  await pending;
  assert.equal(ui.get('csv-previa').hidden, true);
  await ui.get('csv-importar').listeners.click();
  assert.equal(ui.state.calls.length, 1);
});
test('CSV frontend: erros da API e falha de atualização após sucesso', async () => {
  const ui = tela();
  ui.state.fail = true;
  await ui.escolher();
  assert.match(ui.get('csv-mensagem').textContent, /Arquivo inválido/);
  ui.state.fail = false;
  await ui.escolher();
  ui.state.refreshFail = true;
  await ui.get('csv-importar').listeners.click();
  assert.match(ui.get('csv-mensagem').textContent, /Importação concluída.*não pôde ser atualizada/);
  assert.equal(ui.get('csv-arquivo').disabled, false);
});

test('Excel frontend: escolha de aba, prévia e confirmação enviam o mesmo arquivo/aba', async () => {
  const ui=tela(); ui.state.excel=true;
  await ui.escolher('leads.xlsm');
  assert.equal(ui.get('csv-aba-campo').hidden,false);
  assert.equal(ui.get('csv-previa').hidden,true);
  assert.match(ui.state.calls[0].opts.headers['Content-Type'],/macroEnabled/);
  await ui.get('csv-importar').listeners.click(); assert.equal(ui.state.calls.length,1);
  ui.get('csv-aba').value='Outra aba'; await ui.get('csv-aba').listeners.change();
  assert.equal(ui.get('csv-previa').hidden,false);
  assert.match(ui.get('csv-resumo').textContent,/Outra aba/);
  await ui.get('csv-importar').listeners.click();
  assert.equal(ui.state.calls[1].url,'/api/clientes/importacao/previa?aba=Outra%20aba');
  assert.equal(ui.state.calls[2].url,'/api/clientes/importacao?aba=Outra%20aba');
  assert.equal(ui.state.calls[1].opts.body,ui.state.calls[2].opts.body);
  assert.equal(ui.state.refresh,1);
});
test('Excel frontend: aba única, cancelar e mudança de aba invalidam a confirmação anterior', async () => {
  const ui=tela(); ui.state.excel=true; ui.state.single=true;
  await ui.escolher('leads.xlsx'); assert.equal(ui.get('csv-previa').hidden,false);
  assert.match(ui.state.calls[0].opts.headers['Content-Type'],/spreadsheetml/);
  let release; ui.state.delayed=new Promise(resolve=>{release=resolve;});
  ui.get('csv-aba').value='Outra aba'; const pending=ui.get('csv-aba').listeners.change();
  await ui.get('csv-importar').listeners.click(); assert.equal(ui.state.calls.length,2);
  ui.get('csv-cancelar').listeners.click(); release(); await pending;
  assert.equal(ui.get('csv-previa').hidden,true); assert.equal(ui.get('csv-aba-campo').hidden,true);
  await ui.get('csv-importar').listeners.click(); assert.equal(ui.state.calls.length,2);
});
