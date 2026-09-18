'use client';

import React from 'react';
import Image from 'next/image';
import { UserProfile, Tenant } from '@/lib/db';
import { Mail, Briefcase, Shield, Building2, Edit3, Trash2, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isPlatformAdmin as checkPlatformAdmin } from '@/lib/constants';

interface UserTableRowProps {
  userItem: UserProfile;
  currentUserId?: string;
  isAdmin: boolean;
  isEditing: boolean;
  isSaving?: boolean;
  editForm: Partial<UserProfile>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<UserProfile>>>;
  tenants: Tenant[];
  deletingUid: string | null;
  onEditClick: (u: UserProfile) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDeleteUser: (id: string) => void;
}

export function UserTableRow({
  userItem,
  currentUserId,
  isAdmin,
  isEditing,
  isSaving = false,
  editForm,
  setEditForm,
  tenants,
  deletingUid,
  onEditClick,
  onSaveEdit,
  onCancelEdit,
  onDeleteUser
}: UserTableRowProps) {
  const isSuperAdminEmail = checkPlatformAdmin(userItem.email);

  return (
    <tr className="group hover:bg-muted/10 transition-colors">
      <td className="px-3.5 sm:px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {userItem.photoURL ? (
              <Image 
                src={userItem.photoURL} 
                alt={userItem.displayName} 
                width={32} 
                height={32} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="font-bold text-xs text-muted-foreground">
                {userItem.displayName ? userItem.displayName[0] : "?"}
              </span>
            )}
          </div>
          <div>
            {isEditing ? (
              <input 
                type="text"
                disabled={isSaving}
                className="text-xs font-bold text-foreground bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary/20 py-0.5 px-1.5 w-full disabled:opacity-60"
                value={editForm.displayName || ""}
                onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
              />
            ) : (
              <p className="text-xs font-bold text-foreground">{userItem.displayName}</p>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              <Mail className="w-2.5 h-2.5" />
              <span className="text-[10px] font-medium">{userItem.email}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-3.5 sm:px-4 py-2.5">
        {isEditing && isAdmin ? (
          <select 
            disabled={isSaving}
            className="text-xs font-bold bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 py-1 px-1.5 focus:outline-none disabled:opacity-60"
            value={editForm.userType || "funcionário"}
            onChange={(e) => setEditForm(prev => ({ ...prev, userType: e.target.value as any }))}
          >
            <option value="funcionário">Funcionário</option>
            <option value="cliente">Cliente</option>
          </select>
        ) : (
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold",
            userItem.userType === 'cliente' ? "bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20" : "bg-primary/10 text-primary ring-1 ring-primary/20"
          )}>
            <Briefcase className="w-2.5 h-2.5" />
            {(userItem.userType || 'Funcionário').toUpperCase()}
          </span>
        )}
      </td>
      <td className="px-3.5 sm:px-4 py-2.5">
        {isEditing && isAdmin ? (
          <select 
            disabled={isSaving}
            className="text-xs font-bold bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary/20 py-1 px-1.5 focus:outline-none disabled:opacity-60"
            value={editForm.role || "Membro"}
            onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value as any }))}
          >
            <option value="Membro">Membro</option>
            <option value="Admin">Admin</option>
          </select>
        ) : (
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold",
            userItem.role === 'Admin' ? "bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20" : "bg-muted text-muted-foreground ring-1 ring-border"
          )}>
            <Shield className="w-2.5 h-2.5" />
            {userItem.role?.toUpperCase() || 'MEMBRO'}
          </span>
        )}
      </td>
      <td className="px-3.5 sm:px-4 py-2.5 font-medium text-xs">
        {isEditing && isAdmin && tenants.length > 0 ? (
          <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto p-1 bg-background/50 border border-border rounded-lg w-44 shrink-0">
            {tenants.map(t => {
              const isChecked = (editForm.tenantIds || []).includes(t.id);
              return (
                <label key={t.id} className={cn("flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-muted/50 rounded text-[11px] font-semibold text-foreground", isSaving ? "opacity-60 cursor-not-allowed" : "cursor-pointer")}>
                  <input 
                    type="checkbox"
                    disabled={isSaving}
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
                      setEditForm(prev => ({ 
                        ...prev, 
                        tenantIds: updated,
                        tenantId: updated[0]
                      }));
                    }}
                    className="rounded border-border text-primary focus:ring-primary/20 w-3 h-3 cursor-pointer accent-primary disabled:cursor-not-allowed"
                  />
                  <span className="truncate">{t.name}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1 align-start max-w-[180px]">
            {(userItem.tenantIds && userItem.tenantIds.length > 0 ? userItem.tenantIds : [userItem.tenantId]).map((tid, idx) => {
              const tObj = tenants.find(t => t.id === tid);
              if (!tObj) return null;
              return (
                <span key={tid || idx} className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold w-fit",
                  tObj.id === userItem.tenantId
                    ? "bg-teal-500/10 text-teal-600 border border-teal-500/20"
                    : "bg-muted text-muted-foreground border border-border"
                )}>
                  <Building2 className="w-2.5 h-2.5" />
                  {tObj.name} {tObj.id === userItem.tenantId && "👑"}
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
                onClick={() => onSaveEdit(userItem.id)}
                disabled={isSaving}
                className={cn(
                  "p-1.5 rounded-lg transition-colors flex items-center justify-center",
                  isSaving 
                    ? "bg-emerald-500/10 text-emerald-500 cursor-wait opacity-80" 
                    : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 cursor-pointer"
                )}
                title={isSaving ? "Salvando alterações..." : "Salvar"}
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
              <button 
                onClick={onCancelEdit}
                disabled={isSaving}
                className={cn(
                  "p-1.5 bg-muted text-muted-foreground rounded-lg transition-colors",
                  isSaving ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/80 cursor-pointer"
                )}
                title="Cancelar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              {(isAdmin || userItem.id === currentUserId) && (
                <button 
                  onClick={() => onEditClick(userItem)}
                  className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-colors cursor-pointer"
                  title="Editar"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
              {isAdmin && !isSuperAdminEmail && (
                <button 
                  onClick={() => onDeleteUser(userItem.id)}
                  className={cn(
                    "p-1.5 rounded-lg transition-all cursor-pointer",
                    deletingUid === userItem.id 
                      ? "bg-red-600 text-white scale-110 shadow-lg" 
                      : "hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                  )}
                  title={deletingUid === userItem.id ? "Clique para confirmar" : "Remover Acesso"}
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
}
