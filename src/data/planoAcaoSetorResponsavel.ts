// Mapa fixo Setor -> responsável padrão do Plano de Ações.
// Usado só para sugerir automaticamente o Responsável quando o usuário
// preenche o campo Setor (ver handleSetorChange em Detalhe.tsx). Chave
// normalizada (minúsculo, sem acento, trim) para casar com o texto digitado
// ou escolhido, independente de acentuação/caixa.

export interface SetorResponsavel {
  profileId: string;
  nome: string;
}

export const SETOR_RESPONSAVEL_MAP: Record<string, SetorResponsavel> = {
  "compras":                { profileId: "2d49fd95-6d74-4b97-98a8-4ecaf969bd99", nome: "CASSIO RAPHAELLI CAMARGO DUARTE" },
  "controladoria":           { profileId: "3baeb855-5389-4459-93f4-759ee82b288e", nome: "YURI ROSA" },
  "diretor administrativo":  { profileId: "24441177-a9e2-4f0e-b2ae-7d4fabe37044", nome: "FERNANDA MALDANER" },
  "diretor operacional":     { profileId: "6a8ac11c-a1e5-49ab-8de9-6a9c7dc03a98", nome: "SENILTON RAMOS DO NASCIMENTO" },
  "financeiro":              { profileId: "8a03a976-1287-453e-9c86-d78163ac2e2e", nome: "CAROLINE PRISCO LOPES" },
  "juridico":                { profileId: "392cd6af-41c7-4730-a100-69bdd81b5d96", nome: "Natália Taborda" },
  "licitacao":               { profileId: "1116752d-09b2-49c1-951d-753b72c70276", nome: "LUCAS DE JESUS SILVA" },
  "operacional":             { profileId: "7cffae0b-2cfe-4e9f-8876-dde9b3c07e50", nome: "DAISON TAVARES RODRIGUES" },
  "padrao":                  { profileId: "2d49fd95-6d74-4b97-98a8-4ecaf969bd99", nome: "CASSIO RAPHAELLI CAMARGO DUARTE" },
  "presidencia":             { profileId: "60e5bb0a-c0ae-4434-950f-9fdaecb01ea7", nome: "HELENA NASCIMENTO" },
  "rh":                      { profileId: "a240e3b5-3cda-4913-bebb-edcfa1035c7a", nome: "ALESSANDRA APARECIDA DE VARGAS" },
  "seguranca":               { profileId: "eeb3ce16-f0f3-4bba-85ee-41ce0b43d299", nome: "MILENA DA CUNHA CASTRO" },
  "sistemas":                { profileId: "2d49fd95-6d74-4b97-98a8-4ecaf969bd99", nome: "CASSIO RAPHAELLI CAMARGO DUARTE" },
  "sst":                     { profileId: "eeb3ce16-f0f3-4bba-85ee-41ce0b43d299", nome: "MILENA DA CUNHA CASTRO" },
  "treinamentos":            { profileId: "cb0a7a80-84f6-4707-a3be-90c2380736b4", nome: "FRANCIELI SILVA DO NASCIMENTO" },
};

export function normalizeSetorNome(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
