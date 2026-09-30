const service=require('../services/metricasService');
exports.dashboard=async(req,res)=>{try{const filtros=service.validar(req.query);res.set('Cache-Control','no-store').json(await service.dashboard(filtros));}catch(e){res.status(e.status||500).json({erro:e.status?e.message:'Não foi possível carregar o dashboard. Confira a API e o MySQL.'});}};
