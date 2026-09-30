const model = require('../models/prospeccaoModel');
const clientes = require('../models/clienteModel');
const { validarId } = require('./clienteValidation');
const { validarContato, RESULTADOS } = require('./prospeccaoValidation');
function endpoint(acao) {
  return async (req, res) => {
    if (!validarId(req.params.id) || (req.params.contatoId !== undefined && !validarId(req.params.contatoId))) return res.status(400).json({ erro: 'Informe um ID válido.' });
    try { await acao(req, res, Number(req.params.id)); }
    catch (error) {
      if (error.status) return res.status(error.status).json({ erro: error.message });
      console.error('Falha na prospecção:', error.code || 'ERRO_BANCO');
      res.status(503).json({ erro: 'Não foi possível concluir a operação. Atualize o histórico antes de tentar novamente.' });
    }
  };
}
const registrar = endpoint(async (req, res, id) => {
  const { dados, erro } = validarContato(req.body);
  if (erro) return res.status(400).json({ erro });
  await model.registrar(id, dados);
  res.json(await clientes.buscarPorId(id));
});
const listar = endpoint(async (_req, res, id) => {
  if (!await clientes.buscarPorId(id)) return res.status(404).json({ erro: 'Cliente não encontrado.' });
  res.json(await model.listar(id));
});
const resultado = endpoint(async (req, res, id) => {
  if (!RESULTADOS.includes(req.body?.resultado)) return res.status(400).json({ erro: 'Selecione um resultado permitido.' });
  await model.atualizarResultado(id, Number(req.params.contatoId), req.body.resultado);
  res.json(await clientes.buscarPorId(id));
});
const naoContatar = endpoint(async (_req, res, id) => { await model.naoContatar(id); res.json(await clientes.buscarPorId(id)); });
module.exports = { registrar, listar, resultado, naoContatar };
