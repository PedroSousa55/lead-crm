const {createHash}=require('node:crypto');
const LIMITE=20*1024*1024;
const SCHEMA='lead-crm-etapa6-v1';
const SCHEMA2='lead-crm-etapa9-v2';
const config=require('./configuracaoValidation'); // Contrato verificado nas colunas; não há tabela de migrations aplicadas.
const CAMPOS={
  clientes:{id:['id'],nome_empresa:['texto',255],telefone:['texto',30,true],nicho:['texto',120,true],cidade:['texto',120,true],estado:['texto',2,true],instagram:['texto',255,true],possui_site:['flag',0,true],status:['texto',50],ultima_data_contato:['data',0,true],proximo_contato_em:['data',0,true],proxima_acao:['texto',1000,true],observacoes:['text',65535,true],gancho_verificado:['text',65535,true],nao_contatar:['flag'],created_at:['data'],updated_at:['data']},
  prospeccoes:{id:['id'],cliente_id:['id'],canal:['texto',20],estrategia:['texto',30],variant_id:['texto',80,true],mensagem:['text',65535],data_contato:['data'],resultado:['texto',30],data_resposta:['data',0,true]}
};
CAMPOS.configuracoes={id:['id'],...Object.fromEntries(Object.keys(config.valores()).map(k=>[k,k.endsWith('_disponivel')?['flag']:k==='leads_por_pagina'?['id']:['texto',k.endsWith('_url')?2048:k==='tela_inicial'?20:100]])),atualizado_em:['data']};
function erro(message,status=400){return Object.assign(new Error(message),{status});}
function objeto(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function chaves(v,keys){return objeto(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
function canon(v){if(Array.isArray(v))return '['+v.map(canon).join(',')+']';if(objeto(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';return JSON.stringify(v);}
function hash(v){return createHash('sha256').update(canon(v)).digest('hex');}
function dataValida(v){
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v))return false;
  const [y,m,d,h,mi,s]=v.match(/\d+/g).map(Number),date=new Date(Date.UTC(y,m-1,d,h,mi,s));
  return y>=1000&&y<=9999&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d&&h<24&&mi<60&&s<60;
}
function campos(tabela,site){return tabela==='clientes'&&site?{...CAMPOS.clientes,site:['texto',2048,true]}:CAMPOS[tabela];}
function payload(b){return {backup:b.backup,resumo:b.resumo,dados:b.dados};}
function criar(dados,site=false){
  const b={backup:{aplicacao:'lead-crm',versao_backup:Object.hasOwn(dados,'configuracoes')?2:1,schema_version:Object.hasOwn(dados,'configuracoes')?SCHEMA2:SCHEMA,criado_em:new Date().toISOString(),site_legado:site},resumo:{quantidade_clientes:dados.clientes.length,quantidade_prospeccoes:dados.prospeccoes.length},dados};
  b.checksum={algoritmo:'SHA-256',valor:hash(payload(b))};return b;
}
function validar(b){
  if(!chaves(b,['backup','resumo','dados','checksum'])||!chaves(b.backup,['aplicacao','versao_backup','schema_version','criado_em','site_legado']))throw erro('Backup inválido: estrutura incompleta ou campos inesperados.');
  if(b.backup.aplicacao!=='lead-crm')throw erro('Backup inválido: aplicação incorreta.');
  if(!((b.backup.versao_backup===1&&b.backup.schema_version===SCHEMA)||(b.backup.versao_backup===2&&b.backup.schema_version===SCHEMA2)))throw erro('Versão de backup não suportada.');
  if(typeof b.backup.site_legado!=='boolean'||typeof b.backup.criado_em!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(b.backup.criado_em)||!Number.isFinite(Date.parse(b.backup.criado_em))||new Date(b.backup.criado_em).toISOString()!==b.backup.criado_em)throw erro('Backup inválido: metadados.');
  const tabelas=b.backup.versao_backup===2?['clientes','prospeccoes','configuracoes']:['clientes','prospeccoes'];
  if(!chaves(b.resumo,['quantidade_clientes','quantidade_prospeccoes'])||!chaves(b.dados,tabelas))throw erro('Backup inválido: resumo ou tabelas.');
  const ids={clientes:new Set(),prospeccoes:new Set(),configuracoes:new Set()};
  for(const tabela of tabelas){
    const rows=b.dados[tabela],schema=campos(tabela,b.backup.site_legado);
    if(!Array.isArray(rows)||(tabela==='configuracoes'?rows.length>1:b.resumo['quantidade_'+tabela]!==rows.length))throw erro('Backup inválido: quantidade de '+tabela+'.');
    for(const row of rows){
      if(!chaves(row,Object.keys(schema)))throw erro('Backup inválido: campos de '+tabela+'.');
      for(const [campo,[tipo,max,nulo]] of Object.entries(schema)){
        const v=row[campo];if(v===null&&nulo)continue;
        const ok=tipo==='id'?Number.isInteger(v)&&v>0&&v<4294967295:tipo==='flag'?(v===0||v===1):tipo==='data'?dataValida(v):typeof v==='string'&&(tipo==='text'?Buffer.byteLength(v,'utf8')<=max:[...v].length<=max);
        if(!ok)throw erro('Backup inválido: '+tabela+'.'+campo+'.');
      }
      if(tabela==='configuracoes'){const valores=Object.fromEntries(Object.keys(config.valores()).map(k=>[k,k.endsWith('_disponivel')?Boolean(row[k]):row[k]]));if(row.id!==1||Object.keys(config.validar(valores).erros).length)throw erro('Backup inválido: configurações comerciais.');}
      if(ids[tabela].has(row.id))throw erro('Backup inválido: ID duplicado em '+tabela+'.');ids[tabela].add(row.id);
      if(tabela==='prospeccoes'&&!ids.clientes.has(row.cliente_id))throw erro('Backup inválido: cliente referenciado inexistente.');
    }
  }
  if(!chaves(b.checksum,['algoritmo','valor'])||b.checksum.algoritmo!=='SHA-256'||typeof b.checksum.valor!=='string'||b.checksum.valor!==hash(payload(b)))throw erro('Checksum inválido.');
  return b;
}
function ler(buffer){
  if(!Buffer.isBuffer(buffer))throw erro('Envie um arquivo JSON de backup.');
  if(buffer.length>LIMITE)throw erro('Arquivo de backup excede o limite de 20 MB.',413);
  let b;try{b=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));}catch{throw erro('Backup inválido: JSON ou codificação inválida.');}
  return validar(b);
}
function serializar(b){validar(b);const buffer=Buffer.from(JSON.stringify(b,null,2));if(buffer.length>LIMITE)throw erro('Arquivo de backup excede o limite de 20 MB.',413);return buffer;}
module.exports={CAMPOS,SCHEMA,SCHEMA2,LIMITE,campos,criar,validar,ler,serializar,hash,erro};
