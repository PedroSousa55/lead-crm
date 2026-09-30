const { validarConsulta } = require('../services/clienteConsulta');
const { validarFollowup } = require('./followupValidation');
const clienteModel = require('../models/clienteModel');
const { validarCliente, validarId } = require('./clienteValidation');

function falha(res, error) {
  console.error('Falha na operação de clientes:', error.code || 'ERRO_BANCO');
  return res.status(503).json({ erro: 'Não foi possível acessar os clientes. Verifique a conexão com o banco de dados.' });
}
function idValido(req, res) {
  if (validarId(req.params.id)) return true;
  res.status(400).json({ erro: 'Informe um ID de cliente válido.' });
  return false;
}
function ausente(res) {
  return res.status(404).json({ erro: 'Cliente não encontrado.' });
}
async function listar(req, res) {
  if (!Object.keys(req.query).length) {
    try { res.json(await clienteModel.listarTodos()); } catch (error) { falha(res,error); }
    return;
  }
  const {dados,erros}=validarConsulta(req.query);
  if(erros.length)return res.status(400).json({erro:erros.join(' ')});
  try { res.json(await clienteModel.listarFiltrados(dados)); } catch(error) { falha(res,error); }
}
async function buscar(req, res) {
  if (!idValido(req, res)) return;
  try {
    const cliente = await clienteModel.buscarPorId(Number(req.params.id));
    if (!cliente) return ausente(res);
    res.json(cliente);
  } catch (error) { falha(res, error); }
}
async function salvar(req, res) {
  const editando = req.params.id !== undefined;
  if (editando && !idValido(req, res)) return;
  // A validação normaliza a classificação possui_site e o Instagram.
  const { dados, erros } = validarCliente(req.body);
  if (Object.keys(erros).length) {
    return res.status(400).json({ erro: 'Revise os campos informados.', campos: erros });
  }
  try {
    if (editando) {
      const id = Number(req.params.id);
      if (!await clienteModel.atualizar(id, dados)) return ausente(res);
      return res.json(await clienteModel.buscarPorId(id));
    }
    const cliente = await clienteModel.criar(dados);
    res.location(`/api/clientes/${cliente.id}`).status(201).json(cliente);
  } catch (error) { falha(res, error); }
}
async function excluir(req, res) {
  if (!idValido(req, res)) return;
  try {
    if (!await clienteModel.excluir(Number(req.params.id))) return ausente(res);
    res.status(204).end();
  } catch (error) { falha(res, error); }
}
async function followup(req,res) {
  if(!idValido(req,res))return;
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))return res.status(400).json({erro:'Envie os dados do próximo contato.'});
  const {dados,erros}=validarFollowup(req.body);
  if(Object.keys(erros).length||!Object.keys(dados).length)return res.status(400).json({erro:'Revise o próximo contato.',campos:erros});
  try {if(!await clienteModel.atualizarFollowup(Number(req.params.id),dados))return ausente(res);res.json(await clienteModel.buscarPorId(Number(req.params.id)));}catch(error){falha(res,error);}
}
module.exports = { listar, buscar, salvar, excluir, followup };
