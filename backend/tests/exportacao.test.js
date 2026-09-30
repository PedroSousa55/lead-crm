const {test}=require('node:test');const assert=require('node:assert/strict');const XLSX=require('xlsx');const {parse}=require('csv-parse/sync');
Object.assign(process.env,{DB_HOST:'127.0.0.1',DB_PORT:'3306',DB_USER:'test_only',DB_PASSWORD:'',DB_NAME:'test_only',PORT:'3000'});
const exp=require('../services/exportacaoService');const model=require('../models/dadosModel');const {dados}=require('../test-support/backupFixtures');
for(const formato of ['csv','xlsx'])for(const tabela of ['clientes','prospeccoes'])test('Exportação '+tabela+' '+formato+': cabeçalhos, vazios e caracteres especiais',()=>{
 const data=dados();data.prospeccoes[0].nome_empresa=data.clientes[0].nome_empresa;
 const r=exp.gerar(tabela,data[tabela],formato);
 const rows=formato==='csv'?parse(r.buffer,{bom:true,delimiter:';'}):XLSX.utils.sheet_to_json(XLSX.read(r.buffer,{type:'buffer'}).Sheets[tabela==='clientes'?'Leads':'Histórico'],{header:1,defval:''});
 assert.deepEqual(rows[0],exp.COLUNAS[tabela].map(c=>c[1]));assert.equal(rows.length,2);
 for(const [i,[k]] of exp.COLUNAS[tabela].entries())assert.equal(String(rows[1][i]),String(data[tabela][0][k]??''));
 const vazio=exp.gerar(tabela,[],formato);assert.ok(vazio.buffer.length);
});
test('Exportação: proteção de fórmulas CSV, XLSX como texto e texto longo sem truncar',()=>{
 const c={nome_empresa:'=1+1',observacoes:'@SUM(A1:A2)'};
 const csv=parse(exp.gerar('clientes',[c],'csv').buffer,{bom:true,delimiter:';'});assert.equal(csv[1][1],"'=1+1");
 const sheet=XLSX.read(exp.gerar('clientes',[c],'xlsx').buffer,{type:'buffer'}).Sheets.Leads;assert.equal(sheet.B2.t,'s');assert.equal(sheet.B2.f,undefined);assert.equal(sheet.B2.v,'=1+1');
 assert.throws(()=>exp.gerar('clientes',[{observacoes:'x'.repeat(32768)}],'xlsx'),/CSV/);
});
test('Exportação: todos ou filtrados, paginação não adiciona LIMIT e consultas parametrizadas',async()=>{
 let sql,params;const c={execute:async(s,p)=>{sql=s;params=p;return[Array.from({length:100},(_,i)=>({id:i+1}))]}};
 const rows=await model.exportarClientes(c,{estado:'MA',cidade:'São Luís',page:2,limit:25,sort:'nome'});assert.equal(rows.length,100);assert.ok(!sql.includes('LIMIT'));assert.deepEqual(params,['MA','São Luís']);
 const original=model.exportarClientes;let consulta;
 try{model.exportarClientes=async(c,d)=>{consulta=d;return[]};await exp.exportar('clientes',{escopo:'filtrados',formato:'csv',estado:'MA',page:'2',limit:'25'});assert.equal(consulta.estado,'MA');
 await exp.exportar('clientes',{escopo:'todos',estado:'MA'});assert.equal(consulta.estado,undefined);
 await assert.rejects(exp.exportar('clientes',{formato:'exe'}),/Formato/);await assert.rejects(exp.exportar('clientes',{sort:'DROP TABLE'}),/Ordenação/);
 }finally{model.exportarClientes=original;}
});
