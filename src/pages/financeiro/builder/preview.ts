import type { CnabEstrutura, ApiRestEstrutura, LayoutEstrutura } from "./types";
import { renderCampo, getByPath, aplicarTransformacao } from "./transformacoes";

export function gerarPreviewCNAB(estrutura: CnabEstrutura, contexto: any): string {
  const linhas: string[] = [];
  for (const seg of estrutura.segmentos) {
    let linha = "".padEnd(estrutura.tamanho_registro, " ");
    const arr = linha.split("");
    for (const campo of seg.campos) {
      const valor = renderCampo(campo, contexto);
      // posiciona (1-based)
      for (let i = 0; i < valor.length; i++) {
        const idx = campo.pos_ini - 1 + i;
        if (idx < arr.length) arr[idx] = valor[i];
      }
    }
    linhas.push(`# ${seg.codigo}${seg.descricao ? " - " + seg.descricao : ""}`);
    linhas.push(arr.join(""));
  }
  return linhas.join("\n");
}

function resolverValorBody(template: any, contexto: any): any {
  if (template == null) return template;
  if (Array.isArray(template)) return template.map((t) => resolverValorBody(t, contexto));
  if (typeof template === "object") {
    if ("origem" in template && typeof template.origem === "string") {
      let v = getByPath(contexto, template.origem);
      for (const t of template.transformacoes || []) {
        v = aplicarTransformacao(v, t, 0);
      }
      return v;
    }
    const out: any = {};
    for (const [k, v] of Object.entries(template)) out[k] = resolverValorBody(v, contexto);
    return out;
  }
  if (typeof template === "string") {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, p) => {
      const v = getByPath(contexto, p.trim());
      return v == null ? "" : String(v);
    });
  }
  return template;
}

export function gerarPreviewAPI(estrutura: ApiRestEstrutura, contexto: any): string {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(estrutura.headers || {})) {
    headers[k] = String(resolverValorBody(v, contexto));
  }
  const body = resolverValorBody(estrutura.body_template, contexto);
  return [
    `${estrutura.metodo} ${estrutura.endpoint}`,
    ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
    "",
    JSON.stringify(body, null, 2),
  ].join("\n");
}

export function gerarPreview(estrutura: LayoutEstrutura, contexto: any): string {
  const t = (estrutura as any)?.tipo;
  if (t === "cnab240" || t === "cnab400") return gerarPreviewCNAB(estrutura as CnabEstrutura, contexto);
  if (t === "api_rest") return gerarPreviewAPI(estrutura as ApiRestEstrutura, contexto);
  return "Estrutura não reconhecida.";
}
