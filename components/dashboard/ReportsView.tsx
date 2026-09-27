"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  Radar 
} from "recharts";
import { motion } from "motion/react";
import { 
  Layers, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Database, 
  ShieldCheck, 
  Check 
} from "lucide-react";
import { Deal, Contact, Activity, Property } from "@/lib/db";
import { STAGES } from "@/lib/constants";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { MetricCard } from "@/components/dashboard/MetricsSummary";
import { exportExecutiveSummaryToCsv, downloadJsonFile } from "@/lib/csv-export";
import { recordAuditEvent } from "@/lib/audit";
import { toast } from "sonner";

export interface ReportsViewProps {
  deals: Deal[];
  contacts: Contact[];
  activities?: Activity[];
  properties?: Property[];
  progressPercentage: number;
}

const CustomRevenueTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const revenueVal = Number(payload[0].value) || 0;
    const dealsCount = payload[0].payload?.deals || 0;
    return (
      <div className="bg-slate-900 border border-slate-700/80 px-4 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative z-50 min-w-[140px] text-left">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5 mb-1.5">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-mono">{label}</p>
          {dealsCount > 0 && (
            <span className="text-[9px] font-bold bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-mono">
              {dealsCount} {dealsCount === 1 ? 'venda' : 'vendas'}
            </span>
          )}
        </div>
        <p className="text-sm font-black text-white tracking-tight font-mono">
          {formatCurrencyBRL(revenueVal, { maximumFractionDigits: 0 })}
        </p>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700/80 px-3.5 py-2.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col gap-1 relative z-50 min-w-[150px] text-left">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 mb-0.5">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
          <span className="text-[11px] font-bold text-slate-200 tracking-wider uppercase font-mono">{data.name}</span>
        </div>
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="text-slate-400 font-medium">Negócios:</span>
          <span className="font-bold text-white font-mono">{data.value}</span>
        </div>
      </div>
    );
  }
  return null;
};

// Define color mapping for the chart to match STAGES colors
const STAGE_COLORS: Record<string, string> = {
  blue: 'hsl(var(--primary))',
  purple: '#7C3AED',
  orange: '#EA580C',
  yellow: '#F59E0B',
  emerald: '#10B981',
  slate: '#64748B'
};

const STABLE_CONVERSION_SPARKLINE = [
  { value: 55 }, { value: 62 }, { value: 58 }, { value: 71 },
  { value: 68 }, { value: 79 }, { value: 74 }, { value: 85 },
  { value: 82 }, { value: 91 }, { value: 87 }, { value: 96 }
];

const STABLE_PIPELINE_SPARKLINE = [
  { value: 40 }, { value: 48 }, { value: 52 }, { value: 61 },
  { value: 59 }, { value: 67 }, { value: 73 }, { value: 70 },
  { value: 78 }, { value: 84 }, { value: 89 }, { value: 94 }
];

