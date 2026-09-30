const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const instagramSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/instagram.js'), 'utf8');
const modulesSource = ['data/municipios.js','localidades.js','seletorLocalidades.js','datas.js','configuracaoPadrao.js','mensagemTemplates.js','geradorMensagens.js','whatsapp.js','prospeccao.js','pipeline.js','interface.js','script.js'].map(file => fs.readFileSync(path.resolve(__dirname, '../../frontend', file), 'utf8')).join('\n');
const source = instagramSource + '\n' + modulesSource;

async function tela() {
  const nodes = new Map();
  function element() {
    return { children: [], listeners: {}, textContent: '', value: '', disabled: false, hidden: false,
      append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; },
      setCustomValidity(text) {this.validationMessage=text;}, addEventListener(name, handler) { this.listeners[name] = handler; }, scrollIntoView() {}, showModal() { this.open = true; } };
  }
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const names = ['nome_empresa', 'telefone', 'nicho', 'cidade', 'estado', 'instagram', 'possui_site', 'status', 'observacoes', 'gancho_verificado', 'proximo_contato_em', 'proxima_acao'];
  const fields = Object.fromEntries(names.map(n => [n, element()]));
  const form = get('formulario');
  form.elements = { namedItem: n => fields[n] };
  form.reset = () => { names.forEach(n => { fields[n].value = n === 'status' ? 'nao_contatado' : n === 'possui_site' ? '0' : ''; }); };
  form.reportValidity = () => true;
  form.reset();
  const state = { rows: [], calls: [], confirm: true, fail: false, failList: false, validation: false, opened: [], history: [] };
  const context = vm.createContext({
    URL, URLSearchParams, AbortSignal, document: { getElementById: get, createElement: element, querySelectorAll: () => [] },
    window: { confirm: () => state.confirm, open: (...args) => state.opened.push(args) },
    FormData: class { constructor() { return Object.entries(fields).map(([k,v]) => [k,v.value]); } },
    fetch: async (url, opts) => {
      state.calls.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
      if (state.fail || (state.failList && !opts.method)) throw new Error('offline');
      const id = Number(url.split('/')[3]);
      const method = opts.method || 'GET';
      const body = opts.body ? JSON.parse(opts.body) : null;
      let data;
      if (url.endsWith('/nao-contatar')) {
        data = {...state.rows.find(c=>c.id===id),nao_contatar:1}; state.rows=state.rows.map(c=>c.id===id?data:c);
      } else if (url.includes('/prospeccoes/') && method === 'PUT') {
        const contato=state.history.find(c=>c.id===Number(url.split('/').at(-1)) && c.cliente_id===id);
        contato.resultado=body.resultado;
        if (['respondeu','interessado','nao_interessado'].includes(body.resultado)) contato.data_resposta ||= '2026-09-22 15:30:00';
        if(body.resultado==='aguardando_resposta') contato.data_resposta=null;
        data=state.rows.find(c=>c.id===id);
        if(body.resultado==='nao_contatar') data.nao_contatar=1;
      } else if (url.endsWith('/prospeccoes')) {
        data=state.history.filter(c=>c.cliente_id===id).slice().reverse();
      } else if (url.endsWith('/contato') && method === 'POST') {
        state.history.push({id:state.history.length+1,cliente_id:id,...body,canal:'whatsapp',resultado:'aguardando_resposta',data_contato:'2026-09-22 15:00:00',data_resposta:null});
        if (state.fail) throw new Error('offline');
        data = { ...state.rows.find(c => c.id === id), status: 'contatado', ultima_data_contato: '2026-09-21 15:30:00' };
        state.rows = state.rows.map(c => c.id === id ? data : c);
      } else if(url.includes('?')) {
        const q=new URLSearchParams(url.split('?')[1]);const limit=Number(q.get('limit')||25), page=Number(q.get('page')||1);
        data={clientes:state.rows.slice((page-1)*limit,page*limit),total:state.rows.length,page,limit,pipeline:{},indicadores:{total:state.rows.length},opcoes:state.rows,agora:'2026-09-22 15:30:00'};
      } else if(url.endsWith('/followup')) {
        data=state.rows.find(c=>c.id===id);Object.assign(data,body);
      } else if (method === 'POST' || method === 'PUT') {
        if (state.validation) return { status: 400, ok: false, json: async () => ({ erro: 'Revise os campos.', campos: { telefone: 'Este campo é obrigatório.' } }) };
        data = { ...body, id: id || 1 };
        state.rows = [data];
      } else if (method === 'DELETE') { state.rows = []; return { status: 204, ok: true }; }
      else data = id ? state.rows.find(c => c.id === id) : state.rows;
      return { status: 200, ok: true, json: async () => data };
    },
  });
  await vm.runInContext(source, context);
  await vm.runInContext('inicializacao', context);
  return { get, fields, state, run: code => vm.runInContext(code, context),
    submit: () => form.listeners.submit({ preventDefault() {} }) };
}

