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

export const APP_VERSION = "v2.47";
export const APP_VERSION_CODE = 247;
export const APP_VERSION_DATE = "08/10/2026";
export const APP_VERSION_TITLE = "Prevenção de Fechamento Acidental ao Teclar Enter na Edição de Imóveis";

export const VERSION_HISTORY: VersionRelease[] = [
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
