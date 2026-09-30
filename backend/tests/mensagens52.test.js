const { test } = require('node:test');
const assert = require('node:assert/strict');
const { gerar } = require('../../frontend/geradorMensagens');
const templates = require('../../frontend/mensagemTemplates');
const { validarContato } = require('../controllers/prospeccaoValidation');
const esperados = {curiosidade:/Tive uma ideia simples para complementar a forma como vocês se apresentam online/,oportunidade:/Não localizei um site próprio/,problema_sutil:/quem abre o perfil e quer saber um pouco mais sobre a academia antes de chamar vocês/,visualizacao:/Imagine a pessoa abrir uma página da academia/,demonstracao:/Tenho uma proposta de página.*um exemplo/,pergunta:/Vocês já chegaram a pensar/,autoridade:/trabalho criando sites e páginas para negócios locais/,direta:/Gostaria de te mostrar uma ideia/};
for(const [estrategia,esperado] of Object.entries(esperados))test('5.2: biblioteca completa '+estrategia+'_01',()=>{
  const original=templates.demos.academia.demoDisponivel;
  try{
    templates.demos.academia.demoDisponivel=estrategia==='demonstracao';
    const lead={nome_empresa:'Academia Alpha',nicho:'Academia',instagram:'@academiaalpha',possui_site:0};
    const r=gerar(lead,estrategia,{random:()=>{throw Error('Estratégia fixa não deve sortear trechos');}});
    assert.equal(r.variant_id,estrategia+'_01');assert.match(r.texto,esperado);
    assert.equal(validarContato({mensagem:r.texto,estrategia,variant_id:r.variant_id}).dados.mensagem,r.texto);
    assert.doesNotMatch(r.texto,/undefined|null|última chance|vagas limitadas|só hoje|reunião|R\$|garant|perdendo clientes|informações ficam espalhadas/i);
    assert.match(r.texto,/\?$/);
  }finally{templates.demos.academia.demoDisponivel=original;}
});
test('5.2: Demonstração bloqueada sem demo e incluída na rotação somente com demo',()=>{
  const original=templates.demos.academia.demoDisponivel;
  try{for(const habilitada of [false,true]){
    templates.demos.academia.demoDisponivel=habilitada;
    const lead={nicho:'Academia'};
    if(!habilitada)assert.throws(()=>gerar(lead,'demonstracao'),{message:'Nenhuma demonstração está configurada para este nicho.'});
    const ids=new Set();let anterior;
    for(let i=0;i<(habilitada?8:7);i++){anterior=gerar(lead,'automatica',{anterior,random:()=>0});ids.add(anterior.variant_id);}
    assert.equal(ids.size,habilitada?8:7);assert.equal(ids.has('demonstracao_01'),habilitada);
    assert.throws(()=>gerar({nicho:'Outro'},'demonstracao'),/Nenhuma demonstração/);
  }}finally{templates.demos.academia.demoDisponivel=original;}
});
