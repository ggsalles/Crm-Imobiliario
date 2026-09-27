# Registro de Versão - CRM SalesScore

## [REFINAMENTO_COMERCIAL_SUITES_E_FICHA_360] - 27 de Setembro de 2026
Atendimento cirúrgico aos feedbacks de clientes do mercado imobiliário: Cadastro de Suítes e Modal de Visualização Completa 360° sem depender do modo "Editar".

### Novidades e Recursos:
- **Campo Dedicado de Suítes (`PropertyForm.tsx` & `PropertyCard.tsx`):**
  - Implementação de campo de entrada exclusivo para quantidade de **Suítes** no cadastro e edição de imóveis.
  - Exibição inteligente nos cards de catálogo e vitrine (ex: `3 Qts (1 st)`).
  - Atualização na interface `Property`, na rota da API (`/api/properties`) com fallback seguro de retrocompatibilidade no banco.
- **Ficha Técnica e Modal de Detalhes 360° (`PropertyDetailModal.tsx`):**
  - Solução definitiva para a dor do corretor de ter que clicar em "Editar" apenas para ler dados ou ver fotos.
  - Clique direto no card (ou botão "Olho / Visualizar") abre modal moderno com:
    - Galeria de fotos ampliada com navegação anterior/próxima e faixa de miniaturas.
    - Ficha de especificações completas (Área Útil, Dormitórios, **Suítes com destaque**, Banheiros, Vagas, IPTU e Condomínio).
    - Descrição formatada do imóvel e comodidades/tags.
    - Endereço completo estruturado com botão de mapa.
    - Barra de ações comerciais no rodapé: "Negociar no Funil", "WhatsApp / PDF", "Editar Imóvel" e "Excluir".

## [FASE_12_IMPORT_LEADS_AND_DEAL_PROPOSALS] - 27 de Setembro de 2026
Central de Importação Inteligente de Contatos & Leads via CSV/Planilha + Emissão de Propostas Comerciais Formais e Due Diligence Imobiliária no Detalhe da Negociação.

### Novidades e Recursos:
- **Central de Importação de Contatos e Leads (`ImportContactsModal.tsx` & `/app/contacts`):**
  - Upload drag-and-drop e seletor de arquivos `.csv` e `.txt` com detecção automática de delimitadores (vírgula `,` ou ponto e vírgula `;`) e tratamento de aspas RFC 4180.
  - Download em 1 clique de arquivo modelo oficial (`modelo_importacao_leads_crm.csv`) já preenchido com dados de exemplo e codificação UTF-8 BOM.
  - Mapeamento dinâmico de colunas com auto-reconhecimento inteligente de cabeçalhos (Nome, Telefone, E-mail, Empresa/Cargo, Origem do Lead, Temperatura).
  - Normalizador automático de números de telefone para formato brasileiro `(DDD) 9XXXX-XXXX`.
  - Mecanismo de deduplicação em tempo real comparando e-mails e telefones com a base já cadastrada, com opção de ignorar duplicados automaticamente.
  - Tabela interativa de conferência/pré-visualização com badges informativos (`Novo`, `Duplicado`, `Inválido`).
  - Importação assíncrona em lote com barra de progresso em tempo real, contador de processamento e auditoria LGPD (`IMPORT_CONTACTS`).
- **Gerador de Propostas Comerciais Formais (`CommercialProposalModal.tsx` & `/app/deals/[id]`):**
  - Modal interativo para estruturação de propostas de compra, venda ou locação com cálculo automático de proporções.
  - Discriminação completa de: Sinal / Entrada (% e R$), Financiamento Bancário, Recursos Próprios / FGTS, Parcelamento Direto com Proprietário e Permuta / Veículo.
  - Verificador inteligente de integridade da oferta (soma dos pagamentos vs valor total da proposta).
  - Ações comerciais imediatas:
    - **Imprimir / Gerar PDF Formal:** Documento timbrado profissional com dados do proponente comprador, imóvel vinculado, quadro de condições financeiras, cláusulas especiais de validade e linhas de assinatura (Comprador, Corretor CRECI e Proprietário).
    - **Disparar Proposta no WhatsApp:** Gera link direto (`wa.me`) com mensagem estilizada contendo todos os termos e valores combinados.
    - **Gravar no Histórico:** Registra a emissão da proposta na linha do tempo do negócio (`Timeline`) e nos logs de auditoria (`CREATE_COMMERCIAL_PROPOSAL`).
