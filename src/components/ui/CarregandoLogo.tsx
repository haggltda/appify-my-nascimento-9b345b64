import logoIcon from "@/assets/logo-nascimento-icon.png";

// =========================================================================
// Carregamento com a marca: o arco do Grupo Nascimento girando.
//
// É o MESMO arquivo que a Sidebar usa, então já está no cache do navegador
// desde o primeiro render da aplicação — não pisca ao montar.
//
// Dois modos:
//   • bloco   — ocupa o lugar do conteúdo que ainda não existe (1ª abertura).
//   • overlay — véu por cima do que já está na tela, para recálculo (troca de
//     filtro, competência, página). O conteúdo antigo continua visível
//     embaixo; trocá-lo por um vazio seria pior do que esperar meio segundo.
// =========================================================================

const CSS = `
@keyframes cl-giro{to{transform:rotate(360deg)}}
@keyframes cl-pulso{0%,100%{opacity:.3;transform:scale(.9)}50%{opacity:.8;transform:scale(1)}}
@keyframes cl-entra{from{opacity:0}to{opacity:1}}
.cl-giro{animation:cl-giro 1.1s linear infinite;transform-origin:50% 50%}
.cl-halo{animation:cl-pulso 1.7s ease-in-out infinite}
.cl-fade{animation:cl-entra .18s ease}
@media (prefers-reduced-motion:reduce){
  .cl-giro{animation-duration:3s}
  .cl-halo{animation:none;opacity:.35}
}
`;

// O arco já é um semicírculo: girando, ele vira um spinner com a cara da
// marca. A imagem entra num quadrado para o eixo do giro ficar no centro.
function Marca({ tamanho }: { tamanho: number }) {
  return (
    <div style={{ position: "relative", width: tamanho, height: tamanho, display: "grid", placeItems: "center" }}>
      <div className="cl-halo" style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,87,10,.18) 0%, rgba(232,87,10,0) 70%)",
      }} />
      <div className="cl-giro" style={{ width: tamanho * 0.78, height: tamanho * 0.78, display: "grid", placeItems: "center" }}>
        <img src={logoIcon} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      </div>
    </div>
  );
}

export default function CarregandoLogo({ texto = "Carregando…", overlay = false, tamanho = 72 }: {
  texto?: string; overlay?: boolean; tamanho?: number;
}) {
  const conteudo = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <Marca tamanho={tamanho} />
      {texto && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#64748b", letterSpacing: ".2px" }}>{texto}</div>}
    </div>
  );

  // Sem backdrop-filter de propósito: o bloco coberto tem milhares de pixels de
  // altura e o blur sobre essa área trava o compositor — a tela fica borrada e
  // sem responder. Véu opaco resolve e é barato.
  if (overlay) {
    return (
      <div className="cl-fade" style={{
        position: "absolute", inset: 0, zIndex: 5,
        background: "rgba(245,247,251,.82)", borderRadius: "inherit",
      }}>
        <style>{CSS}</style>
        {/* O bloco coberto é bem mais alto que a tela (painéis + tabela). Se a
            marca fosse centralizada nele, cairia no meio da tabela — fora da
            área visível, e a tela só parecia borrada. `sticky` mantém a
            animação à vista em qualquer ponto da rolagem. */}
        <div style={{ position: "sticky", top: "26vh", display: "flex", justifyContent: "center", padding: "28px 0" }}>
          {conteudo}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "56px 20px", display: "grid", placeItems: "center" }}>
      <style>{CSS}</style>
      {conteudo}
    </div>
  );
}
