const InterfaceCRM={
 abrirCadastro(document){const d=document.getElementById('cadastro-dialog');if(!d.open)d.showModal();document.getElementById('formulario').elements.namedItem('nome_empresa').focus?.();},
 fecharCadastro(document){document.getElementById('cadastro-dialog').close?.();},
 errosFormulario(document,campos={}){for(const input of document.getElementById('formulario').querySelectorAll?.('[name]')||[]){const msg=campos[input.name]||'';input.setAttribute('aria-invalid',String(Boolean(msg)));const aviso=document.getElementById('erro-lead-'+input.name);if(aviso)aviso.textContent=msg;}},
 estadoVazio(total,filtros){return total?'':filtros?'Nenhum lead encontrado com esses filtros. Limpe os filtros ou tente outra busca.':'Nenhum lead cadastrado. Use Novo lead para adicionar seu primeiro contato.';}
};
if(typeof module!=='undefined'&&module.exports)module.exports=InterfaceCRM;
