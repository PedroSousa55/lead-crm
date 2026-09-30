function criarDadosBackup({document,fetch,baixar,consultaFiltros,aposRestaurar,base=''}) {
  const el=id=>document.getElementById(id);
  let arquivo=null,token=null,validado=false,geracao=0,ocupado=false;
  function feedback(id,texto,erro=false){el(id).textContent=texto;el(id).className=erro?'erro':'sucesso';}
  function botoes(){el('backup-restaurar').disabled=ocupado||!validado||!token||!el('backup-salvo').checked||el('backup-confirmacao').value!=='RESTAURAR';}
  function limpar(){geracao++;arquivo=null;token=null;validado=false;el('backup-arquivo').value='';el('backup-previa').hidden=true;el('backup-cancelar').hidden=true;el('backup-salvo').checked=false;el('backup-confirmacao').value='';botoes();}
  async function resposta(path,options={}){
    let r;try{r=await fetch(base+'/api/'+path,options);}catch{throw new Error('Não foi possível confirmar o resultado da operação. Confira a API e os dados do CRM antes de tentar novamente.');}
    if(!r.ok){let msg='Não foi possível concluir a operação.';try{msg=(await r.json()).erro||msg;}catch{}throw new Error(msg);}return r;
  }
  const enviar=path=>resposta('backup/'+path,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Restauracao-Token':token||'','X-Confirmacao':el('backup-confirmacao').value},body:arquivo});
  async function download(r){const blob=await r.blob();const nome=/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition')||'')?.[1];if(!nome)throw new Error('A API não retornou um arquivo válido.');await baixar(blob,nome);}
  async function exportar(tipo){
    try{
      const escopo=el('dados-escopo').value;
      const q=new URLSearchParams(tipo==='clientes'&&escopo==='filtrados'?consultaFiltros():'');q.delete('page');q.delete('limit');q.set('formato',el('dados-formato').value);q.set('escopo',tipo==='clientes'?escopo:'todos');
      await download(await resposta('exportacao/'+tipo+'?'+q));feedback('dados-feedback','Exportação concluída.');
    }catch(e){feedback('dados-feedback',e.message,true);}
  }
  el('dados-leads').addEventListener('click',()=>exportar('clientes'));
  el('dados-historico').addEventListener('click',()=>exportar('prospeccoes'));
  el('dados-backup').addEventListener('click',async()=>{try{await download(await resposta('backup'));feedback('dados-feedback','Backup criado com sucesso.');}catch(e){feedback('dados-feedback',e.message,true);}});
  el('backup-arquivo').addEventListener('change',async()=>{
    if(ocupado)return;const file=el('backup-arquivo').files?.[0];limpar();if(!file)return;
    const rodada=geracao;el('backup-cancelar').hidden=false;
    if(!/\.json$/i.test(file.name)){feedback('backup-feedback','Backup inválido. Selecione um arquivo JSON.',true);return;}
    if(file.size>20*1024*1024){feedback('backup-feedback','Arquivo de backup excede o limite de 20 MB.',true);return;}
    arquivo=file;feedback('backup-feedback','Validando backup…');
    try{
      const r=await(await enviar('validar')).json();if(rodada!==geracao)return;
      validado=true;el('backup-previa').hidden=false;
      el('backup-resumo').textContent='Backup criado: '+new Date(r.backup.criado_em).toLocaleString('pt-BR')+' · Clientes: '+r.resumo.quantidade_clientes+' · Prospecções: '+r.resumo.quantidade_prospeccoes+' · Versão: '+r.backup.versao_backup+(r.backup.versao_backup===1?' · Backup antigo: as configurações atuais serão mantidas.':' · Inclui configurações comerciais e preferências.');
      feedback('backup-feedback','Backup válido. Baixe e guarde a cópia dos dados atuais antes de confirmar.');
    }catch(e){if(rodada===geracao){arquivo=null;feedback('backup-feedback',e.message,true);}}
    botoes();
  });
  el('backup-seguranca').addEventListener('click',async()=>{
    if(!validado||ocupado)return;const rodada=geracao;token=null;botoes();
    try{const r=await enviar('seguranca');await download(r);if(rodada!==geracao)return;token=r.headers.get('X-Restauracao-Token');el('backup-salvo').checked=false;feedback('backup-feedback','Download da cópia de segurança iniciado. Confirme que o arquivo foi salvo.');}
    catch(e){if(rodada===geracao)feedback('backup-feedback',e.message,true);}botoes();
  });
  el('backup-salvo').addEventListener('change',botoes);el('backup-confirmacao').addEventListener('input',botoes);
  el('backup-cancelar').addEventListener('click',()=>{if(ocupado)return;limpar();feedback('backup-feedback','Restauração cancelada.');});
  el('backup-restaurar').addEventListener('click',async()=>{
    if(ocupado||!validado||!token||!el('backup-salvo').checked||el('backup-confirmacao').value!=='RESTAURAR')return;
    ocupado=true;el('backup-arquivo').disabled=true;el('backup-cancelar').disabled=true;botoes();
    feedback('backup-feedback','Restaurando backup…');
    try{await enviar('restaurar');limpar();feedback('backup-feedback','Restauração concluída.');await aposRestaurar();}
    catch(e){token=null;el('backup-salvo').checked=false;feedback('backup-feedback',e.message,true);}
    finally{ocupado=false;el('backup-arquivo').disabled=false;el('backup-cancelar').disabled=false;botoes();}
  });
  botoes();return {limpar};
}
if(typeof module!=='undefined'&&module.exports)module.exports={criarDadosBackup};
else criarDadosBackup({document,fetch,base:API_BASE_URL,consultaFiltros:()=>pipeline.consultaExportacao(),aposRestaurar:async()=>{window.alert('Restauração concluída. A página será atualizada para carregar os dados restaurados.');window.location.reload();},baixar:async(blob,nome)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=nome;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}});