test('Geografia frontend: seleção dependente, busca e mudança de UF',async()=>{
  const ui=await tela(),{estado,cidade}=ui.fields,busca=ui.get('cliente-cidade-busca');
  assert.equal(cidade.disabled,true);assert.equal(busca.disabled,true);
  assert.equal(cidade.children[0].textContent,'Selecione primeiro o estado');assert.equal(estado.children.length,28);
  assert.ok(estado.children.some(o=>o.value==='MA'&&o.textContent==='Maranhão (MA)'));
  estado.value='MA';estado.listeners.change();assert.equal(cidade.disabled,false);
  assert.ok(cidade.children.some(o=>o.value==='São Luís'));assert.ok(!cidade.children.some(o=>o.value==='Belo Horizonte'));
  busca.value='sao luis';busca.listeners.input();assert.equal(cidade.children.length,3);
  cidade.value='São Luís';cidade.listeners.change();
  estado.value='SP';estado.listeners.change();assert.equal(cidade.value,'');assert.equal(busca.value,'');assert.ok(!cidade.children.some(o=>o.value==='São Luís'));
  estado.value='';estado.listeners.change();assert.equal(cidade.disabled,true);
});
test('Geografia frontend: edição restaura e dados antigos não identificados exigem revisão',async()=>{
  const ui=await tela();ui.state.rows=[{id:1,nome_empresa:'Empresa',telefone:'31999999999',estado:'maranhao',cidade:'Sao Luis'}];
  await ui.run('editar(1)');assert.equal(ui.fields.estado.value,'MA');assert.equal(ui.fields.cidade.value,'São Luís');
  ui.state.rows[0].cidade='Belo Horizonte';await ui.run('editar(1)');
  assert.match(ui.get('cliente-localidade-aviso').textContent,/precisa de revisão/);assert.ok(ui.fields.estado.validationMessage);
  assert.equal(ui.state.rows[0].cidade,'Belo Horizonte');
  ui.fields.cidade.value='São Luís';ui.fields.cidade.listeners.change();assert.equal(ui.fields.estado.validationMessage,'');
});
test('Geografia frontend: filtros usam todas as UFs e limpam cidade ao trocar estado',async()=>{
  const ui=await tela();ui.state.rows=[{id:1,estado:'MA',cidade:'São Luís',nome_empresa:'A'}];await ui.run('carregarClientes()');
  const estado=ui.get('filtro-estado'),cidade=ui.get('filtro-cidade');assert.equal(estado.children.length,28);assert.equal(cidade.children.length,2);
  estado.value='CE';await estado.listeners.change();assert.ok(cidade.children.some(o=>o.value==='Fortaleza'));assert.ok(!cidade.children.some(o=>o.value==='São Luís'));
  cidade.value='Fortaleza';await cidade.listeners.change();assert.match(ui.state.calls.at(-1).url,/estado=CE&cidade=Fortaleza/);
  estado.value='MA';await estado.listeners.change();assert.equal(cidade.value,'');assert.ok(!ui.state.calls.at(-1).url.includes('cidade='));
});

