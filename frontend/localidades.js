const Localidades = (() => {
  const base = typeof module !== 'undefined' && module.exports ? require('./data/municipios') : BaseLocalidades;
  const chave = valor => typeof valor === 'string' ? valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR') : '';
  const porUF = new Map(base.estados.map(e => [e.uf, base.municipios.filter(m => m.uf === e.uf)]));
  const estadosPorNome = new Map();
  for (const e of base.estados) for (const nome of [e.uf,e.nome,e.nome+' ('+e.uf+')']) estadosPorNome.set(chave(nome),e.uf);
  function normalizarUF(valor) { return estadosPorNome.get(chave(valor)) || null; }
  function cidades(uf, busca = '') {
    const itens = porUF.get(normalizarUF(uf)) || [];
    const termo = chave(busca);
    return termo ? itens.filter(m => chave(m.nome).includes(termo)) : itens;
  }
  function normalizar(estado, cidade) {
    const erros={},dados={estado:null,cidade:null};
    const temEstado=estado!=null&&estado!=='',temCidade=cidade!=null&&cidade!=='';
    if(temEstado && typeof estado!=='string')erros.estado='Informe um estado brasileiro válido.';
    else if(chave(estado)){
      dados.estado=normalizarUF(estado);
      if(!dados.estado)erros.estado='Informe um dos 26 estados ou o Distrito Federal.';
    }
    if(temCidade && typeof cidade!=='string')erros.cidade='Informe um município válido.';
    else if(chave(cidade)){
      if(!dados.estado)erros.cidade='Selecione primeiro o estado para identificar o município.';
      else {
        const encontrados=cidades(dados.estado).filter(m=>chave(m.nome)===chave(cidade));
        if(encontrados.length===1)dados.cidade=encontrados[0].nome;
        else erros.cidade=encontrados.length>1?'Município ambíguo: revise a localidade.':'Cidade não pertence ao estado informado.';
      }
    }
    return {dados,erros};
  }
  function cidadeParaFiltro(cidade, estado) {
    if(estado)return normalizar(estado,cidade);
    const nomes=[...new Set(base.municipios.filter(m=>chave(m.nome)===chave(cidade)).map(m=>m.nome))];
    return nomes.length===1?{dados:{cidade:nomes[0]},erros:{}}:{dados:{},erros:{cidade:'Município não identificado com segurança. Selecione o estado.'}};
  }
  return {chave,normalizarUF,cidades,normalizar,cidadeParaFiltro,estados:base.estados,municipios:base.municipios};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Localidades;
