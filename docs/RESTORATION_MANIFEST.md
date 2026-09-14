# Manifesto de Restauração - 10/05/2026

## Estado Atual do Sistema
O sistema agora conta com um CRM robusto integrado e um Messenger funcional.

### 1. Autenticação (Firebase Auth)
- Login via Google.
- Provedor de contexto `AuthProvider` gerenciando sessão e perfil do usuário.

### 2. Dashboard e Relatórios
- **Visão Geral:** Cards de métricas com tendências e gráficos Sparkline.
- **Relatórios:** Tab específica com:
  - Fluxo de Receita (AreaChart) em Português.
  - Fases do Funil (PieChart) com cores sincronizadas ao Pipeline.
  - Saúde da Carteira (RadarChart).
  - Performance Proativa (Barras de progresso).
- **Previsões:** Cálculo de Forecast baseado em 20% do funil + fechados.

### 3. Sistema de Mensagens (V2)
- **Chat em Tempo Real:** Sincronização via canais Realtime.
- **Interface Social:** Avatares, nomes de remetentes nos grupos e horários sincronizados.
- **Navegação Dinâmica:** Link direto entre Contatos/Equipe e o Chat via query params.

### 4. Perfil e UX
- **Sidebar UX:** Perfil do usuário fixo na base da barra lateral com estilo moderno.
- **Messenger Direto:** Botão "Enviar Mansagem" funcional para clientes e equipe.

### Arquivos Críticos (Atualizados)
- `/app/messages/page.tsx` (Lógica de chat e UI)
- `/components/sidebar.tsx` (Navegação lateral fixa)
- `/lib/db.ts` (Funções de conversação e sincronização)
- `/providers/auth-provider.tsx` (Gestão de perfil e login)

## Instruções de Recuperação
Caso o comportamento seja perdido:
1. Verifique as tipagens em `lib/db.ts`.
2. Certifique-se de que o `DashboardContent` em `app/page.tsx` está envolvido por um `Suspense`.
3. Valide as funções de agregação de valores (reduce) que filtram por estágio.