test('Frontend: cadastro, visualização, edição/status e confirmação da exclusão', async () => {
  const ui = await tela();
  assert.match(ui.get('situacao-lista').textContent, /Nenhum lead cadastrado/);
  ui.fields.nome_empresa.value = '<script>texto seguro</script>';
  ui.fields.telefone.value = '85999999999';
  await ui.submit();
  assert.match(ui.get('mensagem').textContent, /cadastrado com sucesso/);
  assert.equal(ui.get('clientes').children.length, 1);
  assert.equal(ui.get('clientes').children[0].children[0].textContent, '<script>texto seguro</script>');
  assert.equal(ui.state.calls.at(-1).method, 'GET');
  await ui.run('executar(() => visualizar(1))');
  assert.equal(ui.get('detalhes').open, true);
  assert.equal(ui.get('dados-cliente').children[1].textContent, '<script>texto seguro</script>');
  await ui.run('executar(() => editar(1))');
  assert.equal(ui.fields.telefone.value, '85999999999');
  ui.fields.status.value = 'interessado';
  await ui.submit();
  assert.match(ui.get('mensagem').textContent, /atualizado com sucesso/);
  assert.ok(ui.state.calls.some(c => c.method === 'PUT'));
  assert.match(ui.get('clientes').children[0].children[1].children.at(-1).textContent, /Interessado/);
  ui.state.confirm = false;
  await ui.run('executar(() => excluir({ id: 1, nome_empresa: "Teste" }))');
  assert.equal(ui.state.calls.some(c => c.method === 'DELETE'), false);
  ui.state.confirm = true;
  await ui.run('executar(() => excluir({ id: 1, nome_empresa: "Teste" }))');
  assert.match(ui.get('mensagem').textContent, /excluído com sucesso/);
  assert.match(ui.get('situacao-lista').textContent, /Nenhum lead cadastrado/);
  assert.equal(ui.get('clientes').children.length, 0);
});

test('Frontend: erros preservam formulário e diferenciam salvamento de falha na listagem', async () => {
  const ui = await tela();
  ui.fields.nome_empresa.value = 'Empresa';
  ui.state.validation = true;
  await ui.submit();
  assert.match(ui.get('mensagem').textContent, /Telefone: Este campo é obrigatório/);
  assert.equal(ui.fields.nome_empresa.value, 'Empresa');
  ui.state.validation = false;
  ui.state.fail = true;
  await ui.submit();
  assert.match(ui.get('mensagem').textContent, /Não foi possível acessar a API/);
  assert.equal(ui.fields.nome_empresa.value, 'Empresa');
  assert.equal(ui.get('campos').disabled, false);
  ui.state.fail = false;
  ui.state.failList = true;
  await ui.submit();
  assert.match(ui.get('mensagem').textContent, /cadastrado com sucesso.*lista não pôde ser atualizada/);
});

test('Frontend: classificação sem campo de URL', async () => {
  const ui = await tela();
  ui.fields.nome_empresa.value = 'Empresa';
  ui.fields.telefone.value = '85999999999';
  ui.fields.possui_site.value = '1';
  await ui.submit();
  assert.equal(ui.state.rows[0].possui_site, 1);
  assert.equal(Object.hasOwn(ui.state.rows[0], 'site'), false);
  await ui.run('executar(() => editar(1))');
  assert.equal(ui.fields.possui_site.value, '1');
  ui.fields.possui_site.value = '0';
  await ui.submit();
  await ui.run('executar(() => visualizar(1))');
  assert.ok(ui.get('dados-cliente').children.some(c => c.textContent === 'Não'));
  assert.equal(ui.get('dados-cliente').children.some(c => c.textContent === 'URL do site'), false);
});

test('Frontend: Instagram abre perfil em nova aba; vazio e texto antigo não viram links', async () => {
  const ui = await tela();
  for (const instagram of ['@empresa', 'https://instagram.com/empresa/?igsh=teste', 'https://www.instagram.com/empresa/']) {
    ui.state.rows = [{ id: 1, nome_empresa: 'Empresa', instagram, possui_site: 0 }];
    await ui.run('executar(() => visualizar(1))');
    const campos = ui.get('dados-cliente').children;
    const perfil = campos[campos.findIndex(c => c.textContent === 'Instagram') + 1];
    const link = perfil.children[0];
    assert.equal(link.href, 'https://www.instagram.com/empresa/');
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
  }
  for (const instagram of [null, '', 'javascript:alert(1)', 'https://instagram.com.evil.test/empresa', 'Texto antigo']) {
    ui.state.rows = [{ id: 1, instagram }];
    await ui.run('executar(() => visualizar(1))');
    const campos = ui.get('dados-cliente').children;
    const perfil = campos[campos.findIndex(c => c.textContent === 'Instagram') + 1];
    assert.equal(perfil.children.length, 0);
    assert.equal(perfil.textContent, instagram || 'Não informado');
  }
});

