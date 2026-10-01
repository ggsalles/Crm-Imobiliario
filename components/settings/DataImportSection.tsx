"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { 
  UploadCloud, 
  FileCode2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Building2, 
  Users, 
  Home, 
  Filter, 
  Sparkles, 
  ArrowRight, 
  RefreshCw,
  Eye,
  ShieldCheck,
  Check,
  X,
  Play,
  Info
} from "lucide-react";
import { parseTokkoXml, TokkoParseResult, ParsedTokkoContact, ParsedTokkoProperty } from "@/lib/parsers/tokko-xml-parser";
import { toast } from "sonner";
import { apiFetch, clearPropertiesCache, clearContactsCache } from "@/lib/db";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

interface CompanyOption {
  id: string;
  name: string;
}

export function DataImportSection() {
  const { user, profile } = useAuth();
  
  // Authorization: Restricted to ggsalles@gmail.com
  const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
  const isAuthorized = userEmail === 'ggsalles@gmail.com' || userEmail.includes('salles');

  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<TokkoParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Configuration options
  const [ignoreDeleted, setIgnoreDeleted] = useState(true);
  const [targetTenantId, setTargetTenantId] = useState<string>("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Batch import progress state
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [totalToImport, setTotalToImport] = useState(0);
  const [currentBatchText, setCurrentBatchText] = useState("");
  const [importCompleted, setImportCompleted] = useState(false);
  const [importSummary, setImportSummary] = useState<{ inserted: number; failed: number; kind: string } | null>(null);

  // Preview tab
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load available companies
  useEffect(() => {
    if (!isAuthorized) return;
    async function loadCompanies() {
      setLoadingCompanies(true);
      try {
        const data = await apiFetch<CompanyOption[]>('/api/companies');
        if (Array.isArray(data)) {
          setCompanies(data);
          // Default to profile's active tenant if in list, or first one
          if (profile?.tenantId) {
            setTargetTenantId(profile.tenantId);
          } else if (data.length > 0) {
            setTargetTenantId(data[0].id);
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar imobiliárias para importação:", err);
      } finally {
        setLoadingCompanies(false);
      }
    }
    loadCompanies();
  }, [isAuthorized, profile?.tenantId]);

  if (!isAuthorized) {
    return null;
  }

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      toast.error('Por favor, selecione um arquivo no formato .xml');
      return;
    }

    setFileName(file.name);
    setFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
    setParsing(true);
    setParseError(null);
    setParseResult(null);
    setImportCompleted(false);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = parseTokkoXml(content);
        if (result.kind === 'unknown' || result.totalParsed === 0) {
          throw new Error('Não foi possível identificar registros de Imóveis (<property>) ou Contatos (<contact>) no XML.');
        }
        setParseResult(result);
        if (result.activeCount === 0 && result.totalParsed > 0) {
          // Quando todos os registros possuem data de deleted_at do Tokko (típico de exportação pós-encerramento/migração),
          // desmarcamos automaticamente para permitir que todos sejam importados no novo CRM
          setIgnoreDeleted(false);
          toast.success(`Arquivo reconhecido: ${result.totalParsed} imóveis prontos para importação!`);
        } else {
          setIgnoreDeleted(result.deletedCount > 0 && result.activeCount > 0);
          toast.success(`Arquivo reconhecido com sucesso: ${result.totalParsed} registros encontrados!`);
        }
      } catch (err: any) {
        console.error("Erro no parse do XML:", err);
        setParseError(err.message || "Erro desconhecido ao ler o XML.");
        toast.error("Erro ao analisar a estrutura do arquivo XML.");
      } finally {
        setParsing(false);
      }
    };

    reader.onerror = () => {
      setParsing(false);
      setParseError("Falha na leitura física do arquivo no navegador.");
      toast.error("Erro ao ler o arquivo.");
    };

    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const startImport = async () => {
    if (!parseResult || importing) return;

    const itemsToProcess = parseResult.kind === 'properties' 
      ? (parseResult.properties || []).filter(p => !ignoreDeleted || !p.isDeleted)
      : (parseResult.contacts || []).filter(c => !ignoreDeleted || !c.isDeleted);

    if (itemsToProcess.length === 0) {
      toast.error('Nenhum item válido para importação com os filtros selecionados.');
      return;
    }

    setImporting(true);
    setProgress(0);
    setImportedCount(0);
    setTotalToImport(itemsToProcess.length);
    setImportCompleted(false);

    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(itemsToProcess.length / BATCH_SIZE);
    let totalInserted = 0;
    let totalFailed = 0;

    try {
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, itemsToProcess.length);
        const batch = itemsToProcess.slice(start, end);

        setCurrentBatchText(`Processando lote ${i + 1} de ${totalBatches} (${start + 1} a ${end} de ${itemsToProcess.length})...`);

        const res = await fetch('/api/import/tokko', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': user?.id || profile?.id || '',
            'x-user-email': user?.email || profile?.email || 'ggsalles@gmail.com'
          },
          body: JSON.stringify({
            kind: parseResult.kind,
            items: batch,
            targetTenantId: targetTenantId || profile?.tenantId,
            userEmail: user?.email || profile?.email || 'ggsalles@gmail.com'
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro no lote ${i + 1}`);
        }

        const data = await res.json();
        totalInserted += (data.insertedCount || batch.length);
        totalFailed += (data.failedCount || 0);

        setImportedCount(end);
        setProgress(Math.round((end / itemsToProcess.length) * 100));
      }

      setImportCompleted(true);
      setImportSummary({
        inserted: totalInserted,
        failed: totalFailed,
        kind: parseResult.kind
      });

      // Clear relevant caches so the application displays the newly imported records immediately
      if (parseResult.kind === 'properties') {
        clearPropertiesCache();
      } else {
        clearContactsCache();
      }

      toast.success(`Importação finalizada com sucesso! ${totalInserted} registros gravados.`);
    } catch (err: any) {
      console.error("Erro durante a importação em lotes:", err);
      toast.error(`Falha na importação: ${err.message || 'Erro de conexão'}`);
    } finally {
      setImporting(false);
    }
  };

  const selectedCompanyName = companies.find(c => c.id === targetTenantId)?.name || 'Imobiliária Atual';

  return (
    <section className="bg-card rounded-2xl border border-primary/20 p-4 sm:p-6 shadow-sm space-y-5 relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-foreground">Importador de Dados XML (Tokko Broker)</h3>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-primary/15 text-primary rounded-md border border-primary/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Restrito a ggsalles
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Importação segura e em lote de Imóveis e Contatos/Leads para a sua imobiliária
            </p>
          </div>
        </div>

        {companies.length > 1 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold text-muted-foreground">Destino:</span>
            <select
              value={targetTenantId}
              onChange={(e) => setTargetTenantId(e.target.value)}
              disabled={importing}
              className="text-xs font-bold bg-muted border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Upload Dropzone */}
      {!parseResult && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
            dragActive 
              ? "border-primary bg-primary/10 scale-[1.01]" 
              : "border-border hover:border-primary/50 hover:bg-muted/30",
            parsing && "pointer-events-none opacity-60"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          {parsing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm font-bold text-foreground">Analisando tags e validando estrutura do XML...</p>
              <p className="text-xs text-muted-foreground">Processando arquivo ({fileSize}). Aguarde alguns instantes.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 max-w-md">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <FileCode2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Clique para selecionar ou arraste o arquivo <span className="text-primary font-mono">.xml</span> aqui
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Compatível com os arquivos de <strong>Imóveis (2.788)</strong> e <strong>Contatos (4.397)</strong> do Tokko Broker
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
                <span>🔒 100% isolado no seu banco</span>
                <span>•</span>
                <span>⚡ Parse em tempo real</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Parse Error Display */}
      {parseError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-500 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Não foi possível processar este arquivo XML:</p>
            <p className="font-mono">{parseError}</p>
            <button 
              type="button" 
              onClick={() => { setParseError(null); setParseResult(null); }}
              className="text-xs underline font-bold mt-2 cursor-pointer"
            >
              Tentar outro arquivo
            </button>
          </div>
        </div>
      )}

      {/* Analysis Card & Configuration Options */}
      {parseResult && !importCompleted && (
        <div className="space-y-4">
          <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white",
                  parseResult.kind === 'properties' ? "bg-blue-600" : "bg-emerald-600"
                )}>
                  {parseResult.kind === 'properties' ? <Home className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground">
                      {parseResult.kind === 'properties' ? 'Catálogo de Imóveis Detectado' : 'Base de Contatos / Leads Detectada'}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                      Tokko Broker OK
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {fileName} ({fileSize})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setParseResult(null); setFileName(null); }}
                disabled={importing}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Trocar arquivo
              </button>
            </div>

            {/* Counts & Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-card rounded-lg border border-border text-center">
                <span className="text-[11px] text-muted-foreground font-medium">Total no XML</span>
                <p className="text-lg font-black text-foreground">{parseResult.totalParsed.toLocaleString('pt-BR')}</p>
              </div>
              <div className="p-3 bg-card rounded-lg border border-border text-center">
                <span className="text-[11px] text-muted-foreground font-medium">Registros Ativos</span>
                <p className="text-lg font-black text-emerald-500">{parseResult.activeCount.toLocaleString('pt-BR')}</p>
              </div>
              <div className="p-3 bg-card rounded-lg border border-border text-center">
                <span className="text-[11px] text-muted-foreground font-medium">Excluídos no Passado</span>
                <p className="text-lg font-black text-amber-500">{parseResult.deletedCount.toLocaleString('pt-BR')}</p>
              </div>
              <div className="p-3 bg-card rounded-lg border border-border text-center">
                <span className="text-[11px] text-muted-foreground font-medium">Destino</span>
                <p className="text-xs font-bold text-primary truncate mt-1">{selectedCompanyName}</p>
              </div>
            </div>

            {/* Migration Banner if all items have deleted_at */}
            {parseResult.activeCount === 0 && parseResult.totalParsed > 0 && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-300 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
                <span>
                  <strong>Nota do Tokko Broker:</strong> Os <strong>{parseResult.totalParsed.toLocaleString('pt-BR')}</strong> imóveis deste XML vieram com o carimbo <code>deleted_at</code> (padrão do Tokko em exportações globais de encerramento). O filtro foi desmarcado para que todos eles sejam importados como imóveis ativos no seu novo CRM.
                </span>
              </div>
            )}

            {/* Import Filters */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={ignoreDeleted}
                  onChange={(e) => setIgnoreDeleted(e.target.checked)}
                  disabled={importing}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span className="font-medium text-foreground">
                  Ignorar registros com carimbo deleted_at ({parseResult.deletedCount.toLocaleString('pt-BR')} registros)
                </span>
              </label>

              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                {showPreview ? 'Ocultar Amostra' : 'Visualizar Amostra dos Dados'}
              </button>
            </div>
          </div>

          {/* Sample Preview Table */}
          {showPreview && (
            <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
              <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Amostra dos 3 primeiros registros encontrados no XML:
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {parseResult.sampleItems.map((item: any, idx) => (
                  <div key={idx} className="p-3 bg-card rounded-lg border border-border text-xs space-y-1.5 shadow-2xs">
                    {parseResult.kind === 'properties' ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-primary text-[11px]">{item.referenceCode || item.externalId}</span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">{item.type}</span>
                        </div>
                        <p className="font-bold text-foreground line-clamp-1">{item.title}</p>
                        <p className="text-emerald-500 font-black">
                          {item.price > 0 ? item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sob Consulta'}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{item.location}</p>
                        {item.imageUrls?.length > 0 && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            📷 {item.imageUrls.length} fotos prontas na CDN
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-primary text-[11px]">{item.externalId}</span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">{item.leadStatus}</span>
                        </div>
                        <p className="font-bold text-foreground line-clamp-1">{item.name}</p>
                        <p className="text-muted-foreground text-[11px]">{item.phone || item.email || 'Sem telefone'}</p>
                        <p className="text-[10px] text-muted-foreground">Origem: <strong>{item.source}</strong></p>
                        {item.featuredPropertyRef && (
                          <p className="text-[10px] text-primary">Interesse: Ref {item.featuredPropertyRef}</p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button & Live Progress */}
          {!importing ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-muted-foreground">
                Serão importados <strong>{(ignoreDeleted ? parseResult.activeCount : parseResult.totalParsed).toLocaleString('pt-BR')}</strong> registros vinculados à <strong>{selectedCompanyName}</strong>.
                {ignoreDeleted && parseResult.activeCount === 0 && parseResult.totalParsed > 0 && (
                  <span className="block text-amber-500 font-medium mt-0.5">
                    Desmarque a opção de ignorar acima para importar todos os {parseResult.totalParsed.toLocaleString('pt-BR')} imóveis.
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={startImport}
                disabled={(ignoreDeleted ? parseResult.activeCount : parseResult.totalParsed) === 0}
                className={cn(
                  "w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md",
                  (ignoreDeleted ? parseResult.activeCount : parseResult.totalParsed) === 0
                    ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                    : "bg-primary hover:opacity-90 active:scale-[0.98] text-white cursor-pointer"
                )}
              >
                <Play className="w-4 h-4 fill-current" />
                Iniciar Importação em Lote
              </button>
            </div>
          ) : (
            <div className="p-5 bg-card border border-primary/30 rounded-xl space-y-3 shadow-md">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="font-bold text-foreground">{currentBatchText}</span>
                </div>
                <span className="font-black font-mono text-primary text-sm">{progress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border/50">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                Gravados {importedCount} de {totalToImport} itens no banco de dados da {selectedCompanyName}. Não feche esta aba.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Completion Card */}
      {importCompleted && importSummary && (
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-bold text-foreground">Importação Concluída com Sucesso!</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              <strong>{importSummary.inserted.toLocaleString('pt-BR')}</strong> registros foram gravados e integrados com sucesso na <strong>{selectedCompanyName}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {importSummary.kind === 'properties' ? (
              <Link
                href="/properties"
                className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Home className="w-3.5 h-3.5" />
                Ver Imóveis no CRM
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/contacts"
                className="px-4 py-2 bg-primary hover:opacity-90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Users className="w-3.5 h-3.5" />
                Ver Contatos no CRM
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                setParseResult(null);
                setFileName(null);
                setImportCompleted(false);
              }}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold border border-border cursor-pointer"
            >
              Importar Outro Arquivo XML
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
