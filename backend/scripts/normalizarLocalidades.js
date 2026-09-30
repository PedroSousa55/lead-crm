const Localidades = require('../../frontend/localidades');

function planejar(registros) {
  const alteracoes=[],pendencias=[];
  for(const registro of registros) {
    const resultado=Localidades.normalizar(registro.estado,registro.cidade);
    const antes={estado:registro.estado,cidade:registro.cidade};
    if(Object.keys(resultado.erros).length)pendencias.push({id:registro.id,antes,motivos:Object.values(resultado.erros)});
    else if(antes.estado!==resultado.dados.estado||antes.cidade!==resultado.dados.cidade)
      alteracoes.push({id:registro.id,antes,depois:resultado.dados});
  }
  return {total:registros.length,inalterados:registros.length-alteracoes.length-pendencias.length,alteracoes,pendencias};
}

// A transação pertence ao chamador. A comparação exata evita sobrescrever edições concorrentes.
async function aplicar(conexao, alteracoes) {
  for(const item of alteracoes) {
    const [resultado]=await conexao.execute(
      'UPDATE clientes SET estado = ?, cidade = ?, updated_at = updated_at WHERE id = ? AND BINARY estado <=> BINARY ? AND BINARY cidade <=> BINARY ?',
      [item.depois.estado,item.depois.cidade,item.id,item.antes.estado,item.antes.cidade]
    );
    if(resultado.affectedRows!==1)throw new Error('O registro '+item.id+' mudou durante a revisão. Nenhuma alteração foi confirmada.');
  }
}

async function main() {
  const argumentos=process.argv.slice(2);
  if(argumentos.some(a=>!['--aplicar','--dry-run'].includes(a))||argumentos.length>1)throw new Error('Use --dry-run (padrão) ou --aplicar.');
  const pool=require('../config/database');
  let conexao;
  try {
    conexao=await pool.getConnection();
    const [registros]=await conexao.execute('SELECT id, estado, cidade FROM clientes ORDER BY id');
    const plano=planejar(registros);
    console.log(JSON.stringify(plano,null,2));
    if(argumentos.includes('--aplicar')) {
      await conexao.beginTransaction();
      try {await aplicar(conexao,plano.alteracoes);await conexao.commit();}
      catch(error){await conexao.rollback();throw error;}
      console.log(plano.alteracoes.length+' registros normalizados. Pendências preservadas para revisão manual.');
    } else console.log('Simulação: nenhum dado foi modificado. Para aplicar somente correspondências seguras, use --aplicar.');
  } finally {if(conexao)conexao.release();await pool.end();}
}
if(require.main===module)main().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
module.exports={planejar,aplicar};
