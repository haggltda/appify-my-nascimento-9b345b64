import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { QrCode, FileText, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

export default function CobrancaTab() {
  const qc = useQueryClient();
  const [openGerar, setOpenGerar] = useState<{ titulo: any; tipo: "boleto" | "pix" } | null>(null);
  const [verPix, setVerPix] = useState<any | null>(null);

  // Títulos abertos sem cobrança gerada (para gerar)
  const { data: titulosSemCobranca = [] } = useQuery<any[]>({
    queryKey: ["titulos-sem-cobranca"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("titulo_receber")
        .select("*")
        .in("status", ["aberto", "parcial", "vencido"])
        .order("data_vencimento", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: boletos = [] } = useQuery<any[]>({
    queryKey: ["cobranca-boleto"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cobranca_boleto")
        .select("*, titulo_receber(numero, sacado_nome, valor, data_vencimento, status), conta_bancaria(banco_codigo, banco_nome)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pixs = [] } = useQuery<any[]>({
    queryKey: ["cobranca-pix"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cobranca_pix")
        .select("*, titulo_receber(numero, sacado_nome, valor, data_vencimento, status)")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tituloIdsComBoleto = useMemo(() => new Set(boletos.map((b) => b.titulo_id)), [boletos]);
  const tituloIdsComPix = useMemo(() => new Set(pixs.map((p) => p.titulo_id)), [pixs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardDescription>Boletos gerados</CardDescription><CardTitle className="text-3xl">{boletos.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>PIX ativos</CardDescription><CardTitle className="text-3xl">{pixs.filter((p) => p.status === "ativa").length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Títulos sem cobrança</CardDescription><CardTitle className="text-3xl">{titulosSemCobranca.filter((t) => !tituloIdsComBoleto.has(t.id) && !tituloIdsComPix.has(t.id)).length}</CardTitle></CardHeader></Card>
      </div>

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList>
          <TabsTrigger value="pendentes">Gerar cobrança</TabsTrigger>
          <TabsTrigger value="boletos">Boletos ({boletos.length})</TabsTrigger>
          <TabsTrigger value="pixs">PIX ({pixs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Títulos elegíveis para gerar boleto/PIX</CardTitle>
              <CardDescription>Títulos abertos, parciais ou vencidos. Você pode gerar boleto e PIX simultaneamente.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Sacado</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Cobrança</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {titulosSemCobranca.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum título</TableCell></TableRow>}
                  {titulosSemCobranca.map((t) => {
                    const temBoleto = tituloIdsComBoleto.has(t.id);
                    const temPix = tituloIdsComPix.has(t.id);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.numero ?? t.numero_documento}</TableCell>
                        <TableCell>{t.sacado_nome ?? t.cliente_nome}</TableCell>
                        <TableCell>{fmtDate(t.data_vencimento)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(t.valor)}</TableCell>
                        <TableCell className="space-x-1">
                          {temBoleto && <Badge variant="default" className="text-xs">Boleto</Badge>}
                          {temPix && <Badge variant="default" className="text-xs">PIX</Badge>}
                          {!temBoleto && !temPix && <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant={temBoleto ? "outline" : "default"} onClick={() => setOpenGerar({ titulo: t, tipo: "boleto" })}>
                            <FileText className="h-3 w-3 mr-1" /> Boleto
                          </Button>
                          <Button size="sm" variant={temPix ? "outline" : "default"} onClick={() => setOpenGerar({ titulo: t, tipo: "pix" })}>
                            <QrCode className="h-3 w-3 mr-1" /> PIX
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boletos">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nosso Nº</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Sacado</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boletos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum boleto gerado</TableCell></TableRow>}
                  {boletos.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.nosso_numero}</TableCell>
                      <TableCell className="font-mono text-xs">{b.titulo_receber?.numero}</TableCell>
                      <TableCell>{b.titulo_receber?.sacado_nome}</TableCell>
                      <TableCell className="text-xs">{b.conta_bancaria?.banco_codigo} {b.conta_bancaria?.banco_nome}</TableCell>
                      <TableCell className="text-right">{fmtMoney(b.titulo_receber?.valor)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{b.status_registro}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pixs">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>TXID</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Sacado</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pixs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum PIX</TableCell></TableRow>}
                  {pixs.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-[10px] truncate max-w-[140px]">{p.txid}</TableCell>
                      <TableCell className="font-mono text-xs">{p.titulo_receber?.numero}</TableCell>
                      <TableCell>{p.titulo_receber?.sacado_nome}</TableCell>
                      <TableCell className="text-right">{fmtMoney(p.titulo_receber?.valor)}</TableCell>
                      <TableCell className="text-xs">{p.expira_em ? new Date(p.expira_em).toLocaleString("pt-BR") : "—"}</TableCell>
                      <TableCell><Badge variant={p.status === "ativa" ? "default" : "secondary"} className="text-xs">{p.status}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => setVerPix(p)}><QrCode className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {openGerar && (
        <GerarCobrancaDialog
          titulo={openGerar.titulo}
          tipo={openGerar.tipo}
          onClose={(ok) => {
            setOpenGerar(null);
            if (ok) {
              qc.invalidateQueries({ queryKey: ["cobranca-boleto"] });
              qc.invalidateQueries({ queryKey: ["cobranca-pix"] });
            }
          }}
        />
      )}
      {verPix && <PixViewerDialog pix={verPix} onClose={() => setVerPix(null)} />}
    </div>
  );
}

function GerarCobrancaDialog({ titulo, tipo, onClose }: { titulo: any; tipo: "boleto" | "pix"; onClose: (ok: boolean) => void }) {
  const [carteira, setCarteira] = useState("17");
  const [instrucoes, setInstrucoes] = useState("Após vencimento, cobrar multa de 2% e juros de 1% ao mês.");
  const [chavePix, setChavePix] = useState("");
  const [expiracao, setExpiracao] = useState("86400");

  const gerar = useMutation({
    mutationFn: async () => {
      if (tipo === "boleto") {
        const { data, error } = await (supabase as any).rpc("cobranca_gerar_boleto", {
          _titulo_id: titulo.id,
          _carteira: carteira,
          _instrucoes: instrucoes,
        });
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase as any).rpc("cobranca_gerar_pix", {
          _titulo_id: titulo.id,
          _chave_pix: chavePix || null,
          _expiracao_segundos: Number(expiracao),
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast.success(`${tipo === "boleto" ? "Boleto" : "PIX"} gerado com sucesso!`);
      onClose(true);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar {tipo === "boleto" ? "boleto" : "cobrança PIX"} — {titulo.numero ?? titulo.numero_documento}</DialogTitle>
          <DialogDescription>{titulo.sacado_nome ?? titulo.cliente_nome} • {fmtMoney(titulo.valor)} • venc. {fmtDate(titulo.data_vencimento)}</DialogDescription>
        </DialogHeader>
        {tipo === "boleto" ? (
          <div className="space-y-3">
            <div><Label>Carteira</Label><Input value={carteira} onChange={(e) => setCarteira(e.target.value)} /></div>
            <div><Label>Instruções</Label><Textarea value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} rows={3} /></div>
            <p className="text-xs text-muted-foreground">O boleto será adicionado ao próximo lote CNAB de remessa do banco selecionado para o título.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div><Label>Chave PIX (recebimento)</Label><Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder="CNPJ, e-mail, celular ou aleatória" /></div>
            <div>
              <Label>Expiração (segundos)</Label>
              <Input type="number" value={expiracao} onChange={(e) => setExpiracao(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">86400 = 24h • 604800 = 7 dias</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancelar</Button>
          <Button onClick={() => gerar.mutate()} disabled={gerar.isPending}>Gerar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PixViewerDialog({ pix, onClose }: { pix: any; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    navigator.clipboard.writeText(pix.copia_e_cola ?? pix.txid);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>PIX — {pix.titulo_receber?.numero}</DialogTitle>
          <DialogDescription>{pix.titulo_receber?.sacado_nome} • {fmtMoney(pix.titulo_receber?.valor)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex justify-center p-6 bg-muted rounded-md">
            <div className="w-48 h-48 bg-background border-2 border-dashed flex items-center justify-center text-muted-foreground text-sm">
              {pix.qrcode_imagem ? <img src={pix.qrcode_imagem} alt="QR PIX" /> : "QR Code (gerado pelo banco)"}
            </div>
          </div>
          <div>
            <Label>TXID</Label>
            <Input readOnly value={pix.txid} className="font-mono text-xs" />
          </div>
          <div>
            <Label>Copia-e-cola</Label>
            <div className="flex gap-2">
              <Input readOnly value={pix.copia_e_cola ?? "(será preenchido pelo banco após registro)"} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={copiar}>
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
