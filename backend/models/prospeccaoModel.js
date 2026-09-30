const { atualizarFollowup } = require('./clienteModel');
const pool = require('../config/database');
function erro(message, status) { return Object.assign(new Error(message), { status }); }
async function transacao(acao) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const resultado = await acao(connection);
    await connection.commit();
    return resultado;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
async function bloquearCliente(connection, id) {
  const [[cliente]] = await connection.execute('SELECT id, nao_contatar, status FROM clientes WHERE id = ? FOR UPDATE', [id]);
  if (!cliente) throw erro('Cliente não encontrado.', 404);
  return cliente;
}
// Funções com conexão permitem testar no MySQL dentro de transação revertida.
async function registrarNaConexao(connection, clienteId, dados) {
  const cliente = await bloquearCliente(connection, clienteId);
  if ((cliente.nao_contatar || cliente.status === 'nao_contatar') && !dados.confirmar_nao_contatar) throw erro('Cliente marcado como não contatar. Confirme explicitamente esta exceção.', 409);
  const [r] = await connection.execute(
    'INSERT INTO prospeccoes (cliente_id, canal, estrategia, variant_id, mensagem, resultado) VALUES (?, ?, ?, ?, ?, ?)',
    [clienteId, 'whatsapp', dados.estrategia, dados.variant_id, dados.mensagem, 'aguardando_resposta']);
  await connection.execute("UPDATE clientes SET status = CASE WHEN nao_contatar = 1 THEN 'nao_contatar' WHEN status = 'fechado' THEN 'fechado' ELSE ? END, ultima_data_contato = CURRENT_TIMESTAMP WHERE id = ?", ['contatado', clienteId]);
  if (Object.hasOwn(dados,'proximo_contato_em') || Object.hasOwn(dados,'proxima_acao')) await atualizarFollowup(clienteId,dados,connection);
  return r.insertId;
}
async function resultadoNaConexao(connection, clienteId, id, resultado) {
  await bloquearCliente(connection, clienteId);
  const [[contato]] = await connection.execute('SELECT id FROM prospeccoes WHERE id = ? AND cliente_id = ? FOR UPDATE', [id, clienteId]);
  if (!contato) throw erro('Contato não encontrado para este cliente.', 404);
  const respondeu = ['respondeu', 'interessado', 'nao_interessado', 'negociacao', 'fechado'].includes(resultado);
  await connection.execute(
    'UPDATE prospeccoes SET resultado = ?, data_resposta = CASE WHEN ? = 1 THEN COALESCE(data_resposta, CURRENT_TIMESTAMP) WHEN ? = ? THEN NULL ELSE data_resposta END WHERE id = ? AND cliente_id = ?',
    [resultado, respondeu ? 1 : 0, resultado, 'aguardando_resposta', id, clienteId]);
  if (resultado === 'nao_contatar') await connection.execute("UPDATE clientes SET nao_contatar = 1, status = 'nao_contatar' WHERE id = ?", [clienteId]);
  else {
    const [[ultimo]] = await connection.execute('SELECT id FROM prospeccoes WHERE cliente_id = ? ORDER BY data_contato DESC, id DESC LIMIT 1', [clienteId]);
    const status = {aguardando_resposta:'contatado',respondeu:'respondeu',interessado:'interessado',nao_interessado:'descartado',negociacao:'negociacao',fechado:'fechado'}[resultado];
    if(ultimo?.id===id) await connection.execute('UPDATE clientes SET status = ? WHERE id = ? AND nao_contatar = 0', [status,clienteId]);
  }
}
async function listar(clienteId, connection = pool) {
  const [rows] = await connection.execute('SELECT id, cliente_id, canal, estrategia, variant_id, mensagem, data_contato, resultado, data_resposta FROM prospeccoes WHERE cliente_id = ? ORDER BY data_contato DESC, id DESC', [clienteId]);
  return rows;
}
async function naoContatar(clienteId) {
  return transacao(async connection => {
    await bloquearCliente(connection, clienteId);
    await connection.execute("UPDATE clientes SET nao_contatar = 1, status = 'nao_contatar' WHERE id = ?", [clienteId]);
  });
}
// Contagens de registros manuais, não confirmações de entrega do WhatsApp. Sem taxas inferidas.
async function metricas(connection = pool) {
  const medidas = 'COUNT(*) AS contatos_registrados, COALESCE(SUM(data_resposta IS NOT NULL), 0) AS respostas, COALESCE(SUM(resultado = ?), 0) AS interessados';
  const [[totais]] = await connection.execute(`SELECT ${medidas} FROM prospeccoes`, ['interessado']);
  const [porEstrategia] = await connection.execute(`SELECT estrategia, ${medidas} FROM prospeccoes GROUP BY estrategia`, ['interessado']);
  const [porVariante] = await connection.execute(`SELECT estrategia, variant_id, ${medidas} FROM prospeccoes GROUP BY estrategia, variant_id`, ['interessado']);
  return { totais, porEstrategia, porVariante };
}
module.exports = { listar, metricas, naoContatar, registrarNaConexao, resultadoNaConexao,
  registrar: (id, dados) => transacao(c => registrarNaConexao(c, id, dados)),
  atualizarResultado: (clienteId, id, resultado) => transacao(c => resultadoNaConexao(c, clienteId, id, resultado)) };