- **Checklist de Due Diligence e Conformidade Jurídica (`DealDocumentsChecklist.tsx`):**
  - Acompanhamento do processo de certidões e análise jurídica imobiliária diretamente no detalhe do negócio.
  - Checklist padrão com documentos essenciais: RG/CPF, Comprovante de Residência, Comprovante de Renda, Certidão de Estado Civil, Matrícula Atualizada de Inteiro Teor com Ônus Reais, Certidão Negativa de IPTU, Quitação Condominial e Certidões dos Distribuidores Cíveis/Trabalhistas/Federais.
  - Seletor de status por documento (`Pendente`, `Em Análise`, `Aprovado`, `Dispensado`) com barra de progresso de conclusão da due diligence.
  - Campo para notas de protocolo, número de matrícula ou cartório por documento.
  - Possibilidade de adicionar documentos personalizados e persistência resiliente.

## [FASE_11_DATA_EXPORT_AND_EXECUTIVE_REPORTS] - 27 de Setembro de 2026
Central Unificada de Exportação de Dados, Backup e Relatórios Executivos em CSV, PDF e JSON.

### Novidades e Recursos:
- **Utilitário Universal de Exportação (`lib/csv-export.ts`):**
  - Geração de arquivos CSV com marca de ordem de bytes UTF-8 BOM (`\uFEFF`) para compatibilidade perfeita com Microsoft Excel e Google Sheets (sem corrupção de acentos/cedilhas).
  - Sanitização de células contra ataques de injeção de fórmulas CSV (Excel Formula Injection).
- **Exportação do Funil de Vendas (`/app/pipeline` & `PipelineHeader.tsx`):**
  - Novo botão "Exportar .CSV" no cabeçalho do funil.
  - Exportação completa de oportunidades ativas/filtradas com ID, Título, Estágio, Valor monetário, Cliente, Imóvel vinculado, Motivo de perda e datas.
- **Exportação de Atividades e Tarefas (`/app/activities`):**
  - Novo botão "Exportar .CSV" no topo da listagem de atividades.
  - Exportação estruturada de reuniões, visitas, ligações e follow-ups com status (pendente/concluída), cliente e negociação relacionada.
- **Central de Exportações no Dashboard (`components/dashboard/ReportsView.tsx`):**
  - Painel no topo da aba "Relatórios" com 3 ações em 1 clique:
    1. **Exportar CSV Consolidado:** Métricas de faturamento, ticket médio, taxa de conversão do funil e distribuição quantitativa por fase.
    2. **Imprimir / Gerar PDF do Relatório Executivo:** Template gráfico impresso limpo para apresentações gerenciais com KPIs, tabela consolidada e aproveitamento de metas.
    3. **Backup Completo do CRM (JSON):** Exportação snapshot com todas as negociações, contatos, atividades e imóveis.
- **Rastreabilidade e Governança:** Todas as exportações são automaticamente registradas no log de auditoria do sistema (`EXPORT_REPORT`).

## [FASE_10_VITRINE_PROPERTIES_DEAL_CONVERSION] - 27 de Setembro de 2026
Melhorias comerciais de alta conversão nos módulos de Imóveis (`/app/properties`) e Vitrine Pública (`/app/vitrine`).

### Novidades e Recursos:
- **Conversão Direta de Imóvel em Negociação (`CreateDealFromPropertyModal.tsx`):**
  - Botão de ação "Negociar" presente tanto nos cards de catálogo de imóveis quanto nos cards da Vitrine para corretores logados.
  - Pré-preenchimento automático do título da oportunidade, valor de tabela do imóvel e estágio inicial do funil (`lead`).
  - Associação instantânea com a carteira de contatos/clientes compradores e registro no log de auditoria.
  - Link de retorno direto para visualização no Funil de Vendas (`/pipeline`).
- **Envio Direto via WhatsApp e Ficha Técnica em PDF (`PropertyShareModal.tsx`):**
  - Campo de telefone do cliente para disparo direto via WhatsApp Web / App (`wa.me/55...`).
  - Botão "Imprimir / PDF": gera automaticamente uma ficha técnica limpa e elegante para entrega impressa ou salvamento em PDF com foto de capa, especificações, encargos e link da vitrine digital.
- **Filtros Avançados de Preço na Vitrine (`ShowcaseFilters.tsx` & `/app/vitrine`):**
  - Implementação de campo de **Preço Mínimo** e **Preço Máximo**.
  - Botões de faixas rápidas de preço ("Até 500k", "500k - 1M", "1M - 2.5M", "Acima 2.5M").
  - Sincronização em tempo real da contagem de imóveis disponíveis e reset simplificado.

## [FASE_9_CALENDAR_MODULARIZATION_AND_ICAL] - 27 de Setembro de 2026
Modularização completa e otimização de performance do módulo de Calendário e Agenda de Visitas Imobiliárias.

