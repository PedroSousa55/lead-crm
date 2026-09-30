const router=require('express').Router(),controller=require('../controllers/configuracaoController');
router.get('/',controller.obter);router.put('/',controller.salvar);module.exports=router;
