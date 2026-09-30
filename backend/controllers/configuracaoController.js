const model=require('../models/configuracaoModel');const {validar}=require('../services/configuracaoValidation');
exports.obter=async(req,res)=>{try{res.set('Cache-Control','no-store').json(await model.obter());}catch{res.status(500).json({erro:'Não foi possível carregar as configurações. Confira o MySQL e a migração de configurações.'});}};
exports.salvar=async(req,res)=>{
 const {dados,erros}=validar(req.body);if(Object.keys(erros).length)return res.status(400).json({erro:'Confira os campos das configurações.',erros});
 try{res.set('Cache-Control','no-store').json(await model.salvar(dados));}catch{res.status(500).json({erro:'Não foi possível salvar as configurações.'});}
};
