const {test}=require('node:test');const assert=require('node:assert/strict');const {criarDadosBackup}=require('../../frontend/dadosBackup');
function tela(){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,hidden:false,disabled:false,textContent:'',listeners:{},addEventListener(k,fn){this.listeners[k]=fn}});return nodes.get(id)};
 const state={calls:[],downloads:[],restaurado:0,erro:null,atrasar:null};get('dados-formato').value='csv';get('dados-escopo').value='filtrados';
 criarDadosBackup({document:{getElementById:get},consultaFiltros:()=> 'estado=MA&cidade=S%C3%A3o+Lu%C3%ADs&page=2&limit=25&search=Cl%C3%ADnica',aposRestaurar:async()=>state.restaurado++,baixar:async(b,n)=>state.downloads.push(n),fetch:async(url,opts)=>{
  state.calls.push({url,opts});if(state.atrasar)await state.atrasar;if(state.erro)throw Error('offline');
  return {ok:true,headers:{get:k=>k==='X-Restauracao-Token'?'token':'attachment; filename="backup.json"'},blob:async()=>({}),json:async()=>({backup:{criado_em:'2026-09-23T10:00:00.000Z',versao_backup:1},resumo:{quantidade_clientes:2,quantidade_prospeccoes:3}})};
 }});
 const selecionar=async(file={name:'backup.json',size:1024})=>{get('backup-arquivo').files=[file];await get('backup-arquivo').listeners.change()};
 const click=id=>get(id).listeners.click();return {get,state,selecionar,click};
}
test('Dados frontend: exportar filtros sem paginação e baixar sem alterar seleção',async()=>{
 const ui=tela();await ui.click('dados-leads');const url=ui.state.calls[0].url;assert.match(url,/estado=MA/);assert.match(url,/search=Cl/);assert.ok(!url.includes('page=')&&!url.includes('limit='));assert.equal(ui.get('dados-escopo').value,'filtrados');
 ui.get('dados-escopo').value='todos';await ui.click('dados-leads');assert.ok(!ui.state.calls.at(-1).url.includes('estado='));
 await ui.click('dados-historico');assert.match(ui.state.calls.at(-1).url,/exportacao\/prospeccoes/);await ui.click('dados-backup');assert.equal(ui.state.downloads.length,4);assert.match(ui.get('dados-feedback').textContent,/Backup criado/);
});
test('Dados frontend: selecionar só valida; segurança, checkbox e texto são obrigatórios',async()=>{
 const ui=tela();await ui.selecionar();assert.equal(ui.state.calls.length,1);assert.match(ui.state.calls[0].url,/validar$/);assert.equal(ui.get('backup-previa').hidden,false);assert.equal(ui.get('backup-restaurar').disabled,true);
 await ui.click('backup-restaurar');assert.equal(ui.state.calls.length,1);await ui.click('backup-seguranca');assert.equal(ui.state.downloads.length,1);
 ui.get('backup-confirmacao').value='RESTAURAR';ui.get('backup-confirmacao').listeners.input();assert.equal(ui.get('backup-restaurar').disabled,true);
 ui.get('backup-salvo').checked=true;ui.get('backup-salvo').listeners.change();assert.equal(ui.get('backup-restaurar').disabled,false);
 await ui.click('backup-restaurar');assert.equal(ui.state.restaurado,1);assert.equal(ui.state.calls.at(-1).opts.headers['X-Confirmacao'],'RESTAURAR');assert.equal(ui.get('backup-previa').hidden,true);
});
test('Dados frontend: cancelamento e arquivo novo invalidam prévia/confirmacão anterior',async()=>{
 const ui=tela();await ui.selecionar();await ui.click('backup-seguranca');await ui.selecionar();assert.equal(ui.get('backup-restaurar').disabled,true);
 await ui.click('backup-cancelar');assert.match(ui.get('backup-feedback').textContent,/cancelada/);await ui.click('backup-restaurar');assert.equal(ui.state.restaurado,0);
 let liberar;ui.state.atrasar=new Promise(r=>liberar=r);const pending=ui.selecionar();await ui.click('backup-cancelar');liberar();await pending;assert.equal(ui.get('backup-previa').hidden,true);
});
test('Dados frontend: limite/extensão antes de envio e erro de rede sem prometer rollback',async()=>{
 const ui=tela();await ui.selecionar({name:'a.csv',size:1});assert.equal(ui.state.calls.length,0);await ui.selecionar({name:'a.json',size:20*1024*1024+1});assert.match(ui.get('backup-feedback').textContent,/20 MB/);assert.equal(ui.state.calls.length,0);
 ui.state.erro=true;await ui.selecionar();assert.match(ui.get('backup-feedback').textContent,/confirmar o resultado/);assert.equal(ui.get('backup-restaurar').disabled,true);
});
