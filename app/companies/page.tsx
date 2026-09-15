"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Building2, 
  Search, 
  Plus, 
  Globe, 
  Tag, 
  X,
  Loader2,
  Trash2,
  Edit2,
  Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { 
  Company, 
  getCompanies,
  subscribeToCompanies, 
  createCompany, 
  updateCompany, 
  deleteCompany 
} from "@/lib/db";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";

export default function CompaniesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user || !profile) return;
    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    const data = await getCompanies(ownerId);
    setCompanies(data);
  };

  useEffect(() => {
    if (deleteConfirmId) {
      const timer = setTimeout(() => setDeleteConfirmId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirmId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;

    setLoading(true);
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsub = subscribeToCompanies((data) => {
      setCompanies(data);
      setLoading(false);
    }, ownerId);

    return () => unsub();
  }, [user, profile]);

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteCompany(id);
      toast.success("Empresa excluída!");
      setDeleteConfirmId(null);
      await fetchData();
    } catch (err) {
      toast.error("Erro ao excluir empresa.");
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      industry: formData.get('industry') as string,
      website: formData.get('website') as string,
    };

    try {
       if (editingCompany) {
        await updateCompany(editingCompany.id, data);
        toast.success("Empresa atualizada!");
      } else {
        await createCompany(data);
        toast.success("Empresa criada!");
      }
      await fetchData();
      setIsModalOpen(false);
      setEditingCompany(null);
    } catch (err) {
      toast.error("Erro ao salvar empresa.");
    }
  };

  if (authLoading) return null;

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      <Sidebar />
      <main className="flex-1 p-3 sm:p-4 md:p-5 pt-16 md:pt-6 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-5">
          <header className="flex justify-between items-center">
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">Empresas</h1>
              <p className="text-muted-foreground mt-0.5 text-xs md:text-sm font-medium">
                Gerencie as organizações que são suas clientes.
              </p>
            </div>
            <button 
              onClick={() => {
                setEditingCompany(null);
                setIsModalOpen(true);
              }}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[11px] shadow-md shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nova Empresa
            </button>
          </header>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Pesquisar empresas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-card text-foreground border border-border rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs transition-all font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {loading ? (
              <div className="col-span-full py-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredCompanies.map((company) => (
              <div key={company.id} className="bg-card p-4 rounded-xl border border-border shadow-xs hover:shadow-md transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold text-base text-muted-foreground">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm md:text-base tracking-tight">{company.name}</h3>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{company.industry || 'Setor não informado'}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      <button onClick={() => { setEditingCompany(company); setIsModalOpen(true); }} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button 
                        onClick={() => {
                          if (deleteConfirmId === company.id) {
                            handleDelete(company.id);
                          } else {
                            setDeleteConfirmId(company.id);
                          }
                        }} 
                        className={cn(
                          "p-1.5 rounded-lg transition-all",
                          deleteConfirmId === company.id 
                            ? "bg-red-500 text-white scale-105 shadow-xs" 
                            : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                        )}
                        title={deleteConfirmId === company.id ? "Clique novamente para confirmar" : "Excluir"}
                      >
                        <Trash2 className={cn("w-3.5 h-3.5", deleteConfirmId === company.id && "animate-pulse")} />
                      </button>
                    </div>
                  </div>
                  {company.website && (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline mb-3">
                      <Globe className="w-3.5 h-3.5" />
                      <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer">
                        {company.website}
                      </a>
                    </div>
                  )}
                </div>
                <button className="w-full text-[9px] font-black uppercase tracking-widest py-2 bg-muted text-muted-foreground rounded-lg hover:bg-primary/10 hover:text-primary transition-all">Ver Contatos</button>
              </div>
            ))}
            {!loading && filteredCompanies.length === 0 && (
              <div className="col-span-full py-16 text-center bg-card rounded-2xl border border-border border-dashed flex flex-col items-center">
                <Building2 className="w-10 h-10 text-muted-foreground mb-3 opacity-20" />
                <h3 className="text-base md:text-lg font-black tracking-tight">Nenhuma empresa encontrada</h3>
                <p className="text-muted-foreground text-xs mt-1 font-medium">Cadastre sua primeira empresa para começar.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-5 md:p-6 w-full max-w-lg relative shadow-xl overflow-hidden"
            >
              <button onClick={() => setIsModalOpen(false)} className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-primary/10 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              <h2 className="text-xl font-black mb-4 tracking-tight">{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</h2>
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 ml-1 block">Nome da Empresa</label>
                  <input name="name" required defaultValue={editingCompany?.name} placeholder="Ex: Tech Solutions Ltda" className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 ml-1 block">Setor / Atividade</label>
                  <input name="industry" defaultValue={editingCompany?.industry} placeholder="Ex: Tecnologia da Informação" className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 ml-1 block">Website (opcional)</label>
                  <input name="website" defaultValue={editingCompany?.website} placeholder="www.empresa.com.br" className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-xs md:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="pt-2 flex gap-2">
                  {editingCompany && (
                    <button 
                      type="button" 
                      onClick={() => { 
                        if (deleteConfirmId === editingCompany.id) {
                          handleDelete(editingCompany.id); 
                          setIsModalOpen(false);
                        } else {
                          setDeleteConfirmId(editingCompany.id);
                        }
                      }} 
                      className={cn(
                        "px-3 py-2 rounded-xl transition-all border",
                        deleteConfirmId === editingCompany.id 
                          ? "bg-red-500 text-white border-red-600 shadow-md shadow-red-500/20 scale-105" 
                          : "text-red-500 hover:bg-red-500/10 border-red-500/20"
                      )}
                      title={deleteConfirmId === editingCompany.id ? "Clique novamente para confirmar" : "Excluir empresa"}
                    >
                      <Trash2 className={cn("w-4 h-4", deleteConfirmId === editingCompany.id && "animate-pulse")} />
                    </button>
                  )}
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 font-black uppercase tracking-widest text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-2 font-black uppercase tracking-widest text-[11px] bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all shadow-md shadow-primary/30">Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
