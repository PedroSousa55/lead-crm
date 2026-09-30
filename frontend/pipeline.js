function criarPipeline({ document, requisitar, executar, criarItem }) {
  const el = id => document.getElementById(id);
  const estagios = {nao_contatado:'Não contatado',contatado:'Contatado / aguardando resposta',respondeu:'Respondeu',interessado:'Interessado',negociacao:'Negociação',fechado:'Fechado',descartado:'Não interessado',nao_contatar:'Não contatar'};
  const campos=['search','status','nicho','estado','cidade','followup','instagram','sort','limit'];
  let limitePadrao=25;
  let page=1, paginas=1, ultima=null, sequencia=0, consultaAplicada='';
  function opcoes(select, valores, padrao) {
    const atual=select.value;
    select.replaceChildren();
    for(const [value,label] of [['',padrao],...valores]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
    select.value=valores.some(([v])=>v===atual)?atual:'';
  }
  function locais() {
    if(!ultima)return;
    const registros=ultima.opcoes||[];
    const valores=campo=>[...new Set(registros.map(r=>r[campo]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>[v,v]);
    opcoes(el('filtro-nicho'),valores('nicho'),'Todos os nichos');
    opcoes(el('filtro-estado'),Localidades.estados.map(e=>[e.uf,e.nome+' ('+e.uf+')']),'Todos os estados');
    const uf=el('filtro-estado').value;
    const cidades=uf ? Localidades.cidades(uf).map(m=>m.nome) : [...new Set(registros.map(r=>Localidades.normalizar(r.estado,r.cidade)).filter(r=>!Object.keys(r.erros).length).map(r=>r.dados.cidade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    opcoes(el('filtro-cidade'),cidades.map(v=>[v,v]),'Todas as cidades');
  }
  function estagio(cliente) {return cliente.nao_contatar||cliente.status==='nao_contatar'?'nao_contatar':cliente.status==='sem_resposta'?'contatado':cliente.status;}
  function renderizar() {
    if(!ultima)return;
    el('clientes').replaceChildren();el('pipeline-colunas').replaceChildren();
    const emPipeline=el('visao-pipeline').value==='pipeline';
    el('clientes').hidden=emPipeline;el('pipeline-colunas').hidden=!emPipeline;
    if(emPipeline){
      for(const [key,label] of Object.entries(estagios)){
        const secao=document.createElement('section'),titulo=document.createElement('h3'),lista=document.createElement('ul');
        titulo.textContent=label+' ('+(ultima.pipeline[key]||0)+')';
        for(const c of ultima.clientes.filter(c=>estagio(c)===key))lista.append(criarItem(c,ultima.agora));
        secao.append(titulo);
        if(!lista.children.length){const vazio=document.createElement('p');vazio.textContent='Nenhum lead nesta página.';secao.append(vazio);}
        secao.append(lista);el('pipeline-colunas').append(secao);
      }
    }else for(const c of ultima.clientes)el('clientes').append(criarItem(c,ultima.agora));
    const filtros=campos.filter(c=>!['sort','limit'].includes(c)&&el('filtro-'+c).value);el('filtros-ativos').textContent=filtros.length?'Filtros ativos: '+filtros.map(c=>el('filtro-'+c).selectedOptions?.[0]?.textContent||el('filtro-'+c).value).join(' · '):'';
    el('situacao-lista').textContent=ultima.total?ultima.total+' leads encontrados.':InterfaceCRM.estadoVazio(0,filtros.length>0);el('pipeline-ajuda').hidden=!emPipeline;
    el('pagina-info').textContent='Página '+page+' de '+paginas+' · '+(ultima.total?(page-1)*ultima.limit+1:0)+'–'+Math.min(page*ultima.limit,ultima.total)+' de '+ultima.total;
    el('pagina-anterior').disabled=page<=1;el('pagina-proxima').disabled=page>=paginas;
    el('indicadores').replaceChildren();
    const rotulos={total:'Total de leads',nao_contatado:'Não contatados',contatado:'Aguardando resposta',interessado:'Interessados',negociacao:'Negociação',fechado:'Fechados',followups_hoje:'Follow-ups para hoje'};
    for(const [key,label] of Object.entries(rotulos)){const p=document.createElement('p');p.textContent=label+': '+(ultima.indicadores[key]||0);el('indicadores').append(p);}
  }
  async function carregar() {
    const rodada=++sequencia;el('situacao-lista').textContent='Carregando clientes…';
    const query=new URLSearchParams({page:String(page),limit:el('filtro-limit').value||'25',sort:el('filtro-sort').value||'proximo_contato'});
    for(const campo of campos)if(el('filtro-'+campo).value)query.set(campo,el('filtro-'+campo).value);
    try{
      const dados=await requisitar('?'+query.toString());
      if(rodada!==sequencia)return;
      if(!dados||!Array.isArray(dados.clientes))throw new Error('A API retornou uma lista inválida.');
      consultaAplicada=query.toString();ultima=dados;page=dados.page;paginas=Math.max(1,Math.ceil(dados.total/dados.limit));locais();renderizar();
    }catch(error){if(rodada===sequencia)el('situacao-lista').textContent='Não foi possível atualizar a lista. Os dados exibidos podem estar desatualizados.';throw error;}
  }
  el('filtros').addEventListener('submit',event=>{event.preventDefault();page=1;return executar(carregar);});
  for(const campo of campos.filter(c=>c!=='search'))el('filtro-'+campo).addEventListener('change',()=>{if(campo==='estado'){el('filtro-cidade').value='';locais();}page=1;return executar(carregar);});
  el('limpar-filtros').addEventListener('click',()=>{for(const campo of campos)el('filtro-'+campo).value=campo==='sort'?'proximo_contato':campo==='limit'?String(limitePadrao):'';page=1;return executar(carregar);});
  el('preciso-contatar').addEventListener('click',()=>{for(const campo of campos)el('filtro-'+campo).value=campo==='sort'?'proximo_contato':campo==='limit'?String(limitePadrao):'';el('filtro-followup').value='preciso_contatar';page=1;return executar(carregar);});
  el('pagina-anterior').addEventListener('click',()=>{if(page<=1)return;page--;return executar(carregar);});
  el('pagina-proxima').addEventListener('click',()=>{if(page>=paginas)return;page++;return executar(carregar);});
  el('visao-pipeline').addEventListener('change',renderizar);
  return {carregar,definirPadrao:n=>{limitePadrao=n;el('filtro-limit').value=String(n);page=1;},abrirFollowup:async(tipo,f)=>{for(const campo of campos)el('filtro-'+campo).value=campo==='sort'?'proximo_contato':campo==='limit'?String(limitePadrao):'';el('filtro-followup').value=tipo;for(const campo of ['nicho','estado'])el('filtro-'+campo).value=f[campo]||'';locais();el('filtro-cidade').value=f.cidade||'';page=1;return executar(carregar);},consultaExportacao:()=>consultaAplicada,atualizarBotoes:()=>{el('pagina-anterior').disabled=page<=1;el('pagina-proxima').disabled=page>=paginas;}};
}
if(typeof module!=='undefined'&&module.exports)module.exports={criarPipeline};
