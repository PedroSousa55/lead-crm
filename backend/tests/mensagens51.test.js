const { test } = require('node:test');
const assert = require('node:assert/strict');
const { gerar } = require('../../frontend/geradorMensagens');
const templates = require('../../frontend/mensagemTemplates');
const { validarContato } = require('../controllers/prospeccaoValidation');
const lead={nome_empresa:'Empresa Exemplo',nicho:'Academia',instagram:'@exemplo',possui_site:0};
const estrategias=Object.keys(templates.mensagens).filter(e=>e!=='demonstracao');
test('5.1/5.2: identidade central e linguagem natural em todos os nichos',()=>{
  for(const nicho of ['Academia','Clínica','Estética','Outro'])for(const e of estrategias){const r=gerar({...lead,nicho},e);assert.match(r.texto,/Pedro Henrique/);assert.match(r.texto,/desenvolvedor web|desenvolvimento web/);assert.equal(r.texto.split(lead.nome_empresa).length-1,1);assert.doesNotMatch(r.texto,/Sou o Pedro|Aqui é o Pedro|Pedro aqui|esboço|gratuit|Tenho um exemplo|Faz sentido|siga com essa ideia|contar um pouco mais|potencializar|alavancar|maximizar|solução digital|revolucionar|Adorei|incrível|referência|perdendo clientes|garant|aumentar.*vendas/i);assert.equal(validarContato({mensagem:r.texto,estrategia:e,variant_id:r.variant_id}).erro,undefined);}
});
test('5.1/5.2: demo real habilita convite; URL não entra automaticamente',()=>{
  for(const [grupo,nicho] of Object.entries({academia:'Academia',clinica:'Clínica',estetica:'Estética',outros:'Outro'})){const original={...templates.demos[grupo]};assert.equal(original.url,null);try{Object.assign(templates.demos[grupo],{demoDisponivel:true,url:'https://example.com/demo'});for(const e of Object.keys(templates.mensagens)){const r=gerar({...lead,nicho},e);assert.doesNotMatch(r.texto,/https?:|esboço|gratuit/);if(['demonstracao','pergunta','autoridade','direta'].includes(e))assert.match(r.texto,/exemplo/);}}finally{Object.assign(templates.demos[grupo],original);}}
});
test('5.1/5.2: automática evita variantes recentes; fixa preserva texto',()=>{
  let anterior;let recentes=[];for(let i=0;i<40;i++){const r=gerar(lead,'automatica',{anterior,random:()=>0});assert.ok(!recentes.includes(r.variant_id));recentes=[...recentes,r.variant_id].slice(-6);anterior=r;}
  for(const e of estrategias){const a=gerar(lead,e);assert.equal(gerar(lead,e,{anterior:a}).texto,a.texto);}
});
test('5.1/5.2: contexto ausente não vira Instagram ou ausência de site',()=>{
  for(const e of estrategias)assert.doesNotMatch(gerar({nome_empresa:'Empresa',possui_site:1},e).texto,/Instagram|Não localizei|Não encontrei|não tem site|não têm site|pesquisa/);
});
test('5.1/5.2: ganchos autorizados viram contexto; demais pedem edição manual',()=>{
  for(const gancho_verificado of ['Horários aparecem nos destaques','Horários nos destaques do Instagram','Perfil possui botão WhatsApp','Serviços apresentados pelo Instagram']){const c={...lead,gancho_verificado};assert.doesNotMatch(gerar(c).texto,/Vi que vocês/);const r=gerar(c,'curiosidade',{usarGancho:true});assert.match(r.texto,/Vi que vocês/);assert.ok(!r.texto.includes(gancho_verificado));}
  assert.throws(()=>gerar({...lead,gancho_verificado:'Anotação livre ainda não adaptada'},'direta',{usarGancho:true}),/manualmente/);
});
test('5.1/5.2: histórico aceita IDs antigos e novos sem estratégia incorreta',()=>{
  for(const estrategia of ['curiosidade','beneficio','problema','direta','pergunta'])for(const versao of ['','v51_'])for(const n of ['01','02','03'])assert.equal(validarContato({mensagem:'Texto exato\n editado ',estrategia,variant_id:estrategia+'_'+versao+n}).dados.mensagem,'Texto exato\n editado ');
  for(const variant_id of ['direta_v51_04','direta_v52_01','beneficio_v51_01'])assert.match(validarContato({mensagem:'Teste',estrategia:'direta',variant_id}).erro,/inválida/);
});
