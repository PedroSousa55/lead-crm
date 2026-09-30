const { parse } = require('csv-parse/sync');
const { mapearCabecalho, validarCabecalho } = require('./importacaoColunas');
const { analisarRegistros, normalizarTelefone, erroArquivo, MAX_LINHAS } = require('./importacaoRegistros');
const MAX_BYTES = 1024 * 1024;
function lerCsv(buffer, nome) {
  if (typeof nome !== 'string' || nome.length > 255 || !/\.csv$/i.test(nome)) throw erroArquivo('Selecione um arquivo .csv.');
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw erroArquivo('O arquivo CSV está vazio ou não foi enviado como text/csv.');
  if (buffer.length > MAX_BYTES) throw erroArquivo('O arquivo deve ter no máximo 1 MB.', 413);
  let texto;
  try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { throw erroArquivo('Salve o CSV com codificação UTF-8.'); }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(texto)) throw erroArquivo('O arquivo contém conteúdo binário ou caracteres não permitidos.');
  let registros, cabecalho;
  // O separador é escolhido pelo cabeçalho obrigatório, não pela extensão.
  for (const delimiter of [',', ';']) {
    try {
      const parsed = parse(texto, { delimiter, bom: true, skip_empty_lines: true, relax_column_count: true,
        info: true, max_record_size: MAX_BYTES });
      const header = parsed[0] && mapearCabecalho(parsed[0].record);
      if (header?.includes('nome_empresa') && header.includes('telefone')) {
        registros = parsed.slice(1);
        cabecalho = header;
        break;
      }
    } catch { /* Tenta o outro separador; um CSV estruturalmente quebrado é rejeitado inteiro. */ }
  }
  if (!cabecalho) throw erroArquivo('CSV inválido. Confira as aspas, o separador e os cabeçalhos nome_empresa e telefone.');
  const erro = validarCabecalho(cabecalho);
  if (erro) throw erroArquivo(erro);
  if (!registros.length) throw erroArquivo('O CSV não contém registros.');
  if (registros.length > MAX_LINHAS) throw erroArquivo('Importe no máximo 1.000 registros por arquivo.');
  return analisarRegistros(cabecalho, registros);
}
module.exports = { lerCsv, normalizarTelefone, MAX_BYTES };
