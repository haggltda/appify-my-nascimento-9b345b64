import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface ContaPrint {
  classificacao: string;
  descricao: string;
  tipo: "sintetica" | "analitica";
  natureza: "D" | "C";
  entra_fluxo: boolean;
  entra_orcamento: boolean;
  grupo_dre: "balanco" | "balanco_gerencial" | "dre";
  ativo: boolean;
  dre_linha_id: string | null;
}

interface Props {
  contas: ContaPrint[];
  empresaNome?: string;
  dreLinhas?: { id: string; codigo: string; descricao: string }[];
}

export function PlanoContasPrint({ contas, empresaNome, dreLinhas = [] }: Props) {
  const dreMap = new Map(dreLinhas.map((d) => [d.id, `${d.codigo} - ${d.descricao}`]));

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;

    const ordenadas = [...contas].sort((a, b) =>
      a.classificacao.localeCompare(b.classificacao, "pt-BR", { numeric: true }),
    );

    const grupos = {
      balanco: ordenadas.filter((c) => c.grupo_dre === "balanco"),
      balanco_gerencial: ordenadas.filter((c) => c.grupo_dre === "balanco_gerencial"),
      dre: ordenadas.filter((c) => c.grupo_dre === "dre"),
    };

    const renderRow = (c: ContaPrint) => {
      const nivel = c.classificacao.match(/\./g)?.length ?? 0;
      const indent = nivel * 18;
      const bold = c.tipo === "sintetica" ? "font-weight:600;" : "";
      const fade = !c.ativo ? "opacity:0.5;" : "";
      return `
        <tr style="${fade}">
          <td style="padding:3px 6px;font-family:monospace;font-size:10px;color:#1e3a8a;${bold}padding-left:${6 + indent}px;white-space:nowrap;">${c.classificacao}</td>
          <td style="padding:3px 6px;font-size:11px;${bold}">${escapeHtml(c.descricao)}</td>
          <td style="padding:3px 6px;font-size:10px;text-transform:capitalize;color:#555;">${c.tipo}</td>
          <td style="padding:3px 6px;font-size:10px;text-align:center;">${c.natureza}</td>
          <td style="padding:3px 6px;font-size:10px;text-align:center;">${c.entra_fluxo ? "✓" : "-"}</td>
          <td style="padding:3px 6px;font-size:10px;text-align:center;">${c.entra_orcamento ? "✓" : "-"}</td>
          <td style="padding:3px 6px;font-size:9px;color:#444;">${c.dre_linha_id ? escapeHtml(dreMap.get(c.dre_linha_id) ?? "") : "-"}</td>
          <td style="padding:3px 6px;font-size:10px;text-align:center;">${c.ativo ? "✓" : "-"}</td>
        </tr>
      `;
    };

    const renderTabela = (titulo: string, lista: ContaPrint[]) => {
      if (!lista.length) return "";
      return `
        <h2 style="font-size:13px;margin:18px 0 6px;color:#0f172a;border-bottom:2px solid #0f172a;padding-bottom:3px;">
          ${titulo} <span style="font-weight:400;color:#666;font-size:11px;">(${lista.length})</span>
        </h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:5px 6px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;border-bottom:1px solid #cbd5e1;">Classificação</th>
              <th style="padding:5px 6px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;border-bottom:1px solid #cbd5e1;">Descrição</th>
              <th style="padding:5px 6px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;border-bottom:1px solid #cbd5e1;">Tipo</th>
              <th style="padding:5px 6px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;border-bottom:1px solid #cbd5e1;">Nat.</th>
              <th style="padding:5px 6px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;border-bottom:1px solid #cbd5e1;">Fluxo</th>
              <th style="padding:5px 6px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;border-bottom:1px solid #cbd5e1;">Orç.</th>
              <th style="padding:5px 6px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;border-bottom:1px solid #cbd5e1;">Linha DRE</th>
              <th style="padding:5px 6px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;border-bottom:1px solid #cbd5e1;">Ativo</th>
            </tr>
          </thead>
          <tbody>${lista.map(renderRow).join("")}</tbody>
        </table>
      `;
    };

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Plano de Contas${empresaNome ? ` - ${empresaNome}` : ""}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color:#0f172a; margin:0; padding:0; }
    table tr { page-break-inside: avoid; }
    h2 { page-break-after: avoid; }
    .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #0f172a; padding-bottom:8px; margin-bottom:12px; }
    .meta { font-size:10px; color:#555; }
    @media print { .no-print { display:none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;">Módulo Contábil</div>
      <h1 style="margin:2px 0 0;font-size:18px;">Plano de Contas</h1>
      ${empresaNome ? `<div style="font-size:11px;color:#334155;margin-top:2px;">${escapeHtml(empresaNome)}</div>` : ""}
    </div>
    <div class="meta" style="text-align:right;">
      <div>Total de contas: <strong>${ordenadas.length}</strong></div>
      <div>Emitido em ${new Date().toLocaleString("pt-BR")}</div>
    </div>
  </div>

  <div class="no-print" style="margin-bottom:12px;text-align:right;">
    <button onclick="window.print()" style="padding:6px 14px;background:#0f172a;color:white;border:0;border-radius:4px;cursor:pointer;font-size:12px;">Imprimir / Salvar PDF</button>
  </div>

  ${renderTabela("Balanço Patrimonial", grupos.balanco)}
  ${renderTabela("Balanço Gerencial", grupos.balanco_gerencial)}
  ${renderTabela("DRE - Contas de Resultado", grupos.dre)}

  ${ordenadas.length === 0 ? `<p style="color:#888;font-size:12px;text-align:center;padding:40px;">Nenhuma conta cadastrada.</p>` : ""}

  <footer style="margin-top:24px;padding-top:8px;border-top:1px solid #ddd;font-size:9px;color:#888;text-align:center;">
    ERP Cheetah - Plano de contas hierárquico (sintéticas em negrito; analíticas indentadas).
  </footer>

  <script>setTimeout(() => window.print(), 300);</script>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
  };

  return (
    <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}>
      <Printer className="h-4 w-4" />
      Imprimir / PDF
    </Button>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
