const XLSX = require('xlsx');
const { unzipSync } = require('fflate');
const { mapearCabecalho, validarCabecalho } = require('./importacaoColunas');
const { analisarRegistros, erroArquivo, MAX_LINHAS } = require('./importacaoRegistros');
const MAX_EXCEL_BYTES = 5 * 1024 * 1024;

function lerExcel(buffer, nome, aba) {
  if (typeof nome !== 'string' || nome.length > 255 || !/\.(xlsx|xlsm)$/i.test(nome)) throw erroArquivo('Selecione um arquivo XLSX ou XLSM.');
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw erroArquivo('O arquivo Excel está vazio.');
  if (buffer.length > MAX_EXCEL_BYTES) throw erroArquivo('O Excel deve ter no máximo 5 MB.', 413);
  let workbook;
  try {
    if (buffer.readUInt32LE(0) !== 0x04034b50) throw new Error('assinatura');
    // Inspeciona o pacote antes de descompactar. Nenhum arquivo é escrito no disco.
    let bytes = 0, entradas = 0;
    const nomes = new Set();
    unzipSync(buffer, { filter(entry) {
      bytes += entry.originalSize;
      if (++entradas > 1000 || bytes > 20 * 1024 * 1024) throw new Error('limite ZIP');
      nomes.add(entry.name);
      return false;
    } });
    if (!nomes.has('[Content_Types].xml') || !nomes.has('xl/workbook.xml')) throw new Error('formato');
    // Não extrai VBA, não calcula fórmulas e não segue links externos.
    workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer', bookVBA: false, bookFiles: false,
      cellFormula: true, cellHTML: false, cellText: false, sheetRows: MAX_LINHAS + 2 });
  } catch { throw erroArquivo('Excel inválido, protegido por senha ou acima do limite descompactado (20 MB).'); }
  if (!workbook.SheetNames.length || workbook.SheetNames.length > 30) throw erroArquivo('O Excel deve conter entre 1 e 30 abas.');
  const leituras = new Map();
  const abas = workbook.SheetNames.map(nomeAba => {
    try {
      const ws = workbook.Sheets[nomeAba];
      if (!ws?.['!ref']) throw erroArquivo('Aba vazia.');
      const range = XLSX.utils.decode_range(ws['!fullref'] || ws['!ref']);
      if (range.e.c >= 50 || range.e.r > MAX_LINHAS) throw erroArquivo('Limite de 50 colunas e 1.000 linhas de dados por aba (cabeçalho na primeira linha).');
      const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true, range: 0 });
      const cabecalho = mapearCabecalho(matriz[0] || []);
      const erro = validarCabecalho(cabecalho);
      if (erro) throw erroArquivo(erro);
      const registros = [];
      for (let r = 1; r < matriz.length; r++) {
        const record = cabecalho.map((_, c) => String(matriz[r][c] ?? ''));
        let erroCelula;
        for (let c = 0; c < cabecalho.length; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell?.f || cell?.F || cell?.t === 'e') erroCelula = 'A linha contém fórmula ou erro do Excel. Use valores fixos.';
        }
        if (record.every(v => !v.trim()) && !erroCelula) continue;
        registros.push({ record, info: { lines: r + 1 }, erroCelula });
      }
      const analise = analisarRegistros(cabecalho, registros);
      leituras.set(nomeAba, analise);
      return { nome: nomeAba, valida: true, registros: analise.processados };
    } catch (error) { return { nome: nomeAba, valida: false, motivo: error.message }; }
  });
  if (aba !== undefined && (typeof aba !== 'string' || !leituras.has(aba))) throw erroArquivo('Selecione uma aba válida para importar.');
  const validas = abas.filter(a => a.valida);
  if (!validas.length) throw erroArquivo('Nenhuma aba válida: ' + abas.map(a => a.nome + ': ' + a.motivo).join(' '));
  const escolhida = aba ?? (validas.length === 1 ? validas[0].nome : null);
  if (escolhida === null) return { abas, aba: null, requerAba: true };
  return { ...leituras.get(escolhida), abas, aba: escolhida, requerAba: false };
}
module.exports = { lerExcel, MAX_EXCEL_BYTES };
