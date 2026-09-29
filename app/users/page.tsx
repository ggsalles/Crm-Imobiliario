"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { Loader2 } from "lucide-react";
import { 
  UserProfile, 
  subscribeToUsers, 
  updateUserProfile, 
  deleteUserProfile,
  createUserProfile,
  Tenant,
  calculateTenantPlanCapacity,
  getTenants,
  createTenant,
  apiFetch
} from "@/lib/db";
import { toast } from "sonner";
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME, isPlatformAdmin as checkPlatformAdmin } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit";
import { EditTenantModal } from "@/components/saas/EditTenantModal";
import { TenantManagementSection } from "@/components/saas/TenantManagementSection";
import { CreateUserModal } from "@/components/users/CreateUserModal";
import { UserLimitModal } from "@/components/users/UserLimitModal";
import { TenantLicenseBanner } from "@/components/users/TenantLicenseBanner";
import { InactivateUserModal } from "@/components/users/InactivateUserModal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { AdminResetPasswordModal } from "@/components/users/AdminResetPasswordModal";
import { UserCreatedSuccessModal } from "@/components/users/UserCreatedSuccessModal";
import { UsersHeader } from "@/components/users/UsersHeader";
import { UsersTableContainer } from "@/components/users/UsersTableContainer";

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
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [deletingUid] = useState<string | null>(null);
  const [inactivatingUser, setInactivatingUser] = useState<UserProfile | null>(null);
  const [isInactivating, setIsInactivating] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [userToResetPassword, setUserToResetPassword] = useState<UserProfile | null>(null);
  const [createdUserSuccessData, setCreatedUserSuccessData] = useState<{
    displayName: string;
    email: string;
    password?: string;
    role: string;
    tenantName?: string;
  } | null>(null);

  const [newUserData, setNewUserData] = useState<{
    displayName: string;
    email: string;
    role: "Membro" | "Admin";
    userType: "funcionário" | "cliente";
    tenantId: string;
    tenantIds: string[];
    password?: string;
  }>({
    displayName: "",
    email: "",
    role: "Membro",
    userType: "funcionário",
    tenantId: DEFAULT_TENANT_ID,
    tenantIds: [DEFAULT_TENANT_ID],
    password: ""
  });

  const isAdmin = profile?.role === 'Admin';
  const isPlatformAdmin = checkPlatformAdmin(profile?.email);

  const fetchTenants = useCallback(async () => {
    try {
      const data = await getTenants();
      setTenants(data);
    } catch (err) {
      console.error("Erro ao carregar inquilinos:", err);
    }
  }, []);

  const forceDataResync = useCallback(async () => {
    try {
      const data = await apiFetch('/api/profiles', { bypassCache: true });
      if (Array.isArray(data)) {
        const ownerId = isAdmin ? undefined : user?.id;
        const filtered = ownerId ? data.filter((u: UserProfile) => u.id === ownerId) : data;
        setUsers(filtered);
      }
    } catch (err) {
      console.warn("[app/users] Erro ao sincronizar perfis:", err);
    }
  }, [user, isAdmin]);

  // Current active tenant being managed or inspected
  const currentTenantId = useMemo(() => {
    return selectedTenantFilter || profile?.tenantId || DEFAULT_TENANT_ID;
  }, [selectedTenantFilter, profile?.tenantId]);

  const tenantsMap = useMemo(() => new Map(tenants.map(t => [t.id, t])), [tenants]);

  const currentTenant = useMemo(() => {
    return tenantsMap.get(currentTenantId) || {
      id: currentTenantId,
      name: currentTenantId === DEFAULT_TENANT_ID ? DEFAULT_TENANT_NAME : "Imobiliária",
      userLimit: 3,
      brokerLimit: 2,
      adminLimit: 1
    };
  }, [tenantsMap, currentTenantId]);

  // Active users registered to this tenant (never count platform master as a client's seat)
  const tenantUsers = useMemo(() => {
    return users.filter(u => {
      if (checkPlatformAdmin(u.email) && currentTenantId !== DEFAULT_TENANT_ID) {
        return false;
      }
      return (u.tenantId || DEFAULT_TENANT_ID) === currentTenantId || 
             (u.tenantIds && u.tenantIds.includes(currentTenantId));
    });
  }, [users, currentTenantId]);

  // Capacidade total sincronizada com o plano comercial (base + extras)
  const { 
    tenantUserLimit, 
    activeCount, 
    isLimitReached, 
    remainingSlots, 
    usagePercentage, 
    visualBlocksString 
  } = useMemo(() => {
    const capacity = calculateTenantPlanCapacity(currentTenant, tenantUsers);
    const limit = capacity.totalCapacity;
    const staff = tenantUsers.filter(u => u.userType !== 'cliente');
    const active = staff.filter(u => u.isActive !== false).length;
    const reached = active >= limit;
    const remaining = Math.max(0, limit - active);
    const usage = Math.min(100, Math.round((active / (limit || 1)) * 100));
    const filled = Math.min(active, limit);
    const empty = Math.max(0, limit - active);
    const blocks = `[${'■'.repeat(filled)}${'□'.repeat(empty)}]`;

    return {
      planCapacity: capacity,
      tenantUserLimit: limit,
      staffUsers: staff,
      activeCount: active,
      isLimitReached: reached,
      remainingSlots: remaining,
      usagePercentage: usage,
      visualBlocksString: blocks
    };
  }, [currentTenant, tenantUsers]);

  // Status counts for tabs
  const statusCounts = useMemo(() => {
    const active = tenantUsers.filter(u => u.isActive !== false).length;
    const inactive = tenantUsers.length - active;
    return {
      all: tenantUsers.length,
      active,
      inactive
    };
  }, [tenantUsers]);

  const handleQuickUpdateLimit = useCallback(async (newLimit: number, targetId?: string) => {
    if (!isPlatformAdmin) return;
    const tid = targetId || currentTenantId;
    setIsUpdatingLimit(true);
    try {
      await apiFetch(`/api/tenants?id=${tid}`, {
        method: "PATCH",
        body: JSON.stringify({ userLimit: newLimit })
      });
      const targetTenantName = tenantsMap.get(tid)?.name || 'Imobiliária';
      recordAuditEvent({
        action: 'UPDATE_SETTINGS',
        title: 'Alteração de Licenças / Vagas da Imobiliária',
        content: `Limite de vagas para "${targetTenantName}" alterado para ${newLimit} usuários.`,
        severity: 'high',
        category: 'modification',
        relatedId: tid,
        entityType: 'tenant',
        metadata: {
          tenantId: tid,
          tenantName: targetTenantName,
          newLimit
        }
      });
      toast.success(`${targetTenantName}: limite de vagas alterado para ${newLimit} usuários!`);
      await fetchTenants();
    } catch (err: any) {
      toast.error("Erro ao alterar limite: " + err.message);
    } finally {
      setIsUpdatingLimit(false);
    }
  }, [isPlatformAdmin, currentTenantId, tenantsMap, fetchTenants]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;
    
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
  }, [isAdmin, isPlatformAdmin, fetchTenants]);

  const handleEditClick = useCallback((u: UserProfile) => {
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
      tenantIds: u.tenantIds || [u.tenantId || DEFAULT_TENANT_ID],
      isActive: u.isActive !== false,
      inactiveReason: u.inactiveReason || ''
    });
  }, [isAdmin, user?.id]);

  const handleSaveEdit = useCallback(async (id: string) => {
    if (savingUid) return;
    setSavingUid(id);

    const updatedTenantIds = editForm.tenantIds && editForm.tenantIds.length > 0
      ? editForm.tenantIds
      : (editForm.tenantId ? [editForm.tenantId] : []);
    const updatedTenantId = editForm.tenantId || updatedTenantIds[0] || DEFAULT_TENANT_ID;

    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        return {
          ...u,
          displayName: editForm.displayName ?? u.displayName,
          role: editForm.role ?? u.role,
          userType: editForm.userType ?? u.userType,
          tenantId: updatedTenantId,
          tenantIds: updatedTenantIds.length > 0 ? updatedTenantIds : u.tenantIds,
          isActive: editForm.isActive !== undefined ? editForm.isActive : u.isActive,
          inactiveReason: editForm.inactiveReason !== undefined ? editForm.inactiveReason : u.inactiveReason
        };
      }
      return u;
    }));

    try {
      await updateUserProfile(id, {
        ...editForm,
        tenantId: updatedTenantId,
        tenantIds: updatedTenantIds
      });

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
    } catch (err: any) {
      console.error("[app/users] Erro ao atualizar perfil do usuário:", err);
      toast.error(err?.message || "Erro ao atualizar usuário");
      forceDataResync();
    } finally {
      setSavingUid(null);
    }
  }, [savingUid, editForm, forceDataResync]);

  const handleConfirmInactivation = useCallback(async (userId: string, reason: string) => {
    setIsInactivating(true);
    try {
      const targetUser = users.find(u => u.id === userId);
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: false, inactiveReason: reason } : u));

      await updateUserProfile(userId, {
        isActive: false,
        inactiveReason: reason
      });

      recordAuditEvent({
        action: 'UPDATE_SETTINGS',
        title: 'Inativação de Acesso de Usuário',
        content: `Usuário "${targetUser?.displayName || userId}" (${targetUser?.email || ''}) foi inativado pela administração. Motivo: ${reason || 'Não informado'}.`,
        severity: 'high',
        category: 'modification',
        relatedId: userId,
        entityType: 'user',
        metadata: {
          userId,
          userName: targetUser?.displayName,
          userEmail: targetUser?.email,
          reason,
          action: 'inactivate'
        }
      });

      toast.success(`Usuário "${targetUser?.displayName || 'Selecionado'}" inativado com sucesso. O acesso ao sistema foi suspenso e a vaga liberada.`);
      setInactivatingUser(null);
    } catch (err: any) {
      console.error("[app/users] Erro ao inativar usuário:", err);
      toast.error(err?.message || "Erro ao inativar usuário");
      forceDataResync();
    } finally {
      setIsInactivating(false);
    }
  }, [users, forceDataResync]);

  const handleReactivateUser = useCallback(async (targetUser: UserProfile) => {
    if (isLimitReached && !isPlatformAdmin) {
      toast.error("Limite de vagas atingido. Expanda as licenças contratadas para reativar este usuário.");
      setShowLimitModal(true);
      return;
    }

    try {
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, isActive: true, inactiveReason: undefined } : u));

      await updateUserProfile(targetUser.id, {
        isActive: true,
        inactiveReason: null
      });

      recordAuditEvent({
        action: 'UPDATE_SETTINGS',
        title: 'Reativação de Acesso de Usuário',
        content: `Usuário "${targetUser.displayName}" (${targetUser.email}) teve seu acesso restabelecido pela administração.`,
        severity: 'high',
        category: 'modification',
        relatedId: targetUser.id,
        entityType: 'user',
        metadata: {
          userId: targetUser.id,
          userName: targetUser.displayName,
          userEmail: targetUser.email,
          action: 'reactivate'
        }
      });

      toast.success(`Usuário "${targetUser.displayName}" reativado com sucesso! O acesso ao sistema foi restabelecido.`);
    } catch (err: any) {
      console.error("[app/users] Erro ao reativar usuário:", err);
      toast.error(err?.message || "Erro ao reativar usuário");
      forceDataResync();
    }
  }, [isLimitReached, isPlatformAdmin, forceDataResync]);

  const handleOpenAddUserModal = () => {
    setNewUserData({
      displayName: "",
      email: "",
      role: "Membro",
      userType: "funcionário",
      tenantId: currentTenantId,
      tenantIds: [currentTenantId],
      password: ""
    });
    if (isLimitReached) {
      setShowLimitModal(true);
    } else {
      setShowAddModal(true);
    }
  };

  const handleCreateUser = useCallback(async (e: React.FormEvent) => {
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
    const assignedTenantId = newUserData.tenantId || currentTenantId;
    const assignedTenantIds = newUserData.tenantIds && newUserData.tenantIds.length > 0 ? newUserData.tenantIds : [assignedTenantId];

    try {
      await createUserProfile({
        ...newUserData,
        tenantId: assignedTenantId,
        tenantIds: assignedTenantIds
      });

      recordAuditEvent({
        action: 'CREATE_USER',
        title: 'Cadastro de Novo Usuário',
        content: `Novo usuário/corretor "${newUserData.displayName}" (${newUserData.email}) cadastrado no sistema com o perfil "${newUserData.role}".`,
        severity: 'high',
        category: 'modification',
        entityType: 'user',
        metadata: {
          displayName: newUserData.displayName,
          email: newUserData.email,
          role: newUserData.role,
          tenantId: assignedTenantId
        }
      });

      setShowAddModal(false);
      setCreatedUserSuccessData({
        displayName: newUserData.displayName,
        email: newUserData.email,
        password: newUserData.password,
        role: newUserData.role,
        tenantName: currentTenant?.name || "Imobiliária"
      });
      setNewUserData({ 
        displayName: "", 
        email: "", 
        role: "Membro", 
        userType: "funcionário",
        tenantId: currentTenantId,
        tenantIds: [currentTenantId],
        password: ""
      });
      toast.success("Usuário cadastrado com sucesso!");
      await fetchTenants();
      forceDataResync();
    } catch (error: any) {
      toast.error(error.message || "Erro ao cadastrar usuário");
    } finally {
      setIsCreating(false);
    }
  }, [isAdmin, isPlatformAdmin, isLimitReached, newUserData, currentTenantId, currentTenant?.name, fetchTenants, forceDataResync]);

  const confirmDeleteUser = useCallback(async () => {
    if (!userToDelete) return;
    const targetUser = userToDelete;
    const id = targetUser.id;

    if (id === user?.id) {
      toast.error("Você não pode excluir seu próprio perfil");
      setUserToDelete(null);
      return;
    }

    setIsDeletingUser(true);
    const toastId = toast.loading("Excluindo usuário...");
    setUsers(prev => prev.filter(u => u.id !== id));

    try {
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

      toast.success("Acesso e usuário removidos com sucesso!", { id: toastId });
      setUserToDelete(null);
    } catch (error: any) {
      console.error("Erro ao deletar:", error);
      setUsers(prev => [...prev, targetUser]);
      toast.error("Erro ao remover acesso. Verifique as permissões de administrador.", { id: toastId });
    } finally {
      setIsDeletingUser(false);
    }
  }, [userToDelete, user?.id]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (!isPlatformAdmin && checkPlatformAdmin(u.email)) {
        return false;
      }
      if (!isPlatformAdmin) {
        const belongs = (u.tenantId || DEFAULT_TENANT_ID) === currentTenantId || 
                        (u.tenantIds && u.tenantIds.includes(currentTenantId));
        if (!belongs) return false;
      }
      if (statusFilter === 'active' && u.isActive === false) return false;
      if (statusFilter === 'inactive' && u.isActive !== false) return false;

      if (!q) return true;
      return (
        (u.displayName || "").toLowerCase().includes(q) || 
        (u.email || "").toLowerCase().includes(q)
      );
    });
  }, [users, isPlatformAdmin, currentTenantId, statusFilter, search]);

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

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden">
        {/* Header do Módulo de Usuários */}
        <UsersHeader
          search={search}
          setSearch={setSearch}
          isPlatformAdmin={isPlatformAdmin}
          isAdmin={isAdmin}
          showTenantsSection={showTenantsSection}
          setShowTenantsSection={setShowTenantsSection}
          isLimitReached={isLimitReached}
          onOpenAddUserModal={handleOpenAddUserModal}
        />

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
                  const createdTenant = await createTenant({ name: newTenantName });
                  recordAuditEvent({
                    action: 'CREATE_COMPANY',
                    title: 'Cadastro de Nova Imobiliária (Inquilino)',
                    content: `Nova imobiliária "${newTenantName}" provisionada no ecossistema SaaS.`,
                    severity: 'high',
                    category: 'modification',
                    relatedId: createdTenant?.id,
                    entityType: 'tenant',
                    metadata: {
                      name: newTenantName,
                      tenantId: createdTenant?.id
                    }
                  });
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
          <UsersTableContainer
            filteredUsers={filteredUsers}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            statusCounts={statusCounts}
            currentUserId={user?.id}
            isAdmin={isAdmin}
            editingUser={editingUser}
            savingUid={savingUid}
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
            onDeleteUser={(id) => {
              const target = users.find(u => u.id === id);
              if (target) setUserToDelete(target);
            }}
            onInactivateClick={(target) => setInactivatingUser(target)}
            onReactivateClick={handleReactivateUser}
            onResetPasswordClick={(target) => setUserToResetPassword(target)}
          />
        </div>

        {/* Modal para Inativar Usuário */}
        <InactivateUserModal 
          isOpen={!!inactivatingUser}
          onClose={() => setInactivatingUser(null)}
          user={inactivatingUser}
          onConfirm={handleConfirmInactivation}
          isProcessing={isInactivating}
        />

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

        {/* Modal de Confirmação de Exclusão de Usuário */}
        <ConfirmDeleteModal
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          onConfirm={confirmDeleteUser}
          title="Excluir Usuário do Sistema"
          itemName={userToDelete ? `${userToDelete.displayName} (${userToDelete.email})` : undefined}
          itemType="usuário"
          warningNote="ATENÇÃO: A exclusão permanente removerá o cadastro do colaborador. Caso deseje apenas suspender o login mantendo o histórico de negócios intacto, utilize a opção 'Inativar Usuário'."
          isDeleting={isDeletingUser}
        />

        {/* Modal de Redefinição de Senha Administrativa */}
        <AdminResetPasswordModal
          isOpen={!!userToResetPassword}
          onClose={() => setUserToResetPassword(null)}
          user={userToResetPassword}
          tenantName={currentTenant?.name || "Imobiliária"}
        />

        {/* Modal de Sucesso com Credenciais Prontas para Envio */}
        <UserCreatedSuccessModal
          isOpen={!!createdUserSuccessData}
          onClose={() => setCreatedUserSuccessData(null)}
          userData={createdUserSuccessData}
        />
      </main>
    </div>
  );
}
