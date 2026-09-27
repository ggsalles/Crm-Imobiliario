import { format } from "date-fns";
import { Deal, Contact, Property, Activity } from "@/lib/db";
import { STAGES } from "@/lib/constants";
import { formatCurrencyBRL } from "@/lib/utils";

/**
 * Escapes a cell value for CSV (RFC 4180 standard + Excel UTF-8)
 * Also mitigates CSV Formula Injection (Excel / LibreOffice)
 */
export function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();

  // Prevent formula injection in spreadsheet software
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Double quotes inside string
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Creates and downloads a CSV file with UTF-8 BOM support
 */
export function downloadCsvFile(filename: string, headers: string[], rows: (string | number)[][]): void {
  const bom = "\uFEFF";
  const headerLine = headers.map(escapeCsvCell).join(";");
  const dataLines = rows.map(row => row.map(escapeCsvCell).join(";")).join("\r\n");
  const csvContent = `${bom}${headerLine}\r\n${dataLines}`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Creates and downloads a formatted JSON backup file
 */
export function downloadJsonFile(filename: string, data: any): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports deals (Pipeline) to CSV
 */
export function exportDealsToCsv(
  deals: Deal[],
  contactsMap: Record<string, Contact>,
  propertiesMap: Record<string, Property>,
  filenamePrefix = "funil-de-vendas"
): void {
  const headers = [
    "ID do Negócio",
    "Título da Negociação",
    "Estágio Atual",
    "Valor (R$)",
    "Valor Formatado",
    "Cliente Associado",
    "Telefone do Cliente",
    "Email do Cliente",
    "Imóvel Vinculado",
    "Valor do Imóvel",
    "Motivo de Perda (se aplicável)",
    "Data de Criação",
    "Última Atualização",
    "Identificador do Corretor"
  ];

  const rows = deals.map(deal => {
    const stageObj = STAGES.find(s => s.id === deal.stage);
    const stageName = stageObj ? stageObj.name : deal.stage;
    const contact = deal.contactId ? contactsMap[deal.contactId] : null;
    const property = deal.propertyId ? propertiesMap[deal.propertyId] : null;

    return [
      deal.id || "",
      deal.title || "Sem título",
      stageName || "",
      deal.value || 0,
      formatCurrencyBRL(deal.value || 0),
      contact ? contact.name : "Não vinculado",
      contact?.phone || "",
      contact?.email || "",
      property ? property.title : "Nenhum",
      property ? formatCurrencyBRL(property.price || 0) : "",
      deal.lostReason || "",
      deal.createdAt ? format(new Date(deal.createdAt), "dd/MM/yyyy HH:mm") : "",
      deal.updatedAt ? format(new Date(deal.updatedAt), "dd/MM/yyyy HH:mm") : "",
      deal.ownerId || ""
    ];
  });

  const dateSuffix = format(new Date(), "yyyy-MM-dd_HHmm");
  downloadCsvFile(`${filenamePrefix}_${dateSuffix}.csv`, headers, rows);
}

/**
 * Exports activities (tasks, calls, meetings) to CSV
 */
export function exportActivitiesToCsv(
  activities: Activity[],
  contactsMap: Record<string, Contact>,
  dealsMap: Record<string, Deal>,
  filenamePrefix = "atividades-tarefas"
): void {
  const headers = [
    "ID",
    "Título da Atividade",
    "Tipo de Atividade",
    "Status",
    "Data e Hora Agendada",
    "Cliente Vinculado",
    "Negociação Vinculada",
    "Descrição / Observações",
    "Corretor Responsável"
  ];

  const typeLabels: Record<string, string> = {
    meeting: "Reunião / Visita",
    call: "Ligação",
    email: "E-mail",
    task: "Tarefa"
  };

  const rows = activities.map(act => {
    const contact = act.contactId ? contactsMap[act.contactId] : null;
    const deal = act.dealId ? dealsMap[act.dealId] : null;

    let dateStr = "";
    try {
      if (act.date) {
        dateStr = format(new Date(act.date), "dd/MM/yyyy HH:mm");
      }
    } catch {
      dateStr = String(act.date || "");
    }

    return [
      act.id || "",
      act.title || "",
      typeLabels[act.type] || act.type || "Tarefa",
      act.status === "completed" ? "Concluída" : "Pendente",
      dateStr,
      contact ? contact.name : "",
      deal ? deal.title : "",
      (act.description || "").replace(/\n/g, " "),
      act.ownerId || ""
    ];
  });

  const dateSuffix = format(new Date(), "yyyy-MM-dd_HHmm");
  downloadCsvFile(`${filenamePrefix}_${dateSuffix}.csv`, headers, rows);
}

/**
 * Exports executive dashboard metrics and revenue summary to CSV
 */
export function exportExecutiveSummaryToCsv(
  deals: Deal[],
  contacts: Contact[],
  activities: Activity[],
  progressPercentage: number,
  filenamePrefix = "relatorio-executivo-consolidado"
): void {
  const headers = [
    "Indicador Executivo",
    "Valor Quantitativo",
    "Valor Financeiro (R$)",
    "Percentual / Status"
  ];

  const totalDeals = deals.length;
  const closedDeals = deals.filter(d => d.stage === "won");
  const closedValue = closedDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const activeDeals = deals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const activeValue = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const lostDeals = deals.filter(d => d.stage === "lost");
  const lostValue = lostDeals.reduce((sum, d) => sum + (d.value || 0), 0);

  const completedActivities = activities.filter(a => a.status === "completed").length;
  const pendingActivities = activities.filter(a => a.status !== "completed").length;

  const rows: (string | number)[][] = [
    ["Receita Total Fechada", closedDeals.length, formatCurrencyBRL(closedValue), "Vendas Ganhas"],
    ["Pipeline em Aberto (Ativo)", activeDeals.length, formatCurrencyBRL(activeValue), "Em Negociação"],
    ["Negócios Perdidos", lostDeals.length, formatCurrencyBRL(lostValue), "Perdidos"],
    ["Total de Negócios Registrados", totalDeals, formatCurrencyBRL(deals.reduce((s, d) => s + (d.value || 0), 0)), "100% da Base"],
    ["Total de Clientes na Carteira", contacts.length, "-", `${contacts.filter(c => c.type !== "equipe").length} Clientes`],
    ["Total de Atividades Agendadas", activities.length, "-", `${completedActivities} Concluídas / ${pendingActivities} Pendentes`],
    ["Taxa de Conversão do Funil", `${totalDeals > 0 ? ((closedDeals.length / totalDeals) * 100).toFixed(1) : "0"}%`, "-", "Taxa de Sucesso"],
    ["Progresso em Relação à Meta", "-", "-", `${Math.round(progressPercentage)}% Atingido`]
  ];

  // Also append stage breakdown
  rows.push(["--- FASES DO FUNIL ---", "---", "---", "---"]);
  for (const st of STAGES) {
    const stageDeals = deals.filter(d => d.stage === st.id);
    const stageVal = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    rows.push([
      `Fase: ${st.name}`,
      stageDeals.length,
      formatCurrencyBRL(stageVal),
      `${totalDeals > 0 ? ((stageDeals.length / totalDeals) * 100).toFixed(1) : 0}% dos negócios`
    ]);
  }

  const dateSuffix = format(new Date(), "yyyy-MM-dd");
  downloadCsvFile(`${filenamePrefix}_${dateSuffix}.csv`, headers, rows);
}