test('Prospecção: gerar, editar, abrir WhatsApp sem gravar e marcar contato preservando rascunho', async () => {
  const ui = await tela();
  const original = { id: 1, nome_empresa: 'Empresa', telefone: '(31) 99715-0594', status: 'nao_contatado', ultima_data_contato: null };
  ui.state.rows = [{ ...original }];
  await ui.run('executar(() => visualizar(1))');
  ui.get('prospeccao-estrategia').value = 'direta';
  ui.get('prospeccao-gerar').listeners.click();
  const primeira = ui.get('prospeccao-mensagem').value;
  assert.match(primeira, /Empresa/);
  assert.equal(ui.get('prospeccao-gerar').textContent, 'Gerar novamente');
  ui.get('prospeccao-gerar').listeners.click();
  assert.equal(ui.get('prospeccao-mensagem').value, primeira);
  assert.equal(ui.get('prospeccao-estrategia').value, 'direta');
  const editada = '  Olá, texto editado!\nCom acento: você & eu.  ';
  ui.get('prospeccao-mensagem').value = editada;
  ui.get('prospeccao-mensagem').listeners.input();
  assert.equal(ui.get('prospeccao-contador').textContent, Array.from(editada).length + ' caracteres');
  ui.get('prospeccao-estrategia').value = 'visualizacao';
  await ui.run('executar(() => visualizar(1))');
  assert.equal(ui.get('prospeccao-mensagem').value, editada);
  const requestsAntes = ui.state.calls.length;
  await ui.get('prospeccao-abrir').listeners.click();
  assert.equal(ui.state.calls.length, requestsAntes + 1);
  assert.equal(ui.state.calls.at(-1).method, 'GET');
  assert.equal(ui.state.opened.length, 1);
  assert.equal(ui.state.opened[0][0], 'https://wa.me/5531997150594?text=' + encodeURIComponent(editada));
  assert.equal(ui.state.opened[0][1], '_blank');
  assert.deepEqual(ui.state.rows[0], original);
  await ui.get('prospeccao-contatado').listeners.click();
  assert.equal(ui.state.rows[0].status, 'contatado');
  assert.equal(ui.state.rows[0].ultima_data_contato, '2026-09-21 15:30:00');
  assert.equal(ui.state.rows[0].telefone, original.telefone);
  assert.equal(ui.get('prospeccao-mensagem').value, editada);
  assert.ok(ui.state.calls.some(c => c.url === '/api/clientes/1/contato' && c.method === 'POST'));
  assert.match(ui.get('prospeccao-aviso').textContent, /marcado como contatado/);
  assert.match(ui.get('clientes').children[0].children[1].children.at(-1).textContent, /Contatado/);
  assert.ok(ui.get('dados-cliente').children.some(c => c.textContent === '21/09/2026 15:30:00'));
  ui.state.rows.push({ id: 2, nome_empresa: 'Outra empresa', telefone: '123', status: 'nao_contatado' });
  await ui.run('executar(() => visualizar(2))');
  assert.equal(ui.get('prospeccao-mensagem').value, '');
  await ui.get('prospeccao-abrir').listeners.click();
  assert.match(ui.get('prospeccao-aviso').textContent, /telefone brasileiro válido/);
  assert.equal(ui.state.opened.length, 1);
});

test('Prospecção: erros de mensagem, persistência e atualização da lista', async () => {
  const ui = await tela();
  ui.state.rows = [{ id: 1, telefone: '31997150594', status: 'nao_contatado', ultima_data_contato: null }];
  await ui.run('executar(() => visualizar(1))');
  await ui.get('prospeccao-abrir').listeners.click();
  assert.match(ui.get('prospeccao-aviso').textContent, /mensagem antes de abrir/);
  assert.equal(ui.state.opened.length, 0);
  ui.get('prospeccao-mensagem').value = 'Meu rascunho';
  ui.state.fail = true;
  await ui.get('prospeccao-contatado').listeners.click();
  assert.equal(ui.state.rows[0].status, 'nao_contatado');
  assert.equal(ui.state.rows[0].ultima_data_contato, null);
  assert.equal(ui.get('prospeccao-mensagem').value, 'Meu rascunho');
  assert.equal(ui.get('prospeccao-contatado').disabled, false);
  assert.match(ui.get('prospeccao-aviso').textContent, /Não foi possível acessar/);
  ui.state.fail = false;
  ui.state.failList = true;
  await ui.get('prospeccao-contatado').listeners.click();
  assert.equal(ui.state.rows[0].status, 'contatado');
  assert.match(ui.get('prospeccao-aviso').textContent, /Contato registrado, mas a lista não pôde/);
});

