"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  FileText, 
  Printer, 
  Share2, 
  Send, 
  X, 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  Building2, 
  User, 
  Clock, 
  AlertCircle,
  Copy,
  Check
} from "lucide-react";
import { motion } from "motion/react";
import { Deal, Contact, Company, Property, createTimelineEvent, getProperty } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { formatCurrencyBRL } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CommercialProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal;
  contact: Contact | null;
  company: Company | null;
  brokerName?: string;
  brokerCreci?: string;
}

export function CommercialProposalModal({
  isOpen,
  onClose,
  deal,
  contact,
  company,
  brokerName = "Corretor de Imóveis",
  brokerCreci = "CRECI-SP / Brasil",
}: CommercialProposalModalProps) {
  const [property, setProperty] = useState<Property | null>(null);
  const [loadingProperty, setLoadingProperty] = useState(false);

  // Proposal form state
  const [offerValue, setOfferValue] = useState<number>(deal.value || 0);
  const [downPayment, setDownPayment] = useState<number>(Math.round((deal.value || 0) * 0.2));
  const [financingValue, setFinancingValue] = useState<number>(Math.round((deal.value || 0) * 0.8));
  const [fgtsValue, setFgtsValue] = useState<number>(0);
  const [installmentsValue, setInstallmentsValue] = useState<number>(0);
  const [installmentsCount, setInstallmentsCount] = useState<number>(12);
  const [tradeInValue, setTradeInValue] = useState<number>(0);
  const [tradeInDesc, setTradeInDesc] = useState<string>("");
  const [validityDays, setValidityDays] = useState<number>(5);
  const [specialConditions, setSpecialConditions] = useState<string>(
    "Proposta sujeita à aprovação de crédito imobiliário pelo agente financeiro e apresentação de certidões negativas de praxe dos proprietários e do imóvel livres de ônus."
  );

  const [copied, setCopied] = useState(false);
  const [isSavingTimeline, setIsSavingTimeline] = useState(false);

  // Fetch linked property if deal has propertyId
  useEffect(() => {
    if (deal.propertyId) {
      setLoadingProperty(true);
      getProperty(deal.propertyId)
        .then((p) => {
          if (p) setProperty(p);
        })
        .catch(console.error)
        .finally(() => setLoadingProperty(false));
    }
  }, [deal.propertyId]);

  // Sync default values when modal opens
  useEffect(() => {
    if (isOpen) {
      const baseVal = deal.value || 0;
      setOfferValue(baseVal);
      setDownPayment(Math.round(baseVal * 0.2));
      setFinancingValue(Math.round(baseVal * 0.8));
    }
  }, [isOpen, deal.value]);

  // Calculate total payment composition
  const paymentSum = useMemo(() => {
    return Number(downPayment || 0) + 
      Number(financingValue || 0) + 
      Number(fgtsValue || 0) + 
      Number(installmentsValue || 0) + 
      Number(tradeInValue || 0);
  }, [downPayment, financingValue, fgtsValue, installmentsValue, tradeInValue]);

  const downPaymentPercent = useMemo(() => {
    if (!offerValue || offerValue === 0) return 0;
    return Math.round(((downPayment || 0) / offerValue) * 100);
  }, [offerValue, downPayment]);

  const difference = useMemo(() => {
    return offerValue - paymentSum;
  }, [offerValue, paymentSum]);

  // Generate formatted WhatsApp message
  const whatsappMessage = useMemo(() => {
    const lines = [
      `*PROPOSTA COMERCIAL DE COMPRA / LOCAÇÃO*`,
      `*Negociação:* ${deal.title}`,
      property ? `*Imóvel:* ${property.title} (${property.location || ""})` : null,
      contact ? `*Proponente:* ${contact.name}` : null,
      ``,
      `*CONDIÇÕES FINANCEIRAS DA OFERTA:*`,
      `• *Valor Ofertado:* ${formatCurrencyBRL(offerValue)}`,
      downPayment > 0 ? `• *Sinal / Entrada:* ${formatCurrencyBRL(downPayment)} (${downPaymentPercent}%)` : null,
      financingValue > 0 ? `• *Financiamento Bancário:* ${formatCurrencyBRL(financingValue)}` : null,
      fgtsValue > 0 ? `• *Recursos Próprios / FGTS:* ${formatCurrencyBRL(fgtsValue)}` : null,
      installmentsValue > 0 ? `• *Parcelamento Direto:* ${formatCurrencyBRL(installmentsValue)} (em ${installmentsCount}x)` : null,
      tradeInValue > 0 ? `• *Permuta / Veículo:* ${formatCurrencyBRL(tradeInValue)} (${tradeInDesc || "A avaliar"})` : null,
      ``,
      `*Validade da Proposta:* ${validityDays} dias úteis`,
      specialConditions ? `*Condições:* ${specialConditions}` : null,
      ``,
      `_Proposta intermediada por: ${brokerName} (${brokerCreci})_`,
    ].filter(Boolean);

    return lines.join("\n");
  }, [deal.title, property, contact, offerValue, downPayment, downPaymentPercent, financingValue, fgtsValue, installmentsValue, installmentsCount, tradeInValue, tradeInDesc, validityDays, specialConditions, brokerName, brokerCreci]);

  // Copy text to clipboard
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopied(true);
    toast.success("Texto da proposta copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 3000);
  };

  // Open WhatsApp Web or App
  const handleOpenWhatsApp = () => {
    const phone = contact?.phone?.replace(/\D/g, "") || "";
    let url = "";
    if (phone && phone.length >= 10) {
      const ddi = phone.startsWith("55") ? "" : "55";
      url = `https://wa.me/${ddi}${phone}?text=${encodeURIComponent(whatsappMessage)}`;
    } else {
      url = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
    }

    recordAuditEvent({
      action: "SHARE_COMMERCIAL_PROPOSAL",
      title: "Envio de Proposta via WhatsApp",
      content: `Proposta no valor de ${formatCurrencyBRL(offerValue)} disparada para o cliente "${contact?.name || "Cliente"}".`,
      severity: "info",
      category: "modification",
      relatedId: deal.id,
      entityType: "deal"
    });

    window.open(url, "_blank");
  };

  // Log proposal to Deal Timeline
  const handleSaveToTimeline = async () => {
    try {
      setIsSavingTimeline(true);
      await createTimelineEvent({
        type: "system",
        category: "deal",
        relatedId: deal.id,
        title: "Proposta Comercial Emitida",
        content: `Proposta formal de ${formatCurrencyBRL(offerValue)} (Entrada: ${formatCurrencyBRL(downPayment)}, Validade: ${validityDays} dias) registrada por ${brokerName}.`,
        metadata: {
          offerValue,
          downPayment,
          financingValue,
          fgtsValue,
          installmentsValue,
          tradeInValue,
          validityDays
        }
      });

      recordAuditEvent({
        action: "CREATE_COMMERCIAL_PROPOSAL",
        title: "Registro de Proposta Comercial",
        content: `Proposta de ${formatCurrencyBRL(offerValue)} registrada no histórico da negociação "${deal.title}".`,
        severity: "info",
        category: "modification",
        relatedId: deal.id,
        entityType: "deal"
      });

      toast.success("Proposta gravada com sucesso na linha do tempo!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar na linha do tempo.");
    } finally {
      setIsSavingTimeline(false);
    }
  };

  // Generate printable / PDF window
  const handlePrintProposal = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Por favor, permita pop-ups para gerar o documento da proposta.");
      return;
    }

    const todayStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const validityDateStr = format(
      new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
      "dd/MM/yyyy"
    );

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Proposta Comercial - ${deal.title}</title>
        <style>
          @page { margin: 15mm; size: A4 portrait; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.5;
            margin: 0;
            padding: 24px;
            font-size: 13px;
          }
          .header-table {
            width: 100%;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .title { font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 3px; }
          .doc-num { text-align: right; font-size: 11px; font-weight: bold; color: #475569; }
          .section { margin-bottom: 18px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          .section-title {
            background-color: #f8fafc;
            padding: 8px 12px;
            font-weight: 700;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
          }
          .section-body { padding: 12px; }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; }
          .info-value { font-size: 13px; font-weight: 600; color: #0f172a; }
          .financial-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
          }
          .financial-table th {
            background: #f1f5f9;
            text-align: left;
            padding: 8px 10px;
            font-size: 11px;
            color: #475569;
            border-bottom: 1px solid #cbd5e1;
          }
          .financial-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 12px;
          }
          .total-row td {
            font-weight: 800;
            font-size: 14px;
            background: #f8fafc;
            border-top: 2px solid #0f172a;
            color: #0f172a;
          }
          .clauses-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 10px;
            border-radius: 6px;
            font-size: 11px;
            line-height: 1.6;
            color: #334155;
          }
          .signatures {
            margin-top: 40px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            text-align: center;
          }
          .sig-line {
            border-top: 1px solid #0f172a;
            margin-top: 45px;
            padding-top: 6px;
            font-weight: 700;
            font-size: 11px;
          }
          .sig-role { font-size: 10px; color: #64748b; }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <h1 class="title">Proposta de Compra e Venda / Locação</h1>
              <div class="subtitle">Documento de Intenção Formal de Negócio Imobiliário</div>
            </td>
            <td class="doc-num">
              <div>Ref: #${deal.id.slice(0, 8).toUpperCase()}</div>
              <div>Data de Emissão: ${todayStr}</div>
              <div>Validade: até ${validityDateStr}</div>
            </td>
          </tr>
        </table>

        <!-- 1. Proponente Comprador / Locatário -->
        <div class="section">
          <div class="section-title">1. Dados do Proponente Comprador</div>
          <div class="section-body">
            <div class="info-grid">
              <div>
                <div class="info-label">Nome Completo</div>
                <div class="info-value">${contact?.name || "Não informado"}</div>
              </div>
              <div>
                <div class="info-label">Telefone / WhatsApp</div>
                <div class="info-value">${contact?.phone || "Não informado"}</div>
              </div>
              <div>
                <div class="info-label">E-mail</div>
                <div class="info-value">${contact?.email || "Não informado"}</div>
              </div>
              <div>
                <div class="info-label">Empresa / Ocupação</div>
                <div class="info-value">${company?.name || contact?.role || "Particular"}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Objeto / Imóvel -->
        <div class="section">
          <div class="section-title">2. Identificação do Objeto / Imóvel</div>
          <div class="section-body">
            <div class="info-grid">
              <div>
                <div class="info-label">Título da Negociação</div>
                <div class="info-value">${deal.title}</div>
              </div>
              <div>
                <div class="info-label">Tipo de Imóvel</div>
                <div class="info-value">${property?.type ? property.type.toUpperCase() : "Imóvel Residencial / Comercial"}</div>
              </div>
              <div>
                <div class="info-label">Localização / Endereço</div>
                <div class="info-value">${property?.location || property?.street ? `${property.street || ""} ${property.neighborhood || ""}, ${property.city || ""}` : "Conforme cadastro da ficha técnica"}</div>
              </div>
              <div>
                <div class="info-label">Área Privativa</div>
                <div class="info-value">${property?.area ? `${property.area} m²` : "A conferir em certidão"}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Condições Financeiras -->
        <div class="section">
          <div class="section-title">3. Condições de Pagamento e Valores da Oferta</div>
          <div class="section-body">
            <table class="financial-table">
              <thead>
                <tr>
                  <th>Discriminação da Condição de Pagamento</th>
                  <th style="width: 120px; text-align: right;">Participação</th>
                  <th style="width: 180px; text-align: right;">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sinal e Princípio de Pagamento (Entrada na assinatura)</td>
                  <td style="text-align: right;">${downPaymentPercent}%</td>
                  <td style="text-align: right; font-weight: 600;">${formatCurrencyBRL(downPayment)}</td>
                </tr>
                ${financingValue > 0 ? `
                <tr>
                  <td>Financiamento Bancário / Carta de Crédito</td>
                  <td style="text-align: right;">${Math.round((financingValue / offerValue) * 100)}%</td>
                  <td style="text-align: right; font-weight: 600;">${formatCurrencyBRL(financingValue)}</td>
                </tr>` : ""}
                ${fgtsValue > 0 ? `
                <tr>
                  <td>Recursos Próprios / Saldo de FGTS</td>
                  <td style="text-align: right;">${Math.round((fgtsValue / offerValue) * 100)}%</td>
                  <td style="text-align: right; font-weight: 600;">${formatCurrencyBRL(fgtsValue)}</td>
                </tr>` : ""}
                ${installmentsValue > 0 ? `
                <tr>
                  <td>Parcelamento Direto com Proprietário (${installmentsCount} parcelas mensais)</td>
                  <td style="text-align: right;">${Math.round((installmentsValue / offerValue) * 100)}%</td>
                  <td style="text-align: right; font-weight: 600;">${formatCurrencyBRL(installmentsValue)}</td>
                </tr>` : ""}
                ${tradeInValue > 0 ? `
                <tr>
                  <td>Dação em Pagamento / Permuta (${tradeInDesc || "Veículo/Imóvel a vistoriar"})</td>
                  <td style="text-align: right;">${Math.round((tradeInValue / offerValue) * 100)}%</td>
                  <td style="text-align: right; font-weight: 600;">${formatCurrencyBRL(tradeInValue)}</td>
                </tr>` : ""}
                <tr class="total-row">
                  <td>VALOR TOTAL DA PROPOSTA OFERTADA</td>
                  <td style="text-align: right;">100%</td>
                  <td style="text-align: right;">${formatCurrencyBRL(offerValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 4. Cláusulas e Condições -->
        <div class="section">
          <div class="section-title">4. Cláusulas Especiais e Disposições Gerais</div>
          <div class="section-body">
            <div class="clauses-box">
              <p style="margin: 0 0 8px 0;"><strong>A) Validade:</strong> A presente proposta é irrevogável e irretratável pelo prazo de <strong>${validityDays} (${validityDays === 1 ? "um" : validityDays}) dias úteis</strong> a contar da data de sua assinatura.</p>
              <p style="margin: 0 0 8px 0;"><strong>B) Due Diligence e Certidões:</strong> A efetivação do negócio fica condicionada à apresentação e aprovação de certidões pessoais dos proprietários e do imóvel livres e desembaraçadas de quaisquer ônus, hipotecas, penhoras ou ações reipersecutórias.</p>
              <p style="margin: 0;"><strong>C) Condições Adicionais:</strong> ${specialConditions}</p>
            </div>
          </div>
        </div>

        <!-- Assinaturas -->
        <div class="signatures">
          <div>
            <div class="sig-line">${contact?.name || "Proponente Comprador"}</div>
            <div class="sig-role">Proponente Comprador</div>
          </div>
          <div>
            <div class="sig-line">${brokerName}</div>
            <div class="sig-role">Corretor Intermediador (${brokerCreci})</div>
          </div>
          <div>
            <div class="sig-line">Proprietário / Vendedor</div>
            <div class="sig-role">De Acordo / Aceite da Proposta</div>
          </div>
        </div>

        <div class="footer">
          Documento gerado através do CRM SalesScore em ${todayStr}. Código de Verificação: ${deal.id}
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Trigger print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);

    recordAuditEvent({
      action: "PRINT_COMMERCIAL_PROPOSAL",
      title: "Impressão de Proposta Comercial",
      content: `Ficha formal de proposta no valor de ${formatCurrencyBRL(offerValue)} gerada para o negócio "${deal.title}".`,
      severity: "info",
      category: "modification",
      relatedId: deal.id,
      entityType: "deal"
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Gerador de Proposta Comercial Formal</h2>
              <p className="text-xs text-muted-foreground">Emita propostas timbradas prontas para PDF, impressão e WhatsApp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Linked Deal & Parties Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/30 border border-border/80 rounded-xl p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-background rounded-lg flex items-center justify-center text-muted-foreground shadow-xs shrink-0">
                <DollarSign className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Negócio</p>
                <p className="text-xs font-bold text-foreground truncate">{deal.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-background rounded-lg flex items-center justify-center text-muted-foreground shadow-xs shrink-0">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Proponente</p>
                <p className="text-xs font-bold text-foreground truncate">{contact?.name || "Sem contato vinculado"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-background rounded-lg flex items-center justify-center text-muted-foreground shadow-xs shrink-0">
                <Building2 className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Imóvel Vinculado</p>
                <p className="text-xs font-bold text-foreground truncate">{property?.title || "Imóvel do Funil"}</p>
              </div>
            </div>
          </div>

          {/* Value Inputs */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Composição da Oferta Financeira</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Valor da Proposta */}
              <div className="sm:col-span-1 bg-card border-2 border-primary/40 rounded-xl p-3 shadow-xs">
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  Valor Total da Proposta (R$) <span className="text-primary">*</span>
                </label>
                <input
                  type="number"
                  value={offerValue}
                  onChange={(e) => setOfferValue(Number(e.target.value))}
                  className="w-full text-sm font-black bg-transparent border-0 text-primary focus:ring-0 p-0"
                  placeholder="0,00"
                />
                <span className="text-[10px] font-bold text-muted-foreground mt-1 block">
                  {formatCurrencyBRL(offerValue)}
                </span>
              </div>

              {/* Sinal / Entrada */}
              <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-foreground">Sinal / Entrada (R$)</label>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {downPaymentPercent}%
                  </span>
                </div>
                <input
                  type="number"
                  value={downPayment}
                  onChange={(e) => setDownPayment(Number(e.target.value))}
                  className="w-full text-xs font-bold bg-transparent border-0 text-foreground focus:ring-0 p-0"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {formatCurrencyBRL(downPayment)}
                </span>
              </div>

              {/* Financiamento */}
              <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  Financiamento Bancário (R$)
                </label>
                <input
                  type="number"
                  value={financingValue}
                  onChange={(e) => setFinancingValue(Number(e.target.value))}
                  className="w-full text-xs font-bold bg-transparent border-0 text-foreground focus:ring-0 p-0"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {formatCurrencyBRL(financingValue)}
                </span>
              </div>
            </div>

            {/* Secondary payment items */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* FGTS */}
              <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  Recursos / FGTS (R$)
                </label>
                <input
                  type="number"
                  value={fgtsValue}
                  onChange={(e) => setFgtsValue(Number(e.target.value))}
                  className="w-full text-xs font-bold bg-transparent border-0 text-foreground focus:ring-0 p-0"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {formatCurrencyBRL(fgtsValue)}
                </span>
              </div>

              {/* Parcelamento Direto */}
              <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-foreground">Parcelas Diretas (R$)</label>
                  <select
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                    className="text-[10px] bg-muted border border-border rounded px-1.5 py-0.5"
                  >
                    <option value={6}>6x</option>
                    <option value={12}>12x</option>
                    <option value={24}>24x</option>
                    <option value={36}>36x</option>
                    <option value={48}>48x</option>
                  </select>
                </div>
                <input
                  type="number"
                  value={installmentsValue}
                  onChange={(e) => setInstallmentsValue(Number(e.target.value))}
                  className="w-full text-xs font-bold bg-transparent border-0 text-foreground focus:ring-0 p-0"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {formatCurrencyBRL(installmentsValue)}
                </span>
              </div>

              {/* Permuta / Carro */}
              <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  Permuta / Veículo (R$)
                </label>
                <input
                  type="number"
                  value={tradeInValue}
                  onChange={(e) => setTradeInValue(Number(e.target.value))}
                  className="w-full text-xs font-bold bg-transparent border-0 text-foreground focus:ring-0 p-0"
                />
                <input
                  type="text"
                  value={tradeInDesc}
                  onChange={(e) => setTradeInDesc(e.target.value)}
                  placeholder="Ex: Corolla 2024 FIPE"
                  className="w-full text-[10px] bg-muted/60 border border-border rounded px-1.5 py-0.5 mt-1"
                />
              </div>
            </div>

            {/* Payment Check Bar */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${difference === 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-amber-500/10 border-amber-500/20 text-amber-600"}`}>
              <div className="flex items-center gap-1.5">
                {difference === 0 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>Soma das Condições: {formatCurrencyBRL(paymentSum)}</span>
              </div>
              {difference !== 0 && (
                <span>Diferença da oferta: {formatCurrencyBRL(Math.abs(difference))} ({difference > 0 ? "Faltando" : "Excedente"})</span>
              )}
            </div>
          </div>

          {/* Validity & Conditions */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-1 bg-card border border-border rounded-xl p-3 shadow-xs">
              <label className="text-[11px] font-bold text-foreground block mb-1">
                Validade da Proposta
              </label>
              <select
                value={validityDays}
                onChange={(e) => setValidityDays(Number(e.target.value))}
                className="w-full text-xs bg-muted border border-border rounded-lg p-2 font-medium"
              >
                <option value={3}>3 dias úteis</option>
                <option value={5}>5 dias úteis</option>
                <option value={7}>7 dias úteis</option>
                <option value={10}>10 dias úteis</option>
                <option value={15}>15 dias corridos</option>
                <option value={30}>30 dias corridos</option>
              </select>
            </div>

            <div className="sm:col-span-3 bg-card border border-border rounded-xl p-3 shadow-xs">
              <label className="text-[11px] font-bold text-foreground block mb-1">
                Condições Especiais & Cláusulas Resolutivas
              </label>
              <textarea
                rows={2}
                value={specialConditions}
                onChange={(e) => setSpecialConditions(e.target.value)}
                className="w-full text-xs bg-muted border border-border rounded-lg p-2 font-medium resize-none"
              />
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="bg-muted/40 border border-border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyMessage}
                className="px-3 py-1.5 bg-card hover:bg-muted text-foreground border border-border rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                {copied ? "Copiado!" : "Copiar Texto da Proposta"}
              </button>

              <button
                type="button"
                disabled={isSavingTimeline}
                onClick={handleSaveToTimeline}
                className="px-3 py-1.5 bg-card hover:bg-muted text-foreground border border-border rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5 text-primary" />
                Registrar no Histórico
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar no WhatsApp
              </button>

              <button
                type="button"
                onClick={handlePrintProposal}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-primary/20 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir / PDF
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
          <span>Corretor: <strong className="text-foreground">{brokerName}</strong> ({brokerCreci})</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 hover:bg-muted text-foreground rounded-lg font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
