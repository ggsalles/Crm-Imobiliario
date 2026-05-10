# Registro de Versão - CRM SalesScore

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
