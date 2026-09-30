const { validarCliente } = require('../controllers/clienteValidation');
const { validarCabecalho } = require('./importacaoColunas');
const MAX_LINHAS = 1000;
function erroArquivo(message, status = 400) { return Object.assign(new Error(message), { status }); }
function normalizarTelefone(value) { return String(value ?? '').replace(/\D/g, ''); }
function analisarRegistros(cabecalho, registros) {
  const erro = validarCabecalho(cabecalho);
  if (erro) throw erroArquivo(erro);
  if (!registros.length) throw erroArquivo('O arquivo não contém registros.');
  if (registros.length > MAX_LINHAS) throw erroArquivo('Importe no máximo 1.000 registros por aba/arquivo.');
  const validos = [], ignorados = [], previa = [];
  for (const { record, info, erroCelula } of registros) {
    const linha = info.lines;
    const raw = Object.fromEntries(cabecalho.map((c, i) => [c, record[i] ?? '']));
    let erros = {}, dados;
    if (erroCelula) erros.planilha = erroCelula;
    else if (record.length !== cabecalho.length) erros.csv = 'Quantidade de campos diferente do cabeçalho.';
    else {
      const body = { ...raw, telefone: normalizarTelefone(raw.telefone), status: raw.status?.trim() || 'nao_contatado' };
      const escolha = raw.possui_site?.trim().toLowerCase() || '';
      if (['sim', '1'].includes(escolha)) body.possui_site = 1;
      else if (['nao', 'não', '0'].includes(escolha)) body.possui_site = 0;
      else if (!escolha) body.possui_site = null;
      else body.possui_site = 'invalido';
      ({ dados, erros } = validarCliente(body));
      if (!/^\d{10,15}$/.test(body.telefone) || /^(\d)\1+$/.test(body.telefone)) {
        erros.telefone = 'Informe um telefone com 10 a 15 dígitos, sem sequência de um único dígito.';
      }
    }
    const descartado = dados?.possui_site === 1;
    const motivos = descartado ? ['Empresa possui site'] : Object.entries(erros).map(([campo, mensagem]) => campo + ': ' + mensagem);
    if (descartado) ignorados.push({ linha, tipo: 'descartado', motivos });
    else if (motivos.length) ignorados.push({ linha, tipo: 'invalido', motivos });
    else validos.push({ linha, dados });
    if (previa.length < 5) previa.push({ linha, dados: dados || raw, motivos });
  }
  return { processados: registros.length, validos, ignorados, previa,
    invalidos: ignorados.filter(r => r.tipo === 'invalido').length,
    descartados: ignorados.filter(r => r.tipo === 'descartado').length };
}
module.exports = { analisarRegistros, normalizarTelefone, erroArquivo, MAX_LINHAS };
