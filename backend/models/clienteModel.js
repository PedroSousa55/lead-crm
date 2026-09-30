const { montarConsulta, ESTAGIO, ATIVO, STATUS } = require('../services/clienteConsulta');
const pool = require('../config/database');
const CAMPOS = ['nome_empresa', 'telefone', 'nicho', 'cidade', 'estado', 'instagram', 'possui_site', 'status', 'observacoes', 'gancho_verificado'];
const COLUNAS = 'id, nome_empresa, telefone, nicho, cidade, estado, instagram, possui_site, status, ultima_data_contato, observacoes, gancho_verificado, nao_contatar, proximo_contato_em, proxima_acao, created_at, updated_at, (SELECT resultado FROM prospeccoes WHERE cliente_id = clientes.id ORDER BY data_contato DESC, id DESC LIMIT 1) AS ultimo_resultado';

async function listarTodos() {
  const [clientes] = await pool.execute(`SELECT ${COLUNAS} FROM clientes ORDER BY id DESC`);
  return clientes;
}
async function buscarPorId(id) {
  const [clientes] = await pool.execute(`SELECT ${COLUNAS} FROM clientes WHERE id = ?`, [id]);
  return clientes[0] || null;
}
async function criar(dados) {
  const CAMPOS_CRIAR = [...CAMPOS, ...["proximo_contato_em", "proxima_acao"].filter(c => Object.hasOwn(dados, c))];
  if (dados.status === 'nao_contatar') { CAMPOS_CRIAR.push('nao_contatar'); dados = {...dados, nao_contatar:1}; }
  const [result] = await pool.execute(
    `INSERT INTO clientes (${CAMPOS_CRIAR.join(', ')}) VALUES (${CAMPOS_CRIAR.map(() => '?').join(', ')})`,
    CAMPOS_CRIAR.map(campo => dados[campo])
  );
  return { id: result.insertId, ...dados };
}
async function atualizar(id, dados) {
  const CAMPOS_ATUALIZAR = [...CAMPOS, ...["proximo_contato_em", "proxima_acao"].filter(c => Object.hasOwn(dados, c))];
  const [result] = await pool.execute(
    `UPDATE clientes SET ${CAMPOS_ATUALIZAR.map(campo => campo === 'status' ? "status = CASE WHEN nao_contatar = 1 THEN 'nao_contatar' ELSE ? END" : campo + ' = ?').join(', ')}${dados.status === 'nao_contatar' ? ', nao_contatar = 1' : ''} WHERE id = ?`,
    [...CAMPOS_ATUALIZAR.map(campo => dados[campo]), id]
  );
  // mysql2 usa FOUND_ROWS por padrão: salvar sem mudanças também é sucesso.
  return result.affectedRows > 0;
}
async function excluir(id) {
  const [result] = await pool.execute('DELETE FROM clientes WHERE id = ?', [id]);
  return result.affectedRows > 0;
}


async function atualizarFollowup(id, dados, connection = pool) {
  const campos = ['proximo_contato_em','proxima_acao'].filter(c => Object.hasOwn(dados,c));
  if (!campos.length) return false;
  const [r] = await connection.execute('UPDATE clientes SET '+campos.map(c=>c+' = ?').join(', ')+' WHERE id = ?', [...campos.map(c=>dados[c]),id]);
  return r.affectedRows > 0;
}
async function listarFiltrados(dados, connection = pool) {
  const {where,params,ordem}=montarConsulta(dados);
  const [grupos]=await connection.execute('SELECT ('+ESTAGIO+') AS estagio, COUNT(*) AS total FROM clientes'+where+' GROUP BY estagio',params);
  const total=grupos.reduce((n,g)=>n+Number(g.total),0);
  const page=Math.min(dados.page,Math.max(1,Math.ceil(total/dados.limit)));
  const [clientes]=await connection.execute('SELECT '+COLUNAS+' FROM clientes'+where+' ORDER BY '+ordem+' LIMIT ? OFFSET ?',[...params,dados.limit,(page-1)*dados.limit]);
  const [globais]=await connection.execute('SELECT ('+ESTAGIO+') AS estagio, COUNT(*) AS total FROM clientes GROUP BY estagio');
  const [[hoje]]=await connection.execute('SELECT COUNT(*) AS total, NOW() AS agora FROM clientes WHERE '+ATIVO+' AND proximo_contato_em >= CURRENT_DATE AND proximo_contato_em < CURRENT_DATE + INTERVAL 1 DAY');
  const [opcoes]=await connection.execute('SELECT DISTINCT nicho, estado, cidade FROM clientes ORDER BY estado, cidade, nicho');
  const contar=rows=>Object.fromEntries(STATUS.map(e=>[e,Number(rows.find(g=>g.estagio===e)?.total||0)]));
  return {clientes,total,page,limit:dados.limit,pipeline:contar(grupos),indicadores:{...contar(globais),total:globais.reduce((n,g)=>n+Number(g.total),0),followups_hoje:Number(hoje.total)},opcoes,agora:hoje.agora};
}
module.exports = { listarTodos, listarFiltrados, buscarPorId, criar, atualizar, excluir, atualizarFollowup };
