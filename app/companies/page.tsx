"use client";

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
import { AnimatePresence, motion } from "framer-motion";

export default function CompaniesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const fetchData = async () => {
    if (!user || !profile) return;
    const ownerId = profile.role === 'Admin' ? undefined : user.id;
    const data = await getCompanies(ownerId);
    setCompanies(data);
  };

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
    if (confirm("Tem certeza que deseja excluir esta empresa? Isso não excluirá os contatos vinculados.")) {
      try {
        await deleteCompany(id);
        toast.success("Empresa excluída!");
        await fetchData();
      } catch (err) {
        toast.error("Erro ao excluir empresa.");
      }
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
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Empresas</h1>
              <p className="text-muted-foreground mt-1 text-sm font-medium">
                Gerencie as organizações que são suas clientes.
              </p>
            </div>
            <button 
              onClick={() => {
                setEditingCompany(null);
                setIsModalOpen(true);
              }}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nova Empresa
            </button>
          </header>

          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Pesquisar empresas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card text-foreground border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-md transition-all font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full py-20 flex justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : filteredCompanies.map((company) => (
              <div key={company.id} className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-lg transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center font-bold text-xl text-muted-foreground">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-lg tracking-tight">{company.name}</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{company.industry || 'Setor não informado'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingCompany(company); setIsModalOpen(true); }} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(company.id)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {company.website && (
                    <div className="flex items-center gap-2 text-sm text-primary font-bold hover:underline mb-4">
                      <Globe className="w-4 h-4" />
                      <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer">
                        {company.website}
                      </a>
                    </div>
                  )}
                </div>
                <button className="w-full text-[10px] font-black uppercase tracking-widest py-2.5 bg-muted text-muted-foreground rounded-xl hover:bg-primary/10 hover:text-primary transition-all">Ver Contatos</button>
              </div>
            ))}
            {!loading && filteredCompanies.length === 0 && (
              <div className="col-span-full py-20 text-center bg-card rounded-3xl border border-border border-dashed flex flex-col items-center">
                <Building2 className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <h3 className="text-xl font-black tracking-tight">Nenhuma empresa encontrada</h3>
                <p className="text-muted-foreground text-sm mt-1 font-medium">Cadastre sua primeira empresa para começar.</p>
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
              className="bg-card border border-border rounded-3xl p-6 md:p-8 w-full max-w-lg relative shadow-2xl overflow-hidden"
            >
              <button onClick={() => setIsModalOpen(false)} className="absolute right-6 top-6 p-2 rounded-full hover:bg-primary/10 transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              <h2 className="text-2xl font-black mb-6 tracking-tight">{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 ml-1 block">Nome da Empresa</label>
                  <input name="name" required defaultValue={editingCompany?.name} placeholder="Ex: Tech Solutions Ltda" className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 ml-1 block">Setor / Atividade</label>
                  <input name="industry" defaultValue={editingCompany?.industry} placeholder="Ex: Tecnologia da Informação" className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 ml-1 block">Website (opcional)</label>
                  <input name="website" defaultValue={editingCompany?.website} placeholder="www.empresa.com.br" className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="pt-4 flex gap-3">
                  {editingCompany && (
                    <button 
                      type="button" 
                      onClick={() => { handleDelete(editingCompany.id); setIsModalOpen(false); }} 
                      className="px-4 py-3 font-black text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors border border-red-500/20"
                      title="Excluir empresa"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-black uppercase tracking-widest text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-2xl transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 font-black uppercase tracking-widest text-xs bg-primary text-primary-foreground rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/30">Salvar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
