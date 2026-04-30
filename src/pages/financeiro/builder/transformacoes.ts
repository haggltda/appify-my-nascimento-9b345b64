// Engine de transformações + extração de valor por dot-path + render de campo

export function getByPath(obj: any, path: string): any {
  if (path.startsWith("literal:")) return path.slice(8);
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

const SEM_ACENTO: Record<string, string> = {
  á:"a",à:"a",ã:"a",â:"a",ä:"a",é:"e",è:"e",ê:"e",ë:"e",í:"i",ì:"i",î:"i",ï:"i",
  ó:"o",ò:"o",õ:"o",ô:"o",ö:"o",ú:"u",ù:"u",û:"u",ü:"u",ç:"c",
  Á:"A",À:"A",Ã:"A",Â:"A",É:"E",Ê:"E",Í:"I",Ó:"O",Õ:"O",Ô:"O",Ú:"U",Ç:"C",
};

export function aplicarTransformacao(valor: any, transf: string, tamanho: number): any {
  if (valor == null) valor = "";
  const [op, arg] = transf.split(":");
  switch (op) {
    case "removerPontuacao":
      return String(valor).replace(/[\.\-\/\(\)\s]/g, "");
    case "padLeftZeros":
      return String(valor).padStart(tamanho, "0");
    case "padRightSpaces":
      return String(valor).padEnd(tamanho, " ");
    case "uppercase":
      return String(valor).toUpperCase();
    case "removerAcentos":
      return String(valor).replace(/[áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÉÊÍÓÕÔÚÇ]/g, (c) => SEM_ACENTO[c] || c);
    case "multiplicar": {
      const fator = Number(arg || 1);
      const num = Number(String(valor).replace(",", "."));
      return Math.round(num * fator);
    }
    case "formatDate": {
      if (!valor) return "";
      const d = new Date(valor);
      if (isNaN(d.getTime())) return String(valor);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = String(d.getFullYear());
      const yy = yyyy.slice(2);
      switch (arg) {
        case "DDMMYYYY": return `${dd}${mm}${yyyy}`;
        case "DDMMYY": return `${dd}${mm}${yy}`;
        case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
        default: return `${dd}${mm}${yyyy}`;
      }
    }
    case "truncar":
      return String(valor).slice(0, tamanho);
    default:
      return valor;
  }
}

export function renderCampo(
  campo: { origem: string; transformacoes?: string[]; tamanho: number; padding: string; tipo: string },
  contexto: any
): string {
  let v: any = getByPath(contexto, campo.origem);
  if (v == null) v = "";
  for (const t of campo.transformacoes || []) {
    v = aplicarTransformacao(v, t, campo.tamanho);
  }
  let s = String(v);
  // Padding final conforme regra
  if (s.length > campo.tamanho) s = s.slice(0, campo.tamanho);
  if (s.length < campo.tamanho) {
    if (campo.padding === "zeros") s = s.padStart(campo.tamanho, "0");
    else if (campo.padding === "espacos_direita") s = s.padEnd(campo.tamanho, " ");
    else s = s.padEnd(campo.tamanho, " "); // espacos default à direita
  }
  return s;
}
