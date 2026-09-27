"use client";

import { useState, useRef, useMemo } from "react";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Download, 
  Users, 
  ArrowRight, 
  Check, 
  Loader2,
  RefreshCw,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Contact, createContact } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { toast } from "sonner";
import { formatPhone } from "@/lib/utils";

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingContacts: Contact[];
  onImportComplete: () => void;
}

interface ParsedRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  source: string;
  temperature: "quente" | "morno" | "frio";
  isDuplicate: boolean;
  duplicateReason?: string;
  isValid: boolean;
  validationError?: string;
}

export function ImportContactsModal({
  isOpen,
  onClose,
  existingContacts,
  onImportComplete,
}: ImportContactsModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<{
    name: number;
    phone: number;
    email: number;
    role: number;
    source: number;
    temperature: number;
  }>({
    name: -1,
    phone: -1,
    email: -1,
    role: -1,
    source: -1,
    temperature: -1,
  });

  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({ total: 0, imported: 0, skipped: 0, errors: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize phone for comparison
  const normalizePhone = (phoneStr: string) => {
    return phoneStr.replace(/\D/g, "");
  };

  // Map of existing contacts for quick deduplication check
  const existingEmailsSet = useMemo(() => {
    const set = new Set<string>();
    existingContacts.forEach((c) => {
      if (c.email) set.add(c.email.trim().toLowerCase());
    });
    return set;
  }, [existingContacts]);

  const existingPhonesSet = useMemo(() => {
    const set = new Set<string>();
    existingContacts.forEach((c) => {
      if (c.phone) {
        const clean = normalizePhone(c.phone);
        if (clean.length >= 8) set.add(clean.slice(-8)); // match last 8 digits
      }
    });
    return set;
  }, [existingContacts]);

  // Reset state on close
  const handleClose = () => {
    if (isImporting) return;
    setStep(1);
    setFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setImportProgress(0);
    onClose();
  };

  // Download Sample CSV template
  const handleDownloadTemplate = () => {
    const headers = ["Nome Completo", "Telefone", "E-mail", "Empresa ou Cargo", "Origem do Lead", "Temperatura"];
    const sampleRows = [
      ["Carlos Eduardo Silva", "(11) 98765-4321", "carlos.silva@exemplo.com.br", "Diretor / Tech Corp", "Portal Imobiliário", "quente"],
      ["Mariana Souza", "(21) 97654-3210", "mariana.souza@email.com", "Investidora", "Instagram", "morno"],
      ["Roberto Andrade", "(31) 99887-1122", "roberto@andrade.com.br", "Engenheiro Civil", "Indicação", "frio"],
      ["Fernanda Lima", "(41) 98877-6655", "fernanda.lima@advocacia.com", "Advogada", "Site Oficial", "quente"]
    ];

    const csvContent = "\uFEFF" + [
      headers.join(";"),
      ...sampleRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(";"))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "modelo_importacao_leads_crm.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Modelo CSV baixado! Preencha e importe.");
  };

  // Parse CSV content
  const parseCSV = (text: string) => {
    // Remove UTF-8 BOM if present
    const cleanText = text.replace(/^\uFEFF/, "");
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) {
      toast.error("O arquivo está vazio.");
      return;
    }

    // Detect delimiter: semicolon or comma
    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount >= commaCount ? ";" : ",";

    // Split function respecting RFC 4180 quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(cur.trim());
          cur = "";
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine).filter(r => r.some(cell => cell.length > 0));

    setRawHeaders(headers);
    setRawRows(rows);

    // Auto-detect column mapping
    const mapping = {
      name: -1,
      phone: -1,
      email: -1,
      role: -1,
      source: -1,
      temperature: -1,
    };

    headers.forEach((h, idx) => {
      const headerLower = h.toLowerCase().trim();
      if (mapping.name === -1 && (headerLower.includes("nome") || headerLower.includes("name") || headerLower.includes("cliente") || headerLower.includes("lead"))) {
        mapping.name = idx;
      } else if (mapping.phone === -1 && (headerLower.includes("tel") || headerLower.includes("cel") || headerLower.includes("phone") || headerLower.includes("whatsapp"))) {
        mapping.phone = idx;
      } else if (mapping.email === -1 && (headerLower.includes("mail") || headerLower.includes("e-mail"))) {
        mapping.email = idx;
      } else if (mapping.role === -1 && (headerLower.includes("cargo") || headerLower.includes("empresa") || headerLower.includes("role") || headerLower.includes("company"))) {
        mapping.role = idx;
      } else if (mapping.source === -1 && (headerLower.includes("origem") || headerLower.includes("fonte") || headerLower.includes("source") || headerLower.includes("canal"))) {
        mapping.source = idx;
      } else if (mapping.temperature === -1 && (headerLower.includes("temp") || headerLower.includes("qualificacao") || headerLower.includes("status"))) {
        mapping.temperature = idx;
      }
    });

    setColumnMapping(mapping);
    setStep(2);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith(".csv") && !selected.name.endsWith(".txt")) {
      toast.error("Por favor, selecione um arquivo no formato .csv");
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      parseCSV(content);
    };
    reader.readAsText(selected, "UTF-8");
  };

  // Build processed rows according to current mapping
  const processedRows = useMemo<ParsedRow[]>(() => {
    if (columnMapping.name === -1 || rawRows.length === 0) return [];

    return rawRows.map((row, index) => {
      const name = (columnMapping.name !== -1 && row[columnMapping.name]) ? row[columnMapping.name].trim() : "";
      let phone = (columnMapping.phone !== -1 && row[columnMapping.phone]) ? row[columnMapping.phone].trim() : "";
      const email = (columnMapping.email !== -1 && row[columnMapping.email]) ? row[columnMapping.email].trim() : "";
      const role = (columnMapping.role !== -1 && row[columnMapping.role]) ? row[columnMapping.role].trim() : "";
      const source = (columnMapping.source !== -1 && row[columnMapping.source]) ? row[columnMapping.source].trim() : "";
      const tempRaw = (columnMapping.temperature !== -1 && row[columnMapping.temperature]) ? row[columnMapping.temperature].trim().toLowerCase() : "";

      let temperature: "quente" | "morno" | "frio" = "morno";
      if (tempRaw.includes("quente") || tempRaw.includes("hot")) temperature = "quente";
      else if (tempRaw.includes("frio") || tempRaw.includes("cold")) temperature = "frio";

      // Phone formatting
      if (phone) {
        phone = formatPhone(phone);
      }

      // Validation
      const isValid = name.length >= 2;
      let validationError: string | undefined;
      if (!isValid) {
        validationError = "Nome ausente ou muito curto";
      }

      // Duplicate check
      let isDuplicate = false;
      let duplicateReason: string | undefined;

      if (email && existingEmailsSet.has(email.toLowerCase())) {
        isDuplicate = true;
        duplicateReason = `E-mail já cadastrado (${email})`;
      } else if (phone) {
        const cleanPhone = normalizePhone(phone);
        if (cleanPhone.length >= 8 && existingPhonesSet.has(cleanPhone.slice(-8))) {
          isDuplicate = true;
          duplicateReason = `Telefone já cadastrado (${phone})`;
        }
      }

      return {
        id: `row-${index}`,
        name,
        phone,
        email,
        role: role || "Cliente Potencial",
        source: source || "Importação CSV",
        temperature,
        isDuplicate,
        duplicateReason,
        isValid,
        validationError,
      };
    });
  }, [rawRows, columnMapping, existingEmailsSet, existingPhonesSet]);

  const summary = useMemo(() => {
    const total = processedRows.length;
    const valid = processedRows.filter(r => r.isValid).length;
    const duplicates = processedRows.filter(r => r.isValid && r.isDuplicate).length;
    const readyToImport = skipDuplicates 
      ? processedRows.filter(r => r.isValid && !r.isDuplicate).length
      : valid;

    return { total, valid, duplicates, readyToImport };
  }, [processedRows, skipDuplicates]);

  // Execute bulk import
  const handleExecuteImport = async () => {
    const toImport = processedRows.filter(r => r.isValid && (!skipDuplicates || !r.isDuplicate));

    if (toImport.length === 0) {
      toast.warning("Nenhum contato válido selecionado para importação.");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    let importedCount = 0;
    let skippedCount = processedRows.length - toImport.length;
    let errorCount = 0;

    for (let i = 0; i < toImport.length; i++) {
      const item = toImport[i];
      try {
        await createContact({
          name: item.name,
          phone: item.phone,
          email: item.email,
          role: item.role,
          source: item.source,
          temperature: item.temperature,
          type: "cliente"
        });
        importedCount++;
      } catch (err) {
        console.error("Erro importando linha:", item.name, err);
        errorCount++;
      }
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setImportStats({
      total: processedRows.length,
      imported: importedCount,
      skipped: skippedCount,
      errors: errorCount
    });

    // Record audit event
    recordAuditEvent({
      action: "IMPORT_CONTACTS",
      title: "Importação de Leads em Lote",
      content: `Foram importados com sucesso ${importedCount} contatos (${skippedCount} ignorados/duplicados) a partir do arquivo "${file?.name || "leads.csv"}".`,
      severity: "info",
      category: "modification",
      entityType: "contact",
      metadata: {
        filename: file?.name,
        totalRows: processedRows.length,
        importedCount,
        skippedCount,
        errorCount,
        skipDuplicates
      }
    });

    setIsImporting(false);
    setStep(3);
    onImportComplete();
    toast.success(`${importedCount} contatos importados com sucesso!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Importar Contatos & Leads (CSV)</h2>
              <p className="text-xs text-muted-foreground">Migração rápida de planilhas Excel e outros CRMs</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isImporting}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-5 py-2.5 bg-muted/20 border-b border-border/60 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 1 ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"}`}>1</span>
            <span className={step === 1 ? "text-foreground font-bold" : "text-muted-foreground"}>Arquivo CSV</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 2 ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"}`}>2</span>
            <span className={step === 2 ? "text-foreground font-bold" : "text-muted-foreground"}>Mapeamento & Conferência</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 3 ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"}`}>3</span>
            <span className={step === 3 ? "text-foreground font-bold" : "text-muted-foreground"}>Conclusão</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* STEP 1: Upload */}
          {step === 1 && (
            <div className="space-y-5">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
              >
                <div className="w-14 h-14 rounded-2xl bg-muted group-hover:bg-primary/10 group-hover:scale-105 transition-all flex items-center justify-center text-muted-foreground group-hover:text-primary mb-3">
                  <FileText className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-sm text-foreground mb-1">
                  Arraste seu arquivo CSV ou clique para selecionar
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Formatos aceitos: <strong>.csv</strong> ou <strong>.txt</strong> delimitado por vírgula (,) ou ponto e vírgula (;).
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.txt"
                  className="hidden"
                />
              </div>

              <div className="bg-muted/40 border border-border/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Não tem uma planilha pronta?</h4>
                    <p className="text-[11px] text-muted-foreground">Baixe nosso modelo padronizado já com exemplos preenchidos.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-card hover:bg-muted text-foreground border border-border rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  Baixar Modelo CSV
                </button>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground bg-muted/20 p-3.5 rounded-xl border border-border/50">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  Dicas para uma importação perfeita:
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                  <li>O campo <strong>Nome Completo</strong> é obrigatório para cadastrar o lead.</li>
                  <li>Telefones com ou sem formatação (DDD + 8 ou 9 dígitos) serão normalizados automaticamente.</li>
                  <li>O sistema avisa automaticamente se encontrar e-mails ou telefones repetidos na sua base.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: Mapping & Preview */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Mapping Grid */}
              <div className="bg-muted/30 border border-border/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    Mapeamento de Colunas
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Arquivo: <strong className="text-foreground">{file?.name}</strong> ({rawRows.length} linhas detectadas)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Nome */}
                  <div>
                    <label className="text-[11px] font-bold text-foreground flex items-center gap-1 mb-1">
                      Nome Completo <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={columnMapping.name}
                      onChange={(e) => setColumnMapping({ ...columnMapping, name: Number(e.target.value) })}
                      className="w-full text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 font-medium"
                    >
                      <option value={-1}>-- Selecione a coluna --</option>
                      {rawHeaders.map((h, idx) => (
                        <option key={idx} value={idx}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Telefone */}
                  <div>
                    <label className="text-[11px] font-bold text-foreground mb-1 block">
                      Telefone / Celular
                    </label>
                    <select
                      value={columnMapping.phone}
                      onChange={(e) => setColumnMapping({ ...columnMapping, phone: Number(e.target.value) })}
                      className="w-full text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 font-medium"
                    >
                      <option value={-1}>-- Não mapear --</option>
                      {rawHeaders.map((h, idx) => (
                        <option key={idx} value={idx}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-[11px] font-bold text-foreground mb-1 block">
                      E-mail
                    </label>
                    <select
                      value={columnMapping.email}
                      onChange={(e) => setColumnMapping({ ...columnMapping, email: Number(e.target.value) })}
                      className="w-full text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 font-medium"
                    >
                      <option value={-1}>-- Não mapear --</option>
                      {rawHeaders.map((h, idx) => (
                        <option key={idx} value={idx}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Empresa / Cargo */}
                  <div>
                    <label className="text-[11px] font-bold text-foreground mb-1 block">
                      Empresa / Cargo
                    </label>
                    <select
                      value={columnMapping.role}
                      onChange={(e) => setColumnMapping({ ...columnMapping, role: Number(e.target.value) })}
                      className="w-full text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 font-medium"
                    >
                      <option value={-1}>-- Não mapear --</option>
                      {rawHeaders.map((h, idx) => (
                        <option key={idx} value={idx}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Origem */}
                  <div>
                    <label className="text-[11px] font-bold text-foreground mb-1 block">
                      Origem do Lead
                    </label>
                    <select
                      value={columnMapping.source}
                      onChange={(e) => setColumnMapping({ ...columnMapping, source: Number(e.target.value) })}
                      className="w-full text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 font-medium"
                    >
                      <option value={-1}>-- Não mapear --</option>
                      {rawHeaders.map((h, idx) => (
                        <option key={idx} value={idx}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Temperatura */}
                  <div>
                    <label className="text-[11px] font-bold text-foreground mb-1 block">
                      Temperatura / Qualificação
                    </label>
                    <select
                      value={columnMapping.temperature}
                      onChange={(e) => setColumnMapping({ ...columnMapping, temperature: Number(e.target.value) })}
                      className="w-full text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 font-medium"
                    >
                      <option value={-1}>-- Padrão (Morno) --</option>
                      {rawHeaders.map((h, idx) => (
                        <option key={idx} value={idx}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Deduplication & Summary Bar */}
              <div className="bg-card border border-border rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
                  />
                  <span>Ignorar automaticamente contatos duplicados (por e-mail ou telefone)</span>
                </label>

                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    {summary.readyToImport} prontos para importar
                  </span>
                  {summary.duplicates > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      {summary.duplicates} duplicados
                    </span>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                <div className="px-3.5 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Pré-visualização dos Registros (Primeiras 10 linhas)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Exibindo {Math.min(10, processedRows.length)} de {processedRows.length} linhas
                  </span>
                </div>

                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/20 text-muted-foreground font-semibold border-b border-border sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">Telefone</th>
                        <th className="px-3 py-2">E-mail</th>
                        <th className="px-3 py-2">Empresa/Cargo</th>
                        <th className="px-3 py-2">Origem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {processedRows.slice(0, 10).map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {!row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20">
                                <AlertTriangle className="w-3 h-3" /> Inválido
                              </span>
                            ) : row.isDuplicate ? (
                              <span 
                                title={row.duplicateReason}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              >
                                <AlertTriangle className="w-3 h-3" /> Duplicado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                <Check className="w-3 h-3" /> Novo
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-bold text-foreground whitespace-nowrap">
                            {row.name || <span className="text-red-500 italic">Sem nome</span>}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {row.phone || "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {row.email || "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {row.role}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">
                              {row.source}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Progress bar when importing */}
              {isImporting && (
                <div className="space-y-2 bg-muted/40 p-4 rounded-xl border border-border">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      Importando contatos para o banco de dados...
                    </span>
                    <span className="text-primary">{importProgress}%</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-200"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Complete */}
          {step === 3 && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">Importação Finalizada com Sucesso!</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Os novos leads foram adicionados à sua base e já estão prontos para receberem ligações, mensagens de WhatsApp e serem vinculados a imóveis.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
                <div className="p-3 bg-muted/50 rounded-xl border border-border">
                  <div className="text-xl font-black text-emerald-600">{importStats.imported}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Importados</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-xl border border-border">
                  <div className="text-xl font-black text-amber-600">{importStats.skipped}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Duplicados/Pulados</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-xl border border-border">
                  <div className="text-xl font-black text-foreground">{importStats.total}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Total Analisado</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border bg-muted/30 flex items-center justify-between">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md hover:shadow-primary/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Escolher Arquivo
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isImporting || columnMapping.name === -1 || summary.readyToImport === 0}
                onClick={handleExecuteImport}
                className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md hover:shadow-primary/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando ({importProgress}%)...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Importar {summary.readyToImport} Contatos
                  </>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md hover:shadow-primary/20 transition-all cursor-pointer"
              >
                Concluir e Ver Contatos
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