export const ReportsView = memo(function ReportsView({ 
  deals, 
  contacts: _contacts, 
  activities,
  properties,
  progressPercentage 
}: ReportsViewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const salesData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(now, 5 - i);
      return {
        name: format(d, "MMM", { locale: ptBR }).replace('.', '').replace(/^./, (str) => str.toUpperCase()),
        monthKey: format(d, "yyyy-MM"),
        revenue: 0,
        deals: 0
      };
    });

    deals.forEach(deal => {
      if (deal.stage === 'closed' && deal.updatedAt) {
        try {
          const date = new Date(deal.updatedAt);
          if (date) {
            const key = format(date, "yyyy-MM");
            const month = months.find(m => m.monthKey === key);
            if (month) {
              month.revenue += deal.value || 0;
              month.deals += 1;
            }
          }
        } catch {
          // Skip errors
        }
      }
    });
    return months;
  }, [deals]);
  
  // Dynamic stage distribution based on STAGES
  const stageData = useMemo(() => {
    return STAGES.map(stage => ({
      name: stage.title,
      id: stage.id,
      color: STAGE_COLORS[stage.color] || STAGE_COLORS.slate,
      value: deals.filter(d => d.stage === stage.id).length
    })).filter(s => s.value > 0);
  }, [deals]);

  // Filter deals to only include those in defined stages for the total count
  const { totalRevenue, avgTicket, winRate, activePipelineValue } = useMemo(() => {
    const validDeals = deals.filter(d => STAGES.some(s => s.id === d.stage));
    const closedDeals = validDeals.filter(d => d.stage === 'closed');
    const totRevenue = closedDeals.reduce((acc, d) => acc + (d.value || 0), 0);
    const average = totRevenue / (closedDeals.length || 1);
    const rate = (closedDeals.length / (validDeals.length || 1)) * 100;
    
    // Pipeline Ativo: sum of deals in any stage except 'closed' (and only from valid STAGES)
    const pipeline = validDeals
      .filter(d => d.stage !== 'closed')
      .reduce((acc, d) => acc + (d.value || 0), 0);

    return {
      totalRevenue: totRevenue,
      avgTicket: average,
      winRate: rate,
      activePipelineValue: pipeline
    };
  }, [deals]);

  // Memoized sparklines
  const revenueSparkline = useMemo(() => salesData.map(s => ({ value: s.revenue })), [salesData]);
  const dealsSparkline = useMemo(() => salesData.map(s => ({ value: s.deals })), [salesData]);

  // Radar chart data memoized
  const radarData = useMemo(() => [
    { subject: 'Volume', A: winRate },
    { subject: 'Ticket', A: Math.min((avgTicket / 100000) * 100, 100) },
    { subject: 'Velocidade', A: 80 },
    { subject: 'Retenção', A: 70 },
    { subject: 'Meta', A: progressPercentage },
  ], [winRate, avgTicket, progressPercentage]);

  // Central de Exportações: CSV Consolidado
  const handleExportConsolidatedCsv = useCallback(() => {
    exportExecutiveSummaryToCsv(deals, _contacts, activities || [], progressPercentage);
    recordAuditEvent({
      action: "EXPORT_REPORT",
      title: "Exportação de Relatório Executivo Consolidado",
      content: `Relatório executivo exportado para CSV com ${deals.length} negócios e ${_contacts.length} contatos.`,
      severity: "low",
      category: "export",
      metadata: {
        dealsCount: deals.length,
        contactsCount: _contacts.length,
        totalRevenue
      }
    });
    toast.success("Relatório Executivo consolidado exportado com sucesso em .CSV!");
  }, [deals, _contacts, activities, progressPercentage, totalRevenue]);

  // Central de Exportações: Backup JSON
  const handleExportFullBackupJson = useCallback(() => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      crmVersion: "SalesScore 0.2.0",
      summary: {
        totalDeals: deals.length,
        totalContacts: _contacts.length,
        totalActivities: activities?.length || 0,
        totalProperties: properties?.length || 0,
        totalRevenue,
        activePipelineValue
      },
      deals,
      contacts: _contacts,
      activities: activities || [],
      properties: properties || []
    };
    const dateSuffix = format(new Date(), "yyyy-MM-dd_HHmm");
    downloadJsonFile(`backup-salesscore-crm_${dateSuffix}`, backupData);
    recordAuditEvent({
      action: "EXPORT_REPORT",
      title: "Backup Completo do CRM (JSON)",
      content: `Backup estruturado gerado com ${deals.length} negócios, ${_contacts.length} contatos e ${activities?.length || 0} atividades.`,
      severity: "medium",
      category: "export",
      metadata: {
        backupItemsCount: deals.length + _contacts.length + (activities?.length || 0)
      }
    });
    toast.success("Backup do CRM gerado com sucesso em formato .JSON!");
  }, [deals, _contacts, activities, properties, totalRevenue, activePipelineValue]);

  // Central de Exportações: Impressão / PDF Executivo
  const handlePrintExecutiveReport = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Por favor, permita pop-ups para imprimir o relatório executivo.");
      return;
    }

    const nowFormatted = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
    const closedCount = deals.filter(d => d.stage === 'closed').length;
    const activeCount = deals.filter(d => d.stage !== 'closed' && d.stage !== 'lost').length;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Relatório Executivo de Vendas - SalesScore CRM</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 40px; background: #fff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
          .logo { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
          .sub { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 1px; }
          .date { font-size: 12px; color: #64748b; text-align: right; }
          .title-section { margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }
          .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
          .kpi-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
          .kpi-val { font-size: 20px; font-weight: 900; color: #0f172a; }
          .kpi-sub { font-size: 11px; color: #10b981; font-weight: 600; margin-top: 4px; }
          .table-title { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #1e293b; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
          th { text-align: left; background: #f1f5f9; padding: 10px 12px; font-weight: bold; text-transform: uppercase; font-size: 10px; color: #475569; border-bottom: 2px solid #cbd5e1; }
          td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
          .text-right { text-align: right; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
          @media print {
            body { padding: 15px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">SalesScore CRM</div>
            <div class="sub">Inteligência Comercial & Gestão Imobiliária</div>
          </div>
          <div class="date">
            <div>Data de Emissão:</div>
            <strong>${nowFormatted}</strong>
          </div>
        </div>

        <div class="title-section">
          <h1 class="title">Relatório Executivo Consolidado</h1>
          <p style="color: #64748b; font-size: 13px;">Demonstrativo de performance de vendas, fluxo de negócios e carteira de clientes.</p>
        </div>

        <div class="grid">
          <div class="kpi-card">
            <div class="kpi-label">Faturamento Fechado</div>
            <div class="kpi-val">${formatCurrencyBRL(totalRevenue, { maximumFractionDigits: 0 })}</div>
            <div class="kpi-sub">${closedCount} vendas ganhas</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Ticket Médio</div>
            <div class="kpi-val">${formatCurrencyBRL(avgTicket, { maximumFractionDigits: 0 })}</div>
            <div class="kpi-sub">Por venda fechada</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Taxa de Conversão</div>
            <div class="kpi-val">${winRate.toFixed(1)}%</div>
            <div class="kpi-sub">Eficiência do funil</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Pipeline em Aberto</div>
            <div class="kpi-val">${formatCurrencyBRL(activePipelineValue, { maximumFractionDigits: 0 })}</div>
            <div class="kpi-sub">${activeCount} oportunidades</div>
          </div>
        </div>

        <div class="table-title">Distribuição dos Negócios por Fase do Funil</div>
        <table>
          <thead>
            <tr>
              <th>Fase do Funil</th>
              <th class="text-right">Quantidade</th>
              <th class="text-right">Volume Total (R$)</th>
              <th class="text-right">Representatividade</th>
            </tr>
          </thead>
          <tbody>
            ${STAGES.map(stage => {
              const stageDeals = deals.filter(d => d.stage === stage.id);
              const val = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
              const pct = deals.length > 0 ? ((stageDeals.length / deals.length) * 100).toFixed(1) : "0";
              return `
                <tr>
                  <td><strong>${stage.title}</strong></td>
                  <td class="text-right">${stageDeals.length}</td>
                  <td class="text-right">${formatCurrencyBRL(val, { maximumFractionDigits: 0 })}</td>
                  <td class="text-right">${pct}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <span>SalesScore CRM &bull; Documento Gerencial Interno</span>
          <span>Aproveitamento da Meta: ${Math.round(progressPercentage)}%</span>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    recordAuditEvent({
      action: "EXPORT_REPORT",
      title: "Impressão de Relatório Executivo",
      content: "Relatório executivo formatado aberto para impressão / PDF.",
      severity: "low",
      category: "export"
    });
  }, [deals, totalRevenue, avgTicket, winRate, activePipelineValue, progressPercentage]);

  return (
    <div className="space-y-6 md:space-y-8 pb-20">
      {/* Central de Exportações & Ações Gerenciais */}
      <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="text-sm md:text-base font-bold text-foreground">
              Central de Exportações & Relatórios
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exportação em 1 clique para planilhas gerenciais (Excel/CSV), backups e impressão formal.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            type="button"
            onClick={handleExportConsolidatedCsv}
            className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer flex-1 sm:flex-initial"
            title="Baixar planilha consolidada de vendas e funil compatível com Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintExecutiveReport}
            className="px-3 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer flex-1 sm:flex-initial"
            title="Visualizar e imprimir resumo executivo em PDF"
          >
            <Printer className="w-3.5 h-3.5 text-primary" />
            <span>Imprimir / PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportFullBackupJson}
            className="px-3 py-2 bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer flex-1 sm:flex-initial"
            title="Download de arquivo de backup completo dos dados do CRM em JSON"
          >
            <Database className="w-3.5 h-3.5 text-amber-500" />
            <span>Backup JSON</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Faturamento Acumulado" 
          value={formatCurrencyBRL(totalRevenue, { maximumFractionDigits: 0 })} 
          trend="+12.5% vs histórico"
          isPositive={true}
          description="Total gerado em negócios fechados."
          chartData={revenueSparkline}
        />
        <MetricCard 
          title="Ticket Médio" 
          value={formatCurrencyBRL(avgTicket, { maximumFractionDigits: 0 })} 
          trend="Equilíbrio de Vendas"
          isPositive={true}
          isNeutral={true}
          description="Valor médio por venda fechada."
          chartData={dealsSparkline}
        />
        <MetricCard 
          title="Taxa de Conversão" 
          value={`${winRate.toFixed(1)}%`} 
          trend="Eficiência do Funil"
          isPositive={winRate > 15}
          description="Porcentagem de leads que chegam ao status final."
          chartData={STABLE_CONVERSION_SPARKLINE}
        />
        <MetricCard 
          title="Pipeline Ativo" 
          value={formatCurrencyBRL(activePipelineValue, { maximumFractionDigits: 0 })} 
          trend="Oportunidades em aberto"
          isPositive={true}
          isNeutral={true}
          description="Valor total estacionado no funil (exceto vendidos)."
          chartData={STABLE_PIPELINE_SPARKLINE}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-5">
        <div className="lg:col-span-2 bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-5 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Fluxo de Receita</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Sazonalidade das vendas (últimos 6 meses).</p>
          </div>
          <div className="h-[260px] md:h-[280px] w-full min-h-[260px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }}
                    dy={15}
                  />
                  <YAxis hide />
                  <Tooltip 
                    content={<CustomRevenueTooltip />}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-5 shadow-sm flex flex-col items-center justify-center">
          <div className="mb-5 w-full text-center">
            <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Fases do Funil</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-bold">Distribuição por Status</p>
          </div>
          <div className="h-[220px] md:h-[240px] w-full relative min-h-[220px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                  >
                    {stageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<CustomPieTooltip />}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-foreground">{deals.filter(d => STAGES.some(s => s.id === d.stage)).length}</span>
              <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Negócios</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 justify-center">
            {stageData.map((stage) => (
              <div key={stage.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">{stage.name}</span>
                <span className="text-[9.5px] font-bold text-muted-foreground/50 ml-0.5">{stage.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-5">
        <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-5 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Saúde da Carteira</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Eficiência multidimensional.</p>
          </div>
          <div className="h-[260px] md:h-[280px] w-full min-h-[260px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} />
                  <Radar
                    name="Enterprise"
                    dataKey="A"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.1}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl md:rounded-3xl border border-border p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
               <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Performance Proativa</h3>
              <p className="text-xs text-muted-foreground">Acompanhamento vs Objetivos.</p>
            </div>
          </div>
          
          <div className="space-y-5">
            {['Volume de Leads', 'Vendas Diretas', 'Faturamento', 'Retorno ROI'].map((item, i) => {
              const val = [85, 40, 65, 30][i];
              return (
                <div key={item} className="space-y-2">
                  <div className="flex justify-between text-[9.5px] font-bold uppercase tracking-wider">
                    <span>{item}</span>
                    <span className={val > 50 ? 'text-emerald-500' : 'text-blue-500'}>{val}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${val}%` }}
                      className={cn("h-full rounded-full", val > 50 ? "bg-emerald-500" : "bg-primary")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ReportsView;
