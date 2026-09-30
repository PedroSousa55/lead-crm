const assert=require('node:assert/strict'),pool=require('../config/database'),model=require('../models/configuracaoModel'),dados=require('../models/dadosModel'),v=require('../services/backupValidation'),service=require('../services/backupService'),defaults=require('../services/configuracaoValidation');
async function main(){const c=await pool.getConnection();let tx=false;try{
 const site=await dados.estrutura(c),original=await dados.lerDados(c,site),antes=v.hash(original);
 await require('./migrateConfiguracoes').migrate(c);assert.equal(v.hash(await dados.lerDados(c,site)),antes);
 await c.beginTransaction();tx=true;const custom={...defaults.valores(),nome_remetente:'Teste configuração',profissao_remetente:'designer',demo_academia_disponivel:true,demo_academia_url:'https://example.com/demo',leads_por_pagina:100,tela_inicial:'pipeline'};
 await model.salvar(custom,c);assert.deepEqual(await model.obter(c),custom);await c.rollback();tx=false;assert.equal(v.hash(await dados.lerDados(c,site)),antes);
 // Restauração é exercitada somente sobre tabelas temporárias, nunca sobre os dados reais.
 await require('../test-support/tabelasBackupTemporarias').criar(c);await c.beginTransaction();tx=true;
 assert.deepEqual(await model.obter(c),defaults.valores());await model.salvar(custom,c);
 const b=v.criar(await dados.lerDados(c,site),site);assert.equal(b.backup.versao_backup,2);v.ler(v.serializar(b));
 await model.salvar(defaults.valores(),c);let atual=v.criar(await dados.lerDados(c,site),site);
 await service.restaurarNaConexao(c,b,service.assinatura(atual));assert.deepEqual(await model.obter(c),custom);
 const legado=v.criar({clientes:[],prospeccoes:[]});atual=v.criar(await dados.lerDados(c,site),site);await service.restaurarNaConexao(c,legado,service.assinatura(atual));assert.deepEqual(await model.obter(c),custom);
 // Simula falha após trocar também configurações: rollback deve recuperar o conjunto inteiro.
 await c.query('SAVEPOINT teste_falha');const executar=c.execute.bind(c);const falha={execute:async(sql,params)=>{const r=await executar(sql,params);if(sql.startsWith('INSERT INTO configuracoes'))throw Error('FALHA_TESTE');return r;}};
 await assert.rejects(dados.substituir(falha,b,site),/FALHA_TESTE/);await c.query('ROLLBACK TO SAVEPOINT teste_falha');assert.deepEqual(await model.obter(c),custom);
 await c.rollback();tx=false;for(const t of ['prospeccoes','clientes','configuracoes'])await c.query('DROP TEMPORARY TABLE '+t);assert.equal(v.hash(await dados.lerDados(c,site)),antes);
 console.log('Configurações MySQL: migration repetível, persistência, vazio/padrões, backup v2, v1 preservando configurações e rollback aprovados. Dados reais intactos.');
 }finally{try{if(tx)await c.rollback();}finally{c.destroy();await pool.end();}}}
main().catch(e=>{console.error(e);process.exitCode=1});
