const XLSX = require('xlsx');
const header = ['Nome da empresa','WhatsApp','Categoria','Cidade','Estado','Instagram','Tem site','Status','Observação'];
function planilha(abas, tipo = 'xlsx', vba = false) {
  const wb = XLSX.utils.book_new();
  for (const [nome, linhas] of Object.entries(abas)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), nome);
  // Conteúdo opaco de teste: jamais interpretado nem executado pelo importador.
  if (vba) wb.vbaraw = Buffer.from('VBA_TESTE_NAO_EXECUTAR');
  return XLSX.write(wb, { type: 'buffer', bookType: tipo });
}
const linhas = [header,
  ['Academia Teste 4.1','(31) 99715-0594','Academia','Belo Horizonte','MG','@academiateste',0,'',''],
  ['Duplicado interno','31997150594','Academia','','','',0,'',''],
  ['Com site','31997150595','','','','',1,'',''],
  ['', '31997150596','','','','',0,'',''],
  ['Clínica Teste 4.1',31997150597,'Clínica','','','https://instagram.com/clinicateste/',0,'interessado','']];
module.exports = { planilha, header, linhas };