### Novidades e Otimizações:
- **Modularização de Arquivo Monolítico:** Redução de `/app/calendar/page.tsx` de 1.275 linhas para componentes desacoplados e de alta coesão:
  - `components/calendar/CalendarHeader.tsx`: Cabeçalho com busca em tempo real, contador de eventos, filtros por tipo e status, e exportação.
  - `components/calendar/MonthGrid.tsx`: Grid mensal ultra veloz com indexação direta `O(1)` por data (`eventsByDateStr`), eliminando 42 filtros repetidos por ciclo de render.
  - `components/calendar/DayScheduleView.tsx`: Painel lateral com a agenda diária, atalho para adicionar compromisso e resumo semanal.
  - `components/calendar/EventCard.tsx`: Card memoizado com integração direta ao Google Agenda, exportação de `.ics`, alternância de status e exclusão com modal de confirmação.
  - `components/calendar/EventModal.tsx`: Modal para criação e edição de agendamentos com validação de horários passados e slots.
  - `components/calendar/WeeklyReportModal.tsx`: Relatório de produtividade semanal com análise de IA Gemini integrada.
- **Exportação e Sincronização iCal (`lib/calendar-export.ts`):**
  - Download de arquivos `.ics` compatíveis com Apple Calendar, Microsoft Outlook e Google Calendar.
  - Botão de 1 clique para adicionar evento diretamente no Google Calendar sem precisar sincronizar conta.
  - Exportação em lote de todos os eventos filtrados do mês.
- **Filtros Rápidos:**
  - Filtro por tipo de atividade (Visitas, Reuniões, Follow-ups).
  - Filtro por status (Todos, Pendentes, Concluídos).

## [STABLE_POINT_PRE_DEPLOY] - 10 de Maio de 2026
Ponto de controle estável antes da tentativa de deploy no Vercel. 

### Novidades:
- **Build Verificado:** `npm run build` executado com sucesso no ambiente local.
- **Correções de Estabilidade:**
  - Ajuste na tipagem de datas no Calendário para evitar falhas de runtime com `parseISO`.
  - Melhoria na listagem visual do Calendário com cards de eventos (Visita, Follow-up, Reunião).
  - Filtro de busca de eventos implementado no dashboard do calendário.
  - Otimização das funções de `update` no `lib/db.ts` para usar envios parciais de dados (evita sobrescrever campos nulos).
- **Tratamento de 404:** Criação de página `not-found.tsx` personalizada para melhor UX.

### Funcionalidades Verificadas:
- Calendário: Sincronização em tempo real das atividades com o banco de dados.
- Dashboard: KPIs e atividades recentes carregando corretamente.
- Contatos/Empresas: Fluxo de CRUD resiliente.

## [UI_UX_CHAT_UPDATE] - 10 de Maio de 2026
Melhoria na experiência do usuário e sistema de comunicação interna.

### Novidades:
- **Barra Lateral Social:** Perfil do usuário integrado à parte inferior da barra lateral com acesso rápido.
- **Messenger Pro (Beta):** 
  - Interface de chat moderna com balões de mensagem estilizados e avatares sincronizados.
  - Integração direta: botões "Enviar Mensagem" na lista de Contatos e Equipe agora funcionam instantaneamente.
  - Avatares Inteligentes: Geração automática de avatares baseados em iniciais para usuários sem foto.
- **Correções de UI:**
  - Fix nas imagens quebradas via `referrerPolicy` e `unoptimized`.
  - Melhor distinção visual entre Contatos (Clientes) e Membros da Equipe no chat.
- **Segurança de Navegação:** Implementação de guarda contra erros de UUID inválido em rotas dinâmicas.
- **Ajustes de Data:** Correção no mapeamento de campos do banco de dados (UUID para User IDs).

### Funcionalidades Implementadas:
- **Autenticação Completa:** Cadastro e Login integrados ao Supabase Auth.
- **Sincronização de Perfis:** Trigger no banco de dados (`handle_new_user`) que vincula registros de autenticação à tabela `profiles` automaticamente.
- **Segurança Avançada (RLS):** 
  - Implementação de Políticas de Segurança de Nível de Linha (Row Level Security).
  - Uso de função `security definer` (`is_admin()`) para evitar erros de recursão infinita no RLS.
  - Administração centralizada para o usuário `ggsalles@gmail.com`.
- **Tempo Real (Realtime):** Habilitado para todas as tabelas principais (contatos, imóveis, negociações, etc).
- **Tratamento de Erros:** Mensagens amigáveis para limites de e-mail (rate limit) e validações de e-mail (trim/lowercase).

### Estrutura do Banco:
- Tabela `profiles` com suporte a tipos de usuário (Administrador/Membro) e cargos.
- Tabelas de CRM: `companies`, `contacts`, `properties`, `deals`, `goals`, `activities`, `timeline`, `conversations`, `messages`.

Este log serve como garantia de que o sistema está 100% funcional neste estágio.
