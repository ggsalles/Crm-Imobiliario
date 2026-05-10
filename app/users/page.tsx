"use client";

import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
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
  UserPlus
} from "lucide-react";
import Image from 'next/image';
import { 
  UserProfile, 
  subscribeToUsers, 
  updateUserProfile, 
  deleteUserProfile,
  createUserProfile 
} from "@/lib/db";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function UsersPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  
  // Create User States
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [newUserData, setNewUserData] = useState({
    displayName: "",
    email: "",
    role: "Membro" as "Membro" | "Admin",
    userType: "funcionário" as "funcionário" | "cliente"
  });

  const isAdmin = profile?.role === 'Admin';

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;
    
    // Only admins can see all users, members see only themselves or maybe the list depends on the app intent.
    // For now, let's keep the list visible but hide management actions, 
    // unless the ownerId logic should apply to users too.
    const ownerId = isAdmin ? undefined : user.id;

    const unsub = subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
    }, ownerId);
    return () => unsub();
  }, [user, profile, isAdmin]);

  const handleEditClick = (u: UserProfile) => {
    if (!isAdmin && u.id !== user?.id) {
      toast.error("Você só pode editar seu próprio perfil.");
      return;
    }
    setEditingUser(u.id);
    setEditForm({
      displayName: u.displayName,
      role: u.role,
      userType: u.userType || 'funcionário'
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateUserProfile(id, editForm);
      setEditingUser(null);
      toast.success("Usuário atualizado com sucesso");
    } catch (error: any) {
      toast.error("Erro ao atualizar usuário");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await createUserProfile(newUserData);
      setShowAddModal(false);
      setNewUserData({ displayName: "", email: "", role: "Membro", userType: "funcionário" });
      toast.success("Usuário cadastrado com sucesso. Ele agora pode fazer login.");
    } catch (error: any) {
      toast.error("Erro ao cadastrar usuário");
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
      await deleteUserProfile(id);
      toast.success("Acesso removido com sucesso");
      setDeletingUid(null);
    } catch (error: any) {
      console.error("Erro ao deletar:", error);
      toast.error("Erro ao remover acesso. Verifique as permissões de administrador.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </main>
      </div>
    );
  }

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="h-20 bg-white border-b px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <UserCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Gestão de Usuários</h2>
              <p className="text-xs text-slate-500 font-medium tracking-tight">Controle de acessos e perfis</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar usuário..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-sm w-48 lg:w-64 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
              />
            </div>
            
            {isAdmin && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Novo Usuário</span>
              </button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto w-full relative">
          {/* Add User Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight">Cadastrar Usuário</h3>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Preencha os dados de acesso</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome de Exibição</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: João Silva"
                      value={newUserData.displayName}
                      onChange={(e) => setNewUserData({...newUserData, displayName: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail (Google)</label>
                    <input 
                      type="email"
                      required
                      placeholder="email@gmail.com"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                        value={newUserData.userType}
                        onChange={(e) => setNewUserData({...newUserData, userType: e.target.value as any})}
                      >
                        <option value="funcionário">Funcionário</option>
                        <option value="cliente">Cliente</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nível</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                        value={newUserData.role}
                        onChange={(e) => setNewUserData({...newUserData, role: e.target.value as any})}
                      >
                        <option value="Membro">Membro</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                    <p className="text-[10px] text-blue-700 leading-tight">
                      <strong>Informação Importante:</strong> Após o cadastro aqui, o usuário deve acessar a tela de login, clicar em <strong>&quot;Não tem uma senha ainda? Cadastre-se aqui&quot;</strong> e definir sua senha inicial usando o e-mail informado.
                    </p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isCreating}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
                  >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finalizar Cadastro"}
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{filteredUsers.length}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest text-[10px]">Usuários Cadastrados</span>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 text-left">
                    <th className="px-6 py-4 font-bold">Usuário</th>
                    <th className="px-6 py-4 font-bold">Tipo</th>
                    <th className="px-6 py-4 font-bold">Nível de Acesso</th>
                    <th className="px-6 py-4 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map((u) => {
                    const isEditing = editingUser === u.id;
                    
                    return (
                      <tr key={u.id || u.email} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                              {u.photoURL ? (
                                <Image 
                                  src={u.photoURL} 
                                  alt={u.displayName} 
                                  width={40} 
                                  height={40} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="font-bold text-slate-400">{u.displayName[0]}</span>
                              )}
                            </div>
                            <div>
                              {isEditing ? (
                                <input 
                                  type="text"
                                  className="text-sm font-bold text-slate-900 bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-blue-500/20 py-1 px-2 w-full"
                                  value={editForm.displayName}
                                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                />
                              ) : (
                                <p className="text-sm font-bold text-slate-900">{u.displayName}</p>
                              )}
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Mail className="w-3 h-3" />
                                <span className="text-xs font-medium">{u.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {isEditing && isAdmin ? (
                            <select 
                              className="text-xs font-bold bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-blue-500/20 py-1.5"
                              value={editForm.userType}
                              onChange={(e) => setEditForm({ ...editForm, userType: e.target.value as any })}
                            >
                              <option value="funcionário">Funcionário</option>
                              <option value="cliente">Cliente</option>
                            </select>
                          ) : (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold",
                              u.userType === 'cliente' ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                            )}>
                              <Briefcase className="w-3 h-3" />
                              {(u.userType || 'Funcionário').toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          {isEditing && isAdmin ? (
                            <select 
                              className="text-xs font-bold bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-blue-500/20 py-1.5"
                              value={editForm.role}
                              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                            >
                              <option value="Membro">Membro</option>
                              <option value="Admin">Admin</option>
                            </select>
                          ) : (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold",
                              u.role === 'Admin' ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-600"
                            )}>
                              <Shield className="w-3 h-3" />
                              {u.role?.toUpperCase() || 'MEMBRO'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={() => handleSaveEdit(u.id)}
                                  className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                  title="Salvar"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setEditingUser(null)}
                                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                                  title="Cancelar"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                {(isAdmin || u.id === user?.id) && (
                                  <button 
                                    onClick={() => handleEditClick(u)}
                                    className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                    title="Editar"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                )}
                                {isAdmin && u.email !== 'ggsalles@gmail.com' && (
                                  <button 
                                    onClick={() => handleDeleteUser(u.id)}
                                    className={cn(
                                      "p-2 rounded-lg transition-all",
                                      deletingUid === u.id 
                                        ? "bg-red-600 text-white scale-110 shadow-lg" 
                                        : "hover:bg-red-50 text-slate-400 hover:text-red-600"
                                    )}
                                    title={deletingUid === u.id ? "Clique para confirmar" : "Remover Acesso"}
                                  >
                                    <Trash2 className="w-4 h-4" />
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
                      <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-medium text-sm">
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
