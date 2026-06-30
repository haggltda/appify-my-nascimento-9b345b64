import { useState, useEffect } from "react";

export type IBGEMunicipio = { nome: string; uf: string };

const CACHE_KEY = "ibge:municipios:v2";
let memCache: IBGEMunicipio[] | null = null;

async function carregarMunicipios(): Promise<IBGEMunicipio[]> {
  if (memCache) return memCache;
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw) {
    memCache = JSON.parse(raw);
    return memCache!;
  }
  const res = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome"
  );
  const data = await res.json();
  memCache = (
    data as { nome: string; microrregiao?: { mesorregiao?: { UF?: { sigla: string } } } | null }[]
  )
    .map((m) => ({ nome: m.nome, uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? "" }))
    .filter((m) => m.uf);
  localStorage.setItem(CACHE_KEY, JSON.stringify(memCache));
  return memCache;
}

export const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO",
  "MA","MG","MS","MT","PA","PB","PE","PI","PR",
  "RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export function useIBGEMunicipios() {
  const [municipios, setMunicipios] = useState<IBGEMunicipio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    carregarMunicipios()
      .then(setMunicipios)
      .finally(() => setIsLoading(false));
  }, []);

  function cidadesPorUF(uf: string): string[] {
    return municipios.filter((m) => m.uf === uf).map((m) => m.nome);
  }

  return { municipios, cidadesPorUF, isLoading };
}
