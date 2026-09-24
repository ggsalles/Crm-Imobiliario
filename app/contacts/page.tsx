"use client";

export const dynamic = 'force-dynamic';

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
  Building2,
  Download
} from "lucide-react";
import { recordAuditEvent } from "@/lib/audit";
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
  findOrCreateConversation,
  createUserProfile,
  isEmailRegistered
} from "@/lib/db";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

import { Suspense } from "react";

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background">
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
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isDeletingContact, setIsDeletingContact] = useState(false);
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

  const handleExportContacts = () => {
    if (filteredContacts.length === 0) {
      toast.info("Nenhum contato para exportar.");
      return;
    }

    const headers = ["Nome", "Email", "Telefone", "Tipo", "Origem", "Temperatura"];
    const rows = filteredContacts.map(c => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${c.type || ''}"`,
      `"${(c.source || '').replace(/"/g, '""')}"`,
      `"${c.temperature || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contatos-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    recordAuditEvent({
      action: 'EXPORT_LEADS',
      title: 'Exportação de Base de Leads (CSV)',
      content: `Usuário exportou planilha CSV contendo ${filteredContacts.length} ${activeTab === 'cliente' ? 'leads/clientes' : 'membros da equipe'}.`,
      severity: 'critical',
      category: 'export',
      entityType: 'contact',
      metadata: {
        count: filteredContacts.length,
        tab: activeTab
      }
    });

    toast.success(`${filteredContacts.length} contatos exportados (ação registrada na auditoria).`);
  };

  const confirmDeleteContact = async () => {
    if (!contactToDelete) return;
    const targetContact = contactToDelete;
    const id = targetContact.id;

    setIsDeletingContact(true);
    const toastId = toast.loading("Excluindo contato...");
    setContacts(prev => prev.filter(c => c.id !== id));

    try {
      await deleteContact(id);

      recordAuditEvent({
        action: 'DELETE_CONTACT',
        title: 'Exclusão de Contato',
        content: `Contato "${targetContact?.name || id}" (${targetContact?.email || 'sem email'}) foi excluído.`,
        severity: 'critical',
        category: 'deletion',
        relatedId: id,
        entityType: 'contact',
        metadata: {
          contactName: targetContact?.name,
          contactEmail: targetContact?.email
        }
      });

      toast.success("Contato excluído com sucesso!", { id: toastId });
      setContactToDelete(null);

      if (editingContact && editingContact.id === id) {
        setIsModalOpen(false);
        setEditingContact(null);
      }
    } catch (err: any) {
      console.error("Error deleting contact:", err);
      setContacts(prev => [...prev, targetContact]);
      const errorMessage = err?.message || "Erro ao excluir contato.";
      toast.error(`Erro: ${errorMessage}`, { id: toastId });
    } finally {
      setIsDeletingContact(false);
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
      role: activeTab === 'cliente' ? undefined : formData.get('role') as string,
      type: activeTab,
      companyId: activeTab === 'cliente' ? undefined : formData.get('companyId') as string,
      source: activeTab === 'cliente' ? formData.get('source') as string : undefined,
      department: activeTab === 'equipe' ? formData.get('department') as string : undefined,
      temperature: activeTab === 'cliente' ? formData.get('temperature') as 'quente' | 'morno' | 'frio' : undefined,
    };

    try {
      if (editingContact) {
        await updateContact(editingContact.id, data);
        
        recordAuditEvent({
          action: 'UPDATE_CONTACT',
          title: 'Edição de Dados de Contato',
          content: `Dados do contato "${data.name}" foram atualizados.`,
          severity: 'medium',
          category: 'modification',
          relatedId: editingContact.id,
          entityId: editingContact.id,
          entityType: 'contact',
          metadata: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            type: activeTab
          }
        });

        // Track temperature change for timeline
        if (activeTab === 'cliente' && editingContact.temperature !== data.temperature) {
          const tempLabels: Record<string, string> = {
            quente: "🔥 Quente",
            morno: "⚡ Morno",
            frio: "❄️ Frio"
          };
          const newLabel = tempLabels[data.temperature || 'morno'] || '⚡ Morno';
          await createTimelineEvent({
            type: 'system',
            category: 'contact',
            relatedId: editingContact.id,
            content: `Temperatura do Lead atualizada para: ${newLabel}`,
            title: 'Temperatura Atualizada',
            metadata: { type: 'temperature_update', from: editingContact.temperature, to: data.temperature }
          });
        }
        
        toast.success("Contato atualizado!");
      } else {
        // If creating a team member, also create a profile entry
        if (activeTab === 'equipe') {
          const emailExists = await isEmailRegistered(data.email);
          if (emailExists) {
            toast.error("Este e-mail já está vinculado a um usuário cadastrado.");
            return;
          }

          await createUserProfile({
            displayName: data.name,
            email: data.email,
            role: (data.role?.toLowerCase().includes('admin') ? 'Admin' : 'Membro') as 'Admin' | 'Membro',
            userType: 'funcionário'
          });
          
          toast.success("Membro da equipe convidado e perfil criado!");
        }

        const contactId = await createContact(data);
        if (contactId) {
          recordAuditEvent({
            action: 'CREATE_CONTACT',
            title: 'Cadastro de Novo Contato',
            content: `Novo contato "${data.name}" (${data.email || 'sem email'}) cadastrado.`,
            severity: 'info',
            category: 'modification',
            relatedId: contactId,
            entityId: contactId,
            entityType: 'contact',
            metadata: {
              name: data.name,
              email: data.email,
              phone: data.phone,
              type: activeTab
            }
          });

          await createTimelineEvent({
            type: 'system',
            category: 'contact',
            relatedId: contactId,
            content: `Contato "${data.name}" criado no sistema.`,
            title: 'Criação de Contato',
            metadata: { type: 'creation' }
          });
        }
        if (activeTab !== 'equipe') toast.success("Contato criado!");
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
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 p-3 sm:p-4 md:p-5 pt-16 md:pt-6 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-5">
          <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">
                {activeTab === 'cliente' ? 'Meus Clientes' : 'Minha Equipe'}
              </h1>
              <p className="text-muted-foreground mt-0.5 text-xs md:text-sm font-medium">
                {activeTab === 'cliente' 
                  ? 'Gerencie sua base de clientes e leads externos.' 
                  : 'Veja os membros da sua organização e seus cargos.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportContacts}
                className="bg-card hover:bg-muted text-foreground border border-border px-3 py-2 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs"
                title="Exportar dados com registro de auditoria LGPD"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                Exportar (CSV)
              </button>

              <button 
                onClick={() => {
                  setEditingContact(null);
                  setIsModalOpen(true);
                }}
                className={cn(
                  "bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold shadow-md hover:shadow-primary/20 transition-all flex items-center gap-1.5 text-xs",
                  activeTab === 'equipe' && profile?.role !== 'Admin' && "hidden"
                )}
              >
                <Plus className="w-4 h-4" />
                {activeTab === 'cliente' ? 'Novo Cliente' : 'Novo Membro'}
              </button>
            </div>
          </header>

          {/* Navigation & Search bar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="bg-card p-1 rounded-xl border border-border flex gap-1 shadow-xs shrink-0">
              <button 
                onClick={() => setActiveTab('cliente')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all",
                  activeTab === 'cliente' ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <UserCircle className="w-3.5 h-3.5" />
                Clientes
              </button>
              <button 
                onClick={() => setActiveTab('equipe')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all",
                  activeTab === 'equipe' ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Equipe
              </button>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder={`Pesquisar em ${activeTab === 'cliente' ? 'clientes' : 'equipe'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-card border border-border text-foreground rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
              />
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {loading ? (
              <div className="col-span-full py-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                    onDelete={() => setContactToDelete(contact)}
                    isActiveTabEquipe={activeTab === 'equipe'}
                    onMessage={() => handleMessage(contact, activeTab === 'equipe' ? 'equipe' : 'cliente')}
                    isMessaging={isMessaging === contact.id}
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
                  <div className="col-span-full py-20 text-center bg-card rounded-3xl border border-dashed border-border flex flex-col items-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Users className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold">Nenhum contato encontrado</h3>
                    <p className="text-muted-foreground text-sm mt-1 font-medium">Tente ajustar sua pesquisa ou trocar de aba.</p>
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
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl p-5 md:p-6 w-full max-w-lg relative shadow-xl overflow-hidden border border-border"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              
              <h2 className="text-xl font-black tracking-tight mb-4">
                {editingContact ? 'Editar Contato' : `Novo ${activeTab === 'cliente' ? 'Cliente' : 'Membro'}`}
              </h2>

              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Nome Completo</label>
                    <input 
                      name="name"
                      required
                      defaultValue={editingContact?.name}
                      placeholder="Ex: Maria Oliveira"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">E-mail</label>
                    <input 
                      name="email"
                      type="email"
                      required
                      defaultValue={editingContact?.email}
                      placeholder="maria@exemplo.com"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Telefone</label>
                    <input 
                      name="phone"
                      value={displayPhone}
                      onChange={(e) => setDisplayPhone(formatPhone(e.target.value))}
                      placeholder="55 11 99999-9999"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>
                  {activeTab === 'cliente' ? (
                    <>
                      <div className="col-span-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Origem (Como chegou?)</label>
                        <select 
                          name="source"
                          defaultValue={editingContact?.source} 
                          className="w-full pl-3 pr-8 py-2 rounded-xl border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em] text-xs font-medium"
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                        >
                          <option value="" className="bg-card">Selecione uma origem</option>
                          <option value="Instagram" className="bg-card">Instagram</option>
                          <option value="WhatsApp" className="bg-card">WhatsApp</option>
                          <option value="Facebook" className="bg-card">Facebook</option>
                          <option value="Site" className="bg-card">Site / Landing Page</option>
                          <option value="Indicação" className="bg-card">Indicação</option>
                          <option value="Portal Imobiliário" className="bg-card">Portal Imobiliário</option>
                          <option value="Telefone" className="bg-card">Ligação Direta</option>
                          <option value="Outro" className="bg-card">Outro</option>
                        </select>
                      </div>

                      <div className="col-span-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Temperatura do Lead</label>
                        <select 
                          name="temperature"
                          defaultValue={
                            (editingContact as any)?.rawRole === 'manual_quente' ? 'quente' :
                            (editingContact as any)?.rawRole === 'manual_morno' ? 'morno' :
                            (editingContact as any)?.rawRole === 'manual_frio' ? 'frio' : 'auto'
                          } 
                          className="w-full pl-3 pr-8 py-2 rounded-xl border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1em_1em] text-xs font-medium"
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(156, 163, 175, 0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                        >
                          <option value="auto" className="bg-card">🤖 Inteligente (Baseado no Funil)</option>
                          <option value="quente" className="bg-card">🔥 Forçar Quente</option>
                          <option value="morno" className="bg-card">⚡ Forçar Morno</option>
                          <option value="frio" className="bg-card">❄️ Forçar Frio</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Cargo / Função</label>
                        <input 
                          name="role"
                          defaultValue={editingContact?.role}
                          placeholder="Ex: Corretor Sênior"
                          className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 ml-1 block">Departamento</label>
                        <input 
                          name="department"
                          defaultValue={editingContact?.department}
                          placeholder="Ex: Vendas / Aluguel"
                          className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2 flex gap-2">
                  {editingContact && (
                    <button 
                      type="button"
                      onClick={() => setContactToDelete(editingContact)}
                      className="px-3 py-2 rounded-xl transition-all border text-red-500 hover:bg-red-500/10 border-red-500/20 flex items-center justify-center cursor-pointer"
                      title="Excluir este contato"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2 font-bold text-xs md:text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors border border-border"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2 font-bold text-xs md:text-sm bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all shadow-md shadow-primary/20"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão de Contato */}
      <ConfirmDeleteModal
        isOpen={!!contactToDelete}
        onClose={() => setContactToDelete(null)}
        onConfirm={confirmDeleteContact}
        title="Excluir Contato"
        itemName={contactToDelete?.name}
        itemType="contato"
        isDeleting={isDeletingContact}
      />
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
  isMessaging
}: { 
  contact: Contact, 
  companyName?: string, 
  onEdit: () => void, 
  onDelete: () => void, 
  isActiveTabEquipe: boolean, 
  onMessage: () => void, 
  isMessaging: boolean
}) {
  return (
    <div className="bg-card p-4 rounded-xl border border-border shadow-xs hover:shadow-md transition-all group h-full flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-3 gap-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base uppercase shrink-0",
              isActiveTabEquipe ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500"
            )}>
              {contact.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <h3 className="font-bold text-sm md:text-base truncate text-foreground" title={contact.name}>{contact.name}</h3>
                {!isActiveTabEquipe && contact.temperature && (
                  contact.temperature === 'quente' ? (
                    <span 
                      title={(contact as any).rawRole ? "Temperatura definida manualmente" : "Temperatura Inteligente: Negociação ou proposta ativa no funil"}
                      className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded relative select-none animate-pulse"
                    >
                      <span className="w-1 h-1 rounded-full bg-red-500 animate-ping inline-block" />
                      Quente
                    </span>
                  ) : contact.temperature === 'morno' ? (
                    <span 
                      title={(contact as any).rawRole ? "Temperatura definida manualmente" : "Temperatura Inteligente: Oportunidade em qualificação"}
                      className="inline-flex items-center gap-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded select-none"
                    >
                      Morno
                    </span>
                  ) : (
                    <span 
                      title={(contact as any).rawRole ? "Temperatura definida manualmente" : "Temperatura Inteligente: Sem oportunidades ativas no funil"}
                      className="inline-flex items-center gap-0.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded select-none"
                    >
                      Frio
                    </span>
                  )
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate font-medium">
                {isActiveTabEquipe ? contact.role : (contact.source ? `Origem: ${contact.source}` : 'Sem origem')}
              </p>
            </div>
          </div>
          <div className="flex gap-0.5 shrink-0 items-center">
            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation();
                onEdit(); 
              }} 
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all" 
              title="Editar"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation();
                onDelete();
              }} 
              className="p-1.5 rounded-lg transition-all text-muted-foreground hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
              title="Excluir contato"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>{contact.phone}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium border-t border-border pt-2">
            <Tag className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isActiveTabEquipe ? contact.department : (contact.source || 'Não informado')}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5">
        <Link 
          href={`/contacts/${contact.id}`}
          className={cn(
            "text-center text-xs font-bold py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-primary-foreground transition-all shadow-xs",
            isActiveTabEquipe ? "flex-1" : "w-full"
          )}
        >
          {isActiveTabEquipe ? 'Ver Detalhes' : 'Visão 360°'}
        </Link>
        {isActiveTabEquipe && (
          <button 
            onClick={onMessage}
            disabled={isMessaging}
            className="flex-1 text-center text-xs font-bold py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-primary hover:text-primary-foreground transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isMessaging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Mensagem
          </button>
        )}
      </div>
    </div>
  );
}

function UserCard({ user, onMessage, isMessaging }: { user: UserProfile, onMessage: () => void, isMessaging: boolean }) {
  return (
    <div className="bg-card p-4 rounded-xl border border-border shadow-xs hover:shadow-md transition-all group h-full flex flex-col justify-between border-primary/10">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center overflow-hidden border border-border relative">
              {user.photoURL ? (
                <Image src={user.photoURL} alt="Avatar" fill className="w-full h-full object-cover" referrerPolicy="no-referrer" unoptimized />
              ) : (
                <span className="font-bold text-base text-primary">{user.displayName.charAt(0)}</span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm md:text-base flex items-center gap-1.5 text-foreground">
                {user.displayName}
                <span className="bg-primary/10 text-primary text-[8px] uppercase px-1.5 py-0.5 rounded font-black">Membro</span>
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium">Membro da Organização</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-primary font-bold">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Conta Vinculada</span>
          </div>
        </div>

        <button 
          onClick={onMessage}
          disabled={isMessaging}
          className="w-full text-xs font-bold py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 mt-auto"
        >
          {isMessaging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Enviar Mensagem
        </button>
      </div>
    </div>
  );
}
