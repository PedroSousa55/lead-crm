const Localidades = require('../../frontend/localidades');
const { validarFollowup } = require('./followupValidation');
const { urlInstagram } = require('../../frontend/instagram');
const STATUS = ['nao_contatado', 'contatado', 'interessado', 'sem_resposta', 'negociacao', 'fechado', 'descartado', 'respondeu', 'nao_contatar'];
const LIMITES = { nome_empresa: 255, telefone: 30, nicho: 120, instagram: 255, status: 50, observacoes: 10000, gancho_verificado: 1000 };

function validarCliente(body) {
  const erros = {};
  const dados = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { erros: { formulario: 'Envie um objeto JSON com os dados do cliente.' } };
  }
  const escolha = body.possui_site;
  if ([1, '1', true].includes(escolha)) dados.possui_site = 1;
  else if ([0, '0', false].includes(escolha)) dados.possui_site = 0;
  else if (escolha == null || escolha === '') dados.possui_site = null;
  else erros.possui_site = 'Selecione Sim ou Não.';
  for (const [campo, limite] of Object.entries(LIMITES)) {
    let valor = body[campo];
    if (campo === 'status' && valor === undefined) valor = 'nao_contatado';
    if (campo !== 'status' && valor == null) valor = '';
    if (typeof valor !== 'string') {
      erros[campo] = 'Informe um texto válido.';
      continue;
    }
    // Preserva as quebras de linha das observações.
    valor = campo === 'observacoes'
      ? valor.replace(/\r\n?/g, '\n').split('\n').map(linha => linha.trim().replace(/[ \t]+/g, ' ')).join('\n').trim()
      : valor.trim().replace(/\s+/g, ' ');
    if (campo === 'instagram') valor = urlInstagram(valor) || valor;
    if (['nome_empresa', 'telefone'].includes(campo) && !valor) erros[campo] = 'Este campo é obrigatório.';
    if ([...valor].length > limite) erros[campo] = `Use no máximo ${limite} caracteres.`;
    if (campo === 'status' && !STATUS.includes(valor)) erros[campo] = 'Selecione um status permitido.';
    dados[campo] = valor || null;
  }
  const localidade = Localidades.normalizar(body.estado, body.cidade);
  Object.assign(dados, localidade.dados); Object.assign(erros, localidade.erros);
  const followup = validarFollowup(body);
  Object.assign(dados, followup.dados); Object.assign(erros, followup.erros);
  return { dados, erros };
}

function validarId(value) {
  return /^[1-9]\d*$/.test(value) && Number(value) <= 4294967295;
}
module.exports = { validarCliente, validarId };
