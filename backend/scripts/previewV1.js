// Servidor exclusivo de QA. Nenhum COMMIT externo: ao encerrar, toda a sessão sofre rollback.
// Não usar como servidor habitual. Restauração fica bloqueada; é testada com tabelas TEMPORARY em test:db.
const assert=require('node:assert/strict'),express=require('express'),pool=require('../config/database'),dados=require('../models/dadosModel'),{hash}=require('../services/backupValidation');
async function main(){
 const c=await pool.getConnection(),site=await dados.estrutura(c),antes=hash(await dados.lerDados(c,site));
 await c.beginTransaction();
 const originalExecute=pool.execute.bind(pool),originalConnection=pool.getConnection.bind(pool);
 const wrapper={execute:c.execute.bind(c),query:async sql=>sql.startsWith('SET TRANSACTION')?undefined:c.query(sql),beginTransaction:()=>c.query('SAVEPOINT api_qa'),commit:()=>c.query('RELEASE SAVEPOINT api_qa'),rollback:()=>c.query('ROLLBACK TO SAVEPOINT api_qa'),release:()=>{},destroy:()=>{throw Error('QA_CONEXAO_INVALIDA')}};
 pool.execute=wrapper.execute;pool.query=wrapper.query;pool.getConnection=async()=>wrapper;
 const app=express();let encerrando=false;
 async function finalizar(){if(encerrando)return;encerrando=true;await c.rollback();pool.execute=originalExecute;pool.getConnection=originalConnection;assert.equal(hash(await dados.lerDados(c,site)),antes);console.log('QA V1: rollback confirmado; dados reais intactos.');c.release();await pool.end();server.close();clearTimeout(timer);}
 app.post('/__qa/finalizar',async(req,res)=>{try{await finalizar();res.json({rollback:true});}catch(e){res.status(500).json({erro:e.message});}});
 app.use('/api/backup/restaurar',(req,res)=>res.status(403).json({erro:'Restauração visual bloqueada nesta sessão. Use os testes de tabelas temporárias.'}));
 app.use('/api/clientes/:id',async(req,res,next)=>{if(!/^\d+$/.test(req.params.id)||!['PUT','DELETE','POST'].includes(req.method))return next();const [[row]]=await c.execute('SELECT nome_empresa FROM clientes WHERE id=?',[req.params.id]);if(!row?.nome_empresa.startsWith('QA V1'))return res.status(403).json({erro:'Edite somente leads QA V1 nesta sessão.'});next();});
 app.use(require('../server'));
 const server=app.listen(3110,'127.0.0.1',()=>console.log('QA V1 em http://127.0.0.1:3110/ — gravações serão revertidas.'));
 const timer=setTimeout(()=>finalizar().catch(console.error),30*60*1000);
}
main().catch(e=>{console.error(e);process.exitCode=1});
