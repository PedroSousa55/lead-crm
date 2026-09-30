const pool=require('../config/database');const contrato=require('../services/configuracaoValidation');
const CAMPOS=Object.keys(contrato.valores());
async function obter(c=pool){
 const [rows]=await c.execute('SELECT '+CAMPOS.join(',')+' FROM configuracoes WHERE id=1');
 if(!rows.length)return contrato.valores();
 const r=rows[0];for(const k of CAMPOS.filter(k=>k.endsWith('_disponivel')))r[k]=Boolean(r[k]);
 const v=contrato.validar(r);if(Object.keys(v.erros).length)throw Error('CONFIGURACAO_INVALIDA');return v.dados;
}
async function salvar(dados,c=pool){
 await c.execute('INSERT INTO configuracoes (id,'+CAMPOS.join(',')+') VALUES (1,'+CAMPOS.map(()=>'?').join(',')+') ON DUPLICATE KEY UPDATE '+CAMPOS.map(k=>k+'=VALUES('+k+')').join(','),CAMPOS.map(k=>dados[k]));
 return {...dados};
}
module.exports={CAMPOS,obter,salvar};
