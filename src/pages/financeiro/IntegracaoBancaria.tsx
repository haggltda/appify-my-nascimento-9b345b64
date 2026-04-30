import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Banknote, Settings, Upload, RefreshCw, Plug, AlertTriangle, CheckCircle2, Info } from "lucide-react";

type ContaBancaria = any;
type Retorno = any;
type Extrato = any;
type Param = any;

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  nao_configurado: "outline",
  configurado: "secondary",
  ativo: "default",
  erro: "destructive",
  pausado: "outline",
};

export default function IntegracaoBancaria() {
  const { toast } = useToast();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [retornos, setRetornos] = useState<Retorno[]>([]);
  const [extratos, setExtratos] = useState<Extrato[]>([]);
  const [param, setParam] = useState<Param | null>(null);
  const [loading, setLoading] = useState(true);
  const [editConta, setEditConta] = useState<ContaBancaria | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadConta, setUploadConta] = useState<string>("");
  const [uploadFormato, setUploadFormato] = useState<string>("cnab240");
  const [uploadNome, setUploadNome] = useState("");
  const [uploadConteudo, setUploadConteudo] = useState("");

  async function carregar() {
    setLoading(true);
    const { data: prof } = await supabase.from("profiles").select("empresa_id").single();
    const eid = (prof as any)?.empresa_id;
    setEmpresaId(eid);
    if (!eid) { setLoading(false); return; }

    const [c, r, e, p] = await Promise.all([
      supabase.from("conta_bancaria").select("*").eq("empresa_id", eid).order("nome", { ascending: true }),
      supabase.from("retorno_bancario").select("*, conta_bancaria(nome,banco)").eq("empresa_id", eid).order("data_recebimento", { ascending: false }).limit(50),
      supabase.from("extrato_bancario").select("*, conta_bancaria(nome,banco)").eq("empresa_id", eid).order("data_lancamento", { ascending: false }).limit(50),
      supabase.from("parametro_integracao_bancaria").select("*").eq("empresa_id", eid).maybeSingle(),
    ]);
    setContas(c.data || []);
    setRetornos(r.data || []);
    setExtratos(e.data || []);
    setParam(p.data || { empresa_id: eid, modo_match: "estrito", tolerancia_valor: 0, tolerancia_dias: 0, baixa_automatica: false, dias_baixa_automatica: 0, notificar_divergencias: true });
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function salvarConta() {
    if (!editConta) return;
    const { id, ...rest } = editConta;
    const { error } = await supabase.from("conta_bancaria").update(rest).eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Configuração salva", description: "Os dados de integração foram atualizados." });
    setEditConta(null);
    carregar();
  }

  async function salvarParam() {
    if (!param || !empresaId) return;
    const { error } = await supabase.from("parametro_integracao_bancaria").upsert({ ...param, empresa_id: empresaId });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Parâmetros salvos" });
  }

  async function uploadRetorno() {
    if (!uploadConta || !uploadConteudo) {
      toast({ title: "Faltam dados", description: "Selecione conta e cole/conteúdo do arquivo", variant: "destructive" });
      return;
    }
    const hash = String(uploadConteudo.length) + "_" + uploadNome;
    const { data, error } = await supabase.from("retorno_bancario").insert({
      empresa_id: empresaId,
      conta_bancaria_id: uploadConta,
      formato: uploadFormato as any,
      arquivo_nome: uploadNome || `retorno_${Date.now()}.ret`,
      arquivo_conteudo: uploadConteudo,
      arquivo_hash: hash,
      status: "recebido",
      origem: "upload_manual",
    }).select().single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Arquivo recebido", description: "Aguarde processamento (parser ainda não plugado)." });
    setUploadOpen(false);
    setUploadConteudo(""); setUploadNome("");
    carregar();
    // tenta processar (stub)
    if (data?.id) {
      await supabase.rpc("cnab_processar_retorno", { _retorno_id: data.id });
      carregar();
    }
  }

  async function processarRetorno(id: string) {
    const { data, error } = await supabase.rpc("cnab_processar_retorno", { _retorno_id: id });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Processamento solicitado", description: (data as any)?.mensagem || "Concluído." });
    carregar();
  }

  async function rodarConciliacao() {
    if (!empresaId) return;
    const { data, error } = await supabase.rpc("conciliacao_auto_match", { _empresa_id: empresaId });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    const r = data as any;
    toast({ title: "Conciliação executada", description: `${r.matches_realizados}/${r.extratos_avaliados} conciliados — ${r.pendentes} pendentes` });
    carregar();
  }

  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Plug className="h-7 w-7 text-primary" /> Integração Bancária
          </h1>
          <p className="text-muted-foreground mt-1">Parametrização de remessas, retornos e conciliação. Plugue suas APIs/credenciais quando estiverem prontas.</p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Estrutura pronta — operação pendente</AlertTitle>
        <AlertDescription>
          As tabelas, campos e RPCs estão criados. Parsers de CNAB/OFX e envio por API/FTP serão plugados no próximo passo. Hoje você pode: configurar contas, registrar parâmetros e fazer upload manual de arquivos de retorno.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="contas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contas"><Settings className="h-4 w-4 mr-1" /> Contas & API</TabsTrigger>
          <TabsTrigger value="retornos"><Upload className="h-4 w-4 mr-1" /> Retornos</TabsTrigger>
          <TabsTrigger value="conciliacao"><RefreshCw className="h-4 w-4 mr-1" /> Conciliação</TabsTrigger>
          <TabsTrigger value="param"><Banknote className="h-4 w-4 mr-1" /> Parâmetros</TabsTrigger>
        </TabsList>

        {/* CONTAS */}
        <TabsContent value="contas">
          <Card>
            <CardHeader>
              <CardTitle>Contas Bancárias e Integração</CardTitle>
              <CardDescription>Configure método de integração, ambiente e referências de credenciais por conta.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Tipo Integração</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Sinc.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contas.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cadastre contas bancárias em Configurações → Contas Bancárias.</TableCell></TableRow>
                  )}
                  {contas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>{c.banco}</TableCell>
                      <TableCell><Badge variant="outline">{c.integracao_tipo || "manual"}</Badge></TableCell>
                      <TableCell>{c.integracao_ambiente || "sandbox"}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANTS[c.integracao_status || "nao_configurado"]}>{c.integracao_status || "nao_configurado"}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.integracao_ultima_sincronia ? new Date(c.integracao_ultima_sincronia).toLocaleString() : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setEditConta(c)}>Configurar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RETORNOS */}
        <TabsContent value="retornos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Arquivos de Retorno</CardTitle>
                <CardDescription>Upload manual hoje. Recebimento por API/FTP virá depois.</CardDescription>
              </div>
              <Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1" /> Upload Retorno</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recebido em</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registros</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retornos.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum arquivo de retorno recebido.</TableCell></TableRow>
                  )}
                  {retornos.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.data_recebimento).toLocaleString()}</TableCell>
                      <TableCell>{r.conta_bancaria?.nome || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{r.formato}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate text-xs">{r.arquivo_nome}</TableCell>
                      <TableCell><Badge variant={r.status === "erro" ? "destructive" : r.status === "processado" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                      <TableCell>{r.qtd_processados}/{r.qtd_registros}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => processarRetorno(r.id)}>Reprocessar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONCILIAÇÃO */}
        <TabsContent value="conciliacao">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Conciliação Bancária</CardTitle>
                <CardDescription>Match estrito (valor + data exatos). Importação de extrato ainda não plugada.</CardDescription>
              </div>
              <Button onClick={rodarConciliacao}><RefreshCw className="h-4 w-4 mr-1" /> Rodar Conciliação</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extratos.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum lançamento de extrato. Importação OFX/CSV virá no próximo passo.</TableCell></TableRow>
                  )}
                  {extratos.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{e.data_lancamento}</TableCell>
                      <TableCell>{e.conta_bancaria?.nome || "—"}</TableCell>
                      <TableCell>{e.tipo === "credito" ? <Badge variant="default">+ Crédito</Badge> : <Badge variant="secondary">− Débito</Badge>}</TableCell>
                      <TableCell className="font-mono">R$ {Number(e.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="max-w-md truncate text-xs">{e.descricao}</TableCell>
                      <TableCell>
                        {e.status_conciliacao === "conciliado" ? (
                          <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />conciliado</Badge>
                        ) : e.status_conciliacao === "divergente" ? (
                          <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />divergente</Badge>
                        ) : (
                          <Badge variant="outline">{e.status_conciliacao}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PARÂMETROS */}
        <TabsContent value="param">
          <Card>
            <CardHeader>
              <CardTitle>Parâmetros Gerais da Integração</CardTitle>
              <CardDescription>Regras de match e baixa automática para a empresa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Modo de match</Label>
                  <Select value={param?.modo_match || "estrito"} onValueChange={(v) => setParam({ ...param, modo_match: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="estrito">Estrito (valor + data exatos)</SelectItem>
                      <SelectItem value="tolerante">Tolerante (com janela)</SelectItem>
                      <SelectItem value="inteligente">Inteligente (com regras)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tolerância de valor (R$)</Label>
                  <Input type="number" step="0.01" value={param?.tolerancia_valor ?? 0} onChange={(e) => setParam({ ...param, tolerancia_valor: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Tolerância de dias</Label>
                  <Input type="number" value={param?.tolerancia_dias ?? 0} onChange={(e) => setParam({ ...param, tolerancia_dias: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={!!param?.baixa_automatica} onCheckedChange={(v) => setParam({ ...param, baixa_automatica: v })} />
                  <Label>Baixa automática após conciliar</Label>
                </div>
                <div>
                  <Label>Dias para baixa automática</Label>
                  <Input type="number" value={param?.dias_baixa_automatica ?? 0} onChange={(e) => setParam({ ...param, dias_baixa_automatica: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={!!param?.notificar_divergencias} onCheckedChange={(v) => setParam({ ...param, notificar_divergencias: v })} />
                  <Label>Notificar divergências</Label>
                </div>
                <div className="md:col-span-2">
                  <Label>E-mail para notificação de erros</Label>
                  <Input type="email" value={param?.email_notificacao_erros || ""} onChange={(e) => setParam({ ...param, email_notificacao_erros: e.target.value })} placeholder="financeiro@empresa.com.br" />
                </div>
                <div className="md:col-span-3">
                  <Label>Webhook global (opcional)</Label>
                  <Input value={param?.webhook_global_url || ""} onChange={(e) => setParam({ ...param, webhook_global_url: e.target.value })} placeholder="https://…/webhook/banco" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={salvarParam}>Salvar Parâmetros</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: Configurar Conta */}
      <Dialog open={!!editConta} onOpenChange={(o) => !o && setEditConta(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Integração — {editConta?.nome}</DialogTitle>
          </DialogHeader>
          {editConta && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Integração</Label>
                <Select value={editConta.integracao_tipo || "manual"} onValueChange={(v) => setEditConta({ ...editConta, integracao_tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (download/upload)</SelectItem>
                    <SelectItem value="api_rest">API REST do banco</SelectItem>
                    <SelectItem value="open_finance">Open Finance</SelectItem>
                    <SelectItem value="cnab_arquivo">Arquivo CNAB (FTP/SFTP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ambiente</Label>
                <Select value={editConta.integracao_ambiente || "sandbox"} onValueChange={(v) => setEditConta({ ...editConta, integracao_ambiente: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editConta.integracao_status || "nao_configurado"} onValueChange={(v) => setEditConta({ ...editConta, integracao_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_configurado">Não configurado</SelectItem>
                    <SelectItem value="configurado">Configurado</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="erro">Erro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dias para baixa automática</Label>
                <Input type="number" value={editConta.dias_baixa_automatica ?? 0} onChange={(e) => setEditConta({ ...editConta, dias_baixa_automatica: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="md:col-span-2">
                <Label>URL da API</Label>
                <Input value={editConta.integracao_api_url || ""} onChange={(e) => setEditConta({ ...editConta, integracao_api_url: e.target.value })} placeholder="https://api.banco.com.br/v1" />
              </div>
              <div className="md:col-span-2">
                <Label>Webhook URL</Label>
                <Input value={editConta.integracao_webhook_url || ""} onChange={(e) => setEditConta({ ...editConta, integracao_webhook_url: e.target.value })} placeholder="https://…/webhook/recebimento" />
              </div>
              <div>
                <Label>Nome do secret: Client ID</Label>
                <Input value={editConta.integracao_client_id_ref || ""} onChange={(e) => setEditConta({ ...editConta, integracao_client_id_ref: e.target.value })} placeholder="BANCO_X_CLIENT_ID" />
              </div>
              <div>
                <Label>Nome do secret: Client Secret</Label>
                <Input value={editConta.integracao_client_secret_ref || ""} onChange={(e) => setEditConta({ ...editConta, integracao_client_secret_ref: e.target.value })} placeholder="BANCO_X_CLIENT_SECRET" />
              </div>
              <div>
                <Label>Nome do secret: Certificado</Label>
                <Input value={editConta.integracao_certificado_ref || ""} onChange={(e) => setEditConta({ ...editConta, integracao_certificado_ref: e.target.value })} placeholder="BANCO_X_CERT_PEM" />
              </div>
              <div>
                <Label>Nome do secret: Token de acesso</Label>
                <Input value={editConta.integracao_token_acesso_ref || ""} onChange={(e) => setEditConta({ ...editConta, integracao_token_acesso_ref: e.target.value })} placeholder="BANCO_X_TOKEN" />
              </div>
              <div>
                <Label>FTP/SFTP Host</Label>
                <Input value={editConta.integracao_ftp_host || ""} onChange={(e) => setEditConta({ ...editConta, integracao_ftp_host: e.target.value })} placeholder="ftp.banco.com.br" />
              </div>
              <div>
                <Label>FTP Porta</Label>
                <Input type="number" value={editConta.integracao_ftp_porta ?? ""} onChange={(e) => setEditConta({ ...editConta, integracao_ftp_porta: parseInt(e.target.value) || null })} placeholder="22" />
              </div>
              <div>
                <Label>Pasta Remessa</Label>
                <Input value={editConta.integracao_ftp_pasta_remessa || ""} onChange={(e) => setEditConta({ ...editConta, integracao_ftp_pasta_remessa: e.target.value })} placeholder="/envio" />
              </div>
              <div>
                <Label>Pasta Retorno</Label>
                <Input value={editConta.integracao_ftp_pasta_retorno || ""} onChange={(e) => setEditConta({ ...editConta, integracao_ftp_pasta_retorno: e.target.value })} placeholder="/retorno" />
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <Textarea value={editConta.observacoes_integracao || ""} onChange={(e) => setEditConta({ ...editConta, observacoes_integracao: e.target.value })} rows={3} />
              </div>
              {editConta.integracao_ultimo_erro && (
                <Alert variant="destructive" className="md:col-span-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{editConta.integracao_ultimo_erro}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditConta(null)}>Cancelar</Button>
            <Button onClick={salvarConta}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Upload Retorno */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Upload de Arquivo de Retorno</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Conta Bancária</Label>
                <Select value={uploadConta} onValueChange={setUploadConta}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.banco}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Formato</Label>
                <Select value={uploadFormato} onValueChange={setUploadFormato}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cnab240">CNAB 240</SelectItem>
                    <SelectItem value="cnab400">CNAB 400</SelectItem>
                    <SelectItem value="ofx">OFX</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="api_json">API JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nome do arquivo</Label>
              <Input value={uploadNome} onChange={(e) => setUploadNome(e.target.value)} placeholder="retorno_20260430.ret" />
            </div>
            <div>
              <Label>Conteúdo (cole aqui o conteúdo do arquivo)</Label>
              <Textarea value={uploadConteudo} onChange={(e) => setUploadConteudo(e.target.value)} rows={8} className="font-mono text-xs" placeholder="Cole o conteúdo bruto do arquivo CNAB/OFX..." />
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">O arquivo é armazenado para auditoria. O parser que interpreta cada linha será plugado depois.</AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={uploadRetorno}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
