const Localidades = require('../../frontend/localidades');
const ESTAGIO = "CASE WHEN nao_contatar = 1 OR status = 'nao_contatar' THEN 'nao_contatar' WHEN status IN ('contatado','sem_resposta') THEN 'contatado' WHEN status = 'descartado' THEN 'descartado' ELSE status END";
const ATIVO = "nao_contatar = 0 AND status NOT IN ('nao_contatar','fechado')";
const STATUS = ['nao_contatado','contatado','respondeu','interessado','negociacao','fechado','descartado','nao_contatar'];
const ORDEM = {nome:'nome_empresa ASC, id ASC',cadastro:'created_at DESC, id DESC',ultimo_contato:'ultima_data_contato IS NULL, ultima_data_contato DESC, id DESC',proximo_contato:'proximo_contato_em IS NULL, proximo_contato_em ASC, id ASC'};
function validarConsulta(query) {
  const dados={page:1,limit:25,sort:'proximo_contato'}, erros=[];
  const permitidos=['search','status','nicho','estado','cidade','followup','instagram','page','limit','sort'];
  for(const [key,value] of Object.entries(query)) {
    if(!permitidos.includes(key)||typeof value!=='string') {erros.push('Parâmetro inválido: '+key);continue;}
    if(['page','limit'].includes(key)) {if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value)))erros.push('Paginação inválida.');else dados[key]=Number(value);}
    else {dados[key]=value.trim();if(dados[key].length>255)erros.push('Filtro muito longo.');}
  }
  if(![25,50,100].includes(dados.limit)||dados.page>1000000)erros.push('Use limite 25, 50 ou 100 e página válida.');
  const aliases={sem_resposta:'contatado',aguardando_resposta:'contatado',nao_interessado:'descartado'};
  if(Object.hasOwn(aliases,dados.status||''))dados.status=aliases[dados.status];
  if(dados.status&&!STATUS.includes(dados.status))erros.push('Status inválido.');
  if(!Object.hasOwn(ORDEM,dados.sort))erros.push('Ordenação inválida.');
  if(dados.followup&&!['hoje','atrasados','proximos','sem_followup','preciso_contatar'].includes(dados.followup))erros.push('Follow-up inválido.');
  if(dados.instagram&&!['sim','nao'].includes(dados.instagram))erros.push('Filtro Instagram inválido.');
  if(dados.estado) {
    const uf=Localidades.normalizarUF(dados.estado);
    if(!uf)erros.push('Informe um estado brasileiro válido.');else dados.estado=uf;
  }
  if(dados.cidade) {
    const localidade=Localidades.cidadeParaFiltro(dados.cidade,dados.estado);
    if(Object.keys(localidade.erros).length)erros.push(...Object.values(localidade.erros));else dados.cidade=localidade.dados.cidade;
  }
  return {dados,erros};
}
function montarConsulta(dados) {
  const where=[],params=[];
  if(dados.search) {
    const busca='%'+dados.search.replace(/[!%_]/g,'!$&')+'%';
    where.push("(nome_empresa LIKE ? ESCAPE '!' OR telefone LIKE ? ESCAPE '!' OR cidade LIKE ? ESCAPE '!' OR estado LIKE ? ESCAPE '!' OR nicho LIKE ? ESCAPE '!')");params.push(...Array(5).fill(busca));
  }
  if(dados.status){where.push(`(${ESTAGIO}) = ?`);params.push(dados.status);}
  for(const key of ['nicho','estado','cidade'])if(dados[key]){where.push(`${key} = ?`);params.push(dados[key]);}
  if(dados.instagram)where.push(dados.instagram==='sim'?"NULLIF(TRIM(instagram), '') IS NOT NULL":"NULLIF(TRIM(instagram), '') IS NULL");
  const followup={hoje:'proximo_contato_em >= CURRENT_DATE AND proximo_contato_em < CURRENT_DATE + INTERVAL 1 DAY',atrasados:'proximo_contato_em < NOW()',proximos:'proximo_contato_em >= CURRENT_DATE + INTERVAL 1 DAY',sem_followup:'proximo_contato_em IS NULL',preciso_contatar:'proximo_contato_em < CURRENT_DATE + INTERVAL 1 DAY'};
  if(dados.followup){where.push(`(${ATIVO})`,followup[dados.followup]);}
  return {where:where.length?' WHERE '+where.join(' AND '):'',params,ordem:dados.followup==='preciso_contatar'?ORDEM.proximo_contato:ORDEM[dados.sort]};
}
module.exports={validarConsulta,montarConsulta,ESTAGIO,ATIVO,STATUS};
