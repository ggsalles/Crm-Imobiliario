"use client";

export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  UserCircle, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Mail, 
  Shield, 
  Briefcase, 
  Trash2, 
  Edit3, 
  Check, 
  X,
  Loader2,
  Lock,
  UserPlus,
  Building2,
  Layers,
  Tag,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  ShieldAlert,
  ArrowUpRight,
  CreditCard,
  Settings2
} from "lucide-react";
import Image from 'next/image';
import { 
  UserProfile, 
  subscribeToUsers, 
  updateUserProfile, 
  deleteUserProfile,
  createUserProfile,
  Tenant,
  getTenants,
  createTenant,
  apiFetch
} from "@/lib/db";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME, PLATFORM_ADMIN_EMAIL, isPlatformAdmin as checkPlatformAdmin } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit";

export default function UsersPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  
  // Tenants (Multi-Tenant SaaS) States
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showTenantsSection, setShowTenantsSection] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);

  // Create User & Limit States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>("");
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [newUserData, setNewUserData] = useState({
    displayName: "",
    email: "",
    role: "Membro" as "Membro" | "Admin",
    userType: "funcionário" as "funcionário" | "cliente",
    tenantId: DEFAULT_TENANT_ID,
    tenantIds: [DEFAULT_TENANT_ID]
  });

  const isAdmin = profile?.role === 'Admin';
  const isPlatformAdmin = checkPlatformAdmin(profile?.email);

  const fetchTenants = async () => {
    try {
      const data = await getTenants();
      setTenants(data);
    } catch (err) {
      console.error("Erro ao carregar inquilinos:", err);
    }
  };

  // Current active tenant being managed or inspected
  const currentTenantId = selectedTenantFilter || profile?.tenantId || DEFAULT_TENANT_ID;
  const currentTenant = tenants.find(t => t.id === currentTenantId) || {
    id: currentTenantId,
    name: currentTenantId === DEFAULT_TENANT_ID ? DEFAULT_TENANT_NAME : "Imobiliária",
    userLimit: 5
  };
  const tenantUserLimit = currentTenant?.userLimit ?? 5;

  // Active users registered to this tenant
  const tenantUsers = users.filter(u => 
    (u.tenantId || DEFAULT_TENANT_ID) === currentTenantId || 
    (u.tenantIds && u.tenantIds.includes(currentTenantId))
  );
  const activeCount = tenantUsers.length;
  const isLimitReached = activeCount >= tenantUserLimit;
  const remainingSlots = Math.max(0, tenantUserLimit - activeCount);
  const usagePercentage = Math.min(100, Math.round((activeCount / tenantUserLimit) * 100));

  // Visual string representation e.g. [■■■□□]
  const filledCount = Math.min(activeCount, tenantUserLimit);
  const emptyCount = Math.max(0, tenantUserLimit - activeCount);
  const visualBlocksString = `[${'■'.repeat(filledCount)}${'□'.repeat(emptyCount)}]`;

  const handleQuickUpdateLimit = async (newLimit: number, targetId?: string) => {
    if (!isPlatformAdmin) return;
    const tid = targetId || currentTenantId;
    setIsUpdatingLimit(true);
    try {
      await apiFetch(`/api/tenants?id=${tid}`, {
        method: "PATCH",
        body: JSON.stringify({ userLimit: newLimit })
      });
      const targetTenantName = tenants.find(t => t.id === tid)?.name || 'Imobiliária';
      toast.success(`${targetTenantName}: limite de vagas alterado para ${newLimit} usuários!`);
      await fetchTenants();
    } catch (err: any) {
      toast.error("Erro ao alterar limite: " + err.message);
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;
    
    // Only admins can see all users, members see only themselves
    const ownerId = isAdmin ? undefined : user.id;

    const unsub = subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
    }, ownerId);
    return () => unsub();
  }, [user, profile, isAdmin]);

  useEffect(() => {
    if (isAdmin || isPlatformAdmin) {
      fetchTenants();
    }
  }, [isAdmin, isPlatformAdmin]);

  const handleEditClick = (u: UserProfile) => {
    if (!isAdmin && u.id !== user?.id) {
      toast.error("Você só pode editar seu próprio perfil.");
      return;
    }
    setEditingUser(u.id);
    setEditForm({
      displayName: u.displayName,
      role: u.role,
      userType: u.userType || 'funcionário',
      tenantId: u.tenantId || DEFAULT_TENANT_ID,
      tenantIds: u.tenantIds || [u.tenantId || DEFAULT_TENANT_ID]
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateUserProfile(id, editForm);

      recordAuditEvent({
        action: 'UPDATE_USER_ROLE',
        title: 'Alteração de Perfil de Usuário',
        content: `Perfil de usuário ID ${id} foi modificado. Novos parâmetros aplicados.`,
        severity: 'high',
        category: 'modification',
        relatedId: id,
        entityType: 'user',
        metadata: editForm
      });

      setEditingUser(null);
      toast.success("Usuário atualizado com sucesso");
    } catch (error: any) {
      toast.error("Erro ao atualizar usuário");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isPlatformAdmin) {
      toast.error("Você não possui permissão para cadastrar novos usuários.");
      return;
    }
    if (isLimitReached && !isPlatformAdmin) {
      setShowAddModal(false);
      setShowLimitModal(true);
      toast.error("Limite de vagas atingido. Solicite mais licenças para cadastrar novos corretores.");
      return;
    }
    setIsCreating(true);
    try {
      await createUserProfile({
        ...newUserData,
        tenantId: currentTenantId,
        tenantIds: newUserData.tenantIds && newUserData.tenantIds.length > 0 ? newUserData.tenantIds : [currentTenantId]
      });
      setShowAddModal(false);
      setNewUserData({ 
        displayName: "", 
        email: "", 
        role: "Membro", 
        userType: "funcionário",
        tenantId: currentTenantId,
        tenantIds: [currentTenantId]
      });
      toast.success("Usuário cadastrado com sucesso. Ele agora pode fazer login.");
      await fetchTenants();
    } catch (error: any) {
      toast.error(error.message || "Erro ao cadastrar usuário");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === user?.id) {
      toast.error("Você não pode excluir seu próprio perfil");
      return;
    }
    
    if (deletingUid !== id) {
      setDeletingUid(id);
      toast.info("Clique novamente na lixeira para confirmar a exclusão", {
        duration: 3000,
        onAutoClose: () => setDeletingUid(null)
      });
      return;
    }

    try {
      const targetUser = users.find(u => u.id === id);
      await deleteUserProfile(id);

      recordAuditEvent({
        action: 'DELETE_USER',
        title: 'Remoção de Usuário do Sistema',
        content: `Membro "${targetUser?.displayName || id}" (${targetUser?.email || ''}) teve seu acesso e perfil removidos.`,
        severity: 'critical',
        category: 'deletion',
        relatedId: id,
        entityType: 'user',
        metadata: {
          deletedUserName: targetUser?.displayName,
          deletedUserEmail: targetUser?.email,
          role: targetUser?.role
        }
      });

      toast.success("Acesso removido com sucesso");
      setDeletingUid(null);
    } catch (error: any) {
      console.error("Erro ao deletar:", error);
      toast.error("Erro ao remover acesso. Verifique as permissões de administrador.");
    }
  };

  if (authLoading || (loading && !user)) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden">
        <header className="h-auto md:h-16 bg-card/80 backdrop-blur-md border-b border-border pl-14 md:pl-5 px-3 sm:px-4 md:px-5 py-3 md:py-0 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-10 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
              <UserCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold leading-tight">Gestão de Usuários</h2>
              <p className="text-[11px] text-muted-foreground font-medium tracking-tight">Controle de acessos e perfis</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Buscar usuário..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-muted/50 border border-border rounded-lg text-xs w-36 sm:w-48 lg:w-56 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            
            {isPlatformAdmin && (
              <button 
                onClick={() => setShowTenantsSection(!showTenantsSection)}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-all active:scale-95",
                  showTenantsSection 
                    ? "bg-primary text-white border-primary" 
                    : "bg-muted/50 border-border text-foreground hover:bg-muted"
                )}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Painel SaaS</span>
              </button>
            )}

            {(isAdmin || isPlatformAdmin) && (
              <button 
                onClick={() => {
                  if (isLimitReached) {
                    setShowLimitModal(true);
                  } else {
                    setShowAddModal(true);
                  }
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 shadow-xs",
                  isLimitReached
                    ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
                    : "bg-primary text-white hover:opacity-90"
                )}
                title={isLimitReached ? "Limite de vagas atingido. Clique para ver detalhes e solicitar upgrade." : "Cadastrar novo corretor ou membro"}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Novo Usuário</span>
                {isLimitReached && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-white dark:bg-amber-600 rounded uppercase tracking-wider">
                    Limite de vagas atingido
                  </span>
                )}
              </button>
            )}
          </div>
        </header>

        <div className="p-3 sm:p-4 md:p-5 max-w-6xl mx-auto w-full relative space-y-3.5">
          
          {/* Section: Expandable SaaS Tenant Control Panel */}
          {showTenantsSection && isPlatformAdmin && (
            <div className="mb-4 bg-card rounded-xl border border-border overflow-hidden shadow-xs animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="p-3.5 sm:p-4 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight">Painel SaaS - Inquilinos (Tenants)</h3>
                    <p className="text-[11px] text-muted-foreground font-medium">Cadastre novas imobiliárias/empresas clientes e gerencie suas vagas e isolamento</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    href="/admin/billing"
                    className="px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                    title="Acessar tela completa de faturamento e vagas"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Gestão SaaS & Cobrança</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newTenantName.trim()) return;
                      setIsCreatingTenant(true);
                      try {
                        await createTenant({ name: newTenantName });
                        setNewTenantName("");
                        toast.success("Novo Inquilino cadastrado com sucesso!");
                        fetchTenants();
                      } catch (err: any) {
                        toast.error("Erro ao cadastrar inquilino: " + err.message);
                      } finally {
                        setIsCreatingTenant(false);
                      }
                    }}
                    className="flex items-center gap-2 shrink-0 w-full sm:w-auto"
                  >
                    <input 
                      type="text" 
                      placeholder="Nome da Imobiliária..." 
                      value={newTenantName}
                      onChange={(e) => setNewTenantName(e.target.value)}
                      required
                      className="flex-1 sm:w-40 px-3 py-1.5 text-xs bg-muted/60 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                    <button 
                      type="submit" 
                      disabled={isCreatingTenant}
                      className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-all flex items-center gap-1 disabled:opacity-50 shrink-0"
                    >
                      {isCreatingTenant ? <Loader2 className="w-3 h-3 animate-spin" /> : "+ Cadastrar"}
                    </button>
                  </form>
                </div>
              </div>
              
              <div className="p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-muted/5">
                {tenants.map(t => {
                  const tenantUserCount = users.filter(u => u.tenantId === t.id).length;
                  const limit = t.userLimit ?? 5;
                  const isSelected = (selectedTenantFilter || currentTenantId) === t.id;
                  return (
                    <div 
                      key={t.id} 
                      className={cn(
                        "relative p-3 bg-card border rounded-lg transition-all shadow-xs flex flex-col justify-between gap-3",
                        isSelected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="font-bold text-xs text-foreground leading-tight tracking-tight truncate">{t.name}</span>
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                            t.id === DEFAULT_TENANT_ID 
                              ? "bg-primary/10 text-primary" 
                              : "bg-muted text-muted-foreground border border-border"
                          )}>
                            {t.id === DEFAULT_TENANT_ID ? 'Padrão' : 'SaaS'}
                          </span>
                        </div>
                        <p className="text-[9px] text-muted-foreground font-mono truncate mb-2 select-all">slug: {t.slug || 'default'}</p>
                      </div>
                      
                      <div className="space-y-2 pt-2 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Membros Ativos</span>
                          <span className="text-[11px] font-bold text-foreground bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                            {tenantUserCount} {tenantUserCount === 1 ? 'usuário' : 'usuários'}
                          </span>
                        </div>

                        {/* Direct User Limit Configurator */}
                        <div className="flex items-center justify-between bg-muted/40 p-2 rounded-md border border-border/50">
                          <div>
                            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider block">Vagas / Licenças</span>
                            <span className="text-[8.5px] text-muted-foreground">Definir limite</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number"
                              min={1}
                              max={500}
                              defaultValue={limit}
                              key={`${t.id}-${limit}`}
                              disabled={isUpdatingLimit}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 1 && val !== limit) {
                                  handleQuickUpdateLimit(val, t.id);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseInt((e.target as HTMLInputElement).value);
                                  if (!isNaN(val) && val >= 1 && val !== limit) {
                                    handleQuickUpdateLimit(val, t.id);
                                  }
                                }
                              }}
                              className="w-14 px-1.5 py-1 text-xs bg-background border border-border rounded font-mono font-bold text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
                              title="Pressione Enter ou saia do campo para salvar o limite"
                            />
                            <span className="text-[10px] text-muted-foreground font-semibold">vagas</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedTenantFilter(t.id)}
                          className={cn(
                            "w-full py-1 px-2 rounded text-[11px] font-semibold transition-all flex items-center justify-center gap-1",
                            isSelected 
                              ? "bg-primary text-white" 
                              : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {isSelected ? "✓ Selecionada no Cartão Abaixo" : "Ver / Gerenciar Vagas"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add User Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <div className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-border">
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground leading-tight">Cadastrar Usuário</h3>
                      <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Preencha os dados de acesso</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                
                <form onSubmit={handleCreateUser} className="p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Nome de Exibição</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: João Silva"
                      value={newUserData.displayName}
                      onChange={(e) => setNewUserData({...newUserData, displayName: e.target.value})}
                      className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary/10 transition-all font-medium focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">E-mail (Google)</label>
                    <input 
                      type="email"
                      required
                      placeholder="email@gmail.com"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                      className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary/10 transition-all font-medium focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Tipo</label>
                      <select 
                        className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:outline-none appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em] font-medium"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                        value={newUserData.userType}
                        onChange={(e) => setNewUserData({...newUserData, userType: e.target.value as any})}
                      >
                        <option value="funcionário" className="bg-card">Funcionário</option>
                        <option value="cliente" className="bg-card">Cliente</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Nível</label>
                      <select 
                        className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:outline-none appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em] font-medium"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                        value={newUserData.role}
                        onChange={(e) => setNewUserData({...newUserData, role: e.target.value as any})}
                      >
                        <option value="Membro" className="bg-card">Membro</option>
                        <option value="Admin" className="bg-card">Admin</option>
                      </select>
                    </div>
                  </div>

                  {/* Multi-Tenant associations in creation form */}
                  {isAdmin && tenants.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Vincular a Imobiliárias / Empresas</label>
                      <div className="border border-border bg-muted/20 rounded-lg p-2.5 space-y-1.5 max-h-[140px] overflow-y-auto">
                        {tenants.map(t => {
                          const isNewChecked = (newUserData.tenantIds || []).includes(t.id);
                          return (
                            <label key={t.id} className="flex items-center gap-2 hover:bg-muted/50 p-1 rounded-lg cursor-pointer text-xs font-semibold text-foreground">
                              <input 
                                type="checkbox"
                                checked={isNewChecked}
                                onChange={(e) => {
                                  let currentIds = newUserData.tenantIds || [];
                                  if (e.target.checked) {
                                    currentIds = [...currentIds, t.id];
                                  } else {
                                    currentIds = currentIds.filter(id => id !== t.id);
                                  }
                                  if (currentIds.length === 0) {
                                    currentIds = [t.id];
                                  }
                                  setNewUserData({
                                    ...newUserData,
                                    tenantIds: currentIds,
                                    tenantId: currentIds[0]
                                  });
                                }}
                                className="rounded border-border text-primary focus:ring-primary/20 w-3.5 h-3.5 cursor-pointer accent-primary"
                              />
                              <span className="truncate">{t.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="bg-primary/5 border border-primary/10 p-2.5 rounded-lg">
                    <p className="text-[10px] text-primary leading-tight font-medium">
                      <strong>Informação Importante:</strong> Após o cadastro aqui, o usuário deve acessar a tela de login, clicar em <strong>&quot;Não tem uma senha ainda? Cadastre-se aqui&quot;</strong> e definir sua senha inicial usando o e-mail informado.
                    </p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isCreating}
                    className="w-full bg-primary text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 mt-1"
                  >
                    {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Finalizar Cadastro"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Modal Profissional: Limite de Vagas Atingido */}
          {showLimitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-border animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-amber-500/10 via-card to-card flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-foreground leading-tight">
                        Limite de Vagas Atingido
                      </h3>
                      <p className="text-xs text-muted-foreground font-medium">
                        Capacidade máxima de licenças contratadas
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowLimitModal(false)}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Status Box */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
                    <p className="text-xs text-amber-950 dark:text-amber-200 font-medium leading-relaxed">
                      Sua imobiliária <strong>{currentTenant.name}</strong> está utilizando todas as <strong>{tenantUserLimit} de {tenantUserLimit}</strong> licenças ativas contratadas no seu plano atual.
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-amber-500/20 text-xs font-mono font-bold">
                      <span className="text-amber-800 dark:text-amber-300">Licenças Ocupadas:</span>
                      <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[11px]">
                        {visualBlocksString} 100%
                      </span>
                    </div>
                  </div>

                  {/* 3 Metric Cards */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-muted/30 border border-border rounded-lg p-2.5 text-center">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Contratadas</span>
                      <span className="text-base font-bold text-foreground">{tenantUserLimit}</span>
                    </div>
                    <div className="bg-muted/30 border border-border rounded-lg p-2.5 text-center">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Ativas</span>
                      <span className="text-base font-bold text-amber-600 dark:text-amber-400">{activeCount}</span>
                    </div>
                    <div className="bg-muted/30 border border-border rounded-lg p-2.5 text-center">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Disponíveis</span>
                      <span className="text-base font-bold text-rose-600 dark:text-rose-400">0</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                    <p>
                      Para adicionar novos corretores ou membros à sua equipe, solicite um upgrade de plano para liberar novas licenças ou desative usuários que não estão mais atuando.
                    </p>
                    <p className="text-[11px]">
                      💡 <em>Dica:</em> Você também pode liberar vagas imediatamente revisando e removendo membros ou corretores inativos na lista abaixo.
                    </p>
                  </div>

                  {/* Admin SaaS inline adjustment */}
                  {isPlatformAdmin && (
                    <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                          <Shield className="w-3 h-3 text-primary" /> Painel SaaS (Ajuste Rápido)
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">ID: {currentTenantId.slice(0, 8)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Novo Limite:</span>
                        <input 
                          type="number" 
                          min={1} 
                          max={500}
                          defaultValue={tenantUserLimit + 5}
                          id="quick-new-limit"
                          className="w-20 px-2 py-1 text-xs bg-card border border-border rounded-md font-mono font-bold text-foreground text-center"
                        />
                        <button
                          disabled={isUpdatingLimit}
                          onClick={() => {
                            const input = document.getElementById("quick-new-limit") as HTMLInputElement;
                            const val = parseInt(input?.value);
                            if (!isNaN(val) && val >= 1) {
                              handleQuickUpdateLimit(val);
                            }
                          }}
                          className="px-3 py-1 bg-primary text-white text-xs font-semibold rounded-md hover:opacity-90 transition-all flex items-center gap-1"
                        >
                          {isUpdatingLimit ? <Loader2 className="w-3 h-3 animate-spin" /> : "Aumentar Vagas"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                    <a 
                      href={`https://wa.me/5511999999999?text=${encodeURIComponent(`Olá! Gostaria de solicitar a contratação de mais vagas/licenças de corretores para a imobiliária ${currentTenant.name}. Atualmente temos ${tenantUserLimit} vagas contratadas.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Falar no WhatsApp / Solicitar Vagas</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => setShowLimitModal(false)}
                      className="w-full sm:w-auto py-2 px-3 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-semibold transition-colors"
                    >
                      Gerenciar Usuários Atuais
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cartão Visual no Topo: Licenças Contratadas & Vagas da Imobiliária */}
          {(isAdmin || isPlatformAdmin) && (
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-xs">
              <div className="p-3.5 sm:p-4 bg-muted/20 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                    isLimitReached 
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30" 
                      : "bg-primary/10 text-primary border border-primary/20"
                  )}>
                    {isLimitReached ? <AlertTriangle className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base text-foreground leading-tight">
                        Licenças Contratadas: {activeCount} de {tenantUserLimit} vagas ativas
                      </h3>
                      <span className="font-mono text-xs font-bold text-muted-foreground select-all bg-muted px-2 py-0.5 rounded border border-border">
                        {visualBlocksString}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                      <span className="font-semibold text-foreground">{currentTenant.name}</span> • {isLimitReached ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">Capacidade máxima atingida (100% ocupado)</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {remainingSlots} vaga{remainingSlots > 1 ? 's' : ''} disponível{remainingSlots > 1 ? 'is' : ''} para novos corretores
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isPlatformAdmin && (
                    <div className="flex items-center gap-1.5 bg-muted/60 border border-border px-2 py-1 rounded-lg">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <Settings2 className="w-3 h-3 text-primary" /> Vagas:
                      </span>
                      <input 
                        type="number" 
                        min={1} 
                        max={500} 
                        defaultValue={tenantUserLimit}
                        key={`topcard-${currentTenantId}-${tenantUserLimit}`}
                        disabled={isUpdatingLimit}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1 && val !== tenantUserLimit) {
                            handleQuickUpdateLimit(val, currentTenantId);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            if (!isNaN(val) && val >= 1 && val !== tenantUserLimit) {
                              handleQuickUpdateLimit(val, currentTenantId);
                            }
                          }
                        }}
                        className="w-12 px-1 py-0.5 text-xs bg-background border border-border rounded font-mono font-bold text-foreground text-center focus:ring-1 focus:ring-primary focus:outline-none"
                        title="Altere o total de vagas contratadas e pressione Enter ou clique fora para salvar"
                      />
                      <span className="text-[10px] text-muted-foreground font-medium">limite</span>
                    </div>
                  )}

                  {isPlatformAdmin && tenants.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Imobiliária:</span>
                      <select 
                        value={currentTenantId}
                        onChange={(e) => setSelectedTenantFilter(e.target.value)}
                        className="text-xs bg-card border border-border rounded-lg px-2 py-1 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        {tenants.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isLimitReached ? (
                    <button
                      onClick={() => setShowLimitModal(true)}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Solicitar Mais Vagas</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Convidar Corretor</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Segmented Visual Blocks & Progress */}
              <div className="p-3.5 sm:p-4 bg-muted/5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Distribuição Visual das Licenças
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground font-mono">
                      {activeCount}/{tenantUserLimit} ({usagePercentage}%)
                    </span>
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                      isLimitReached
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    )}>
                      {isLimitReached ? "Limite Atingido" : `${remainingSlots} Vaga${remainingSlots > 1 ? 's' : ''} Livre${remainingSlots > 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>

                {/* Visual Blocks Render [■■■□□] */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {Array.from({ length: Math.max(tenantUserLimit, activeCount) }).map((_, idx) => {
                    const isOccupied = idx < activeCount;
                    const assignedUser = tenantUsers[idx];
                    return (
                      <div 
                        key={idx}
                        title={isOccupied ? `Vaga ${idx + 1}: ${assignedUser?.displayName || assignedUser?.email || 'Ocupada'}` : `Vaga ${idx + 1}: Disponível para convidar corretor`}
                        className={cn(
                          "h-8 min-w-8 px-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-mono font-bold transition-all border",
                          isOccupied 
                            ? isLimitReached 
                              ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                              : "bg-primary text-white border-primary shadow-xs"
                            : "bg-muted/30 border-dashed border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
                        )}
                      >
                        <span>{isOccupied ? "■" : "□"}</span>
                        <span className="text-[10px]">{idx + 1}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden border border-border/50">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      isLimitReached ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-foreground">{filteredUsers.length}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Usuários Cadastrados</span>
              </div>
              <div className="flex gap-1.5">
                <button className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
                  <Filter className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border text-left">
                    <th className="px-3.5 sm:px-4 py-2.5 font-bold">Usuário</th>
                    <th className="px-3.5 sm:px-4 py-2.5 font-bold">Tipo</th>
                    <th className="px-3.5 sm:px-4 py-2.5 font-bold">Nível de Acesso</th>
                    <th className="px-3.5 sm:px-4 py-2.5 font-bold">Inquilino / Empresa</th>
                    <th className="px-3.5 sm:px-4 py-2.5 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredUsers.map((u) => {
                    const isEditing = editingUser === u.id;
                    const assignedTenant = tenants.find(t => t.id === u.tenantId);
                    
                    return (
                      <tr key={u.id || u.email} className="group hover:bg-muted/10 transition-colors">
                        <td className="px-3.5 sm:px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                              {u.photoURL ? (
                                <Image 
                                  src={u.photoURL} 
                                  alt={u.displayName} 
                                  width={32} 
                                  height={32} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="font-bold text-xs text-muted-foreground">{u.displayName ? u.displayName[0] : "?"}</span>
                              )}
                            </div>
                            <div>
                              {isEditing ? (
                                <input 
                                  type="text"
                                  className="text-xs font-bold text-foreground bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary/20 py-0.5 px-1.5 w-full"
                                  value={editForm.displayName || ""}
                                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                />
                              ) : (
                                <p className="text-xs font-bold text-foreground">{u.displayName}</p>
                              )}
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="w-2.5 h-2.5" />
                                <span className="text-[10px] font-medium">{u.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 sm:px-4 py-2.5">
                          {isEditing && isAdmin ? (
                            <select 
                              className="text-xs font-bold bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 py-1 px-1.5 focus:outline-none"
                              value={editForm.userType || "funcionário"}
                              onChange={(e) => setEditForm({ ...editForm, userType: e.target.value as any })}
                            >
                              <option value="funcionário">Funcionário</option>
                              <option value="cliente">Cliente</option>
                            </select>
                          ) : (
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold",
                              u.userType === 'cliente' ? "bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20" : "bg-primary/10 text-primary ring-1 ring-primary/20"
                            )}>
                              <Briefcase className="w-2.5 h-2.5" />
                              {(u.userType || 'Funcionário').toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 sm:px-4 py-2.5">
                          {isEditing && isAdmin ? (
                            <select 
                              className="text-xs font-bold bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 py-1 px-1.5 focus:outline-none"
                              value={editForm.role || "Membro"}
                              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                            >
                              <option value="Membro">Membro</option>
                              <option value="Admin">Admin</option>
                            </select>
                          ) : (
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold",
                              u.role === 'Admin' ? "bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20" : "bg-muted text-muted-foreground ring-1 ring-border"
                            )}>
                              <Shield className="w-2.5 h-2.5" />
                              {u.role?.toUpperCase() || 'MEMBRO'}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 sm:px-4 py-2.5 font-medium text-xs">
                          {isEditing && isAdmin && tenants.length > 0 ? (
                            <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto p-1 bg-background/50 border border-border rounded-lg w-44 shrink-0">
                              {tenants.map(t => {
                                const isChecked = (editForm.tenantIds || []).includes(t.id);
                                return (
                                  <label key={t.id} className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-muted/50 rounded cursor-pointer text-[11px] font-semibold text-foreground">
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const current = editForm.tenantIds || [];
                                        let updated;
                                        if (e.target.checked) {
                                          updated = [...current, t.id];
                                        } else {
                                          updated = current.filter(id => id !== t.id);
                                        }
                                        if (updated.length === 0) {
                                          updated = [t.id];
                                        }
                                        setEditForm({ 
                                          ...editForm, 
                                          tenantIds: updated,
                                          tenantId: updated[0]
                                        });
                                      }}
                                      className="rounded border-border text-primary focus:ring-primary/20 w-3 h-3 cursor-pointer accent-primary"
                                    />
                                    <span className="truncate">{t.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 align-start max-w-[180px]">
                              {(u.tenantIds && u.tenantIds.length > 0 ? u.tenantIds : [u.tenantId]).map((tid, idx) => {
                                const tObj = tenants.find(t => t.id === tid);
                                if (!tObj) return null;
                                return (
                                  <span key={tid || idx} className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold w-fit",
                                    tObj.id === u.tenantId
                                      ? "bg-teal-500/10 text-teal-600 border border-teal-500/20"
                                      : "bg-muted text-muted-foreground border border-border"
                                  )}>
                                    <Building2 className="w-2.5 h-2.5" />
                                    {tObj.name} {tObj.id === u.tenantId && "👑"}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 sm:px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={() => handleSaveEdit(u.id)}
                                  className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
                                  title="Salvar"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => {
                                    setEditingUser(null);
                                    setEditForm({});
                                  }}
                                  className="p-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                                  title="Cancelar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                {(isAdmin || u.id === user?.id) && (
                                  <button 
                                    onClick={() => handleEditClick(u)}
                                    className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-colors"
                                    title="Editar"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isAdmin && !checkPlatformAdmin(u.email) && (
                                  <button 
                                    onClick={() => handleDeleteUser(u.id)}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-all",
                                      deletingUid === u.id 
                                        ? "bg-red-600 text-white scale-110 shadow-lg" 
                                        : "hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                                    )}
                                    title={deletingUid === u.id ? "Clique para confirmar" : "Remover Acesso"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr key="empty-state">
                      <td colSpan={5} className="px-4 py-14 text-center text-muted-foreground font-medium text-xs">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
