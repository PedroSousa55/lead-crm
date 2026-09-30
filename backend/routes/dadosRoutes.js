const express=require('express');const c=require('../controllers/dadosController');const {LIMITE}=require('../services/backupValidation');
const router=express.Router();
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/exportacao/clientes',c.exportarClientes);router.get('/exportacao/prospeccoes',c.exportarHistorico);router.get('/backup',c.backup);
router.use('/backup',(req,res,next)=>{
  if(req.method==='POST'&&(!req.is('application/json')&&!req.is('application/octet-stream')))return res.status(415).json({erro:'Envie um arquivo JSON de backup.'});
  next();
},express.raw({type:['application/json','application/octet-stream'],limit:LIMITE,inflate:false}));
router.post('/backup/validar',c.validar);router.post('/backup/seguranca',c.seguranca);router.post('/backup/restaurar',c.restaurar);
router.use((error,req,res,next)=>{if(error.type==='entity.too.large')return res.status(413).json({erro:'Arquivo de backup excede o limite de 20 MB.'});if(error.status===415)return res.status(415).json({erro:'Envie o JSON sem compressão.'});next(error);});
module.exports=router;
