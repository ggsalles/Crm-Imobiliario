"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  FileCheck2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Plus, 
  Trash2, 
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";
import { Deal, createTimelineEvent } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { safeGetItem, safeSetItem } from "@/lib/safe-storage";
import { toast } from "sonner";

export interface DocItem {
  id: string;
  name: string;
  category: "comprador" | "imovel" | "vendedor";
  status: "pendente" | "em_analise" | "aprovado" | "dispensado";
  note?: string;
  updatedAt?: string;
}

const DEFAULT_DOCUMENTS: Omit<DocItem, "id">[] = [
  // Comprador
  { name: "RG / CNH e CPF dos Proponentes", category: "comprador", status: "pendente" },
  { name: "Comprovante de Residência Atualizado (< 60 dias)", category: "comprador", status: "pendente" },
  { name: "Comprovante de Renda / 3 Holerites / Declaração IRPF", category: "comprador", status: "pendente" },
  { name: "Certidão de Estado Civil (Nascimento / Casamento)", category: "comprador", status: "pendente" },
  // Imóvel & Vendedor
  { name: "Certidão de Matrícula Atualizada de Inteiro Teor c/ Ônus", category: "imovel", status: "pendente" },
  { name: "Certidão Negativa de Débitos de IPTU / Enfitêutica", category: "imovel", status: "pendente" },
  { name: "Declaração de Quitação Condominial assinada pelo Síndico", category: "imovel", status: "pendente" },
  { name: "Certidões dos Distribuidores Cíveis, Trabalhistas e Federais", category: "vendedor", status: "pendente" },
];

interface DealDocumentsChecklistProps {
  deal: Deal;
  onUpdate?: () => void;
}

