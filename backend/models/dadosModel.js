const {campos,erro}=require('../services/backupValidation');
const {montarConsulta}=require('../services/clienteConsulta');
async function estrutura(c){
  const [tables]=await c.execute('SELECT TABLE_NAME AS nome, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  if(![2,3].includes(tables.length)||tables.some(t=>!['clientes','prospeccoes','configuracoes'].includes(t.nome))||!['clientes','prospeccoes'].every(n=>tables.some(t=>t.nome===n&&t.engine==='InnoDB')))throw erro('Estrutura do banco incompatível com esta versão de backup. São necessárias as tabelas clientes e prospeccoes em InnoDB.',409);
  let site=false;
  for(const tabela of tables.map(t=>t.nome)){
    if(tables.find(t=>t.nome===tabela).engine!=='InnoDB')throw erro('Tabelas de backup devem usar InnoDB.',409);
    const [cols]=await c.execute('SHOW COLUMNS FROM '+tabela);
    if(tabela==='clientes')site=cols.some(col=>col.Field==='site');
    const expected=Object.keys(campos(tabela,site));
    if(cols.length!==expected.length||!expected.every(n=>cols.some(col=>col.Field===n)))throw erro('Colunas do banco incompatíveis com esta versão de backup.',409);
  }
  return site;
}
async function lerDados(c,site,bloquear=false){
  const dados={};
  for(const tabela of ['clientes','prospeccoes'])[dados[tabela]]=await c.execute('SELECT '+Object.keys(campos(tabela,site)).join(', ')+' FROM '+tabela+' ORDER BY id'+(bloquear?' FOR UPDATE':''));
  try{[dados.configuracoes]=await c.execute('SELECT '+Object.keys(campos('configuracoes')).join(', ')+' FROM configuracoes ORDER BY id'+(bloquear?' FOR UPDATE':''));}catch(e){if(e.code!=='ER_NO_SUCH_TABLE')throw e;}
  return dados;
}
async function substituir(c,b,site){
  if(b.backup.site_legado&&!site)throw erro('O backup contém a coluna legada site, ausente neste banco. Restauração bloqueada para evitar perda de dados.',409);
  await c.execute('DELETE FROM prospeccoes');await c.execute('DELETE FROM clientes');
  if(b.backup.versao_backup===2)await c.execute('DELETE FROM configuracoes');
  for(const tabela of b.backup.versao_backup===2?['clientes','prospeccoes','configuracoes']:['clientes','prospeccoes']){
    const keys=Object.keys(campos(tabela,site));
    const sql='INSERT INTO '+tabela+' ('+keys.join(', ')+') VALUES ('+keys.map(()=>'?').join(', ')+')';
    for(const row of b.dados[tabela])await c.execute(sql,keys.map(k=>k==='site'&&!b.backup.site_legado?null:row[k]));
  }
  // INSERT com IDs explícitos atualiza o AUTO_INCREMENT do InnoDB. Nenhum ALTER/TRUNCATE (commit implícito).
  const [[r]]=await c.execute('SELECT COUNT(*) AS total FROM prospeccoes p LEFT JOIN clientes c ON c.id=p.cliente_id WHERE c.id IS NULL');
  if(Number(r.total)!==0)throw new Error('RELACIONAMENTOS_INVALIDOS');
}
async function exportarClientes(c,dados){
  const {where,params,ordem}=montarConsulta(dados);
  const [rows]=await c.execute('SELECT '+Object.keys(campos('clientes',false)).join(', ')+' FROM clientes'+where+' ORDER BY '+ordem,params);return rows;
}
async function exportarHistorico(c){
  const [rows]=await c.execute('SELECT p.*, c.nome_empresa FROM prospeccoes p JOIN clientes c ON c.id=p.cliente_id ORDER BY p.id');return rows;
}
module.exports={estrutura,lerDados,substituir,exportarClientes,exportarHistorico};
