function validarFollowup(body, parcial = true) {
  const dados = {}, erros = {};
  for (const campo of ['proximo_contato_em', 'proxima_acao']) {
    if (parcial && !Object.hasOwn(body, campo)) continue;
    const valor = body[campo];
    if (valor == null || valor === '') { dados[campo] = null; continue; }
    if (typeof valor !== 'string') { erros[campo] = 'Informe um valor válido.'; continue; }
    if (campo === 'proxima_acao') {
      const texto = valor.trim().replace(/\s+/g, ' ');
      if ([...texto].length > 1000 || /\u0000/.test(texto)) erros[campo] = 'Use até 1.000 caracteres, sem caracteres nulos.';
      dados[campo] = texto || null;
    } else {
      const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(valor);
      if (!m) { erros[campo] = 'Informe data e hora válidas, sem fuso (horário local).'; continue; }
      const [y,mo,d,h,mi,se] = m.slice(1).map(Number); const segundo = se || 0;
      const data = new Date(Date.UTC(y,mo-1,d,h,mi,segundo));
      if (y < 1000 || y > 9999 || data.getUTCFullYear()!==y || data.getUTCMonth()!==mo-1 || data.getUTCDate()!==d || h>23 || mi>59 || segundo>59) erros[campo] = 'Informe uma data e hora existentes.';
      else dados[campo] = `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${String(segundo).padStart(2,'0')}`;
    }
  }
  return { dados, erros };
}
module.exports = { validarFollowup };
