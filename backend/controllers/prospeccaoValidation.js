const { validarFollowup } = require('./followupValidation');
const templates = require('../../frontend/mensagemTemplates');
const RESULTADOS = ['aguardando_resposta', 'respondeu', 'interessado', 'nao_interessado', 'negociacao', 'fechado', 'nao_contatar'];
function validarContato(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { erro: 'Envie a mensagem utilizada no contato.' };
  const { mensagem, estrategia = 'manual', variant_id = null } = body;
  if (typeof mensagem !== 'string' || !mensagem.trim() || [...mensagem].length > 10000 || /\u0000/.test(mensagem)) {
    return { erro: 'Informe a mensagem utilizada, com até 10.000 caracteres.' };
  }
  const novas = typeof estrategia === 'string' && Object.hasOwn(templates.mensagens, estrategia) && variant_id === estrategia + '_01';
  // Compatibilidade explícita com rascunhos/histórico das etapas 5 e 5.1.
  const antigas = ['curiosidade', 'beneficio', 'problema', 'direta', 'pergunta'].includes(estrategia) &&
    ['', 'v51_'].some(versao => [1, 2, 3].some(i => variant_id === estrategia + '_' + versao + '0' + i));
  const valida = novas || antigas;
  if (!(estrategia === 'manual' && variant_id === null) && !valida) return { erro: 'Estratégia ou variante inválida.' };
  if (body.confirmar_nao_contatar !== undefined && typeof body.confirmar_nao_contatar !== 'boolean') return { erro: 'A confirmação de não contatar deve ser explícita.' };
  const followup = validarFollowup(body);
  if (Object.keys(followup.erros).length) return { erro: Object.values(followup.erros).join(' ') };
  // Não normalizar: espaços, quebras, acentos e edição manual devem permanecer exatos.
  return { dados: { ...followup.dados, mensagem, estrategia, variant_id, confirmar_nao_contatar: body.confirmar_nao_contatar === true } };
}
module.exports = { validarContato, RESULTADOS };
