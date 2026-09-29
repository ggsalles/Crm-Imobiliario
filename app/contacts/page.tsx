"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Users, 
  Plus, 
  Loader2,
  Download,
  Upload
} from "lucide-react";
import { ImportContactsModal } from "@/components/contacts/ImportContactsModal";
import { recordAuditEvent } from "@/lib/audit";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Contact, 
  UserProfile, 
  Company, 
  subscribeToContacts, 
  subscribeToUsers, 
  subscribeToCompanies, 
  createContact, 
  updateContact, 
  deleteContact, 
  createTimelineEvent,
  findOrCreateConversation,
  createUserProfile,
  isEmailRegistered,
  getCachedContacts
} from "@/lib/db";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";

import { ContactCard } from "@/components/contacts/list/ContactCard";
import { UserMemberCard } from "@/components/contacts/list/UserMemberCard";
import { ContactsFilterBar } from "@/components/contacts/list/ContactsFilterBar";
import { ContactFormModal } from "@/components/contacts/list/ContactFormModal";

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
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const cached = getCachedContacts();
    return cached && cached.length > 0 ? cached : [];
  });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(() => {
    const cached = getCachedContacts();
    return !(cached && cached.length > 0);
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isMessaging, setIsMessaging] = useState<string | null>(null);
  const [displayPhone, setDisplayPhone] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedTemperature, setSelectedTemperature] = useState<'all' | 'quente' | 'morno' | 'frio'>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');

  // Reset pagination on search or filter change
  useEffect(() => {
    setVisibleCount(12);
  }, [searchQuery, activeTab, selectedTemperature, selectedSource]);

  useEffect(() => {
    if (isModalOpen) {
      setDisplayPhone(editingContact?.phone || "");
    } else {
      setDisplayPhone("");
    }
  }, [isModalOpen, editingContact]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;

    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    const existing = getCachedContacts(ownerId);
    if (!existing || existing.length === 0) {
      setLoading(true);
    }

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
        router.replace('/contacts');
      }
    }
  }, [editId, contacts, router]);

  // Indexed companies map for O(1) resolution
  const companiesMap = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies]);

  // Memoized tab counts
  const clientCount = useMemo(() => contacts.filter(c => c.type === 'cliente').length, [contacts]);
  const teamCount = useMemo(() => {
    const otherUsers = users.filter(u => 
      u.id !== user?.id && (!user?.email || u.email?.toLowerCase().trim() !== user?.email?.toLowerCase().trim())
    );
    const registeredEmails = new Set(users.map(u => (u.email || '').toLowerCase().trim()));
    const manualTeamContacts = contacts.filter(c => 
      c.type === 'equipe' && (!c.email || !registeredEmails.has(c.email.toLowerCase().trim()))
    );
    return otherUsers.length + manualTeamContacts.length;
  }, [contacts, users, user?.id, user?.email]);

  // Memoized temperature distribution counts
  const temperatureCounts = useMemo(() => {
    let quente = 0, morno = 0, frio = 0;
    contacts.forEach(c => {
      if (c.type === 'cliente') {
        if (c.temperature === 'quente') quente++;
        else if (c.temperature === 'morno') morno++;
        else if (c.temperature === 'frio') frio++;
      }
    });
    return { quente, morno, frio };
  }, [contacts]);

  // Available unique sources for quick filtering
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => {
      if (c.type === 'cliente' && c.source) set.add(c.source);
    });
    return Array.from(set).sort();
  }, [contacts]);

  // Memoized contacts filter
  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const registeredEmails = new Set(users.map(u => (u.email || '').toLowerCase().trim()));
    return contacts.filter(c => {
      if (c.type !== activeTab) return false;
      if (activeTab === 'equipe' && c.email && registeredEmails.has(c.email.toLowerCase().trim())) {
        return false;
      }
      if (activeTab === 'cliente') {
        if (selectedTemperature !== 'all' && c.temperature !== selectedTemperature) return false;
        if (selectedSource !== 'all' && c.source !== selectedSource) return false;
      }
      if (!q) return true;
      return (
        (c.name || "").toLowerCase().includes(q) || 
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.source || "").toLowerCase().includes(q)
      );
    });
  }, [contacts, activeTab, selectedTemperature, selectedSource, searchQuery, users]);

  // Paginated contacts for optimal rendering
  const displayedContacts = useMemo(() => {
    return filteredContacts.slice(0, visibleCount);
  }, [filteredContacts, visibleCount]);

  // Memoized users filter (oculta a conta master/logada)
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter(u => {
      if (u.id === user?.id || (user?.email && u.email?.toLowerCase().trim() === user?.email?.toLowerCase().trim())) {
        return false;
      }
      if (!q) return true;
      return (
        (u.displayName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    });
  }, [users, user?.id, user?.email, searchQuery]);

  const handleExportContacts = useCallback(() => {
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
  }, [filteredContacts, activeTab]);

  const confirmDeleteContact = useCallback(async () => {
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
  }, [contactToDelete, editingContact]);

  const handleMessage = useCallback(async (target: any, type: 'cliente' | 'equipe') => {
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
  }, [user, router]);

  const handleEditContact = useCallback((contact: Contact) => {
    setEditingContact(contact);
    setIsModalOpen(true);
  }, []);

  const handleDeletePrompt = useCallback((contact: Contact) => {
    setContactToDelete(contact);
  }, []);

  const handleSave = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
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
      setIsModalOpen(false);
      setEditingContact(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar contato.");
    }
  }, [activeTab, editingContact]);

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
                onClick={() => setIsImportModalOpen(true)}
                className="bg-card hover:bg-muted text-foreground border border-border px-3 py-2 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs cursor-pointer"
                title="Importar leads e contatos de planilhas CSV com deduplicação"
              >
                <Upload className="w-3.5 h-3.5 text-primary" />
                Importar (CSV)
              </button>

              <button
                onClick={handleExportContacts}
                className="bg-card hover:bg-muted text-foreground border border-border px-3 py-2 rounded-xl font-bold shadow-xs transition-all flex items-center gap-1.5 text-xs cursor-pointer"
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
                  "bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold shadow-md hover:shadow-primary/20 transition-all flex items-center gap-1.5 text-xs cursor-pointer",
                  activeTab === 'equipe' && profile?.role !== 'Admin' && "hidden"
                )}
              >
                <Plus className="w-4 h-4" />
                {activeTab === 'cliente' ? 'Novo Cliente' : 'Novo Membro'}
              </button>
            </div>
          </header>

          {/* Navigation & Search bar & Filters */}
          <ContactsFilterBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            clientCount={clientCount}
            teamCount={teamCount}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedTemperature={selectedTemperature}
            setSelectedTemperature={setSelectedTemperature}
            temperatureCounts={temperatureCounts}
            selectedSource={selectedSource}
            setSelectedSource={setSelectedSource}
            availableSources={availableSources}
          />

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {loading ? (
              <div className="col-span-full py-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Regular Contacts (Clients or Team) */}
                {displayedContacts.map((contact) => (
                  <ContactCard 
                    key={contact.id} 
                    contact={contact} 
                    companyName={companiesMap.get(contact.companyId || '')?.name}
                    onEdit={handleEditContact}
                    onDelete={handleDeletePrompt}
                    isActiveTabEquipe={activeTab === 'equipe'}
                    onMessage={handleMessage}
                    isMessaging={isMessaging === contact.id}
                  />
                ))}

                {/* Team Members (Registered Users) */}
                {activeTab === 'equipe' && filteredUsers.map((userProfile) => (
                  <UserMemberCard 
                    key={userProfile.id} 
                    user={userProfile} 
                    isCurrentUser={userProfile.id === user?.id}
                    onMessage={handleMessage}
                    isMessaging={isMessaging === userProfile.id}
                  />
                ))}

                {displayedContacts.length === 0 && (activeTab === 'cliente' || filteredUsers.length === 0) && (
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

          {/* Pagination Controls */}
          {filteredContacts.length > displayedContacts.length && (
            <div className="flex justify-center pt-2 pb-6">
              <button
                onClick={() => setVisibleCount(prev => prev + 12)}
                className="px-5 py-2.5 rounded-xl bg-card border border-border hover:bg-muted font-bold text-xs text-foreground transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                Carregar mais contatos ({filteredContacts.length - displayedContacts.length} restantes)
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Criação / Edição de Contato */}
      <ContactFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingContact={editingContact}
        activeTab={activeTab}
        displayPhone={displayPhone}
        setDisplayPhone={setDisplayPhone}
        onSave={handleSave}
        onDeleteRequest={handleDeletePrompt}
      />

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

      {/* Modal de Importação de Leads e Contatos via CSV */}
      <ImportContactsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingContacts={contacts}
        onImportComplete={() => {
          // Automatic sync via subscription
        }}
      />
    </div>
  );
}
