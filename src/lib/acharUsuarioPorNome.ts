/** Casa usuário por nome (contém, case-insensitive) — sempre excluindo contas de teste (ex: "Iury Silva - Testes"), que colidem com nomes oficiais. */
export function acharUsuarioPorNome<T extends { label: string }>(usuarios: T[], nomeAlvo: string): T | undefined {
  const alvoLc = nomeAlvo.toLowerCase();
  return usuarios.find((u) => {
    const labelLc = u.label.toLowerCase();
    return labelLc.includes(alvoLc) && !labelLc.includes("teste");
  });
}
