function criarDashboard({document,fetch,localidades,abrirLista,base=''}){
 const dataBR=typeof module!=='undefined'&&module.exports?require('./datas').formatar:DataCRM.formatar;
 const el=id=>document.getElementById(id),estagios={nao_contatado:'Não contatado',contatado:'Aguardando resposta',respondeu:'Respondeu',interessado:'Interessado',negociacao:'Negociação',fechado:'Fechado',descartado:'Não interessado',nao_contatar:'Não contatar'};
 let rodada=0,aplicados={};
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n};
 const porcento=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
 function opcoes(select,lista,placeholder){const atual=select.value;select.replaceChildren(...[['',placeholder],...lista].map(([v,t])=>{const o=node('option',t);o.value=v;return o}));select.value=lista.some(([v])=>v===atual)?atual:'';}
 opcoes(el('dashboard-estado'),localidades.estados.map(e=>[e.uf,e.nome+' ('+e.uf+')']),'Todos os estados');
 function cidades(){el('dashboard-cidade').value='';const uf=el('dashboard-estado').value;el('dashboard-cidade').disabled=!uf;opcoes(el('dashboard-cidade'),localidades.cidades(uf).map(m=>[m.nome,m.nome]),uf?'Todas as cidades':'Selecione o estado');}
 el('dashboard-estado').addEventListener('change',cidades);
 el('dashboard-periodo').addEventListener('change',()=>{const custom=el('dashboard-periodo').value==='personalizado';for(const c of ['inicio','fim']){el('dashboard-'+c+'-campo').hidden=!custom;el('dashboard-'+c).required=custom;}});
 function tabela(id,headers,rows){const table=node('table'),head=node('thead'),tr=node('tr'),body=node('tbody');for(const h of headers)tr.append(node('th',h));head.append(tr);for(const r of rows){const row=node('tr');for(const v of r)row.append(node('td',v??'Não informado'));body.append(row);}table.append(head,body);el(id).replaceChildren(rows.length?table:node('p','Sem dados suficientes neste período.'));}
 function barras(id,rows){const max=Math.max(1,...rows.map(r=>r[1]));el(id).replaceChildren(...rows.map(([texto,n,key])=>{const box=node('div');box.className='dashboard-barra '+(key||'');const p=node('p',texto+': '+n),bar=node('progress');bar.max=max;bar.value=n;bar.setAttribute('aria-label',texto+': '+n);box.append(p,bar);return box}));}
 function renderizar(r){
  const s=r.resumo,rotulos={leads:'Total de leads · estoque',contatados:'Contatados · únicos',responderam:'Responderam · únicos',interessados:'Interessados · acumulado',negociacao:'Em negociação · acumulado',fechados:'Fechados · evidência',contatos:'Contatos realizados'};
  const cards=Object.entries(rotulos).map(([k,label])=>{const p=node('p');p.append(node('span',label),node('strong',s[k]));return p});
  for(const [k,label] of [['hoje','Follow-ups para hoje · estoque'],['atrasados','Follow-ups atrasados · estoque']]){const p=node('p');p.append(node('span',label),node('strong',r.followups[k]));cards.push(p)}el('dashboard-cards').replaceChildren(...cards);
  el('dashboard-taxas').replaceChildren(...[['resposta','Taxa de resposta','respondidos','contatados'],['interesse','Taxa de interesse','interessados','respondidos'],['fechamento','Taxa de fechamento','fechados','contatados']].map(([k,label,num,den])=>{const t=r.taxas[k],p=node('p');p.title=label+' = leads '+num+' / leads '+den+'.';p.append(node('span',label),node('strong',porcento(t.percentual)),node('span',t.numerador+' '+num+' / '+t.denominador+' '+den));return p}));
  barras('dashboard-funil',r.funil.map(e=>[rotulos[e.etapa],e.quantidade]));barras('dashboard-pipeline',Object.entries(estagios).map(([k,n])=>[n,r.pipeline.find(p=>p.estagio===k)?.total||0,k]));
  el('dashboard-followups').replaceChildren(...[['hoje','Hoje'],['atrasados','Atrasados'],['proximos','Próximos 7 dias']].map(([k,n])=>{const b=node(k==='proximos'?'p':'button',n+': '+r.followups[k]);if(k!=='proximos'){b.type='button';b.addEventListener('click',()=>abrirLista(k,aplicados));}return b}));
  const taxa=t=>porcento(t.percentual)+' ('+t.numerador+'/'+t.denominador+')';
  tabela('dashboard-estrategias',['Abordagem','Leads contatados','Responderam','Taxa de resposta','Interessados','Fechados','Amostra'],r.estrategias.map(e=>[e.nome,e.contatados,e.responderam,taxa(e.taxa_resposta),e.interessados,e.fechados,e.amostra_pequena?'Amostra pequena':'≥ 10 leads']));
  tabela('dashboard-variantes',['Variante','Estratégia','Leads contatados','Contatos realizados','Responderam','Interessados','Fechados'],r.variantes.map(e=>[e.variant_id||'Sem variante',e.estrategia,e.contatados,e.contatos,e.responderam,e.interessados,e.fechados]));
  for(const grupo of ['nichos','estados'])tabela('dashboard-'+grupo,[grupo==='nichos'?'Nicho':'Estado','Leads · estoque','Contatados','Responderam','Interessados','Fechados','Taxa de resposta'],r[grupo].map(e=>[e.grupo,e.leads,e.contatados,e.responderam,e.interessados,e.fechados,taxa(e.taxa_resposta)]));
  tabela('dashboard-evolucao',['Período','Contatos realizados','Leads com resposta','Fechados por contato'],r.evolucao.map(e=>[dataBR(e.periodo),e.contatos,e.respostas,e.fechados]));
  el('dashboard-evolucao-info').textContent='Agrupamento por '+(r.periodo.agrupamento==='dia'?'dia':'mês')+'. Até 36 faixas recentes com atividade.';
  el('dashboard-periodo-info').textContent=r.periodo.inicio?'Contatos e respostas: de '+dataBR(r.periodo.inicio.slice(0,10))+' até antes de '+dataBR(r.periodo.fim_exclusivo.slice(0,10))+'. Horário local do MySQL.':'Todo o período: histórico disponível e estágio atual dos leads com contato registrado.';
  opcoes(el('dashboard-nicho'),r.opcoes.map(o=>[o.nicho,o.nicho]),'Todos os nichos');
  el('dashboard-aviso').textContent=(s.contatados?'Dashboard atualizado.':'Sem dados suficientes neste período.')+(Number(s.sem_historico)?' '+s.sem_historico+' lead(s) com estágio avançado sem histórico: aparecem somente no estoque/pipeline.':'');
 }
 async function carregar(){const atual=++rodada,q=new URLSearchParams();for(const k of ['periodo','nicho','estado','cidade'])if(el('dashboard-'+k).value)q.set(k,el('dashboard-'+k).value);if(q.get('periodo')==='personalizado')for(const k of ['inicio','fim'])q.set(k,el('dashboard-'+k).value);el('dashboard-aviso').textContent='Carregando dashboard…';
  try{const response=await fetch(base+'/api/metricas/dashboard?'+q,{signal:AbortSignal.timeout(20000)}),r=await response.json();if(atual!==rodada)return;if(!response.ok)throw Error(r.erro||'Falha ao carregar métricas.');aplicados=Object.fromEntries(q);renderizar(r);}catch(e){if(atual===rodada)el('dashboard-aviso').textContent='Não foi possível atualizar o dashboard. Os dados exibidos podem estar desatualizados. '+e.message;}
 }
 el('dashboard-filtros').addEventListener('submit',e=>{e.preventDefault();return carregar()});return {carregar};
}
if(typeof module!=='undefined'&&module.exports)module.exports={criarDashboard};
else {
 const doc=id=>document.getElementById(id);
 const dashboard=criarDashboard({document,fetch,localidades:Localidades,base:API_BASE_URL,abrirLista:async(tipo,f)=>{navegacao.navegar('lista');await pipeline.abrirFollowup(tipo,f);}});
 const navegacao=criarNavegacao({document,aoDashboard:()=>dashboard.carregar(),aoVisao:area=>{doc('visao-pipeline').value=area;doc('visao-pipeline').dispatchEvent(new Event('change'));}});
 inicializacao.then(()=>navegacao.navegar(configuracoesCRM?.obter().tela_inicial||'dashboard'));
}
