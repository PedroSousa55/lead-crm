// MySQL não permite CREATE TEMPORARY TABLE x LIKE x. Copia a definição antes de ocultar as reais.
async function criar(c){
  const definicoes=[];
  for(const tabela of ['clientes','prospeccoes','configuracoes']){
    const [[ddl]]=await c.query('SHOW CREATE TABLE '+tabela);
    definicoes.push(ddl['Create Table'].replace(/^CREATE TABLE/,'CREATE TEMPORARY TABLE').replace(/,\n\s*CONSTRAINT[^\n]+/g,''));
  }
  for(const sql of definicoes)await c.query(sql);
}
module.exports={criar};
