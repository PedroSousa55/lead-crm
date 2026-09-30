function criarTema({document,storage,media}){
 let salvo;try{salvo=storage.getItem('lead-crm-tema');}catch{}
 let explicito=['light','dark'].includes(salvo),atual=explicito?salvo:media.matches?'dark':'light';
 function aplicar(){document.documentElement.setAttribute('data-theme',atual);const b=document.getElementById('alternar-tema');if(b){b.textContent=atual==='dark'?'Modo claro':'Modo escuro';b.setAttribute('aria-label','Ativar '+b.textContent.toLowerCase());}}
 function alternar(){atual=atual==='dark'?'light':'dark';explicito=true;try{storage.setItem('lead-crm-tema',atual);}catch{}aplicar();}
 aplicar();media.addEventListener('change',e=>{if(!explicito){atual=e.matches?'dark':'light';aplicar();}});
 return {alternar,aplicar};
}
if(typeof module!=='undefined'&&module.exports)module.exports={criarTema};
else{
 let storage;try{storage=window.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{}};}
 const temaCRM=criarTema({document,storage,media:window.matchMedia('(prefers-color-scheme: dark)')});
 document.addEventListener('DOMContentLoaded',()=>{temaCRM.aplicar();document.getElementById('alternar-tema').addEventListener('click',temaCRM.alternar);});
}