export function DealDocumentsChecklist({ deal, onUpdate }: DealDocumentsChecklistProps) {
  const storageKey = `deal_documents_${deal.id}`;
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocCategory, setNewDocCategory] = useState<"comprador" | "imovel" | "vendedor">("comprador");
  const [expanded, setExpanded] = useState(true);

  // Load from safeStorage or initialize with defaults
  useEffect(() => {
    const saved = safeGetItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDocuments(parsed);
          return;
        }
      } catch (err) {
        console.warn("Could not parse saved deal documents", err);
      }
    }

    // Initialize defaults
    const initial = DEFAULT_DOCUMENTS.map((doc, idx) => ({
      ...doc,
      id: `doc-${idx + 1}`,
      updatedAt: new Date().toISOString(),
    }));
    setDocuments(initial);
    safeSetItem(storageKey, JSON.stringify(initial));
  }, [deal.id, storageKey]);

  // Save documents state
  const saveDocuments = (updated: DocItem[]) => {
    setDocuments(updated);
    safeSetItem(storageKey, JSON.stringify(updated));
    if (onUpdate) onUpdate();
  };

  // Progress computation
  const stats = useMemo(() => {
    const total = documents.length;
    if (total === 0) return { total: 0, approved: 0, pending: 0, inReview: 0, percent: 0 };

    const approved = documents.filter(d => d.status === "aprovado" || d.status === "dispensado").length;
    const inReview = documents.filter(d => d.status === "em_analise").length;
    const pending = documents.filter(d => d.status === "pendente").length;
    const percent = Math.round((approved / total) * 100);

    return { total, approved, pending, inReview, percent };
  }, [documents]);

  // Update status of single document
  const handleUpdateStatus = (id: string, status: DocItem["status"]) => {
    const item = documents.find(d => d.id === id);
    const updated = documents.map(d => {
      if (d.id === id) {
        return { ...d, status, updatedAt: new Date().toISOString() };
      }
      return d;
    });

    saveDocuments(updated);

    if (item && item.status !== status) {
      const statusLabels = {
        pendente: "Pendente",
        em_analise: "Em Análise",
        aprovado: "Aprovado",
        dispensado: "Dispensado"
      };

      toast.success(`Documento "${item.name}" atualizado para: ${statusLabels[status]}`);

      // Record in deal timeline if approved
      if (status === "aprovado") {
        createTimelineEvent({
          type: "system",
          category: "deal",
          relatedId: deal.id,
          title: "Documento Aprovado na Due Diligence",
          content: `O documento "${item.name}" foi validado e marcado como Aprovado.`,
        }).catch(console.warn);
      }

      recordAuditEvent({
        action: "UPDATE_DEAL_DOCUMENT",
        title: "Atualização de Documento do Negócio",
        content: `Documento "${item.name}" atualizado para ${statusLabels[status]} na negociação "${deal.title}".`,
        severity: "info",
        category: "modification",
        relatedId: deal.id,
        entityType: "deal"
      });
    }
  };

  // Update note
  const handleUpdateNote = (id: string, note: string) => {
    const updated = documents.map(d => {
      if (d.id === id) {
        return { ...d, note, updatedAt: new Date().toISOString() };
      }
      return d;
    });
    saveDocuments(updated);
  };

  // Add custom doc
  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;

    const newDoc: DocItem = {
      id: `doc-custom-${Date.now()}`,
      name: newDocName.trim(),
      category: newDocCategory,
      status: "pendente",
      updatedAt: new Date().toISOString(),
    };

    const updated = [...documents, newDoc];
    saveDocuments(updated);
    setNewDocName("");
    setIsAddingDoc(false);
    toast.success("Documento adicionado ao checklist!");
  };

  // Delete document
  const handleDeleteDoc = (id: string) => {
    const updated = documents.filter(d => d.id !== id);
    saveDocuments(updated);
    toast.info("Documento removido do checklist.");
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-xs transition-colors">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Due Diligence & Documentos
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Checklist de conformidade jurídica para fechamento
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${stats.percent === 100 ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-primary/10 text-primary border-primary/20"}`}>
            {stats.percent}% Concluído
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-border/40 h-1.5 overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${stats.percent === 100 ? "bg-emerald-500" : "bg-primary"}`}
          style={{ width: `${stats.percent}%` }}
        />
      </div>

      {expanded && (
        <div className="p-3.5 sm:p-4 space-y-3.5">
          {/* Summary Pills */}
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground pb-1">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" /> {stats.approved} Aprovados
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <Clock className="w-3.5 h-3.5" /> {stats.inReview} Em Análise
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5" /> {stats.pending} Pendentes
              </span>
            </div>
            
            <button
              onClick={() => setIsAddingDoc(!isAddingDoc)}
              className="text-primary hover:underline flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Adicionar Documento
            </button>
          </div>

          {/* Add Doc Form */}
          {isAddingDoc && (
            <form onSubmit={handleAddDocument} className="p-3 bg-muted/40 rounded-xl border border-border space-y-2 animate-in fade-in duration-150">
              <div className="text-xs font-bold text-foreground">Novo Documento Requerido</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Nome do documento ou certidão..."
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  className="sm:col-span-2 text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 font-medium"
                />
                <select
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value as any)}
                  className="text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 font-medium"
                >
                  <option value="comprador">Comprador</option>
                  <option value="imovel">Imóvel</option>
                  <option value="vendedor">Vendedor</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingDoc(false)}
                  className="px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-md shadow-xs hover:opacity-90"
                >
                  Salvar
                </button>
              </div>
            </form>
          )}

          {/* Document list */}
          <div className="space-y-2">
            {documents.map((doc) => {
              return (
                <div
                  key={doc.id}
                  className="p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0">
                      {doc.status === "aprovado" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : doc.status === "em_analise" ? (
                        <Clock className="w-4 h-4 text-amber-500" />
                      ) : doc.status === "dispensado" ? (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-muted-foreground/60" />
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground truncate">{doc.name}</span>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/50">
                          {doc.category === "comprador" ? "Comprador" : doc.category === "imovel" ? "Imóvel" : "Vendedor"}
                        </span>
                      </div>
                      
                      {/* Optional note or protocol input */}
                      <input
                        type="text"
                        placeholder="Adicionar protocolo, cartório ou observação..."
                        value={doc.note || ""}
                        onChange={(e) => handleUpdateNote(doc.id, e.target.value)}
                        className="w-full text-[10px] text-muted-foreground bg-transparent border-0 focus:ring-0 p-0 placeholder:text-muted-foreground/40 mt-0.5"
                      />
                    </div>
                  </div>

                  {/* Actions & Status Dropdown */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <select
                      value={doc.status}
                      onChange={(e) => handleUpdateStatus(doc.id, e.target.value as any)}
                      className={`text-[10px] font-bold rounded-md px-2 py-1 border transition-colors cursor-pointer ${
                        doc.status === "aprovado"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : doc.status === "em_analise"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : doc.status === "dispensado"
                          ? "bg-muted text-muted-foreground border-border"
                          : "bg-card text-foreground border-border"
                      }`}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="em_analise">Em Análise</option>
                      <option value="aprovado">Aprovado</option>
                      <option value="dispensado">Dispensado</option>
                    </select>

                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1 hover:bg-muted text-muted-foreground hover:text-red-500 rounded transition-colors"
                      title="Remover documento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
