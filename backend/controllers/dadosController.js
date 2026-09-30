const backup=require('../services/backupService');
const validation=require('../services/backupValidation');
const exp=require('../services/exportacaoService');
function download(res,buffer,nome,mime){res.set({'Content-Type':mime,'Content-Disposition':'attachment; filename="'+nome+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).send(buffer);}
function acao(fn){return async(req,res)=>{try{await fn(req,res);}catch(e){res.status(e.status||500).json({erro:e.status?e.message:'Não foi possível concluir a operação. Confira a API e o banco.'});}};}
exports.exportarClientes=acao(async(req,res)=>{const r=await exp.exportar('clientes',req.query);download(res,r.buffer,r.nome,r.mime);});
exports.exportarHistorico=acao(async(req,res)=>{const r=await exp.exportar('prospeccoes',req.query);download(res,r.buffer,r.nome,r.mime);});
exports.backup=acao(async(req,res)=>download(res,validation.serializar(await backup.snapshot()),exp.nomeArquivo('lead-crm-backup','json'),'application/json; charset=utf-8'));
exports.validar=acao(async(req,res)=>{const b=validation.ler(req.body);res.json({mensagem:'Backup válido.',backup:b.backup,resumo:b.resumo});});
exports.seguranca=acao(async(req,res)=>{const b=validation.ler(req.body);const r=await backup.seguranca(b);res.set('X-Restauracao-Token',r.token);download(res,validation.serializar(r.atual),exp.nomeArquivo('lead-crm-antes-restauracao','json'),'application/json; charset=utf-8');});
exports.restaurar=acao(async(req,res)=>{await backup.restaurar(validation.ler(req.body),req.get('X-Restauracao-Token'),req.get('X-Confirmacao'));res.json({mensagem:'Restauração concluída.'});});