test('Motor frontend: gancho opt-in, mensagem exata e variante original no histórico', async () => {
  const ui=await tela();
  ui.state.rows=[{id:1,nome_empresa:'Academia',nicho:'Academia',telefone:'31997150594',gancho_verificado:'Horários nos destaques',nao_contatar:0}];
  await ui.run('executar(() => visualizar(1))');
  assert.equal(ui.get('prospeccao-usar-gancho').checked,false);
  ui.get('prospeccao-usar-gancho').checked=true;
  ui.get('prospeccao-estrategia').value='curiosidade'; ui.get('prospeccao-gerar').listeners.click();
  assert.match(ui.get('prospeccao-mensagem').value,/Vi que vocês apresentam os horários nos destaques/);
  const editada='  Texto editado <b>seguro</b>\nVocê & eu  ';
  ui.get('prospeccao-mensagem').value=editada;ui.get('prospeccao-estrategia').value='direta';
  await ui.get('prospeccao-contatado').listeners.click();
  const h=ui.state.history[0];assert.equal(h.mensagem,editada);assert.equal(h.estrategia,'curiosidade');assert.match(h.variant_id,/^curiosidade_/);
  assert.equal(h.resultado,'aguardando_resposta');
  const item=ui.get('historico-lista').children[0];assert.equal(item.children[1].children[1].textContent,editada);
  item.children[3].children[0].value='respondeu';await item.children[4].listeners.click();
  assert.equal(ui.state.history[0].resultado,'respondeu');assert.ok(ui.state.history[0].data_resposta);
  assert.equal(ui.get('prospeccao-mensagem').value,editada);
  assert.equal(ui.get('prospeccao-usar-gancho').checked,true);
  ui.state.rows.push({id:2});await ui.run('executar(() => visualizar(2))');
  assert.equal(ui.get('prospeccao-usar-gancho').checked,false);assert.equal(ui.get('historico-lista').children.length,0);
});
test('Motor frontend: não contatar exige confirmação por abertura, inclusive bloqueio em outra aba',async()=>{
  const ui=await tela();ui.state.rows=[{id:1,nome_empresa:'Empresa',telefone:'31997150594',nao_contatar:0}];
  await ui.run('executar(() => visualizar(1))');
  ui.get('prospeccao-mensagem').value='Mensagem manual';
  ui.state.rows[0].nao_contatar=1;ui.state.confirm=false;
  await ui.get('prospeccao-abrir').listeners.click();assert.equal(ui.state.opened.length,0);assert.equal(ui.get('prospeccao-bloqueio').hidden,false);
  ui.get('prospeccao-gerar').listeners.click();assert.equal(ui.get('prospeccao-mensagem').value,'Mensagem manual');assert.match(ui.get('prospeccao-aviso').textContent,/bloqueada/);
  await ui.get('prospeccao-contatado').listeners.click();assert.equal(ui.state.history.length,0);
  ui.state.confirm=true;await ui.get('prospeccao-abrir').listeners.click();assert.equal(ui.state.opened.length,1);assert.equal(ui.state.history.length,0);
  await ui.get('prospeccao-contatado').listeners.click();assert.equal(ui.state.history.length,1);assert.equal(ui.state.history[0].confirmar_nao_contatar,true);
  assert.equal(ui.state.rows[0].nao_contatar,1);
  ui.state.confirm=false;await ui.get('prospeccao-abrir').listeners.click();assert.equal(ui.state.opened.length,1);
});
test('Motor frontend: resultado não contatar destaca bloqueio e não apaga rascunho',async()=>{
  const ui=await tela();ui.state.rows=[{id:1,telefone:'31997150594',nao_contatar:0}];
  await ui.run('executar(() => visualizar(1))');ui.get('prospeccao-mensagem').value='Manual';
  await ui.get('prospeccao-contatado').listeners.click();
  const item=ui.get('historico-lista').children[0];item.children[3].children[0].value='nao_contatar';await item.children[4].listeners.click();
  assert.equal(ui.get('prospeccao-bloqueio').hidden,false);assert.equal(ui.get('prospeccao-mensagem').value,'Manual');
  assert.match(ui.get('clientes').children[0].children[1].children.at(-1).textContent,/Não contatar/);
});

