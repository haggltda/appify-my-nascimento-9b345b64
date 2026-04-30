// Estado global do Builder (Zustand)
import { create } from "zustand";
import type { LayoutEstrutura, CnabEstrutura, CampoLayout } from "./types";

export interface BuilderState {
  // metadados
  layoutId: string | null;
  versaoId: string | null;
  numeroVersao: number;
  empresaId: string | null;
  contaBancariaId: string | null;
  nomeLayout: string;
  tipo: string;
  bancoCodigo: string | null;
  ambiente: "sandbox" | "producao";
  metodoConexao: "api_rest" | "open_finance" | "cnab_arquivo" | "manual" | null;
  estrutura: LayoutEstrutura;
  amostraInput: any;
  amostraOutput: string;
  status: "rascunho" | "pendente_aprovacao" | "aprovada" | "rejeitada" | "arquivada";
  etapa: number; // 1..5
  dirty: boolean;

  // setters
  setMeta: (m: Partial<BuilderState>) => void;
  setEtapa: (n: number) => void;
  setEstrutura: (e: LayoutEstrutura) => void;
  setAmostraOutput: (s: string) => void;
  marcarDirty: () => void;

  // CNAB-specific helpers
  atualizarCampoCNAB: (segIdx: number, campoIdx: number, patch: Partial<CampoLayout>) => void;
  setOrigemCampo: (segIdx: number, campoIdx: number, origem: string) => void;
  removerCampoCNAB: (segIdx: number, campoIdx: number) => void;
  adicionarCampoCNAB: (segIdx: number, campo: CampoLayout) => void;
  adicionarSegmento: (codigo: string) => void;

  // reset
  resetar: () => void;
}

const ESTADO_INICIAL: Pick<
  BuilderState,
  | "layoutId" | "versaoId" | "numeroVersao" | "empresaId" | "contaBancariaId"
  | "nomeLayout" | "tipo" | "bancoCodigo" | "ambiente" | "metodoConexao"
  | "estrutura" | "amostraInput" | "amostraOutput" | "status" | "etapa" | "dirty"
> = {
  layoutId: null,
  versaoId: null,
  numeroVersao: 1,
  empresaId: null,
  contaBancariaId: null,
  nomeLayout: "",
  tipo: "cnab240_remessa_pagamento",
  bancoCodigo: null,
  ambiente: "sandbox",
  metodoConexao: null,
  estrutura: { tipo: "cnab240", tamanho_registro: 240, segmentos: [] } as CnabEstrutura,
  amostraInput: {
    empresa: { cnpj: "12345678000190", razao_social: "EMPRESA TESTE LTDA" },
    conta: { codigo_banco: "341", agencia: "1234", conta: "567890", cnab_convenio: "9876543" },
    titulo: { id: "T-001", numero_documento: "NF-1023", valor: 1234.56, data_pagamento: new Date().toISOString(), data_vencimento: new Date().toISOString(), nosso_numero: "00001234567" },
    fornecedor: { documento: "98765432000100", nome_razao: "FORNECEDOR ALFA SA", banco_codigo: "237", agencia: "5678", conta: "112233", pix_chave: "fornecedor@alfa.com" },
  },
  amostraOutput: "",
  status: "rascunho",
  etapa: 1,
  dirty: false,
};

export const useBuilderStore = create<BuilderState>((set) => ({
  ...ESTADO_INICIAL,
  setMeta: (m) => set((s) => ({ ...s, ...m, dirty: true })),
  setEtapa: (n) => set({ etapa: n }),
  setEstrutura: (e) => set({ estrutura: e, dirty: true }),
  setAmostraOutput: (s) => set({ amostraOutput: s }),
  marcarDirty: () => set({ dirty: true }),

  atualizarCampoCNAB: (segIdx, campoIdx, patch) =>
    set((s) => {
      const e = structuredClone(s.estrutura) as CnabEstrutura;
      Object.assign(e.segmentos[segIdx].campos[campoIdx], patch);
      return { estrutura: e, dirty: true };
    }),

  setOrigemCampo: (segIdx, campoIdx, origem) =>
    set((s) => {
      const e = structuredClone(s.estrutura) as CnabEstrutura;
      e.segmentos[segIdx].campos[campoIdx].origem = origem;
      return { estrutura: e, dirty: true };
    }),

  removerCampoCNAB: (segIdx, campoIdx) =>
    set((s) => {
      const e = structuredClone(s.estrutura) as CnabEstrutura;
      e.segmentos[segIdx].campos.splice(campoIdx, 1);
      return { estrutura: e, dirty: true };
    }),

  adicionarCampoCNAB: (segIdx, campo) =>
    set((s) => {
      const e = structuredClone(s.estrutura) as CnabEstrutura;
      e.segmentos[segIdx].campos.push(campo);
      return { estrutura: e, dirty: true };
    }),

  adicionarSegmento: (codigo) =>
    set((s) => {
      const e = structuredClone(s.estrutura) as CnabEstrutura;
      e.segmentos.push({ codigo, descricao: codigo, campos: [] });
      return { estrutura: e, dirty: true };
    }),

  resetar: () => set({ ...ESTADO_INICIAL }),
}));
