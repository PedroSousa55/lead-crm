const {test}=require('node:test');const assert=require('node:assert/strict');
const {validarConsulta,montarConsulta}=require('../services/clienteConsulta');
const {validarFollowup}=require('../controllers/followupValidation');
const {validarContato}=require('../controllers/prospeccaoValidation');
for(const campo of ['search','status','nicho','estado','cidade','instagram'])test('Pipeline: filtro preparado '+campo,()=>{
 const valores={search:"D'Ávila %_",status:'interessado',nicho:'Academia',estado:'SP',cidade:'São Paulo',instagram:'sim'};
 const {dados,erros}=validarConsulta({[campo]:valores[campo]});assert.deepEqual(erros,[]);const sql=montarConsulta(dados);assert.ok(sql.where);
 if(campo!=='instagram'){assert.ok(sql.params.length);assert.equal(sql.where.includes(valores[campo]),false);}
});
test('Pipeline: filtros combinados mantêm critérios e ordenação permitida',()=>{
 const {dados,erros}=validarConsulta({search:'Alpha',estado:'SP',nicho:'Academia',status:'nao_contatado',cidade:'São Paulo',followup:'atrasados',instagram:'sim',sort:'nome',page:'2',limit:'50'});assert.deepEqual(erros,[]);
 const q=montarConsulta(dados);assert.equal(q.params.length,9);assert.match(q.where,/proximo_contato_em < NOW/);assert.match(q.where,/nao_contatar = 0/);assert.equal(q.ordem,'nome_empresa ASC, id ASC');assert.equal(dados.page,2);
});
for(const followup of ['hoje','atrasados','proximos','sem_followup','preciso_contatar'])test('Pipeline: regra de follow-up '+followup,()=>{
 const {dados,erros}=validarConsulta({followup});assert.deepEqual(erros,[]);const q=montarConsulta(dados);assert.match(q.where,/nao_contatar = 0/);assert.match(q.where,/fechado/);assert.match(q.where,/proximo_contato_em/);
 if(followup==='preciso_contatar')assert.match(q.ordem,/proximo_contato_em ASC/);
});
test('Pipeline: parâmetros inválidos e injeção na ordenação rejeitados',()=>{
 for(const q of [{sort:'nome; DROP TABLE clientes'},{status:'invalido'},{limit:'500'},{page:'0'},{page:'1.5'},{page:'1000001'},{nicho:['a','b']},{followup:'nunca'},{instagram:'talvez'},{campo:'x'}])assert.ok(validarConsulta(q).erros.length);
 const q=montarConsulta(validarConsulta({search:"%' OR 1=1 --"}).dados);assert.ok(q.params[0].includes("!%' OR"));assert.doesNotMatch(q.where,/OR 1=1/);
});
test('Pipeline: compatibilidade com status antigos',()=>{
 for(const [entrada,saida] of [['sem_resposta','contatado'],['aguardando_resposta','contatado'],['nao_interessado','descartado'],['descartado','descartado'],['respondeu','respondeu']])assert.equal(validarConsulta({status:entrada}).dados.status,saida);
});
test('Follow-up: data real, ação opcional, limpeza e atualização parcial',()=>{
 assert.deepEqual(validarFollowup({proximo_contato_em:'2028-02-29T10:30',proxima_acao:'  Retornar   depois  '}),{dados:{proximo_contato_em:'2028-02-29 10:30:00',proxima_acao:'Retornar depois'},erros:{}});
 assert.deepEqual(validarFollowup({}).dados,{});assert.deepEqual(validarFollowup({proximo_contato_em:'',proxima_acao:null}).dados,{proximo_contato_em:null,proxima_acao:null});
 for(const data of ['2026-02-29T10:30','2026-13-01T10:30','2026-09-22T25:30','2026-09-22T12:60','2026-09-22','2026-09-22T12:30Z',123])assert.ok(validarFollowup({proximo_contato_em:data}).erros.proximo_contato_em);
 assert.ok(validarFollowup({proxima_acao:'a'.repeat(1001)}).erros.proxima_acao);
});
test('Follow-up: contato aceita agendamento sem alterar mensagem',()=>{
 const r=validarContato({mensagem:'  Texto exato\n ',proximo_contato_em:'2026-09-25T10:00',proxima_acao:'Enviar proposta'});assert.equal(r.dados.mensagem,'  Texto exato\n ');assert.equal(r.dados.proximo_contato_em,'2026-09-25 10:00:00');assert.ok(validarContato({mensagem:'Teste',proximo_contato_em:'inválida'}).erro);
});
