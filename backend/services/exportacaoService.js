const XLSX=require('xlsx');
const pool=require('../config/database');
const model=require('../models/dadosModel');
const {validarConsulta}=require('./clienteConsulta');
const {erro}=require('./backupValidation');
const COLUNAS={
  clientes:[['id','ID'],['nome_empresa','Empresa'],['telefone','WhatsApp'],['nicho','Nicho'],['cidade','Cidade'],['estado','Estado'],['instagram','Instagram'],['possui_site','Possui site'],['status','Status'],['observacoes','Observações'],['gancho_verificado','Gancho verificado'],['nao_contatar','Não contatar'],['ultima_data_contato','Último contato'],['proximo_contato_em','Próximo contato'],['proxima_acao','Próxima ação'],['created_at','Data de cadastro'],['updated_at','Última atualização']],
  prospeccoes:[['id','ID'],['cliente_id','ID do cliente'],['nome_empresa','Empresa'],['canal','Canal'],['estrategia','Estratégia'],['variant_id','ID da variante'],['mensagem','Mensagem'],['data_contato','Data do contato'],['resultado','Resultado'],['data_resposta','Data da resposta']]
};
function nomeArquivo(prefixo,ext){return prefixo+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+ext;}
function gerar(tabela,rows,formato){
  const col=COLUNAS[tabela],matriz=[col.map(c=>c[1]),...rows.map(r=>col.map(([k])=>r[k]??''))];
  if(formato==='csv'){
    // Aspas protegem a estrutura; apóstrofo protege textos que planilhas poderiam executar como fórmula.
    const cell=v=>{let s=String(v);if(typeof v==='string'&&/^(?:\s*[=+\-@]|[\t\r\n])/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    return {buffer:Buffer.from('\uFEFF'+matriz.map(r=>r.map(cell).join(';')).join('\r\n')+'\r\n'),mime:'text/csv; charset=utf-8'};
  }
  if(formato!=='xlsx')throw erro('Escolha CSV ou XLSX.');
  if(matriz.some(r=>r.some(v=>typeof v==='string'&&v.length>32767)))throw erro('Um texto excede o limite de célula do XLSX. Exporte em CSV para preservar o conteúdo.');
  const wb=XLSX.utils.book_new();const sheet=XLSX.utils.aoa_to_sheet(matriz);
  XLSX.utils.book_append_sheet(wb,sheet,tabela==='clientes'?'Leads':'Histórico');
  return {buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx',compression:true}),mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
}
async function exportar(tabela,query){
  const {formato='xlsx',escopo='todos',...filtros}=query;
  if(typeof formato!=='string'||!['csv','xlsx'].includes(formato)||!['todos','filtrados'].includes(escopo))throw erro('Formato ou escopo inválido.');
  const {dados,erros}=validarConsulta(filtros);if(erros.length)throw erro(erros.join(' '));
  const consulta=escopo==='filtrados'?dados:validarConsulta({}).dados;
  const rows=tabela==='clientes'?await model.exportarClientes(pool,consulta):await model.exportarHistorico(pool);
  const prefixo=tabela==='clientes'?(escopo==='filtrados'?'leads-filtrados':'leads'):'historico-prospeccao';
  return {...gerar(tabela,rows,formato),nome:nomeArquivo(prefixo,formato)};
}
module.exports={exportar,gerar,nomeArquivo,COLUNAS};
