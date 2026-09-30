const {randomBytes}=require('node:crypto');
const pool=require('../config/database');
const model=require('../models/dadosModel');
const v=require('./backupValidation');
const permissoes=new Map();
const assinatura=b=>v.hash({site_legado:b.backup.site_legado,dados:b.dados});
async function snapshot(){
  const c=await pool.getConnection();let transacao=false;
  try{
    const site=await model.estrutura(c);
    await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await c.beginTransaction();transacao=true;
    const b=v.criar(await model.lerDados(c,site),site);v.serializar(b);
    await c.commit();transacao=false;return b;
  }finally{try{if(transacao)await c.rollback();}finally{c.release();}}
}
async function seguranca(incoming){
  v.validar(incoming);const atual=await snapshot();
  if(incoming.backup.site_legado&&!atual.backup.site_legado)throw v.erro('O backup contém a coluna legada site, ausente neste banco.',409);
  for(const [key,p] of permissoes)if(p.expira<Date.now())permissoes.delete(key);
  if(permissoes.size>=20)permissoes.delete(permissoes.keys().next().value);
  const token=randomBytes(32).toString('hex');
  permissoes.set(token,{entrada:incoming.checksum.valor,atual:assinatura(atual),expira:Date.now()+10*60*1000});
  return {atual,token};
}
// A transação pertence ao chamador, inclusive nos testes com rollback externo.
async function restaurarNaConexao(c,incoming,esperado){
  v.validar(incoming);const site=await model.estrutura(c);
  const atual=v.criar(await model.lerDados(c,site,true),site);
  if(assinatura(atual)!==esperado)throw v.erro('Os dados atuais mudaram. Baixe um novo backup dos dados atuais antes de confirmar.',409);
  await model.substituir(c,incoming,site);
  const reconstruido=await model.lerDados(c,site);
  const esperadoDados=structuredClone(incoming.dados);
  // Backups v1 preservam as configurações atuais, sem redefinir preferências silenciosamente.
  if(incoming.backup.versao_backup===1&&atual.dados.configuracoes)esperadoDados.configuracoes=atual.dados.configuracoes;
  if(site&&!incoming.backup.site_legado)for(const row of esperadoDados.clientes)row.site=null;
  for(const rows of Object.values(esperadoDados))rows.sort((a,b)=>a.id-b.id);
  if(v.hash(reconstruido)!==v.hash(esperadoDados))throw new Error('CONFERENCIA_RESTAURACAO_FALHOU');
}
async function restaurar(incoming,token,confirmacao){
  v.validar(incoming);
  const p=permissoes.get(token);
  if(confirmacao!=='RESTAURAR'||!p||p.expira<Date.now()||p.entrada!==incoming.checksum.valor)throw v.erro('Confirmação inválida ou expirada. Valide o arquivo e baixe o backup dos dados atuais novamente.',409);
  permissoes.delete(token); // Uso único, inclusive se houver erro.
  const c=await pool.getConnection();let transacao=false,confirmando=false,destruida=false;
  try{
    await c.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');await c.beginTransaction();transacao=true;
    await restaurarNaConexao(c,incoming,p.atual);confirmando=true;await c.commit();transacao=false;
  }catch(error){
    if(transacao){try{await c.rollback();}catch{c.destroy();destruida=true;}transacao=false;}
    if(confirmando)throw v.erro('Não foi possível confirmar a conclusão da restauração. Confira os dados do CRM antes de tentar novamente.',500);
    if(error.status)throw error;
    throw v.erro('Falha na restauração. Nenhum dado foi alterado.',500);
  }finally{if(!destruida)c.release();}
}
module.exports={snapshot,seguranca,restaurar,restaurarNaConexao,assinatura};
