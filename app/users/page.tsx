"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { 
  UserCircle, 
  Search, 
  Filter, 
  Loader2, 
  UserPlus, 
  Building2 
} from "lucide-react";
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
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME, isPlatformAdmin as checkPlatformAdmin } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit";
import { EditTenantModal } from "@/components/saas/EditTenantModal";
import { TenantManagementSection } from "@/components/saas/TenantManagementSection";
import { CreateUserModal } from "@/components/users/CreateUserModal";
import { UserLimitModal } from "@/components/users/UserLimitModal";
import { TenantLicenseBanner } from "@/components/users/TenantLicenseBanner";
import { UserTableRow } from "@/components/users/UserTableRow";

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
  const [editingTenantForModal, setEditingTenantForModal] = useState<Tenant | null>(null);

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

  // Active users registered to this tenant (never count platform master as a client's seat)
  const tenantUsers = users.filter(u => {
    if (checkPlatformAdmin(u.email) && currentTenantId !== DEFAULT_TENANT_ID) {
      return false;
    }
    return (u.tenantId || DEFAULT_TENANT_ID) === currentTenantId || 
           (u.tenantIds && u.tenantIds.includes(currentTenantId));
  });
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
    } catch {
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

  const filteredUsers = users.filter(u => {
    // Platform master login is strictly hidden from regular companies
    if (!isPlatformAdmin && checkPlatformAdmin(u.email)) {
      return false;
    }
    // Regular companies only see their own users
    if (!isPlatformAdmin) {
      const belongs = (u.tenantId || DEFAULT_TENANT_ID) === currentTenantId || 
                      (u.tenantIds && u.tenantIds.includes(currentTenantId));
      if (!belongs) return false;
    }
    return (
      u.displayName.toLowerCase().includes(search.toLowerCase()) || 
      u.email.toLowerCase().includes(search.toLowerCase())
    );
  });

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
                  "px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 border transition-all active:scale-95 cursor-pointer",
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
                  "px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 shadow-xs cursor-pointer",
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
          
          {/* Painel Expansível SaaS - Gerenciamento Multi-Tenant */}
          {showTenantsSection && isPlatformAdmin && (
            <TenantManagementSection 
              tenants={tenants}
              users={users}
              selectedTenantFilter={selectedTenantFilter}
              currentTenantId={currentTenantId}
              currentTenant={currentTenant}
              tenantUsers={tenantUsers}
              newTenantName={newTenantName}
              setNewTenantName={setNewTenantName}
              isCreatingTenant={isCreatingTenant}
              isUpdatingLimit={isUpdatingLimit}
              isPlatformAdmin={isPlatformAdmin}
              onCreateTenant={async (e) => {
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
              onQuickUpdateLimit={handleQuickUpdateLimit}
              onSelectTenant={(id) => setSelectedTenantFilter(id)}
              onEditTenant={(t) => setEditingTenantForModal(t)}
              onRefreshTenants={fetchTenants}
            />
          )}

          {/* Cartão Visual no Topo: Licenças Contratadas & Vagas da Imobiliária */}
          <TenantLicenseBanner 
            isAdmin={isAdmin}
            isPlatformAdmin={isPlatformAdmin}
            isLimitReached={isLimitReached}
            activeCount={activeCount}
            tenantUserLimit={tenantUserLimit}
            visualBlocksString={visualBlocksString}
            currentTenant={currentTenant}
            remainingSlots={remainingSlots}
            currentTenantId={currentTenantId}
            isUpdatingLimit={isUpdatingLimit}
            tenants={tenants}
            usagePercentage={usagePercentage}
            tenantUsers={tenantUsers}
            onQuickUpdateLimit={handleQuickUpdateLimit}
            onSelectTenantFilter={(id) => setSelectedTenantFilter(id)}
            onOpenLimitModal={() => setShowLimitModal(true)}
            onOpenAddModal={() => setShowAddModal(true)}
          />

          {/* Tabela de Usuários */}
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
                  {filteredUsers.map((u) => (
                    <UserTableRow 
                      key={u.id || u.email}
                      userItem={u}
                      currentUserId={user?.id}
                      isAdmin={isAdmin}
                      isEditing={editingUser === u.id}
                      editForm={editForm}
                      setEditForm={setEditForm}
                      tenants={isPlatformAdmin ? tenants : tenants.filter(t => t.id === currentTenantId)}
                      deletingUid={deletingUid}
                      onEditClick={handleEditClick}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={() => {
                        setEditingUser(null);
                        setEditForm({});
                      }}
                      onDeleteUser={handleDeleteUser}
                    />
                  ))}

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

        {/* Modal para Adicionar Novo Usuário */}
        <CreateUserModal 
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateUser}
          isCreating={isCreating}
          newUserData={newUserData}
          setNewUserData={setNewUserData}
          isAdmin={isAdmin}
          tenants={isPlatformAdmin ? tenants : tenants.filter(t => t.id === currentTenantId)}
        />

        {/* Modal de Limite de Vagas Atingido */}
        <UserLimitModal 
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          currentTenant={currentTenant}
          tenantUserLimit={tenantUserLimit}
          activeCount={activeCount}
          visualBlocksString={visualBlocksString}
          isPlatformAdmin={isPlatformAdmin}
          currentTenantId={currentTenantId}
          isUpdatingLimit={isUpdatingLimit}
          onQuickUpdateLimit={handleQuickUpdateLimit}
        />

        {/* Modal para Editar Cadastro da Imobiliária */}
        <EditTenantModal
          isOpen={!!editingTenantForModal}
          onClose={() => setEditingTenantForModal(null)}
          tenant={editingTenantForModal}
          onSuccess={() => {
            fetchTenants();
          }}
        />
      </main>
    </div>
  );
}
