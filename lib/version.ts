/**
 * Central de Versionamento do SalesScore CRM
 * 
 * REGRA PERMANENTE: Sempre que houver uma melhoria ou correção de bug no app,
 * incremente o número da versão (ex: v2.40 -> v2.41) e registre o resumo em VERSION_HISTORY.
 */

export interface VersionRelease {
  version: string;
  releaseDate: string;
  title: string;
  type: 'major' | 'minor' | 'patch';
  highlights: string[];
  fixes?: string[];
  improvements?: string[];
}

export const APP_VERSION = "v2.57";
export const APP_VERSION_CODE = 257;
export const APP_VERSION_DATE = "08/10/2026";
export const APP_VERSION_TITLE = "Auditoria & Blindagem da Central de Mensagens & Chat (Módulo 7 - CRUD 100% Confiável & Otimização de Egress Supabase)";

export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: "v2.57",
    releaseDate: "08/10/2026",
    title: "Auditoria & Blindagem da Central de Mensagens & Chat (Módulo 7 - CRUD 100% Confiável & Otimização de Egress Supabase)",
    type: "minor",
    highlights: [
      "Retorno garantido do registro completo formatado (formatConversationDbRow / formatMessage) nas rotas POST, PATCH e DELETE de mensagens e conversas",
      "Sincronização otimista imediata no estado local do React na Central de Mensagens (/messages) sem depender de novas viagens de rede",
      "Novo cache cirúrgico em memória no servidor Next.js para mensagens e conversas (/api/messages & /api/conversations) estancando leituras repetidas no Supabase",
      "Seleção estrita de colunas (MESSAGE_SELECT_COLUMNS & CONVERSATION_SELECT_COLUMNS) no lugar de SELECT * reduzindo drasticamente a cota de egress do Supabase",
      "Novo sistema de persistência com snapshots locais (getCachedConversations & getCachedMessages) para carregamento instantâneo em 0ms sem telas brancas"
    ],
    improvements: [
      "Cabeçalhos NO_CACHE_HEADERS aplicados a todas as rotas e métodos de conversas e mensagens",
      "Sincronização automática em snapshots offline e memória no envio e na exclusão de mensagens ou conversas",
      "Integração perfeita entre o canal WebSocket Realtime e o cache local para evitar requisições redundantes pela rede",
      "Manutenção segura de mensagens pendentes ou rascunhos em caso de instabilidade temporária na rede"
    ],
    fixes: [
      "Correção do POST de conversas que retornava apenas o ID sem o objeto oficial da conversa",
      "Correção do PATCH de conversas que retornava apenas { success: true } sem atualizar o objeto em memória",
      "Eliminada a necessidade de recarregar a página (Ctrl + F5) para visualizar novas conversas ou apagar mensagens"
    ]
  },
  {
    version: "v2.56",
    releaseDate: "08/10/2026",
    title: "Auditoria & Blindagem do Módulo de Equipe & Usuários (Módulo 6 - CRUD 100% Confiável & Proteção de Egress Supabase)",
    type: "minor",
    highlights: [
      "Retorno garantido do perfil oficial carimbado pelo banco nas rotas POST e PATCH de usuários e colaboradores",
      "Sincronização imediata no estado do React na tela de Equipe (/users) refletindo novos corretores e alterações de papéis sem F5",
      "Ativação do cache de perfis em memória no servidor Next.js (/api/profiles), eliminando o loop de consultas repetidas ao Supabase",
      "Novo sistema de persistência com snapshots locais (getCachedUsers) para renderização instantânea em 0ms sem telas brancas",
      "Cabeçalhos NO_CACHE_HEADERS aplicados a todos os métodos de leitura e alteração de perfis"
    ],
    improvements: [
      "Integração direta entre CreateUserModal/EditUserModal e o estado local sem necessidade de re-consultas forçadas pela rede",
      "Sincronização imediata em snapshots offline e memória a cada criação, edição ou exclusão de colaboradores",
      "Eliminação do bypassCache redundante nas inscrições de usuários para estancar o consumo de leitura do Supabase",
      "Proteção de inativação e reativação de usuários com atualização visual imediata e liberação/alocação de licenças"
    ],
    fixes: [
      "Correção do POST de perfis que retornava somente ID sem o objeto oficial do usuário criado",
      "Correção do PATCH de perfis que retornava apenas { success: true } sem os dados atualizados do usuário",
      "Correção da rota /api/profiles que não persistia a resposta no cache de servidor em leituras completas"
    ]
  },
  {
    version: "v2.55",
    releaseDate: "08/10/2026",
    title: "Auditoria & Blindagem do Módulo de Empresas (Módulo 5 - CRUD 100% Confiável & Proteção de Egress Supabase)",
    type: "minor",
    highlights: [
      "Retorno garantido do registro carimbado pelo banco (formatCompanyDbRow) nas rotas POST e PATCH de empresas",
      "Sincronização imediata em tempo real do estado local do React na tela de Empresas (/companies) sem necessidade de recarregar a página",
      "Novo cache cirúrgico em memória no servidor Next.js para empresas (/api/companies) reduzindo requisições repetidas ao Supabase",
      "Aplicação de colunas estritas (COMPANY_SELECT_COLUMNS) no lugar de SELECT * estancando vazamentos de dados e consumo de egress",
      "Contador e vínculo inteligente de contatos vinculados por organização exibido diretamente nos cards"
    ],
    improvements: [
      "Cabeçalhos NO_CACHE_HEADERS aplicados a todas as rotas e métodos do módulo de empresas",
      "Sincronização instantânea em snapshots persistentes e cache em memória (getCachedCompanies) a cada criação, edição ou exclusão",
      "Proteção de bloqueio com Loader2 e estado isSaving evitando cliques duplicados ou submissões redundantes",
      "Preservação integral dos dados preenchidos no modal de empresa caso o banco ou a rede apresente indisponibilidade"
    ],
    fixes: [
      "Correção do POST de empresas que retornava somente ID sem os campos oficiais carimbados pelo banco",
      "Correção do PATCH de empresas que retornava apenas { success: true } sem o objeto da empresa atualizado",
      "Eliminada a necessidade de Ctrl + F5 ou de viagens extras de rede (fetchData redundante) para refletir inclusões e alterações"
    ]
  },
  {
    version: "v2.54",
    releaseDate: "08/10/2026",
    title: "Auditoria & Blindagem do Módulo de Atividades/Agenda (CRUD 100% Confiável & Otimização de Egress)",
    type: "minor",
    highlights: [
      "Retorno garantido do registro carimbado pelo banco (formatActivityDbRow) nas rotas POST e PATCH de atividades",
      "Sincronização imediata em tempo real do estado local do React nas telas de Atividades (/activities) e Agenda (/calendar)",
      "Conclusão e alternância de status de compromissos refletida instantaneamente na tela sem precisar de Ctrl + F5",
      "Novo cache em memória no servidor Next.js para atividades (/api/activities) reduzindo drasticamente consultas repetidas ao Supabase",
      "Aplicação de colunas cirúrgicas (ACTIVITY_SELECT_COLUMNS) no lugar de SELECT * para estancar o consumo de egress"
    ],
    improvements: [
      "Cabeçalhos NO_CACHE_HEADERS aplicados a todas as rotas e métodos do módulo de atividades",
      "Sincronização instantânea em snapshots persistentes e cache em memória a cada criação, edição ou exclusão",
      "Reversão graciosa no estado do React na Agenda e Dashboard em caso de falha de conexão",
      "Preservação do formulário de agendamento em caso de indisponibilidade momentânea"
    ],
    fixes: [
      "Correção do problema onde concluir uma tarefa na Agenda ou Dashboard só atualizava visualmente após recarregar",
      "Correção do POST de atividades que retornava somente ID sem os campos oficiais carimbados",
      "Correção do PATCH de atividades que devolvia apenas { success: true } sem o objeto atualizado"
    ]
  },
  {
    version: "v2.53",
    releaseDate: "08/10/2026",
    title: "Auditoria & Blindagem do Módulo de Negócios / Funil de Vendas (CRUD 100% Confiável)",
    type: "minor",
    highlights: [
      "Retorno garantido do registro carimbado pelo banco (formatDeal) nas rotas POST e PATCH de oportunidades",
      "Sincronização imediata em tempo real do estado local do React no Funil (Pipeline) a cada inclusão, edição e exclusão",
      "Remoção da dependência de Ctrl + F5 ou polling para refletir mudanças de cards de negócios no Kanban",
      "Bloqueio de submissão duplicada com indicador visual animado (Loader2) no modal de Negócios",
      "Validação prévia obrigatória do título da oportunidade antes do envio para a API"
    ],
    improvements: [
      "Cabeçalhos NO_CACHE_HEADERS aplicados a todas as rotas e métodos (GET, POST, PATCH, DELETE) do módulo de negócios",
      "Sincronização imediata em snapshots offline e cache de memória do navegador para consistência instantânea",
      "Atualização direta no detalhe 360 do negócio ao avançar estágio sem depender de múltiplas viagens de rede",
      "Preservação integral dos dados preenchidos no modal de negócio em caso de falha de conexão"
    ],
    fixes: [
      "Correção do POST de negócios que retornava apenas o ID sem o objeto oficial criado",
      "Correção do PATCH de negócios que retornava apenas { success: true } sem os dados atualizados",
      "Correção da exclusão de negócios no Kanban que deixava o card visível na tela até recarregar a página"
    ]
  },
  {
    version: "v2.52",
    releaseDate: "08/10/2026",
    title: "Auditoria & Blindagem do Módulo de Contatos/Clientes (CRUD 100% Confiável & Redução de Egress)",
    type: "minor",
    highlights: [
      "Retorno garantido do registro carimbado pelo banco (formatContactDbRow) nas rotas POST e PATCH de contatos",
      "Sincronização imediata em memória do React e Snapshots a cada inclusão e edição de cliente",
      "Eliminação do loop massivo de consulta a negócios (deals) na listagem de contatos, blindando e reduzindo o consumo de egress do Supabase",
      "Estado de salvamento (isSaving) com bloqueio de duplo clique e feedback visual no modal de contato",
      "Preservação de todos os dados do formulário caso o banco ou conexão retorne falha"
    ],
    improvements: [
      "Cabeçalhos NO_CACHE_HEADERS aplicados a todas as rotas e métodos do módulo de contatos",
      "Aproveitamento direto do retorno da atualização no perfil 360 do contato, eliminando requisições GET redundantes",
      "Tratamento resiliente de exclusão de contato com reversão automática de estado em caso de falha de rede"
    ],
    fixes: [
      "Eliminada a necessidade de Ctrl + F5 para enxergar novos clientes cadastrados ou alterações de contatos",
      "Correção do POST de contatos que retornava somente ID sem os campos oficiais do registro",
      "Correção do PATCH de contatos que retornava apenas booleano success sem o registro atualizado"
    ]
  },
  {
    version: "v2.51",
    releaseDate: "08/10/2026",
    title: "Auditoria & Blindagem Transacional do Módulo de Imóveis (CRUD 100% Confiável)",
    type: "minor",
    highlights: [
      "Fim do falso otimismo: a tela só confirma sucesso após a resposta 200 OK definitiva do banco de dados",
      "Retorno garantido do registro carimbado pelo banco (formatPropertyDbRow) nas rotas POST e PATCH de imóveis",
      "Sincronização imediata da memória do React com os dados oficiais retornados pela API",
      "Invalidação forçada e cirúrgica de caches locais e do servidor Next.js a cada salvamento",
      "Permanência segura de todos os dados preenchidos no formulário caso a rede ou banco aponte qualquer erro"
    ],
    improvements: [
      "Padronização do contrato de resposta com cabeçalhos NO_CACHE_HEADERS em todas as operações de imóveis",
      "Validação prévia obrigatória de título e valor de venda antes de tocar o banco de dados"
    ],
    fixes: [
      "Eliminação de divergências onde a tela exibia sucesso mas o banco não persistia os dados alterados",
      "Correção do retorno de POST de imóveis que enviava apenas o ID em vez do objeto completo"
    ]
  },
  {
    version: "v2.50",
    releaseDate: "08/10/2026",
    title: "Blindagem Dupla na Gravação de Endereço e CEP de Imóveis",
    type: "patch",
    highlights: [
      "Dupla camada de extração para Logradouro (street) e CEP no formulário de edição de imóveis",
      "Garantia de persistência mesmo em casos de inputs controlados ou autopreenchimento do navegador",
      "Sincronização imediata entre estado de formulário e dados submetidos à API",
    ],
    improvements: [
      "Resiliência absoluta no envio dos dados de localização do imóvel",
      "Eliminação de qualquer possibilidade de divergência entre a tela e o banco de dados"
    ],
    fixes: [
      "Prevenção de gravação em branco de endereço quando o input do formulário não for capturado exclusivamente pelo FormData"
    ]
  },
  {
    version: "v2.49",
    releaseDate: "08/10/2026",
    title: "Eliminação do Scroll Horizontal e Barra de Rolagem Discreta nas Modais",
    type: "patch",
    highlights: [
      "Eliminação completa da barra de rolagem horizontal nas modais de Clientes e Imóveis com table-fixed e larguras percentuais precisas",
      "Novo visual refinado para a barra de rolagem vertical: espessura ultrafina (6px), fundo transparente e indicador translúcido discreto",
      "Ajuste responsivo das colunas com quebra/reticências inteligentes evitando estouro de largura",
      "Botão Selecionar integrado organicamente sem necessidade de pinçamento artificial"
    ],
    improvements: [
      "Aparência limpa e moderna compatível com o tema dark do CRM em sistemas Windows e Linux",
      "Otimização visual nos cabeçalhos e células das tabelas de busca"
    ],
    fixes: [
      "Remoção da barra de rolagem horizontal indesejada no grid de pesquisa de clientes e imóveis",
      "Substituição das barras de rolagem cinza grossas nativas do navegador por visual discreto e moderno"
    ]
  },
  {
    version: "v2.47",
    releaseDate: "08/10/2026",
    title: "Prevenção de Fechamento Acidental ao Teclar Enter na Edição de Imóveis",
    type: "patch",
    highlights: [
      "Bloqueio de submissão e fechamento acidental da tela de edição ao pressionar a tecla Enter em inputs e selects",
      "Garantia de que a gravação ocorra única e exclusivamente quando o usuário clicar em 'Salvar Alterações'",
      "Preservação do funcionamento da tecla Enter em campos multilinha (textarea) para quebras de linha em descrições e anotações",
      "Isolamento do Enter no campo de tags/comodidades para inclusão rápida de itens sem disparar ações no formulário principal"
    ],
    improvements: [
      "Aplicada a mesma proteção de teclado ao formulário de Oportunidades/Negócios do Funil",
      "Maior segurança contra perda de alterações em formulários extensos durante a digitação"
    ],
    fixes: [
      "Correção do comportamento onde teclar Enter na tela de edição do imóvel disparava submit implícito e fechava a tela inesperadamente"
    ]
  },
  {
    version: "v2.46",
    releaseDate: "08/10/2026",
    title: "Correção da Abertura das Modais de Pesquisa com Grid (Lupa)",
    type: "patch",
    highlights: [
      "Renderização das modais de busca (Clientes e Imóveis) via React Portal diretamente no document.body com z-index 99999",
      "Eliminação do conflito de sobreposição onde a modal de pesquisa abria atrás do modal do negócio",
      "Desacoplamento do fechamento da busca do estado de edição do negócio para abertura garantida",
      "Aprimoramento dos eventos de clique (preventDefault / stopPropagation) nos botões de lupa e campos de texto"
    ],
    improvements: [
      "Backdrop escurecido de alto contraste (bg-black/75) com animação suave de entrada",
      "Foco imediato no campo de pesquisa ao abrir a modal para digitação ágil"
    ],
    fixes: [
      "Correção do problema onde clicar no botão Buscar não abria a modal de pesquisa"
    ]
  },
  {
    version: "v2.44",
    releaseDate: "08/10/2026",
    title: "Busca Inteligente & Autocomplete de Clientes e Imóveis no Funil",
    type: "minor",
    highlights: [
      "Substituição dos selects estáticos por seletores inteligentes (Combobox) com pesquisa em tempo real",
      "Busca avançada de clientes por nome, telefone (inclusive dígitos soltos), e-mail ou cargo",
      "Busca avançada de imóveis por Código de Referência (REF), título, tipo, bairro, cidade ou valor",
      "Cards visuais de seleção com foto/miniatura, código REF, badges de temperatura e botões de troca rápida"
    ],
    improvements: [
      "Fim da rolagem manual cansativa em listas longas de contatos e imóveis",
      "Visualização rica de dados diretamente no modal (fotos, preços em destaque, telefones e status)",
      "Fechamento dinâmico ao clicar fora, navegação por teclado (Esc / Enter) e botão de remoção em 1 clique"
    ],
    fixes: [
      "Eliminação da dificuldade de localizar itens em listas extensas no modal de oportunidades"
    ]
  },
  {
    version: "v2.43",
    releaseDate: "08/10/2026",
    title: "Correção da Digitação de Valores no Funil de Vendas",
    type: "patch",
    highlights: [
      "Correção do campo de Valor Estimado no modal de Novo Negócio/Lead permitindo digitação fluida em centavos e reais",
      "Seleção automática do texto e limpeza ao focar para facilitar a edição rápida de valores",
      "Preenchimento automático do valor ao selecionar um Imóvel de Interesse no formulário"
    ],
    improvements: [
      "Integração do padrão formatCurrencyInput usado com sucesso no cadastro financeiro de imóveis",
      "Sincronização bidirecional do valor e imóvel selecionado sem travar ou rejeitar dígitos"
    ],
    fixes: [
      "Correção do bug onde a digitação do campo de valor no modal de Novo Negócio ficava bloqueada ou travada"
    ]
  },
  {
    version: "v2.42",
    releaseDate: "08/10/2026",
    title: "Otimização de Performance e Blindagem Multi-Tenant do Funil (Deals)",
    type: "patch",
    highlights: [
      "Projeção cirúrgica de colunas no endpoint /api/deals eliminando SELECT *",
      "Cache in-memory server-side e sincronização otimista de 0ms no pipeline",
      "Reforço de segurança multi-tenant em operações de criação, atualização e exclusão"
    ],
    improvements: [
      "Padronização da mecânica de deals idêntica à excelência do cadastro de imóveis",
      "Validação estrita de colunas e dados no payload"
    ]
  },
  {
    version: "v2.41",
    releaseDate: "08/10/2026",
    title: "Aprimoramento de Layout & Opacidade Sólida do Modal",
    type: "patch",
    highlights: [
      "Eliminação total da transparência no modal de versão com fundo sólido de alto contraste",
      "Isolamento visual absoluto para evitar vazamento de textos e métricas da tela de fundo",
      "Novo acabamento visual nos cards de changelog para leitura clara no modo claro e escuro"
    ],
    improvements: [
      "Definição de variáveis de fallback para dark mode no CSS global",
      "Aumento do escurecimento do backdrop para focar a atenção do usuário no conteúdo do modal"
    ],
    fixes: [
      "Correção do problema de transparência (bleed-through) que exibia métricas do dashboard atrás do texto do modal"
    ]
  },
  {
    version: "v2.40",
    releaseDate: "08/10/2026",
    title: "Estabilidade Multi-Tenant & Sincronização em Tempo Real",
    type: "minor",
    highlights: [
      "Sincronização imediata na exclusão e inserção de fotos de imóveis (< 5s)",
      "Reforço de isolamento multi-tenant estrito por organização",
      "Novo indicador visual de versão ativa com changelog detalhado",
      "Validação de integridade de dados e auditoria de consultas no banco"
    ],
    improvements: [
      "Cache invalidation instantânea após mutações de imagem",
      "Otimização no carregamento de cards de imóveis no Kanban e lista",
      "Ajustes de latência nas ações do Supabase com fallback reativo"
    ],
    fixes: [
      "Correção de atraso visual de mais de 10s ao remover fotos de imóvel com filtro ativo",
      "Prevenção de sobrescrita de tenant_id em requisições concorrentes"
    ]
  },
  {
    version: "v2.39",
    releaseDate: "07/10/2026",
    title: "Otimização de Quota e Armazenamento Supabase",
    type: "patch",
    highlights: [
      "Compressão inteligente de imagens antes do upload",
      "Limpeza automatizada de arquivos temporários e órfãos no Storage"
    ],
    improvements: [
      "Redução da largura de banda transferida em listagens",
      "Paginação e limite em consultas pesadas"
    ]
  },
  {
    version: "v2.35",
    releaseDate: "01/10/2026",
    title: "Sistema de Mensagens & Painel Administrativo",
    type: "minor",
    highlights: [
      "Notificações em tempo real de mensagens e atividades",
      "Gestão de usuários por imobiliária com permissões de acesso"
    ]
  },
  {
    version: "v2.00",
    releaseDate: "15/09/2026",
    title: "Lançamento da Arquitetura Multi-Tenant SalesScore",
    type: "major",
    highlights: [
      "Isolamento completo por organização (Tenant ID)",
      "Gestão completa de Imóveis, Clientes, Funil de Vendas e Calendário"
    ]
  }
];
