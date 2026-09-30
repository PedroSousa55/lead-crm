const service = require('../services/importacaoService');
function nomeArquivo(req) {
  try { return decodeURIComponent(req.get('X-CSV-Name') || ''); }
  catch { throw Object.assign(new Error('Nome de arquivo inválido.'), { status: 400 }); }
}
function handler(previa) {
  return async (req, res) => {
    if (!req.is(['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel.sheet.macroenabled.12'])) return res.status(415).json({ erro: 'Envie um arquivo CSV, XLSX ou XLSM com o tipo de conteúdo correspondente.' });
    try {
      const nome = nomeArquivo(req);
      if (!req.is('text/csv') && !/\.(xlsx|xlsm)$/i.test(nome)) return res.status(415).json({ erro: 'Tipo de conteúdo incompatível com o arquivo.' });
      const aba = req.query.aba;
      if (previa) {
        const analise = service.preparar(req.body, nome, aba);
        if (analise.requerAba) return res.json({ nome, abas: analise.abas, aba: null, requerAba: true });
        return res.json({ nome, abas: analise.abas, aba: analise.aba, requerAba: false, processados: analise.processados, validos: analise.validos.length,
          invalidos: analise.invalidos, descartados: analise.descartados, previa: analise.previa, ignorados: analise.ignorados });
      }
      res.json(await service.importar(req.body, nome, aba));
    } catch (error) {
      if (error.status) return res.status(error.status).json({ erro: error.message });
      console.error('Falha na importação:', error.code || 'ERRO_IMPORTACAO');
      res.status(503).json({ erro: 'Não foi possível concluir a importação. Atualize a lista antes de tentar novamente; telefones já importados serão ignorados.' });
    }
  };
}
module.exports = { previa: handler(true), importar: handler(false) };
