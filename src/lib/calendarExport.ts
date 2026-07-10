// Exportação de reunião pro calendário pessoal do usuário — sem OAuth, sem
// projeto no Google Cloud: só um link pré-preenchido (Google Calendar) e um
// arquivo .ics (funciona em Google/Outlook/Apple Calendar).

interface ReuniaoParaExportar {
  id: string;
  titulo: string;
  objetivo: string | null;
  data_hora: string;
  local_ou_link: string;
}

const DURACAO_PADRAO_MIN = 60;

function fmtGoogleUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildGoogleCalendarUrl(reuniao: ReuniaoParaExportar): string {
  const inicio = new Date(reuniao.data_hora);
  const fim = new Date(inicio.getTime() + DURACAO_PADRAO_MIN * 60_000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: reuniao.titulo,
    dates: `${fmtGoogleUtc(inicio.toISOString())}/${fmtGoogleUtc(fim.toISOString())}`,
    details: reuniao.objetivo ?? "",
    location: reuniao.local_ou_link,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(texto: string): string {
  return texto.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

export function buildIcsContent(reuniao: ReuniaoParaExportar): string {
  const inicio = new Date(reuniao.data_hora);
  const fim = new Date(inicio.getTime() + DURACAO_PADRAO_MIN * 60_000);
  const agora = fmtGoogleUtc(new Date().toISOString());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ERP Grupo Nascimento//Atas de Reuniao//PT-BR",
    "BEGIN:VEVENT",
    `UID:reuniao-${reuniao.id}@erp`,
    `DTSTAMP:${agora}`,
    `DTSTART:${fmtGoogleUtc(inicio.toISOString())}`,
    `DTEND:${fmtGoogleUtc(fim.toISOString())}`,
    `SUMMARY:${icsEscape(reuniao.titulo)}`,
    `DESCRIPTION:${icsEscape(reuniao.objetivo ?? "")}`,
    `LOCATION:${icsEscape(reuniao.local_ou_link)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function baixarIcs(reuniao: ReuniaoParaExportar) {
  const blob = new Blob([buildIcsContent(reuniao)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${reuniao.titulo.replace(/[^a-zA-Z0-9]+/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
