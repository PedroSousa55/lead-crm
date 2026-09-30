const router=require('express').Router();
router.get('/dashboard',require('../controllers/metricasController').dashboard);
module.exports=router;
