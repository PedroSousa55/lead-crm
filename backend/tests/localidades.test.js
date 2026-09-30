const {test}=require('node:test');
const assert=require('node:assert/strict');
const geo=require('../../frontend/localidades');
const {validarCliente}=require('../controllers/clienteValidation');
const {validarConsulta}=require('../services/clienteConsulta');
const {lerCsv}=require('../services/csvService');
const {lerExcel}=require('../services/excelService');
const {planilha}=require('../test-support/excelFixtures');
const {planejar,aplicar}=require('../scripts/normalizarLocalidades');

test('Geografia: base nacional completa, 27 UFs, códigos únicos e localidades sem duplicidade',()=>{
  const ufs='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  assert.deepEqual(geo.estados.map(e=>e.uf).sort(),ufs.sort());
  // 5.569 municípios + Brasília/DF + Fernando de Noronha/PE, conforme o endpoint do IBGE.
  assert.equal(geo.municipios.length,5571);
  const ids=new Set(),nomes=new Set();
  for(const m of geo.municipios){assert.ok(ufs.includes(m.uf));assert.match(String(m.id),/^\d{7}$/);assert.ok(m.nome);assert.ok(!ids.has(m.id));ids.add(m.id);const key=m.uf+':'+geo.chave(m.nome);assert.ok(!nomes.has(key));nomes.add(key);}
  for(const uf of ufs)assert.ok(geo.cidades(uf).length);
});

for(const [uf,cidade] of [['AC','Rio Branco'],['MA','São Luís'],['SP','São Paulo'],['MG','Belo Horizonte'],['CE','Fortaleza'],['DF','Brasília']]) {
  test('Geografia: localidade da base oficial do IBGE em '+uf,()=>{
    assert.deepEqual(geo.normalizar(uf,cidade),{dados:{estado:uf,cidade},erros:{}});
    if(uf==='DF')assert.deepEqual(geo.cidades(uf).map(m=>m.nome),['Brasília']);
  });
}
test('Geografia: nomes, siglas, caixa, acentos e espaços normalizam sem inferir UF',()=>{
  for(const uf of ['Maranhão','maranhao','ma',' MA ','Maranhão (MA)'])for(const cidade of ['Sao Luis','sao luis','São Luis','SÃO LUÍS','  Sao   Luis  '])assert.deepEqual(geo.normalizar(uf,cidade).dados,{estado:'MA',cidade:'São Luís'});
  for(const uf of ['São Paulo','sao paulo','sp'])assert.equal(geo.normalizarUF(uf),'SP');
  assert.ok(geo.normalizar('', 'São Luís').erros.cidade);
  assert.deepEqual(geo.normalizar('',null),{dados:{estado:null,cidade:null},erros:{}});
  assert.ok(geo.normalizar('XX','Cidade').erros.estado);
  assert.ok(geo.normalizar({},[]).erros.estado);
  assert.equal(geo.normalizar('MA','Belo Horizonte').erros.cidade,'Cidade não pertence ao estado informado.');
});
test('Geografia: CRUD recebe nome do estado e persiste apenas UF/cidade oficiais',()=>{
  const body={nome_empresa:'Empresa',telefone:'31999999999',estado:'maranhao',cidade:'sao luis'};
  const r=validarCliente(body);assert.deepEqual(r.erros,{});assert.equal(r.dados.estado,'MA');assert.equal(r.dados.cidade,'São Luís');
  assert.equal(validarCliente({...body,cidade:'Belo Horizonte'}).erros.cidade,'Cidade não pertence ao estado informado.');
});
for(const tipo of ['csv','xlsx','xlsm'])test('Geografia: importação '+tipo+' normaliza e isola cidade incompatível',()=>{
  const rows=[['nome_empresa','telefone','estado','cidade','possui_site'],['A','31999999991','Maranhão','Sao Luis',0],['B','31999999992','sp','SÃO PAULO',0],['C','31999999993','MA','Belo Horizonte',0],['D','31999999994','CE','Fortaleza',1]];
  const r=tipo==='csv'?lerCsv(Buffer.from(rows.map(r=>r.join(';')).join('\n')),'geo.csv'):lerExcel(planilha({Leads:rows},tipo),'geo.'+tipo);
  assert.equal(r.processados,4);assert.equal(r.invalidos,1);assert.equal(r.descartados,1);assert.equal(r.validos.length,2);
  assert.deepEqual(r.validos.map(r=>[r.dados.estado,r.dados.cidade]),[['MA','São Luís'],['SP','São Paulo']]);
  assert.ok(r.ignorados.some(r=>r.linha===4&&r.motivos.includes('cidade: Cidade não pertence ao estado informado.')));
});
test('Geografia: filtros isolados e combinados preservam filtros anteriores',()=>{
  for(const q of [{estado:'maranhao'},{cidade:'sao luis'},{estado:'ma',cidade:'Sao Luis',status:'interessado',followup:'hoje',instagram:'sim',page:'2',limit:'50',nicho:'Academia'}]){
    const r=validarConsulta(q);assert.deepEqual(r.erros,[]);if(q.estado)assert.equal(r.dados.estado,'MA');if(q.cidade)assert.equal(r.dados.cidade,'São Luís');if(q.status)assert.equal(r.dados.status,q.status);
  }
  assert.ok(validarConsulta({estado:'MA',cidade:'Belo Horizonte'}).erros.includes('Cidade não pertence ao estado informado.'));
});
test('Geografia: revisão de registros antigos preserva os não identificados',async()=>{
  const registros=[{id:1,estado:'ma',cidade:'Sao Luis'},{id:2,estado:'MG',cidade:'Belo Horizonte'},{id:3,estado:'MA',cidade:'Belo Horizonte'},{id:4,estado:null,cidade:'Bom Jesus'}];
  const copia=structuredClone(registros),r=planejar(registros);
  assert.deepEqual(registros,copia);assert.equal(r.total,4);assert.equal(r.inalterados,1);assert.equal(r.alteracoes.length,1);assert.equal(r.pendencias.length,2);
  const calls=[];await aplicar({execute:async(sql,params)=>{calls.push({sql,params});return[{affectedRows:1}];}},r.alteracoes);
  assert.equal(calls.length,1);assert.deepEqual(calls[0].params,['MA','São Luís',1,'ma','Sao Luis']);assert.match(calls[0].sql,/updated_at = updated_at/);
  await assert.rejects(aplicar({execute:async()=>[{affectedRows:0}]},r.alteracoes),/mudou durante/);
});
