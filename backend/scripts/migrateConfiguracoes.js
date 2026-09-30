const fs=require('node:fs'),path=require('node:path'),pool=require('../config/database');
async function migrate(c){
 const sql=fs.readFileSync(path.resolve(__dirname,'../../database/migrations/005_configuracoes.sql'),'utf8');
 for(const statement of sql.split(';').filter(s=>s.trim()))await c.query(statement);
}
if(require.main===module)migrate(pool).then(()=>console.log('Migração 005 concluída. Configurações existentes preservadas.')).catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>pool.end());
module.exports={migrate};
