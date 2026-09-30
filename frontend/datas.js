// DATETIME local: altera apenas a apresentação, sem conversão de fuso ou armazenamento.
const DataCRM={formatar(valor){return typeof valor==='string'?valor.replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1').replace(/^(\d{4})-(\d{2})$/, '$2/$1'):valor;}};
if(typeof module!=='undefined'&&module.exports)module.exports=DataCRM;
