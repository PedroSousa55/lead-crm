const { lerCsv } = require('./csvService');
const { lerExcel } = require('./excelService');
const { erroArquivo } = require('./importacaoRegistros');
const model = require('../models/importacaoModel');
function preparar(buffer, nome, aba) {
  return /\.(xlsx|xlsm)$/i.test(nome) ? lerExcel(buffer, nome, aba) : lerCsv(buffer, nome);
}
async function importar(buffer, nome, aba) {
  const analise = preparar(buffer, nome, aba);
  if (analise.requerAba) throw erroArquivo('Escolha uma aba e confira a prévia antes de importar.');
  const resultado = await model.importar(analise.validos);
  return { processados: analise.processados, importados: resultado.importados, duplicados: resultado.duplicados,
    invalidos: analise.invalidos, descartados: analise.descartados,
    ignorados: [...analise.ignorados, ...resultado.ignorados].sort((a, b) => a.linha - b.linha) };
}
module.exports = { preparar, importar };
