const { test } = require('node:test');
const assert = require('node:assert/strict');
const { gerar } = require('../../frontend/geradorMensagens');
const templates = require('../../frontend/mensagemTemplates');
const lead = { nome_empresa: 'Academia Alpha', nicho: 'Academia', cidade: 'Belo Horizonte', estado: 'MG', observacoes: 'SEGREDO_INTERNO', instagram: '@academiaalpha', telefone: '31997150594' };
const estrategias = Object.keys(templates.mensagens).filter(e => e !== 'demonstracao');
for (const estrategia of ['curiosidade','visualizacao','problema_sutil','direta','pergunta']) {
  test('Gerador: estratégia ' + estrategia + ', curta e somente com dados disponíveis', () => {
    const r=gerar(lead,estrategia);
    assert.equal(r.estrategia,estrategia);assert.match(r.texto,/Academia Alpha/);assert.match(r.texto,/Belo Horizonte - MG/);
    assert.ok(r.texto.length<800);assert.match(r.texto,/\?$/);
    assert.doesNotMatch(r.texto,/undefined|null|SEGREDO_INTERNO|31997150594|referência|excelente|muitos clientes|crescendo|garantido/);
  });
}
test('Gerador: estratégia fixa preserva mensagem revisada, sem combinar trechos',()=>{
  for(const estrategia of estrategias) {const a=gerar(lead,estrategia,{random:()=>0});const b=gerar(lead,estrategia,{anterior:a,random:()=>0.99});assert.equal(a.texto,b.texto);assert.equal(a.variant_id,b.variant_id);}
});
test('Gerador: automática varia estratégia mesmo com aleatoriedade constante',()=>{
  let anterior;for(let i=0;i<30;i++){const r=gerar(lead,'automatica',{anterior,random:()=>0});if(anterior)assert.notEqual(r.estrategia,anterior.estrategia);anterior=r;}
});
test('Gerador: campos opcionais ausentes e observações nunca incluídas',()=>{
  for(const campo of ['nicho','cidade','estado'])for(const estrategia of estrategias){const r=gerar({...lead,[campo]:null},estrategia);assert.doesNotMatch(r.texto,/undefined|null|SEGREDO_INTERNO/);if(campo!=='nicho')assert.ok(!r.texto.includes(lead[campo]));}
  assert.doesNotMatch(gerar({}).texto,/undefined|null|\(\)/);assert.throws(()=>gerar(lead,'invalida'),/estratégia válida/);
});
test('Mensagens: todas as abordagens representam o serviço sem promessas ou elogios inventados',()=>{
  for(const estrategia of estrategias){const r=gerar({...lead,possui_site:0},estrategia);assert.match(r.texto,/Pedro Henrique/);assert.match(r.texto,/web/);assert.doesNotMatch(r.texto,/aumentar.*vendas|garant|Google|perdendo clientes|urgente|engajamento|excelente|referência|analisei|gostei|oferta imperdível|pagamento/i);}
});
for(const [nicho,esperado] of [['Academia',/modalidades, horários/],['Clínica',/informações da clínica/],['Fisioterapia',/informações da clínica/],['Estética',/serviços/],['Nail Design',/serviços/],['Salão',/página do salão/],['Desconhecido',/informações da empresa/],['',/informações da empresa/]]){
  test('Mensagens: visualização segura para nicho '+(nicho||'ausente'),()=>{const r=gerar({nome_empresa:'Empresa Exemplo',nicho},'visualizacao');assert.match(r.texto,esperado);assert.match(r.texto,/Imagine/);assert.doesNotMatch(r.texto,/pilates|musculação|botox|oferecem|undefined|null/);});
}
test('Mensagens: ausência de site somente quando cadastrada; remetente centralizado',()=>{
  for(const possui_site of [undefined,null,1,'1'])assert.doesNotMatch(gerar({possui_site},'direta').texto,/Não localizei/);
  assert.match(gerar({possui_site:0},'direta').texto,/Não localizei um site próprio/);
  const original=templates.remetente.nome;try{templates.remetente.nome='Remetente Teste';for(const e of estrategias)assert.match(gerar(lead,e).texto,/Remetente Teste/);}finally{templates.remetente.nome=original;}
});
test('Motor: Instagram real, ausência de site cautelosa e nenhum contexto inventado',()=>{
  assert.match(gerar({nome_empresa:'Loja',instagram:'@loja'},'curiosidade').texto,/Encontrei o perfil de Loja no Instagram/);
  for(const instagram of ['',null,'https://evil.test/loja'])for(const e of estrategias)assert.doesNotMatch(gerar({nome_empresa:'Loja',instagram},e).texto,/Instagram|pesquisa de empresas|Conheci/);
  assert.doesNotMatch(gerar({possui_site:0},'oportunidade').texto,/vocês não têm|ainda não possui|precisam|preparei|fiz um site/i);
});
test('Motor: gancho opcional exige escolha e não usa notas internas ou marcação',()=>{
  const cliente={...lead,gancho_verificado:'Horários nos destaques do Instagram'};
  assert.doesNotMatch(gerar(cliente).texto,/Vi que vocês/);assert.match(gerar(cliente,'curiosidade',{usarGancho:true}).texto,/Vi que vocês apresentam os horários/);
  for(const gancho_verificado of ['',null,'<script>alert(1)</script>','senha interna: 123','a'.repeat(241)])assert.throws(()=>gerar({...cliente,gancho_verificado},'direta',{usarGancho:true}),/gancho/);
});
test('Motor: demos habilitadas e desabilitadas sem alegar exemplos inexistentes',()=>{
  for(const [grupo,nicho] of Object.entries({academia:'Academia',clinica:'Clínica',estetica:'Estética',outros:'Outro'})){
    const original=templates.demos[grupo].demoDisponivel;try{
      templates.demos[grupo].demoDisponivel=false;for(const e of estrategias)assert.doesNotMatch(gerar({nicho},e).texto,/exemplo/);
      templates.demos[grupo].demoDisponivel=true;for(const e of ['demonstracao','pergunta','autoridade','direta'])assert.match(gerar({nicho},e).texto,/exemplo/);
    }finally{templates.demos[grupo].demoDisponivel=original;}
  }
});
test('Motor: IDs estáveis, mensagens curtas e ordem de apresentação revisada',()=>{
  for(const e of estrategias){const r=gerar(lead,e);assert.equal(r.variant_id,e+'_01');assert.ok(r.texto.split('\n\n').length>=2&&r.texto.split('\n\n').length<=4);assert.ok(r.texto.split(/\s+/).length<=100);assert.equal(r.texto.indexOf('Pedro')<r.texto.indexOf('Academia Alpha'),e==='direta');}
});
test('Motor: não contatar bloqueia geração, inclusive com mensagem anterior',()=>{
  for(const nao_contatar of [1,'1',true])for(const e of [...estrategias,'automatica','demonstracao'])assert.throws(()=>gerar({...lead,nao_contatar},e),/não contatar/);
});
