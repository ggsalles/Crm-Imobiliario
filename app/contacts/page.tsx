"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/sidebar";
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  Tag, 
  MapPin,
  ShieldCheck,
  UserCircle,
  X,
  Loader2,
  Trash2,
  Edit2,
  Building2
} from "lucide-react";
import { cn, formatPhone } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Contact, 
  UserProfile, 
  Company,
  getContacts,
  subscribeToContacts, 
  subscribeToUsers, 
  subscribeToCompanies,
  createContact, 
  updateContact, 
  deleteContact,
  createCompany,
  createTimelineEvent,
  findOrCreateConversation
} from "@/lib/db";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

import { Suspense } from "react";

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>}>
      <ContactsContent />
    </Suspense>
  );
}

function ContactsContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'cliente' | 'equipe'>('cliente');

  useEffect(() => {
    if (tabParam === 'cliente' || tabParam === 'equipe') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isMessaging, setIsMessaging] = useState<string | null>(null);
  const [displayPhone, setDisplayPhone] = useState("");

  useEffect(() => {
    if (isModalOpen) {
      setDisplayPhone(editingContact?.phone || "");
    } else {
      setDisplayPhone("");
    }
  }, [isModalOpen, editingContact]);

  const fetchData = async () => {
    if (!user || !profile) return;
    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    const data = await getContacts(ownerId);
    setContacts(data);
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;

    setLoading(true);
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsubContacts = subscribeToContacts((data) => {
      setContacts(data);
      setLoading(false);
    }, ownerId);

    const unsubUsers = subscribeToUsers((data) => {
      setUsers(data);
    }, ownerId);

    const unsubCompanies = subscribeToCompanies((data) => {
      setCompanies(data);
    }, ownerId);

    return () => {
      unsubContacts();
      unsubUsers();
      unsubCompanies();
    };
  }, [user, profile]);

  useEffect(() => {
    if (!isModalOpen) {
      setDeleteConfirmId(null);
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (editId && contacts.length > 0) {
      const contactToEdit = contacts.find(c => c.id === editId);
      if (contactToEdit) {
        setEditingContact(contactToEdit);
        setIsModalOpen(true);
        // Clear the query param to avoid re-opening on refresh
        router.replace('/contacts');
      }
    }
  }, [editId, contacts, router]);

  const filteredContacts = contacts.filter(c => 
    c.type === activeTab &&
    (c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredUsers = users.filter(u => 
    u.id !== user?.id && // Don't show current user in the list
    (u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDelete = async (id: string) => {
    console.log("handleDelete called for id:", id);
    try {
      console.log("Deleting contact...");
      await deleteContact(id);
      toast.success("Contato excluído com sucesso!");
      
      // Close modal if deleting the contact being edited
      if (editingContact && editingContact.id === id) {
        setIsModalOpen(false);
        setEditingContact(null);
      }
      
      setDeleteConfirmId(null);
      await fetchData();
    } catch (err: any) {
      console.error("Error deleting contact:", err);
      const errorMessage = err.message || "Erro ao excluir contato.";
      toast.error(`Erro: ${errorMessage}`);
    }
  };

  const handleMessage = async (target: any, type: 'cliente' | 'equipe') => {
    if (!user) return;
    
    setIsMessaging(target.id);
    try {
      const convId = await findOrCreateConversation(
        target.id, 
        type === 'equipe' ? 'team' : 'client',
        target
      );
      router.push(`/messages?id=${convId}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao iniciar conversa.");
    } finally {
      setIsMessaging(null);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      role: formData.get('role') as string,
      type: activeTab,
      companyId: activeTab === 'cliente' ? formData.get('companyId') as string : undefined,
      department: activeTab === 'equipe' ? formData.get('department') as string : undefined,
    };

    try {
      if (editingContact) {
        await updateContact(editingContact.id, data);
        toast.success("Contato atualizado!");
      } else {
        const contactId = await createContact(data);
        if (contactId) {
          await createTimelineEvent({
            type: 'system',
            category: 'contact',
            relatedId: contactId,
            content: `Contato "${data.name}" criado no sistema.`,
            title: 'Criação de Contato',
            metadata: { type: 'creation' }
          });
        }
        toast.success("Contato criado!");
      }
      await fetchData();
      setIsModalOpen(false);
      setEditingContact(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar contato.");
    }
  };

  if (authLoading) return null;

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {activeTab === 'cliente' ? 'Meus Clientes' : 'Minha Equipe'}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {activeTab === 'cliente' 
                  ? 'Gerencie sua base de clientes e leads externos.' 
                  : 'Veja os membros da sua organização e seus cargos.'}
              </p>
            </div>
            <button 
              onClick={() => {
                setEditingContact(null);
                setIsModalOpen(true);
              }}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {activeTab === 'cliente' ? 'Novo Cliente' : 'Novo Membro'}
            </button>
          </header>

          {/* Navigation & Search bar */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="bg-white p-1 rounded-2xl border flex gap-1 shadow-sm">
              <button 
                onClick={() => setActiveTab('cliente')}
                className={cn(
                  "px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all",
                  activeTab === 'cliente' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <UserCircle className="w-4 h-4" />
                Clientes
              </button>
              <button 
                onClick={() => setActiveTab('equipe')}
                className={cn(
                  "px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all",
                  activeTab === 'equipe' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <ShieldCheck className="w-4 h-4" />
                Equipe
              </button>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder={`Pesquisar em ${activeTab === 'cliente' ? 'clientes' : 'equipe'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              />
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full py-20 flex justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Regular Contacts (Clients or Team) */}
                {filteredContacts.map((contact) => (
                  <ContactCard 
                    key={contact.id} 
                    contact={contact} 
                    companyName={companies.find(c => c.id === contact.companyId)?.name}
                    onEdit={() => {
                      setEditingContact(contact);
                      setIsModalOpen(true);
                    }}
                    onDelete={() => handleDelete(contact.id)}
                    isActiveTabEquipe={activeTab === 'equipe'}
                    onMessage={() => handleMessage(contact, activeTab === 'equipe' ? 'equipe' : 'cliente')}
                    isMessaging={isMessaging === contact.id}
                    isConfirmingDelete={deleteConfirmId === contact.id}
                    setConfirmingDelete={(val) => setDeleteConfirmId(val ? contact.id : null)}
                  />
                ))}

                {/* Team Members (Registered Users) */}
                {activeTab === 'equipe' && filteredUsers.map((userProfile) => (
                  <UserCard 
                    key={userProfile.id} 
                    user={userProfile} 
                    onMessage={() => handleMessage(userProfile, 'equipe')}
                    isMessaging={isMessaging === userProfile.id}
                  />
                ))}

                {filteredContacts.length === 0 && (activeTab === 'cliente' || filteredUsers.length === 0) && (
                  <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed flex flex-col items-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Users className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold">Nenhum contato encontrado</h3>
                    <p className="text-muted-foreground text-sm mt-1">Tente ajustar sua pesquisa ou trocar de aba.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              // Removido onClick propositalmente para obedecer o botão cancelar/X, atendendo solicitação do usuário
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 w-full max-w-lg relative shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              
              <h2 className="text-2xl font-bold mb-6">
                {editingContact ? 'Editar Contato' : `Novo ${activeTab === 'cliente' ? 'Cliente' : 'Membro'}`}
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Nome Completo</label>
                    <input 
                      name="name"
                      required
                      defaultValue={editingContact?.name}
                      placeholder="Ex: Maria Oliveira"
                      className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">E-mail</label>
                    <input 
                      name="email"
                      type="email"
                      required
                      defaultValue={editingContact?.email}
                      placeholder="maria@exemplo.com"
                      className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Telefone</label>
                    <input 
                      name="phone"
                      value={displayPhone}
                      onChange={(e) => setDisplayPhone(formatPhone(e.target.value))}
                      placeholder="55 11 99999-9999"
                      className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Cargo / Função</label>
                    <input 
                      name="role"
                      defaultValue={editingContact?.role}
                      placeholder="Ex: Diretora Comercial"
                      className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">
                      {activeTab === 'cliente' ? 'Empresa' : 'Departamento'}
                    </label>
                    {activeTab === 'cliente' ? (
                      <div className="flex gap-2">
                        <select 
                          name="companyId"
                          defaultValue={editingContact?.companyId}
                          className="flex-1 px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em]"
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                        >
                          <option value="">Nenhuma empresa</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <button 
                          type="button"
                          onClick={() => {
                            const name = prompt("Nome da nova empresa:");
                            if (name) {
                              createCompany({ name }).then(id => {
                                if (id) toast.success("Empresa criada!");
                              });
                            }
                          }}
                          className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-600"
                          title="Nova Empresa"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <input 
                        name="department"
                        defaultValue={editingContact?.department}
                        placeholder="Ex: Vendas"
                        className="w-full px-4 py-3 rounded-xl border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    )}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  {editingContact && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (deleteConfirmId === editingContact.id) {
                          handleDelete(editingContact.id);
                        } else {
                          setDeleteConfirmId(editingContact.id);
                        }
                      }}
                      className={cn(
                        "px-4 py-3 font-bold rounded-2xl transition-all border",
                        deleteConfirmId === editingContact.id 
                          ? "bg-red-500 text-white border-red-500 hover:bg-red-600" 
                          : "text-red-500 hover:bg-red-50 border-red-100"
                      )}
                      title={deleteConfirmId === editingContact.id ? "Clique novamente para confirmar" : "Excluir este contato"}
                    >
                      {deleteConfirmId === editingContact.id ? "Confirmar?" : <Trash2 className="w-5 h-5" />}
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 font-bold text-muted-foreground hover:bg-muted rounded-2xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 font-bold bg-primary text-white rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContactCard({ 
  contact, 
  companyName, 
  onEdit, 
  onDelete, 
  isActiveTabEquipe, 
  onMessage, 
  isMessaging,
  isConfirmingDelete,
  setConfirmingDelete
}: { 
  contact: Contact, 
  companyName?: string, 
  onEdit: () => void, 
  onDelete: () => void, 
  isActiveTabEquipe: boolean, 
  onMessage: () => void, 
  isMessaging: boolean,
  isConfirmingDelete?: boolean,
  setConfirmingDelete?: (val: boolean) => void
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow group h-full flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl uppercase shrink-0",
              isActiveTabEquipe ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
            )}>
              {contact.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg truncate" title={contact.name}>{contact.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{contact.role}</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0 items-center">
            {!isConfirmingDelete ? (
              <>
                <button 
                  onClick={(e) => { 
                    console.log("Edit clicked");
                    e.preventDefault(); 
                    e.stopPropagation();
                    onEdit(); 
                  }} 
                  className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-all" 
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { 
                    console.log("Delete button clicked, confirming...");
                    e.preventDefault(); 
                    e.stopPropagation();
                    setConfirmingDelete?.(true); 
                  }} 
                  className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" 
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2 duration-200">
                <button 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation();
                    setConfirmingDelete?.(false); 
                  }}
                  className="text-[10px] font-bold px-2 py-1 text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
                <button 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation();
                    onDelete(); 
                  }}
                  className="text-[10px] font-bold px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-sm shadow-red-200"
                >
                  Excluir
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Mail className="w-4 h-4 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Phone className="w-4 h-4 shrink-0" />
            <span>{contact.phone}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {isActiveTabEquipe ? <Users className="w-4 h-4 shrink-0" /> : <Building2 className="w-4 h-4 shrink-0" />}
            <span className="truncate">{isActiveTabEquipe ? contact.department : (companyName || 'Sem empresa')}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Link 
          href={`/contacts/${contact.id}`}
          className={cn(
            "text-center text-sm font-bold py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm",
            isActiveTabEquipe ? "flex-1" : "w-full"
          )}
        >
          {isActiveTabEquipe ? 'Ver Detalhes' : 'Visão 360°'}
        </Link>
        {isActiveTabEquipe && (
          <button 
            onClick={onMessage}
            disabled={isMessaging}
            className="flex-1 text-center text-sm font-bold py-2 bg-muted text-muted-foreground rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isMessaging && <Loader2 className="w-4 h-4 animate-spin" />}
            Mensagem
          </button>
        )}
      </div>
    </div>
  );
}

function UserCard({ user, onMessage, isMessaging }: { user: UserProfile, onMessage: () => void, isMessaging: boolean }) {
  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow group h-full flex flex-col justify-between border-primary/20">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center overflow-hidden border relative">
              {user.photoURL ? (
                <Image src={user.photoURL} alt="Avatar" fill className="w-full h-full object-cover" referrerPolicy="no-referrer" unoptimized />
              ) : (
                <span className="font-bold text-xl text-primary">{user.displayName.charAt(0)}</span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                {user.displayName}
                <span className="bg-primary/10 text-primary text-[8px] uppercase px-1.5 py-0.5 rounded-full font-bold">Membro</span>
              </h3>
              <p className="text-xs text-muted-foreground">Membro da Organização</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Mail className="w-4 h-4 shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-primary font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Conta Vinculada</span>
          </div>
        </div>

        <button 
          onClick={onMessage}
          disabled={isMessaging}
          className="w-full text-sm font-bold py-2 bg-muted text-muted-foreground rounded-xl hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-auto"
        >
          {isMessaging && <Loader2 className="w-4 h-4 animate-spin" />}
          Enviar Mensagem
        </button>
      </div>
    </div>
  );
}
