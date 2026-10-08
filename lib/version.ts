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

export const APP_VERSION = "v2.41";
export const APP_VERSION_CODE = 241;
export const APP_VERSION_DATE = "08/10/2026";
export const APP_VERSION_TITLE = "Aprimoramento de Layout & Opacidade Sólida do Modal";

export const VERSION_HISTORY: VersionRelease[] = [
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