test('5.2 frontend: demo indisponível preserva rascunho, contador e origem do histórico',async()=>{
  const ui=await tela();ui.state.rows=[{id:1,nome_empresa:'Academia',nicho:'Academia',telefone:'31997150594',nao_contatar:0}];
  await ui.run('executar(() => visualizar(1))');
  ui.get('prospeccao-estrategia').value='oportunidade';ui.get('prospeccao-gerar').listeners.click();
  ui.get('prospeccao-mensagem').value='Meu texto editado';ui.get('prospeccao-mensagem').listeners.input();
  ui.get('prospeccao-estrategia').value='demonstracao';ui.get('prospeccao-gerar').listeners.click();
  assert.equal(ui.get('prospeccao-aviso').textContent,'Nenhuma demonstração está configurada para este nicho.');
  assert.equal(ui.get('prospeccao-mensagem').value,'Meu texto editado');assert.equal(ui.get('prospeccao-contador').textContent,'17 caracteres');
  await ui.get('prospeccao-contatado').listeners.click();
  assert.equal(ui.state.history[0].estrategia,'oportunidade');assert.equal(ui.state.history[0].variant_id,'oportunidade_01');assert.equal(ui.state.history[0].mensagem,'Meu texto editado');
});

test('Pipeline frontend: filtros combinados, páginas e limpeza preservam os controles',async()=>{
 const ui=await tela();ui.state.rows=Array.from({length:60},(_,i)=>({id:i+1,nome_empresa:'Empresa '+i,status:'nao_contatado',estado:'SP',cidade:'São Paulo',nicho:'Academia'}));
 await ui.run('carregarClientes()');assert.equal(ui.get('clientes').children.length,25);
 ui.get('filtro-estado').value='SP';ui.get('filtro-nicho').value='Academia';ui.get('filtro-status').value='nao_contatado';
 await ui.get('filtros').listeners.submit({preventDefault(){}});
 await ui.get('pagina-proxima').listeners.click();
 const q=new URL('http://local'+ui.state.calls.at(-1).url).searchParams;
 assert.equal(q.get('page'),'2');assert.equal(q.get('estado'),'SP');assert.equal(q.get('nicho'),'Academia');assert.equal(q.get('status'),'nao_contatado');
 assert.equal(ui.get('clientes').children.length,25);assert.equal(ui.get('pagina-info').textContent,'Página 2 de 3 · 26–50 de 60');
 await ui.get('preciso-contatar').listeners.click();assert.match(ui.state.calls.at(-1).url,/followup=preciso_contatar/);assert.equal(ui.get('filtro-status').value,'');
 await ui.get('limpar-filtros').listeners.click();assert.equal(ui.get('filtro-followup').value,'');assert.equal(ui.get('pagina-info').textContent,'Página 1 de 3 · 1–25 de 60');
 ui.get('visao-pipeline').value='pipeline';ui.get('visao-pipeline').listeners.change();assert.equal(ui.get('pipeline-colunas').children.length,8);assert.equal(ui.get('clientes').hidden,true);
});
test('Follow-up frontend: salvar e retirar agendamento preserva mensagem editada',async()=>{
 const ui=await tela();ui.state.rows=[{id:1,nome_empresa:'Teste',telefone:'31997150594',status:'nao_contatado',proximo_contato_em:null}];
 await ui.run('executar(() => visualizar(1))');ui.get('prospeccao-mensagem').value='Texto manual preservado';
 ui.get('followup-data').value='2026-09-25T10:00';ui.get('followup-acao').value='Enviar proposta';
 await ui.get('followup-salvar').listeners.click();assert.equal(ui.state.rows[0].proxima_acao,'Enviar proposta');assert.equal(ui.get('prospeccao-mensagem').value,'Texto manual preservado');
 ui.get('followup-data').value='';await ui.get('followup-salvar').listeners.click();assert.equal(ui.state.rows[0].proximo_contato_em,null);
 ui.get('followup-data').value='2026-09-26T09:00';ui.get('prospeccao-agendar').checked=true;await ui.get('prospeccao-contatado').listeners.click();
 assert.equal(ui.state.history[0].proximo_contato_em,'2026-09-26T09:00');assert.equal(ui.state.history[0].mensagem,'Texto manual preservado');
});
