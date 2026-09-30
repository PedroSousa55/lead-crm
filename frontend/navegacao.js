function criarNavegacao({document,aoDashboard,aoVisao}){
 const el=id=>document.getElementById(id),areas=['dashboard','lista','pipeline','dados','configuracoes'];
 const titulos={dashboard:['Visão geral','Acompanhe sua prospecção, um contato de cada vez.'],lista:['Leads','Organize seus contatos e encontre a próxima conversa.'],pipeline:['Pipeline','Acompanhe cada etapa do relacionamento.'],dados:['Dados e backup','Exporte seus dados e mantenha uma cópia segura.'],configuracoes:['Configurações','Seu perfil comercial e suas preferências, em um só lugar.']};
 function menu(aberto){el('barra-lateral').setAttribute('data-aberto',String(aberto));el('menu-mobile').setAttribute('aria-expanded',String(aberto));}
 function navegar(area){if(!areas.includes(area))area='dashboard';for(const a of ['dashboard','dados','configuracoes'])el('area-'+a).hidden=area!==a;el('area-clientes').hidden=!['lista','pipeline'].includes(area);for(const a of areas){el('nav-'+a).setAttribute('aria-pressed',String(a===area));el('nav-'+a).setAttribute('aria-current',a===area?'page':'false');}el('pagina-titulo').textContent=titulos[area][0];el('pagina-descricao').textContent=titulos[area][1];menu(false);if(['lista','pipeline'].includes(area))aoVisao(area);if(area==='dashboard')aoDashboard();}
 for(const a of areas)el('nav-'+a).addEventListener('click',()=>navegar(a));
 el('menu-mobile').addEventListener('click',()=>menu(el('menu-mobile').getAttribute('aria-expanded')!=='true'));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&el('menu-mobile').getAttribute('aria-expanded')==='true'){menu(false);el('menu-mobile').focus();}});
 return {navegar,menu};
}
if(typeof module!=='undefined'&&module.exports)module.exports={criarNavegacao};
