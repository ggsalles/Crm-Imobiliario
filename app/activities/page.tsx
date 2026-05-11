"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Phone, 
  Mail, 
  Users, 
  Briefcase,
  Trash2,
  Pencil,
  X,
  Filter
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { 
  Activity, 
  subscribeToActivities, 
  createActivity, 
  updateActivity, 
  deleteActivity,
  subscribeToContacts,
  subscribeToDeals,
  Contact,
  Deal
} from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function ActivitiesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    type: 'task' as Activity['type'],
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    contactId: "",
    dealId: "",
    description: ""
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;

    setLoading(true);
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsubActivities = subscribeToActivities((data) => {
      setActivities(data);
      setLoading(false);
    }, ownerId);
    const unsubContacts = subscribeToContacts(setContacts, ownerId);
    const unsubDeals = subscribeToDeals(setDeals, ownerId);

    return () => {
      unsubActivities();
      unsubContacts();
      unsubDeals();
    };
  }, [user, profile]);

  const handleOpenAddModal = () => {
    setEditingActivity(null);
    setFormData({
      title: "",
      type: 'task',
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      contactId: "",
      dealId: "",
      description: ""
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (activity: Activity) => {
    setEditingActivity(activity);
    setFormData({
      title: activity.title,
      type: activity.type,
      date: format(new Date(activity.date), "yyyy-MM-dd'T'HH:mm"),
      contactId: activity.contactId || "",
      dealId: activity.dealId || "",
      description: activity.description || ""
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    const activityData = {
      title: formData.title,
      type: formData.type,
      date: new Date(formData.date).toISOString(),
      contactId: formData.contactId || undefined,
      dealId: formData.dealId || undefined,
      description: formData.description || undefined,
    };

    if (editingActivity) {
      await updateActivity(editingActivity.id, activityData);
    } else {
      await createActivity({
        ...activityData,
        status: 'pending',
      });
    }

    setIsAddModalOpen(false);
  };

  const toggleStatus = async (activity: Activity) => {
    await updateActivity(activity.id, {
      status: activity.status === 'completed' ? 'pending' : 'completed'
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta atividade?")) {
      await deleteActivity(id);
    }
  };

  const filteredActivities = activities.filter(a => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  useEffect(() => {
    if (!isAddModalOpen) {
      setDeleteConfirmId(null);
    }
  }, [isAddModalOpen]);

  if (authLoading || !user) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Atividades</h1>
              <p className="text-slate-500 font-medium mt-1">Gerencie suas tarefas, chamadas e reuniões</p>
            </div>
            <button 
              onClick={handleOpenAddModal}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 hover:scale-105 transition-all"
            >
              <Plus className="w-5 h-5" />
              Nova Atividade
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-8">
            {(['all', 'pending', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                  filter === f 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/10" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Concluídas'}
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-500 font-bold">Carregando atividades...</p>
            </div>
          ) : filteredActivities.length > 0 ? (
            <div className="space-y-4">
              {filteredActivities.map((activity) => {
                const contact = contacts.find(c => c.id === activity.contactId);
                const deal = deals.find(d => d.id === activity.dealId);
                
                return (
                  <div 
                    key={activity.id}
                    className={cn(
                      "group bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-6 transition-all hover:bg-slate-50/50",
                      activity.status === 'completed' && "opacity-60"
                    )}
                  >
                    <button 
                      onClick={() => toggleStatus(activity)}
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                        activity.status === 'completed' 
                          ? "bg-emerald-500 text-white" 
                          : "border-2 border-slate-200 text-slate-200 group-hover:border-blue-300 group-hover:text-blue-300"
                      )}
                    >
                      {activity.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </button>

                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className={cn(
                          "text-lg font-bold text-slate-900",
                          activity.status === 'completed' && "line-through text-slate-400"
                        )}>
                          {activity.title}
                        </h3>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider",
                          activity.type === 'call' ? "bg-blue-50 text-blue-600" :
                          activity.type === 'meeting' ? "bg-purple-50 text-purple-600" :
                          activity.type === 'email' ? "bg-orange-50 text-orange-600" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {activity.type}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(activity.date), "dd MMM, yyyy", { locale: ptBR })}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 border-l pl-4">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(activity.date), "HH:mm")}
                        </div>
                        {contact && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 border-l pl-4">
                            <Users className="w-3.5 h-3.5" />
                            {contact.name}
                          </div>
                        )}
                        {deal && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 border-l pl-4">
                            <Briefcase className="w-3.5 h-3.5" />
                            {deal.title}
                          </div>
                        )}
                      </div>
                      {activity.description && (
                        <p className="text-sm text-slate-500 mt-3 font-medium">{activity.description}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleOpenEditModal(activity)}
                        className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                        title="Editar"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(activity.id)}
                        className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        title="Excluir"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-[32px] border border-dashed border-slate-200 py-32 text-center">
              <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-6" />
              <h3 className="text-xl font-bold text-slate-900">Nenhuma atividade encontrada</h3>
              <p className="text-slate-500 font-medium mt-2">Relaxe! Você está em dia com suas tarefas.</p>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="mt-8 bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-900/20 hover:scale-105 transition-all"
              >
                Criar Minha Primeira Atividade
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-xl rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {editingActivity ? 'Editar Atividade' : 'Nova Atividade'}
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Título</label>
                <input 
                  autoFocus
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Ligar para prospecto..."
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-blue-500 focus:bg-white outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipo</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-blue-500 focus:bg-white outline-none transition-all"
                  >
                    <option value="task">Tarefa</option>
                    <option value="call">Chamada</option>
                    <option value="meeting">Reunião</option>
                    <option value="email">E-mail</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Data/Hora</label>
                  <input 
                    type="datetime-local"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-blue-500 focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Lead/Contato</label>
                  <select 
                    value={formData.contactId}
                    onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-blue-500 focus:bg-white outline-none transition-all"
                  >
                    <option value="">Nenhum</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Negócio</label>
                  <select 
                    value={formData.dealId}
                    onChange={(e) => setFormData({ ...formData, dealId: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-blue-500 focus:bg-white outline-none transition-all"
                  >
                    <option value="">Nenhum</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Observações</label>
                <textarea 
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-slate-900 font-medium focus:border-blue-500 focus:bg-white outline-none transition-all"
                />
              </div>

              <div className="flex gap-4 pt-4">
                {editingActivity && (
                  <button 
                    type="button"
                    onClick={() => {
                      if (deleteConfirmId === editingActivity.id) {
                        handleDelete(editingActivity.id);
                        setIsAddModalOpen(false);
                      } else {
                        setDeleteConfirmId(editingActivity.id);
                      }
                    }}
                    className={cn(
                      "px-6 py-4 border-2 rounded-2xl font-bold transition-all font-sans",
                      deleteConfirmId === editingActivity.id
                        ? "bg-red-500 text-white border-red-500 hover:bg-red-600"
                        : "border-red-50 text-red-500 hover:bg-red-50"
                    )}
                    title={deleteConfirmId === editingActivity.id ? "Clique para confirmar" : "Excluir atividade"}
                  >
                    {deleteConfirmId === editingActivity.id ? "Confirmar?" : <Trash2 className="w-5 h-5" />}
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-8 py-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all font-sans"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-900/20 hover:opacity-90 transition-all font-sans"
                >
                  {editingActivity ? 'Salvar Alterações' : 'Salvar Atividade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

