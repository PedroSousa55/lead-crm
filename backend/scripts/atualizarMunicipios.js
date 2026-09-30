const fs=require('node:fs/promises');const path=require('node:path');
const BASE='https://servicodados.ibge.gov.br/api/v1/localidades';
async function obter(url){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error('IBGE retornou HTTP '+r.status);return r.json();}
async function atualizar(){
 const [ufs,lista]=await Promise.all([obter(BASE+'/estados'),obter(BASE+'/municipios')]);
 const esperadas='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
 if(!Array.isArray(ufs)||ufs.length!==27||!esperadas.every(uf=>ufs.some(e=>e.sigla===uf)))throw new Error('Resposta de UFs incompleta. Base local preservada.');
 if(!Array.isArray(lista)||lista.length<5500)throw new Error('Resposta de localidades incompleta. Base local preservada.');
 const estados=ufs.map(e=>({id:e.id,uf:e.sigla,nome:e.nome})).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
 const ids=new Set(),nomes=new Set();
 const municipios=lista.map(m=>{
   // O endpoint municipios inclui Brasília/DF e Fernando de Noronha/PE como registros especiais.
   // Os dois primeiros dígitos do código IBGE desses registros identificam a UF.
   const estado=estados.find(e=>e.id===Number(String(m.id).slice(0,2)));
   if(!estado||!Number.isInteger(m.id)||!/^\d{7}$/.test(String(m.id))||typeof m.nome!=='string'||!m.nome.trim()||ids.has(m.id))throw new Error('Registro territorial inválido/duplicado. Base local preservada.');
   const chave=estado.uf+'|'+m.nome;if(nomes.has(chave))throw new Error('Localidade duplicada na UF.');ids.add(m.id);nomes.add(chave);
   return {id:m.id,uf:estado.uf,nome:m.nome};
 }).sort((a,b)=>a.uf.localeCompare(b.uf)||a.nome.localeCompare(b.nome,'pt-BR'));
 if(estados.some(e=>!municipios.some(m=>m.uf===e.uf)))throw new Error('UF sem localidades.');
 const dados={fonte:BASE,consultado_em:new Date().toISOString(),estados,municipios};
 const destino=path.resolve(__dirname,'../../frontend/data/municipios.js');
 const conteudo='// Base local gerada por npm run atualizar:municipios. Não editar manualmente.\nconst BaseLocalidades = '+JSON.stringify(dados,null,2).replace(/</g,'\\u003c')+';\nif (typeof module !== "undefined" && module.exports) module.exports = BaseLocalidades;\n';
 await fs.mkdir(path.dirname(destino),{recursive:true});await fs.writeFile(destino+'.tmp',conteudo,'utf8');await fs.rename(destino+'.tmp',destino);
 console.log('Base IBGE gerada: '+estados.length+' UFs, '+municipios.length+' registros territoriais (incluindo Brasília/DF e Fernando de Noronha/PE).');
}
if(require.main===module)atualizar().catch(e=>{console.error('Falha ao atualizar a base:',e.message);process.exitCode=1;});
module.exports={atualizar};
