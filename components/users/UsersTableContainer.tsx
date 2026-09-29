"use client";

import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfile, Tenant } from "@/lib/db";
import { UserTableRow } from "@/components/users/UserTableRow";

interface UsersTableContainerProps {
  filteredUsers: UserProfile[];
  statusFilter: 'all' | 'active' | 'inactive';
  setStatusFilter: (val: 'all' | 'active' | 'inactive') => void;
  statusCounts: { all: number; active: number; inactive: number };
  currentUserId?: string;
  isAdmin: boolean;
  editingUser: string | null;
  savingUid: string | null;
  editForm: Partial<UserProfile>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<UserProfile>>>;
  tenants: Tenant[];
  deletingUid: string | null;
  onEditClick: (u: UserProfile) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDeleteUser: (id: string) => void;
  onInactivateClick: (target: UserProfile) => void;
  onReactivateClick: (target: UserProfile) => void;
  onResetPasswordClick: (target: UserProfile) => void;
}

export function UsersTableContainer({
  filteredUsers,
  statusFilter,
  setStatusFilter,
  statusCounts,
  currentUserId,
  isAdmin,
  editingUser,
  savingUid,
  editForm,
  setEditForm,
  tenants,
  deletingUid,
  onEditClick,
  onSaveEdit,
  onCancelEdit,
  onDeleteUser,
  onInactivateClick,
  onReactivateClick,
  onResetPasswordClick
}: UsersTableContainerProps) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-muted/30">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-bold text-foreground">{filteredUsers.length}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Usuários</span>
          </div>
          <div className="h-4 w-px bg-border hidden sm:block" />
          
          {/* Tabs de Filtro de Status */}
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10.5px] font-bold transition-all cursor-pointer",
                statusFilter === 'all' 
                  ? "bg-card text-foreground shadow-xs" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todos ({statusCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                statusFilter === 'active' 
                  ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Ativos ({statusCounts.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10.5px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                statusFilter === 'inactive' 
                  ? "bg-card text-rose-500 shadow-xs" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Inativos ({statusCounts.inactive})
            </button>
          </div>
        </div>

        <div className="flex gap-1.5">
          <button 
            onClick={() => setStatusFilter(statusFilter === 'all' ? 'active' : statusFilter === 'active' ? 'inactive' : 'all')}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground flex items-center gap-1 text-xs cursor-pointer"
            title="Alternar filtro rápido de status"
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium hidden md:inline">Filtro rápido</span>
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
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                isEditing={editingUser === u.id}
                isSaving={savingUid === u.id}
                editForm={editForm}
                setEditForm={setEditForm}
                tenants={tenants}
                deletingUid={deletingUid}
                onEditClick={onEditClick}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                onDeleteUser={onDeleteUser}
                onInactivateClick={onInactivateClick}
                onReactivateClick={onReactivateClick}
                onResetPasswordClick={onResetPasswordClick}
              />
            ))}

            {filteredUsers.length === 0 && (
              <tr key="empty-state">
                <td colSpan={5} className="px-4 py-14 text-center text-muted-foreground font-medium text-xs">
                  {statusFilter === 'inactive' 
                    ? "Nenhum usuário inativo encontrado." 
                    : statusFilter === 'active'
                    ? "Nenhum usuário ativo encontrado."
                    : "Nenhum usuário encontrado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
