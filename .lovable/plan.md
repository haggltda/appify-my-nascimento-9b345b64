## Hotfix único — Presidência Caixa + CNPJ Empresas

Aplicar exatamente o pacote `hotfix-pres-caixa-cnpj-20260607` enviado, em uma única migration, sem tocar em frontend, saldos, estrutura contábil ou Edge Functions.

### Etapas

1. **Criar migration única** com o SQL fornecido (seção 3), contendo:
   - Pré-checks de estrutura (funções `has_role`, `user_pode_atuar_empresa`, `can_access`; enums `app_role`, `app_acao`; colunas de `profiles`, `empresas`, `mz_40_fato_fluxo_caixa_realizado`).
   - Tabela de auditoria `public.aud_empresas_cnpj_snapshot` com RLS + GRANTs (SELECT para `authenticated` via `has_role` admin/controladoria/presidencia; ALL para `service_role`).
   - Snapshot + UPDATE cirúrgico de `razao_social` e `cnpj` em `public.empresas` para os 6 códigos AGPS, CANAA, HAGG, NH, SN, LF.
   - Recriar `public.parse_mz40_valor(text)`.
   - Recriar `public.normaliza_alias_banco(text)`.
   - Recriar `public.pres_caixa_status()` como `SECURITY INVOKER`, preservando admin/presidência/`acessa_todas_empresas`/`user_pode_atuar_empresa`.
   - Smoke de compilação tolerando `42501`.
   - Pós-check final de CNPJ.

2. **Aguardar aprovação** do usuário da migration (Lovable mostra diff antes de aplicar).

3. **Pós-execução (read-only)**:
   - `SELECT codigo, razao_social, nome_fantasia, cnpj, regime, ativa FROM public.empresas ORDER BY codigo;`
   - Confirmar `pres_caixa_status` recriada via `pg_proc`.
   - Confirmar `aud_empresas_cnpj_snapshot` com 6 linhas no batch.
   - Confirmar que `conta_bancaria`, `conta_contabil`, `saldo_inicial`, `saldos_iniciais_caixa`, `mz_40_fato_fluxo_caixa_realizado` não foram modificados (não há DDL/DML sobre eles na migration).
   - Confirmar que `src/pages/Presidencia.tsx` e Edge Functions não foram tocados.

4. **Atualizar preview** para usuário verificar header de empresa, cadastro de Empresas do Grupo e Painel da Presidência.

### Proibições respeitadas

- Sem alterar frontend (`Presidencia.tsx` e demais).
- Sem alterar `conta_bancaria`, `conta_contabil`, `saldo_inicial`, `saldos_iniciais_caixa`, `mz_40_*`, lançamentos, títulos, pré-títulos, aliases, RLS/policies existentes, Edge Functions, HERO, BI, DRE.
- Sem executar P3.E, P3.H, P3.H0-D2.
- Sem rollback do superbloco anterior.
- Sem criar conta contábil/bancária nem alterar saldo.

### Rollback

Script de rollback (seção 4 do comando) fica documentado; execução só sob comando explícito posterior.

### Retorno após execução

Lista exata pedida na seção 5: status da migration, snapshot=6, updates=6, SELECTs de verificação, confirmação de recriação de `pres_caixa_status()`, confirmação de não-alteração das tabelas/arquivos protegidos, e P3.E/P3.H/P3.H0-D2 seguem bloqueados.
