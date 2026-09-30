const assert=require('node:assert/strict');
const pool=require('../config/database');
const clientes=require('../models/clienteModel');
const contatos=require('../models/prospeccaoModel');
const {validarConsulta}=require('../services/clienteConsulta');
async function check(){let c;const original=pool.execute;try{
 c=await pool.getConnection();await c.beginTransaction();pool.execute=c.execute.bind(c);
 const [[datas]]=await c.query("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS agora, DATE_FORMAT(CURRENT_DATE - INTERVAL 1 DAY, '%Y-%m-%d 10:00:00') AS ontem, DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d 23:59:59') AS hoje, DATE_FORMAT(CURRENT_DATE + INTERVAL 2 DAY, '%Y-%m-%d 10:00:00') AS futuro");
 const prefix='TestePipeline'+Date.now();const fixtures=[];
 const estados=['SP','MG','CE'],cidades=['São Paulo','Belo Horizonte','Fortaleza'];
 const status=['nao_contatado','contatado','sem_resposta','respondeu','interessado','negociacao','fechado','descartado','nao_contatar'];
 for(let i=0;i<450;i++)fixtures.push({nome_empresa:prefix+' '+String(i).padStart(3,'0'),telefone:'00000'+String(i).padStart(6,'0'),nicho:i%2?'Clínica':'Academia',estado:estados[i%3],cidade:cidades[i%3],status:status[i%9],nao_contatar:i%9===8?1:0,instagram:i%2?'https://www.instagram.com/exemplo/':null,proximo_contato_em:[datas.ontem,datas.hoje,datas.futuro,null][i%4],proxima_acao:'Perguntar se viu a demo'});
 const campos=Object.keys(fixtures[0]);await c.execute('INSERT INTO clientes ('+campos.join(',')+') VALUES '+fixtures.map(()=> '('+campos.map(()=>'?').join(',')+')').join(','),fixtures.flatMap(row=>campos.map(k=>row[k])));
 const query=async filtros=>{const {dados,erros}=validarConsulta({search:prefix,...filtros});assert.deepEqual(erros,[]);return clientes.listarFiltrados(dados,c);};
 const all=await query({});assert.equal(all.total,450);assert.equal(all.clientes.length,25);assert.ok(all.indicadores.total>=450);assert.equal(Object.values(all.pipeline).reduce((a,b)=>a+b,0),450);
 const a=await query({sort:'nome'}),b=await query({sort:'nome',page:'2'});assert.notEqual(a.clientes[0].id,b.clientes[0].id);assert.ok(a.clientes[0].nome_empresa.endsWith('000'));assert.ok(b.clientes[0].nome_empresa.endsWith('025'));
 for(const limit of ['25','50','100'])assert.equal((await query({limit})).clientes.length,Number(limit));
 for(const campo of ['nicho','estado','cidade']){const valor=fixtures[0][campo];const r=await query({[campo]:valor});assert.equal(r.total,fixtures.filter(f=>f[campo]===valor).length);assert.ok(r.clientes.every(f=>f[campo]===valor));}
 for(const sort of ['nome','cadastro','ultimo_contato','proximo_contato'])assert.equal((await query({sort})).total,450);
 const combinado=await query({estado:'SP',nicho:'Academia',status:'nao_contatado'});assert.equal(combinado.total,fixtures.filter(f=>f.estado==='SP'&&f.nicho==='Academia'&&f.status==='nao_contatado').length);
 assert.equal((await query({status:'contatado'})).total,100);assert.equal((await query({status:'sem_resposta'})).total,100);assert.equal((await query({status:'descartado'})).total,50);assert.equal((await query({instagram:'sim'})).total,225);assert.equal((await query({instagram:'nao'})).total,225);
 const ativo=f=>!f.nao_contatar&&f.status!=='fechado';
 const regras={hoje:f=>f.proximo_contato_em===datas.hoje,atrasados:f=>f.proximo_contato_em===datas.ontem,proximos:f=>f.proximo_contato_em===datas.futuro,sem_followup:f=>!f.proximo_contato_em,preciso_contatar:f=>[datas.ontem,datas.hoje].includes(f.proximo_contato_em)};
 for(const [followup,predicado] of Object.entries(regras)){const r=await query({followup});assert.equal(r.total,fixtures.filter(f=>ativo(f)&&predicado(f)).length,followup);assert.ok(r.clientes.every(ativo));}
 const fila=await query({followup:'preciso_contatar',sort:'nome'});assert.ok(fila.clientes.every(f=>f.proximo_contato_em===datas.ontem));
 const unico=await query({search:fixtures[0].nome_empresa});assert.equal(unico.total,1);const id=unico.clientes[0].id;
 assert.equal((await query({search:fixtures[0].telefone})).total,1);
 await clientes.atualizarFollowup(id,{proximo_contato_em:datas.futuro,proxima_acao:'Enviar proposta'},c);assert.equal((await clientes.buscarPorId(id)).proxima_acao,'Enviar proposta');
 const antigo=await contatos.registrarNaConexao(c,id,{mensagem:'Contato antigo',estrategia:'manual',variant_id:null});
 const recente=await contatos.registrarNaConexao(c,id,{mensagem:'Texto exato\n ',estrategia:'direta',variant_id:'direta_01',proximo_contato_em:datas.hoje,proxima_acao:'Retornar'});
 for(const [resultado,esperado] of [['respondeu','respondeu'],['interessado','interessado'],['negociacao','negociacao'],['fechado','fechado'],['nao_interessado','descartado']]){await contatos.resultadoNaConexao(c,id,recente,resultado);assert.equal((await clientes.buscarPorId(id)).status,esperado);}
 await contatos.resultadoNaConexao(c,id,antigo,'respondeu');assert.equal((await clientes.buscarPorId(id)).status,'descartado');
 await contatos.resultadoNaConexao(c,id,recente,'fechado');await contatos.registrarNaConexao(c,id,{mensagem:'Contato manual fechado',estrategia:'manual',variant_id:null});assert.equal((await clientes.buscarPorId(id)).status,'fechado');
 await contatos.resultadoNaConexao(c,id,antigo,'nao_contatar');assert.equal((await clientes.buscarPorId(id)).nao_contatar,1);assert.equal((await query({search:fixtures[0].nome_empresa,followup:'preciso_contatar'})).total,0);
 await assert.rejects(contatos.registrarNaConexao(c,id,{mensagem:'Bloquear',estrategia:'manual',variant_id:null}),e=>e.status===409);
 console.log('Pipeline MySQL: 450 leads, busca, filtros combinados, paginação, ordenação, contadores, follow-up e atualização de estágio validados.');
 }catch(e){console.error('Falha no pipeline MySQL:',e.code||e.message);process.exitCode=1;}
 finally{pool.execute=original;if(c){await c.rollback();c.release();console.log('Rollback concluído: nenhum lead fictício mantido.');}await pool.end();}
}
check();
