"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { 
  Sparkles, 
  Tag, 
  Plus, 
  X, 
  Check, 
  Upload, 
  Loader2, 
  Star, 
  Zap 
} from "lucide-react";
import { 
  Property, 
  Contact, 
  createProperty, 
  updateProperty, 
  uploadFile, 
  createDeal, 
  createTimelineEvent 
} from "@/lib/db";
import { 
  cn, 
  formatCurrencyBRL, 
  parseCurrencyBRLToNumber, 
  formatCEP 
} from "@/lib/utils";
import { recordAuditEvent } from "@/lib/audit";
import { TAG_CATEGORIES } from "@/lib/property-tags";
import { PropertyValuationCard, ValuationResult } from "@/components/PropertyValuationCard";
import { toast } from "sonner";

interface PropertyFormProps {
  editingProperty: Property | null;
  properties: Property[];
  contacts: Contact[];
  user: any;
  onCancel: () => void;
  onSuccess: () => void;
}

export function PropertyForm({
  editingProperty,
  properties,
  contacts,
  user,
  onCancel,
  onSuccess
}: PropertyFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const isSubmittingRef = useRef(false);

  const [title, setTitle] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [displayPrice, setDisplayPrice] = useState("");
  const [displayIptu, setDisplayIptu] = useState("");
  const [displayCondoFee, setDisplayCondoFee] = useState("");
  const [cep, setCep] = useState("");
  const [areaInput, setAreaInput] = useState<string>("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [addressData, setAddressData] = useState({
    street: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isEstimatingPrice, setIsEstimatingPrice] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [valuationResult, setValuationResult] = useState<ValuationResult | null>(null);

  // Initialize form when editingProperty changes
  useEffect(() => {
    if (editingProperty) {
      setTitle(editingProperty.title || "");
      setBuildingName(editingProperty.buildingName || "");
      setDisplayPrice(formatCurrencyBRL(editingProperty.price || 0));
      setDisplayIptu(editingProperty.iptu ? formatCurrencyBRL(editingProperty.iptu) : "");
      setDisplayCondoFee(editingProperty.condoFee ? formatCurrencyBRL(editingProperty.condoFee) : "");
      setImageUrls(editingProperty.imageUrls || []);
      setCep(formatCEP(editingProperty.cep || ""));
      setAreaInput(editingProperty.area ? String(editingProperty.area) : "");
      setSelectedTags(editingProperty.tags || []);
      setIsFeatured(Boolean(editingProperty.isFeatured));
      setAddressData({
        street: editingProperty.street || "",
        neighborhood: editingProperty.neighborhood || "",
        city: editingProperty.city || "",
        state: editingProperty.state || "",
      });
    } else {
      setTitle("");
      setBuildingName("");
      setDisplayPrice("");
      setDisplayIptu("");
      setDisplayCondoFee("");
      setImageUrls([]);
      setCep("");
      setAreaInput("");
      setSelectedTags([]);
      setIsFeatured(false);
      setAddressData({ street: "", neighborhood: "", city: "", state: "" });
    }
    setCustomTagInput("");
    setValuationResult(null);
  }, [editingProperty]);

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const rawCep = e.target.value.replace(/\D/g, "");
    if (rawCep.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setAddressData({
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
        });
      } else {
        toast.error("CEP não encontrado.");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleSuggestPrice = async () => {
    if (!formRef.current) return;
    const form = formRef.current;
    const formElements = form.elements as any;

    const propertyType = formElements.type?.value || editingProperty?.type || "apartamento";
    const neighborhood = addressData.neighborhood || formElements.neighborhood?.value || "";
    const city = addressData.city || formElements.city?.value || "";
    const state = addressData.state || formElements.state?.value || "";
    const area = parseFloat(areaInput || formElements.area?.value || "0") || 0;
    const bedrooms = parseInt(formElements.bedrooms?.value || "0") || 0;
    const bathrooms = parseInt(formElements.bathrooms?.value || "0") || 0;
    const parkingSpots = parseInt(formElements.parkingSpots?.value || "0") || 0;
    const acceptsFinancing = formElements.acceptsFinancing?.checked ?? true;
    const currentPriceNum = parseCurrencyBRLToNumber(displayPrice);

    if (!city && !neighborhood && area <= 0) {
      toast.warning("Para estimar o valor com precisão, preencha ao menos o Bairro/Cidade ou a Área (m²).");
      return;
    }

    setIsEstimatingPrice(true);
    const toastId = toast.loading("Consultando inteligência de mercado imobiliário...");

    try {
      const similarInPortfolio = properties.filter(p => 
        p.area > 0 && p.price > 0 && (
          (neighborhood && p.neighborhood?.toLowerCase() === neighborhood.toLowerCase()) ||
          (city && p.city?.toLowerCase() === city.toLowerCase()) ||
          p.type === propertyType
        )
      );

      let portfolioAvgM2: number | null = null;
      if (similarInPortfolio.length > 0) {
        const sumM2 = similarInPortfolio.reduce((acc, p) => acc + (p.price / p.area), 0);
        portfolioAvgM2 = Math.round(sumM2 / similarInPortfolio.length);
      }

      const res = await fetch("/api/properties/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: propertyType,
          neighborhood,
          city,
          state,
          area,
          bedrooms,
          bathrooms,
          parkingSpots,
          acceptsFinancing,
          currentPrice: currentPriceNum,
          condoFee: parseCurrencyBRLToNumber(displayCondoFee),
          iptu: parseCurrencyBRLToNumber(displayIptu),
          buildingName: buildingName.trim(),
          portfolioAverageM2: portfolioAvgM2
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Falha na estimativa de valor.");
      }

      const data: ValuationResult = await res.json();
      data.portfolioAvgM2 = portfolioAvgM2;
      data.matchingPropertiesCount = similarInPortfolio.length;

      setValuationResult(data);
      toast.success("Avaliação de mercado gerada com sucesso!", { id: toastId });
    } catch (err: any) {
      console.error("Erro na avaliação:", err);
      toast.error(err.message || "Não foi possível gerar a sugestão de preço.", { id: toastId });
    } finally {
      setIsEstimatingPrice(false);
    }
  };

  const handleApplyValuationPrice = (priceVal: number) => {
    setDisplayPrice(formatCurrencyBRL(priceVal));
  };

  const processFiles = useCallback(async (incomingFiles: FileList | File[]) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    const files = Array.from(incomingFiles);
    const totalFiles = files.length;
    let uploadedCount = 0;
    
    setIsUploading(true);
    const toastId = toast.loading(`Processando ${totalFiles} ${totalFiles === 1 ? 'imagem' : 'imagens'}...`);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        toast.loading(`Enviando ${i + 1} de ${totalFiles}: ${file.name}`, { id: toastId });
        
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`Arquivo "${file.name}" excede 10MB.`, { duration: 3000 });
          continue;
        }

        try {
          await new Promise(resolve => setTimeout(resolve, 300));

          if (file.size === 0) {
            toast.error(`Arquivo "${file.name}" está vazio.`, { duration: 3000 });
            continue;
          }

          const uploadTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout de 60s excedido")), 60000)
          );

          const uploadOp = uploadFile(file, 'property-images', user?.id);
          const result = await Promise.race([uploadOp, uploadTimeout]) as { url: string };
          
          if (result && result.url) {
            setImageUrls(prev => [...prev, result.url]);
            uploadedCount++;
          }
        } catch (err: any) {
          console.error(`Falha no upload da imagem ${i+1}:`, err);
          toast.error(`Não foi possível enviar: ${file.name}`, { duration: 3000 });
        }
      }

      if (uploadedCount > 0) {
        toast.success(`${uploadedCount} ${uploadedCount === 1 ? 'imagem enviada' : 'imagens enviadas'} com sucesso!`, { id: toastId });
      } else {
        toast.error("Nenhuma imagem foi enviada corretamente.", { id: toastId });
      }
    } catch (error: any) {
      console.error("Erro no upload de imagens:", error);
      toast.error("Erro ao processar lote de imagens.", { id: toastId });
    } finally {
      setIsUploading(false);
    }
  }, [user?.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;
    const files = e.target.files;
    if (files) {
      await processFiles(files);
      e.target.value = '';
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  }, [processFiles, isUploading]);

  const handleCreateOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving || isUploading || isFetchingCep || isSubmittingRef.current) {
      if (isUploading) toast.error("Aguarde o upload das imagens terminar.");
      if (isFetchingCep) toast.error("Aguarde a busca do CEP terminar.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    setIsSaving(true);
    isSubmittingRef.current = true;

    const uiTimeoutId = setTimeout(() => {
      if (isSubmittingRef.current) {
        setIsSaving(false);
        isSubmittingRef.current = false;
        toast.dismiss();
        toast.error("O servidor demorou demais para responder. Tente novamente.");
      }
    }, 45000);
    
    let toastId: string | number = "saving-toast";
    
    try {
      if (!user) throw new Error("Sessão inválida ou expirada.");
      
      const neighborhood = String(formData.get("neighborhood") || "");
      const city = String(formData.get("city") || "");
      const state = String(formData.get("state") || "");
      const location = String(formData.get("location") || "") || `${neighborhood}, ${city} - ${state}`;

      const isEditing = !!editingProperty;
      const currentPropertyId = editingProperty?.id;

      const cleanUrls = imageUrls.filter(url => 
        typeof url === 'string' &&
        url.trim() !== "" && 
        !url.startsWith('data:image')
      ).map(u => String(u).trim());

      const data: Partial<Property> = {
        title: String(formData.get("title") || "").substring(0, 200),
        buildingName: String(formData.get("buildingName") || "").trim().substring(0, 200),
        type: (formData.get("type") as any) || "apartamento",
        status: (formData.get("status") as any) || "disponível",
        price: Number(parseCurrencyBRLToNumber(String(formData.get("price") || "0"))),
        iptu: Number(parseCurrencyBRLToNumber(String(formData.get("iptu") || "0"))),
        condoFee: Number(parseCurrencyBRLToNumber(String(formData.get("condoFee") || "0"))),
        location: location.substring(0, 500),
        cep: String(formData.get("cep") || "").replace(/\D/g, "").substring(0, 8),
        street: String(formData.get("street") || "").substring(0, 200),
        neighborhood: neighborhood.substring(0, 100),
        city: city.substring(0, 100),
        state: state.substring(0, 2),
        number: String(formData.get("number") || "").substring(0, 20),
        complement: String(formData.get("complement") || "").substring(0, 200),
        area: Number(formData.get("area") || 0),
        bedrooms: Number(formData.get("bedrooms") || 0),
        bathrooms: Number(formData.get("bathrooms") || 0),
        parkingSpots: Number(formData.get("parkingSpots") || 0),
        acceptsFinancing: formData.get("acceptsFinancing") === "on",
        isFeatured: formData.get("isFeatured") === "on" || isFeatured,
        notes: String(formData.get("notes") || "").substring(0, 2000),
        description: String(formData.get("description") || "").substring(0, 5000),
        tags: selectedTags,
        imageUrls: cleanUrls,
      };

      toastId = toast.loading(isEditing ? "Atualizando registro..." : "Salvando novo imóvel...");

      if (isEditing && currentPropertyId) {
        await updateProperty(currentPropertyId, data, user.id);
        recordAuditEvent({
          action: 'UPDATE_PROPERTY',
          title: 'Edição de Imóvel',
          content: `Imóvel "${data.title}" foi editado e atualizado no catálogo.`,
          severity: 'medium',
          category: 'modification',
          relatedId: currentPropertyId,
          entityId: currentPropertyId,
          entityType: 'property',
          metadata: {
            title: data.title,
            price: data.price,
            location: data.location,
            type: data.type
          }
        });
      } else {
        const newId = await createProperty(data, user.id);
        recordAuditEvent({
          action: 'CREATE_PROPERTY',
          title: 'Cadastro de Novo Imóvel',
          content: `Novo imóvel "${data.title}" cadastrado com sucesso no catálogo.`,
          severity: 'info',
          category: 'modification',
          relatedId: newId || undefined,
          entityId: newId || undefined,
          entityType: 'property',
          metadata: {
            title: data.title,
            price: data.price,
            location: data.location,
            type: data.type
          }
        });
      }
      
      clearTimeout(uiTimeoutId);
      toast.success(isEditing ? "Imóvel atualizado com sucesso!" : "Imóvel cadastrado com sucesso!", { id: toastId });
      onSuccess();
    } catch (err: any) {
      console.error("[Properties] Falha crítica no salvamento:", err);
      clearTimeout(uiTimeoutId);
      toast.error(err.message || "Erro ao gravar dados.", { id: toastId });
    } finally {
      setIsSaving(false);
      isSubmittingRef.current = false;
    }
  };

  const getMatchingContactsForProperty = (p: Property) => {
    return contacts
      .map(c => {
        let finalScore = 0;
        let possibleScore = 0;

        let profileOfInt: any = null;
        try {
          if (c.department) {
            profileOfInt = JSON.parse(c.department);
          }
        } catch (e) {}

        if (!profileOfInt) return { contact: c, score: 0 };

        const maxPrice = typeof profileOfInt.maxPrice === 'number' ? profileOfInt.maxPrice : null;
        const minBedrooms = typeof profileOfInt.minBedrooms === 'number' ? profileOfInt.minBedrooms : null;
        const propertyType = typeof profileOfInt.propertyType === 'string' ? profileOfInt.propertyType : "todos";
        const neighborhoods = Array.isArray(profileOfInt.neighborhoods) ? profileOfInt.neighborhoods : [];

        if (maxPrice) {
          possibleScore += 25;
          if (p.price <= maxPrice) finalScore += 25;
          else if (p.price <= maxPrice * 1.15) finalScore += 10;
        }

        if (propertyType && propertyType !== 'todos') {
          possibleScore += 25;
          if (p.type === propertyType) finalScore += 25;
        }

        if (minBedrooms) {
          possibleScore += 25;
          if (p.bedrooms && p.bedrooms >= minBedrooms) finalScore += 25;
        }

        if (neighborhoods && neighborhoods.length > 0) {
          possibleScore += 25;
          const propNeighborhoodClean = (p.neighborhood || "").trim().toLowerCase();
          const matches = neighborhoods.some(n => 
            propNeighborhoodClean.includes(n.trim().toLowerCase()) || 
            n.trim().toLowerCase().includes(propNeighborhoodClean)
          );
          if (matches) finalScore += 25;
        }

        const normScore = possibleScore > 0 ? Math.round((finalScore / possibleScore) * 100) : 0;

        return { contact: c, score: normScore };
      })
      .filter(mc => mc.score >= 40)
      .sort((a, b) => b.score - a.score);
  };

  const handleCreateDealFromPropertyMatch = async (contact: Contact, p: Property) => {
    if (!user) return;
    try {
      const dealTitle = `${p.title} - ${contact.name}`;
      const value = p.price;
      
      await createDeal({
        title: dealTitle,
        value: value,
        stage: 'lead',
        contactId: contact.id,
        propertyId: p.id,
        ownerId: user.id
      });

      await createTimelineEvent({
        type: 'system',
        category: 'contact',
        relatedId: contact.id,
        content: `Lead de imóvel cruzado na visão do Imóvel: associado ao imóvel "${p.title}" com preço de R$ ${p.price.toLocaleString('pt-BR')}.`,
        title: `Novo negócio de cruzamento`
      });

      toast.success("Cruzamento realizado! Novo negócio criado para o cliente.");
    } catch (e: any) {
      console.error("Error creating matching deal:", e);
      toast.error("Erro ao cruzar cliente e criar negócio.");
    }
  };

  return (
    <div className={cn(
      "mx-auto transition-all duration-500",
      editingProperty ? "max-w-7xl" : "max-w-4xl"
    )}>
      <div className={cn(
        "grid grid-cols-1 gap-8",
        editingProperty ? "xl:grid-cols-12" : "grid-cols-1"
      )}>
        <div className={cn(
          editingProperty ? "xl:col-span-8" : "w-full"
        )}>
          <form 
            ref={formRef}
            key={editingProperty?.id || 'new-property'}
            onSubmit={handleCreateOrUpdate} 
            className={cn(
              "bg-card border border-border rounded-[40px] shadow-2xl overflow-hidden pb-12 transition-opacity",
              (isSaving || isUploading) && "opacity-80 cursor-wait"
            )}
          >
            <div className="p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Title */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                    Identificação / Título do Imóvel
                  </label>
                  <input 
                    name="title"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Apartamento Vista Mar Premium"
                    className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>

                {/* Building / Condomínio Name */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center justify-between">
                    <span>Nome do Edifício ou Condomínio</span>
                    <span className="text-[9px] font-semibold text-muted-foreground lowercase">opcional</span>
                  </label>
                  <input 
                    name="buildingName"
                    value={buildingName}
                    onChange={(e) => setBuildingName(e.target.value)}
                    placeholder="Ex: Edifício Solar das Acácias / Cond. Alphaville"
                    className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-base font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>

                {/* Type */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                    Tipo de Unidade
                  </label>
                  <select 
                    name="type"
                    defaultValue={editingProperty?.type || "apartamento"}
                    className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  >
                    <option value="casa">Casa</option>
                    <option value="sobrado">Sobrado</option>
                    <option value="apartamento">Apartamento</option>
                    <option value="cobertura">Cobertura</option>
                    <option value="comercial">Comercial</option>
                    <option value="terreno">Terreno</option>
                    <option value="sítio">Sítio</option>
                    <option value="chácara">Chácara</option>
                    <option value="fazenda">Fazenda</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                    Status Comercial
                  </label>
                  <select 
                    name="status"
                    defaultValue={editingProperty?.status || "disponível"}
                    className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  >
                    <option value="disponível">Disponível</option>
                    <option value="reservado">Reservado</option>
                    <option value="vendido">Vendido</option>
                    <option value="alugado">Alugado</option>
                  </select>
                </div>

                {/* Financial Values & Charges */}
                <div className="md:col-span-2 p-6 sm:p-7 bg-muted/20 border border-border/70 rounded-3xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Valores & Encargos Financeiros</h4>
                      <p className="text-xs text-muted-foreground">Preço de venda e despesas periódicas do imóvel (formatação monetária automática)</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSuggestPrice}
                      disabled={isEstimatingPrice}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all border border-primary/25 disabled:opacity-50 cursor-pointer shadow-xs self-start sm:self-auto"
                      title="Calcular estimativa de preço de mercado com base em dados imobiliários e IA"
                    >
                      {isEstimatingPrice ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          <span>Analisando mercado...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          <span>Sugerir Preço (IA)</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                        Preço de Venda (R$) *
                      </label>
                      <input 
                        name="price"
                        required
                        value={displayPrice}
                        onChange={(e) => setDisplayPrice(formatCurrencyBRL(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        placeholder="R$ 0,00"
                        className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-base font-black text-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      />
                      {parseFloat(areaInput || "0") > 0 && parseCurrencyBRLToNumber(displayPrice) > 0 ? (
                        <p className="text-[11px] font-medium text-muted-foreground pl-1 flex items-center gap-1.5">
                          <span>Média m²:</span>
                          <span className="font-bold text-foreground font-mono">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.round(parseCurrencyBRLToNumber(displayPrice) / parseFloat(areaInput)))} / m²
                          </span>
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-muted-foreground pl-1">Valor de avaliação / venda</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center justify-between">
                        <span>Valor Condomínio (R$)</span>
                        <span className="text-[9px] font-semibold text-muted-foreground lowercase">mensal</span>
                      </label>
                      <input 
                        name="condoFee"
                        value={displayCondoFee}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          setDisplayCondoFee(raw ? formatCurrencyBRL(raw) : "");
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="R$ 0,00"
                        className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-base font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      />
                      <p className="text-[11px] font-medium text-muted-foreground pl-1">Taxa mensal do condomínio</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center justify-between">
                        <span>IPTU (R$)</span>
                        <span className="text-[9px] font-semibold text-muted-foreground lowercase">anual / total</span>
                      </label>
                      <input 
                        name="iptu"
                        value={displayIptu}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          setDisplayIptu(raw ? formatCurrencyBRL(raw) : "");
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder="R$ 0,00"
                        className="w-full px-5 py-3.5 bg-background border border-border rounded-2xl text-base font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      />
                      <p className="text-[11px] font-medium text-muted-foreground pl-1">Valor total anual ou cota única</p>
                    </div>
                  </div>
                </div>

                {/* CEP Input */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex justify-between">
                    CEP
                    {isFetchingCep && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                  </label>
                  <input 
                    name="cep"
                    value={cep}
                    onChange={(e) => setCep(formatCEP(e.target.value))}
                    onBlur={handleCepBlur}
                    required
                    placeholder="00000-000"
                    autoComplete="new-password"
                    className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-mono font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>

                {/* AI Valuation Card Output */}
                {valuationResult && (
                  <div className="md:col-span-2">
                    <PropertyValuationCard
                      valuation={valuationResult}
                      currentPrice={parseCurrencyBRLToNumber(displayPrice)}
                      onApplyPrice={handleApplyValuationPrice}
                      onClose={() => setValuationResult(null)}
                      propertyTitle={title || "Novo Imóvel"}
                    />
                  </div>
                )}

                {/* Street and Number */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Logradouro</label>
                    <input 
                      name="street"
                      required
                      value={addressData.street}
                      onChange={(e) => setAddressData({ ...addressData, street: e.target.value })}
                      className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Número</label>
                    <input 
                      name="number"
                      required
                      defaultValue={editingProperty?.number}
                      className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Neighborhood, City, State */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Bairro</label>
                    <input 
                      name="neighborhood"
                      required
                      value={addressData.neighborhood}
                      onChange={(e) => setAddressData({ ...addressData, neighborhood: e.target.value })}
                      className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Cidade</label>
                    <input 
                      name="city"
                      required
                      value={addressData.city}
                      onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                      className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Estado (UF)</label>
                    <input 
                      name="state"
                      required
                      maxLength={2}
                      value={addressData.state}
                      onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
                      className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-black text-center uppercase focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Map Preview */}
                {cep && cep.replace(/\D/g, "").length === 8 && (
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Localização no Mapa</label>
                    <div className="w-full h-64 rounded-[32px] overflow-hidden border border-border bg-muted/10 shadow-inner relative">
                      <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(`${addressData.street || ""} ${addressData.neighborhood || ""} ${addressData.city || ""} ${addressData.state || ""} ${cep}`.trim())}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      />
                    </div>
                  </div>
                )}

                {/* Specs */}
                <div className="grid grid-cols-2 md:grid-cols-4 md:col-span-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Área (m²)</label>
                    <input 
                      name="area" 
                      type="number" 
                      value={areaInput}
                      onChange={(e) => setAreaInput(e.target.value)}
                      placeholder="Ex: 85"
                      className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Dormitórios</label>
                    <input name="bedrooms" type="number" defaultValue={editingProperty?.bedrooms} className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Banheiros</label>
                    <input name="bathrooms" type="number" defaultValue={editingProperty?.bathrooms} className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Vagas</label>
                    <input name="parkingSpots" type="number" defaultValue={editingProperty?.parkingSpots} className="w-full px-5 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none" />
                  </div>
                </div>

                {/* Checkboxes: Financing and Featured */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-5 bg-muted/20 border border-border rounded-3xl">
                    <input 
                      type="checkbox" 
                      name="acceptsFinancing" 
                      id="acceptsFinancing"
                      defaultChecked={editingProperty?.acceptsFinancing}
                      className="w-5 h-5 accent-primary cursor-pointer"
                    />
                    <label htmlFor="acceptsFinancing" className="text-sm font-bold cursor-pointer select-none">
                      Aceita Financiamento Bancário
                    </label>
                  </div>

                  <div 
                    onClick={() => setIsFeatured(!isFeatured)}
                    className={cn(
                      "flex items-center gap-3 p-5 border rounded-3xl transition-all cursor-pointer",
                      isFeatured 
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400" 
                        : "bg-muted/20 border-border text-foreground hover:bg-muted/30"
                    )}
                  >
                    <input 
                      type="checkbox" 
                      name="isFeatured" 
                      id="isFeatured"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 accent-amber-500 cursor-pointer"
                    />
                    <label 
                      htmlFor="isFeatured" 
                      className="text-sm font-bold cursor-pointer select-none flex items-center gap-2" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Star className={cn("w-4 h-4", isFeatured ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
                      <span>Destaque / Melhores Oportunidades</span>
                    </label>
                  </div>
                </div>

                {/* Description */}
                <div className="md:col-span-2 space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Descritivo Comercial</label>
                  <textarea 
                    name="description"
                    required
                    defaultValue={editingProperty?.description}
                    rows={4}
                    className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all resize-none outline-none"
                  />
                </div>

                {/* Tags & Amenities */}
                <div className="md:col-span-2 p-6 sm:p-7 bg-muted/20 border border-border/70 rounded-3xl space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Tag className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <span>Características, Diferenciais & Comodidades</span>
                          {selectedTags.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                              {selectedTags.length} selecionado{selectedTags.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Adicione comodidades e tags para valorizar seu imóvel na vitrine e acelerar buscas
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = customTagInput.trim();
                            if (val && !selectedTags.some(t => t.toLowerCase() === val.toLowerCase())) {
                              setSelectedTags(prev => [...prev, val]);
                              setCustomTagInput("");
                            }
                          }
                        }}
                        placeholder="Digite uma comodidade e tecle Enter (ex: Vista Panorâmica, Energia Solar, Reformado...)"
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                      {customTagInput && (
                        <button
                          type="button"
                          onClick={() => setCustomTagInput("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const val = customTagInput.trim();
                        if (val && !selectedTags.some(t => t.toLowerCase() === val.toLowerCase())) {
                          setSelectedTags(prev => [...prev, val]);
                          setCustomTagInput("");
                        }
                      }}
                      disabled={!customTagInput.trim()}
                      className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  {selectedTags.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Tags ativas neste imóvel (clique no × para remover):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs animate-in fade-in"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                              className="hover:bg-white/20 rounded-full p-0.5 transition-colors cursor-pointer"
                              title="Remover tag"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
                      Comodidades Frequentes (clique para marcar/desmarcar):
                    </label>
                    <div className="space-y-2.5">
                      {TAG_CATEGORIES.map((cat, catIdx) => (
                        <div key={catIdx} className="space-y-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider block">
                            {cat.category}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {cat.tags.map((tag) => {
                              const isSelected = selectedTags.some(t => t.toLowerCase() === tag.toLowerCase());
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedTags(prev => prev.filter(t => t.toLowerCase() !== tag.toLowerCase()));
                                    } else {
                                      setSelectedTags(prev => [...prev, tag]);
                                    }
                                  }}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1",
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                                      : "bg-background border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                  )}
                                >
                                  {isSelected ? <Check className="w-3 h-3 text-white" /> : <Plus className="w-2.5 h-2.5 opacity-60" />}
                                  <span>{tag}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Images Upload Section */}
                <div className="md:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                      Galeria de Imagens (Anexos)
                    </label>
                  </div>

                  <div 
                    className={cn(
                      "relative p-8 border-2 border-dashed rounded-3xl bg-muted/10 group transition-all cursor-pointer flex flex-col items-center justify-center text-center",
                      isDragging ? "border-primary bg-primary/5 scale-[1.01] shadow-xl shadow-primary/5" : "border-border hover:bg-muted/20 hover:border-primary/50",
                      isUploading && "opacity-50 pointer-events-none"
                    )}
                    onClick={() => document.getElementById('file-upload')?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input 
                      id="file-upload"
                      type="file" 
                      multiple 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload} 
                    />
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-tight">Clique ou arraste fotos aqui</h4>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-2">
                      Suporta múltiplos arquivos • Máximo 10MB por foto
                    </p>
                  </div>

                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {imageUrls.map((url, idx) => (
                        <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden border border-border group bg-muted/50">
                          <Image 
                            src={url} 
                            alt={`Property ${idx}`} 
                            fill
                            className="object-cover" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setImageUrls(imageUrls.filter((_, i) => i !== idx));
                              }}
                              className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer"
                              title="Remover imagem"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form Footer Buttons */}
            <div className="px-10 py-8 bg-muted/30 border-t border-border flex flex-col md:flex-row gap-4">
              <button 
                type="submit" 
                disabled={isSaving || isUploading}
                className="flex-1 bg-primary text-primary-foreground py-5 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
              >
                {(isSaving || isUploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                {isUploading ? "Processando Imagens..." : isSaving ? "Salvando..." : editingProperty ? 'Salvar Alterações' : 'Publicar no Inventário'}
              </button>
              <button 
                type="button" 
                onClick={onCancel}
                className="flex-1 bg-card text-muted-foreground py-5 rounded-2xl text-sm font-black uppercase tracking-widest border border-border hover:bg-background transition-all cursor-pointer"
              >
                Descartar e Sair
              </button>
            </div>
          </form>
        </div>

        {/* Reverse Matching Column (Only when editing an existing property) */}
        {editingProperty && (
          <div className="xl:col-span-4 space-y-8">
            <div className="bg-card border border-border rounded-[40px] p-8 shadow-2xl h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 justify-between mb-6 pb-4 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#00E5FF]/10 flex items-center justify-center text-[#00E5FF] animate-pulse">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">Cruzamento Reverso</h3>
                      <p className="text-xs text-muted-foreground font-medium">Clientes compatíveis</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#00E5FF] px-2.5 py-1.5 bg-[#00E5FF]/10 rounded-xl border border-[#00E5FF]/20">
                    {getMatchingContactsForProperty(editingProperty).length} Match(es)
                  </span>
                </div>

                {(() => {
                  const matches = getMatchingContactsForProperty(editingProperty);
                  if (matches.length === 0) {
                    return (
                      <div className="py-16 text-center text-muted-foreground bg-muted/15 rounded-3xl border border-dashed border-border p-6 flex flex-col justify-center items-center">
                        <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/75 mb-1">
                          Nenhum cliente compatível
                        </p>
                        <p className="text-[11px] leading-relaxed max-w-sm mx-auto text-center">
                          Nenhum cliente cadastrado no CRM possui critérios que correspondam às especificações deste imóvel.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 font-sans">
                      {matches.map(({ contact, score }) => (
                        <div key={contact.id} className="p-4 bg-muted/30 hover:bg-muted/70 border border-border rounded-2xl flex items-center justify-between transition-all hover:scale-[1.01] duration-300">
                          <div className="min-w-0 flex-1 pr-3">
                            <h4 className="font-bold text-xs text-foreground truncate">{contact.name}</h4>
                            <p className="text-[9px] font-black text-primary uppercase mt-0.5 tracking-wider">
                              Origem: {contact.source || "Direto"}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 px-2 py-0.5 bg-background border border-border/60 rounded-lg max-w-max font-mono truncate">
                              <span>{contact.email}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-10 h-10 rounded-full border shadow-sm flex flex-col items-center justify-center text-[10px] font-black shrink-0",
                              score >= 80 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" :
                              score >= 60 ? "bg-primary/10 border-primary/30 text-primary" :
                              "bg-amber-500/10 border-amber-500/30 text-amber-500"
                            )}>
                              <span>{score}%</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCreateDealFromPropertyMatch(contact, editingProperty)}
                              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:opacity-95 transition-all flex items-center justify-center shadow shadow-primary/20 cursor-pointer"
                              title="Vincular cliente a este imóvel via Negócio"
                            >
                              <Zap className="w-3.5 h-3.5 fill-primary-foreground text-primary-foreground" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
