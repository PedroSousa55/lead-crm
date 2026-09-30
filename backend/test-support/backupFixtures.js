const v=require('../services/backupValidation');
function dados(){
  const c=Object.fromEntries(Object.keys(v.CAMPOS.clientes).map(k=>[k,null]));
  Object.assign(c,{id:7,nome_empresa:'Clínica "São Luís", Estética',telefone:'31999999999',cidade:'São Luís',estado:'MA',possui_site:0,status:'nao_contatado',nao_contatar:1,observacoes:'Observações com ç/ã/é\nSegunda linha',created_at:'2026-09-23 10:20:30',updated_at:'2026-09-23 10:20:30'});
  return {clientes:[c],prospeccoes:[{id:9,cliente_id:7,canal:'whatsapp',estrategia:'direta',variant_id:'direta_01',mensagem:'  Olá, "Clínica"! 👋\nSão Luís, Maranhão.  ',data_contato:'2026-09-23 10:30:00',resultado:'respondeu',data_resposta:'2026-09-23 10:35:00'}]};
}
module.exports={dados,backup:()=>v.criar(dados())};
