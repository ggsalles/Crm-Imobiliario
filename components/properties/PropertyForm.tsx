"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Star } from "lucide-react";
import { 
  Property, 
  Contact, 
  Company,
  createProperty, 
  updateProperty, 
  uploadFile, 
  createDeal, 
  createTimelineEvent,
  subscribeToCompanies
} from "@/lib/db";
import { 
  cn, 
  formatCurrencyBRL, 
  parseCurrencyBRLToNumber, 
  formatCEP 
} from "@/lib/utils";
import { recordAuditEvent } from "@/lib/audit";
import { PropertyValuationCard, ValuationResult } from "@/components/PropertyValuationCard";
import { toast } from "sonner";
import { applyWatermarkToImage } from "@/lib/watermark";

import { PropertyBasicFields } from "./form/PropertyBasicFields";
import { PropertyLocationFields, AddressData } from "./form/PropertyLocationFields";
import { PropertyFinancialFields } from "./form/PropertyFinancialFields";
import { PropertyMediaUploader } from "./form/PropertyMediaUploader";
import { PropertyFeaturesPicker } from "./form/PropertyFeaturesPicker";
import { PropertyReverseMatchSidebar } from "./form/PropertyReverseMatchSidebar";

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
  onSuccess,
}: PropertyFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const isSubmittingRef = useRef(false);

  // Form State
  const [title, setTitle] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [displayPrice, setDisplayPrice] = useState("");
  const [displayIptu, setDisplayIptu] = useState("");
  const [displayCondoFee, setDisplayCondoFee] = useState("");
  const [cep, setCep] = useState("");
  const [areaInput, setAreaInput] = useState<string>("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [addressData, setAddressData] = useState<AddressData>({
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

  // Código de Referência e Tipo de Imóvel
  const [referenceCode, setReferenceCode] = useState("");
  const [selectedType, setSelectedType] = useState("apartamento");
  const [isGeneratingRef, setIsGeneratingRef] = useState(false);

  // Busca automática do próximo código sequencial para o tipo selecionado
  const fetchNextRef = useCallback(async (typeToUse: string) => {
    setIsGeneratingRef(true);
    try {
      const res = await fetch(`/api/properties/next-reference?type=${encodeURIComponent(typeToUse)}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.nextCode) {
          setReferenceCode(data.nextCode);
        }
      }
    } catch (err) {
      console.warn("Erro ao buscar próxima referência:", err);
    } finally {
      setIsGeneratingRef(false);
    }
  }, []);

  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    if (!editingProperty) {
      fetchNextRef(newType);
    } else {
      // Se estiver editando um imóvel existente e o tipo mudar, atualiza o prefixo da referência automaticamente
      const typePrefixes: Record<string, string> = {
        apartamento: 'AP',
        casa: 'CA',
        'condomínio': 'CD',
        condominio: 'CD',
        sobrado: 'SO',
        cobertura: 'CO',
        studio: 'ST',
        sala: 'SL',
        comercial: 'CM',
        'galpão': 'GP',
        galpao: 'GP',
        'prédio': 'PR',
        predio: 'PR',
        terreno: 'TR',
        'sítio': 'SI',
        sitio: 'SI',
        'chácara': 'CH',
        chacara: 'CH',
        fazenda: 'FZ'
      };
      const newPrefix = typePrefixes[newType.toLowerCase()] || 'IM';
      if (referenceCode) {
        const match = referenceCode.match(/^([A-Za-z]+)(\d+)$/);
        if (match) {
          const numPart = match[2];
          setReferenceCode(`${newPrefix}${numPart}`);
        }
      } else {
        fetchNextRef(newType);
      }
    }
  };

  // Subscribe to companies
  useEffect(() => {
    const unsub = subscribeToCompanies((data) => {
      setCompanies(data);
    });
    return () => unsub();
  }, []);

  // Marca d'água automática para fotos
  const [applyWatermark, setApplyWatermark] = useState(true);
  const [watermarkCompany, setWatermarkCompany] = useState("Chiarelli");
  const [watermarkPosition, setWatermarkPosition] = useState<'center' | 'bottom-right' | 'bottom-left' | 'top-right'>('center');

  // Initialize form when editingProperty changes
  useEffect(() => {
    if (editingProperty) {
      setTitle(editingProperty.title || "");
      setBuildingName(editingProperty.buildingName || "");
      setCompanyId(editingProperty.companyId || "");
      setSelectedType(editingProperty.type || "apartamento");
      setReferenceCode(editingProperty.referenceCode || (editingProperty as any).reference_code || "");
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
      setCompanyId("");
      setSelectedType("apartamento");
      fetchNextRef("apartamento");
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
  }, [editingProperty, fetchNextRef]);

  // Consulta automática de CEP
  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const rawCep = e.target.value.replace(/\D/g, "");
    if (rawCep.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      const data = await response.json().catch(() => null);

      if (data && !data.erro) {
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

  // Estimativa de Preço via IA & Portfólio
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
      const similarInPortfolio = properties.filter(
        (p) =>
          p.area > 0 &&
          p.price > 0 &&
          ((neighborhood && p.neighborhood?.toLowerCase() === neighborhood.toLowerCase()) ||
            (city && p.city?.toLowerCase() === city.toLowerCase()) ||
            p.type === propertyType)
      );

      let portfolioAvgM2: number | null = null;
      if (similarInPortfolio.length > 0) {
        const sumM2 = similarInPortfolio.reduce((acc, p) => acc + p.price / p.area, 0);
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
          portfolioAverageM2: portfolioAvgM2,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Falha na estimativa de valor.");
      }

      const data: ValuationResult = (await res.json().catch(() => null)) || {} as ValuationResult;
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

  // Upload e Processamento de Imagens
  const processFiles = useCallback(
    async (incomingFiles: FileList | File[]) => {
      if (!incomingFiles || incomingFiles.length === 0) return;

      const files = Array.from(incomingFiles);
      const totalFiles = files.length;
      let uploadedCount = 0;

      setIsUploading(true);
      const toastId = toast.loading(
        `Processando ${totalFiles} ${totalFiles === 1 ? "imagem" : "imagens"}...`
      );

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          toast.loading(`Enviando ${i + 1} de ${totalFiles}: ${file.name}`, { id: toastId });

          if (file.size > 10 * 1024 * 1024) {
            toast.error(`Arquivo "${file.name}" excede 10MB.`, { duration: 3000 });
            continue;
          }

          try {
            await new Promise((resolve) => setTimeout(resolve, 300));

            if (file.size === 0) {
              toast.error(`Arquivo "${file.name}" está vazio.`, { duration: 3000 });
              continue;
            }

            const uploadTimeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout de 60s excedido")), 60000)
            );

            let fileToUpload = file;
            if (applyWatermark) {
              try {
                fileToUpload = await applyWatermarkToImage(file, {
                  companyName: watermarkCompany || "Chiarelli",
                  subtitle: "IMÓVEIS",
                  position: watermarkPosition,
                  opacity: 0.92,
                });
              } catch (wmErr) {
                console.warn("[PropertyForm] Falha ao aplicar marca d'água:", wmErr);
              }
            }

            const uploadOp = uploadFile(fileToUpload, "property-images", user?.id);
            const result = (await Promise.race([uploadOp, uploadTimeout])) as { url: string };

            if (result && result.url) {
              setImageUrls((prev) => [...prev, result.url]);
              uploadedCount++;
            }
          } catch (err: any) {
            console.error(`Falha no upload da imagem ${i + 1}:`, err);
            toast.error(`Não foi possível enviar: ${file.name}`, { duration: 3000 });
          }
        }

        if (uploadedCount > 0) {
          toast.success(
            `${uploadedCount} ${uploadedCount === 1 ? "imagem enviada" : "imagens enviadas"} com sucesso!`,
            { id: toastId }
          );
        } else {
          toast.error("Nenhuma imagem foi enviada corretamente.", { id: toastId });
        }
      } catch (error: any) {
        console.error("Erro no upload de imagens:", error);
        toast.error("Erro ao processar lote de imagens.", { id: toastId });
      } finally {
        setIsUploading(false);
      }
    },
    [user?.id, applyWatermark, watermarkCompany, watermarkPosition]
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;
    const files = e.target.files;
    if (files) {
      await processFiles(files);
      e.target.value = "";
    }
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragging) setIsDragging(true);
    },
    [isDragging]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (isUploading) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        await processFiles(files);
      }
    },
    [processFiles, isUploading]
  );

  // Criação ou Atualização do Imóvel
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

      const cleanUrls = imageUrls
        .filter(
          (url) =>
            typeof url === "string" && url.trim() !== "" && !url.startsWith("data:image")
        )
        .map((u) => String(u).trim());

      const data: Partial<Property> = {
        title: String(formData.get("title") || "").substring(0, 200),
        buildingName: String(formData.get("buildingName") || "").trim().substring(0, 200),
        companyId: companyId || String(formData.get("companyId") || "") || undefined,
        referenceCode: (String(formData.get("referenceCode") || referenceCode || "")).trim().toUpperCase() || undefined,
        type: (selectedType || formData.get("type") || "apartamento") as any,
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
        suites: Number(formData.get("suites") || 0),
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
          action: "UPDATE_PROPERTY",
          title: "Edição de Imóvel",
          content: `Imóvel "${data.title}" foi editado e atualizado no catálogo.`,
          severity: "medium",
          category: "modification",
          relatedId: currentPropertyId,
          entityType: "property",
          metadata: {
            title: data.title,
            price: data.price,
            location: data.location,
            type: data.type,
          },
        });
      } else {
        const newId = await createProperty(data, user.id);
        recordAuditEvent({
          action: "CREATE_PROPERTY",
          title: "Cadastro de Novo Imóvel",
          content: `Novo imóvel "${data.title}" cadastrado com sucesso no catálogo.`,
          severity: "info",
          category: "modification",
          relatedId: newId || undefined,
          entityType: "property",
          metadata: {
            title: data.title,
            price: data.price,
            location: data.location,
            type: data.type,
          },
        });
      }

      clearTimeout(uiTimeoutId);
      toast.success(isEditing ? "Imóvel atualizado com sucesso!" : "Imóvel cadastrado com sucesso!", {
        id: toastId,
      });
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

  // Criação de Negócio a partir de Cruzamento
  const handleCreateDealFromPropertyMatch = async (contact: Contact, p: Property) => {
    if (!user) return;
    try {
      const dealTitle = `${p.title} - ${contact.name}`;
      const value = p.price;

      await createDeal({
        title: dealTitle,
        value: value,
        stage: "lead",
        contactId: contact.id,
        propertyId: p.id,
        ownerId: user.id,
      });

      await createTimelineEvent({
        type: "system",
        category: "contact",
        relatedId: contact.id,
        content: `Lead de imóvel cruzado na visão do Imóvel: associado ao imóvel "${p.title}" com preço de ${formatCurrencyBRL(p.price)}.`,
        title: `Novo negócio de cruzamento`,
      });

      toast.success("Cruzamento realizado! Novo negócio criado para o cliente.");
    } catch (e: any) {
      console.error("Error creating matching deal:", e);
      toast.error("Erro ao cruzar cliente e criar negócio.");
    }
  };

  return (
    <div
      className={cn(
        "mx-auto transition-all duration-500",
        editingProperty ? "max-w-7xl" : "max-w-4xl"
      )}
    >
      <div
        className={cn(
          "grid grid-cols-1 gap-8",
          editingProperty ? "xl:grid-cols-12" : "grid-cols-1"
        )}
      >
        <div className={cn(editingProperty ? "xl:col-span-8" : "w-full")}>
          <form
            ref={formRef}
            key={editingProperty?.id || "new-property"}
            onSubmit={handleCreateOrUpdate}
            className={cn(
              "bg-card border border-border rounded-[40px] shadow-2xl overflow-hidden pb-12 transition-opacity",
              (isSaving || isUploading) && "opacity-80 cursor-wait"
            )}
          >
            <div className="p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. Campos Básicos de Identificação */}
                <PropertyBasicFields
                  editingProperty={editingProperty}
                  title={title}
                  onTitleChange={setTitle}
                  buildingName={buildingName}
                  onBuildingNameChange={setBuildingName}
                  companyId={companyId}
                  onCompanyIdChange={setCompanyId}
                  companies={companies}
                  referenceCode={referenceCode}
                  onReferenceCodeChange={setReferenceCode}
                  selectedType={selectedType}
                  onTypeChange={handleTypeChange}
                  isGeneratingRef={isGeneratingRef}
                  onAutoGenerateRef={() => fetchNextRef(selectedType)}
                />

                {/* 2. Endereço e Localização */}
                <PropertyLocationFields
                  editingProperty={editingProperty}
                  cep={cep}
                  onCepChange={setCep}
                  onCepBlur={handleCepBlur}
                  isFetchingCep={isFetchingCep}
                  addressData={addressData}
                  onAddressDataChange={setAddressData}
                />

                {/* 3. Metragem e Cômodos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 md:col-span-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                      Área (m²) *
                    </label>
                    <input
                      name="area"
                      type="number"
                      value={areaInput}
                      onChange={(e) => setAreaInput(e.target.value)}
                      placeholder="Ex: 85"
                      className="w-full px-4 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                      Dormitórios
                    </label>
                    <input
                      name="bedrooms"
                      type="number"
                      defaultValue={editingProperty?.bedrooms}
                      className="w-full px-4 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none text-foreground"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest pl-1 flex items-center gap-1">
                      <span>Suítes</span>
                      <span className="text-[8px] bg-primary/10 text-primary px-1 py-0.5 rounded font-bold">Novo</span>
                    </label>
                    <input
                      name="suites"
                      type="number"
                      placeholder="Ex: 1"
                      defaultValue={editingProperty?.suites}
                      className="w-full px-4 py-4 bg-muted/30 border border-primary/30 focus:border-primary rounded-2xl text-sm font-bold outline-none text-foreground"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                      Banheiros
                    </label>
                    <input
                      name="bathrooms"
                      type="number"
                      defaultValue={editingProperty?.bathrooms}
                      className="w-full px-4 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none text-foreground"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                      Vagas
                    </label>
                    <input
                      name="parkingSpots"
                      type="number"
                      defaultValue={editingProperty?.parkingSpots}
                      className="w-full px-4 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-bold outline-none text-foreground"
                    />
                  </div>
                </div>

                {/* 4. Valores & Encargos Financeiros (com Sugestão por IA baseada nos dados acima) */}
                <PropertyFinancialFields
                  displayPrice={displayPrice}
                  onDisplayPriceChange={setDisplayPrice}
                  displayCondoFee={displayCondoFee}
                  onDisplayCondoFeeChange={setDisplayCondoFee}
                  displayIptu={displayIptu}
                  onDisplayIptuChange={setDisplayIptu}
                  areaInput={areaInput}
                  isEstimatingPrice={isEstimatingPrice}
                  onSuggestPrice={handleSuggestPrice}
                />

                {/* Card de Avaliação Inteligente por IA */}
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

                {/* 4. Checkboxes: Financiamento e Destaque */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-5 bg-muted/20 border border-border rounded-3xl">
                    <input
                      type="checkbox"
                      name="acceptsFinancing"
                      id="acceptsFinancing"
                      defaultChecked={editingProperty?.acceptsFinancing}
                      className="w-5 h-5 accent-primary cursor-pointer"
                    />
                    <label
                      htmlFor="acceptsFinancing"
                      className="text-sm font-bold cursor-pointer select-none text-foreground"
                    >
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
                      <Star
                        className={cn(
                          "w-4 h-4",
                          isFeatured ? "fill-amber-500 text-amber-500" : "text-muted-foreground"
                        )}
                      />
                      <span>Destaque / Melhores Oportunidades</span>
                    </label>
                  </div>
                </div>

                {/* 5. Descritivo Comercial (Público) */}
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">
                      Descritivo Comercial (Público) *
                    </label>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Visível na Vitrine Pública e para Clientes
                    </span>
                  </div>
                  <textarea
                    name="description"
                    required
                    defaultValue={editingProperty?.description}
                    rows={4}
                    placeholder="Descreva os pontos fortes do imóvel, vista, acabamento, etc."
                    className="w-full px-6 py-4 bg-muted/30 border border-border rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all resize-none outline-none text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* 5.1 Descrição Interna (Exclusiva da Equipe / Privada) */}
                <div className="md:col-span-2 space-y-3 p-5 bg-amber-500/5 border border-amber-500/25 rounded-3xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                      <span>🔒</span> Descrição Interna (Uso Restrito da Equipe)
                    </label>
                    <span className="text-[10px] font-bold text-amber-500/90 bg-background/90 px-2.5 py-0.5 rounded-lg border border-amber-500/30 w-fit">
                      Privado • Não aparece na Vitrine Pública
                    </span>
                  </div>
                  <textarea
                    name="notes"
                    defaultValue={editingProperty?.notes || editingProperty?.internalNotes || ""}
                    rows={3}
                    placeholder="Anotações confidenciais da equipe, comissão combinada com o proprietário, contato direto, código da chave na portaria, restrições de horários de visitas, etc."
                    className="w-full px-5 py-3.5 bg-background/90 border border-amber-500/30 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-amber-500/20 transition-all resize-none outline-none text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* 6. Tags e Comodidades */}
                <PropertyFeaturesPicker
                  selectedTags={selectedTags}
                  onSelectedTagsChange={setSelectedTags}
                  customTagInput={customTagInput}
                  onCustomTagInputChange={setCustomTagInput}
                />

                {/* 7. Galeria de Imagens com Drag & Drop e Marca d'Água */}
                <PropertyMediaUploader
                  imageUrls={imageUrls}
                  onRemoveImage={(idx) =>
                    setImageUrls((prev) => prev.filter((_, i) => i !== idx))
                  }
                  isUploading={isUploading}
                  isDragging={isDragging}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onImageUpload={handleImageUpload}
                  applyWatermark={applyWatermark}
                  setApplyWatermark={setApplyWatermark}
                  watermarkCompany={watermarkCompany}
                  setWatermarkCompany={setWatermarkCompany}
                  watermarkPosition={watermarkPosition}
                  setWatermarkPosition={setWatermarkPosition}
                />
              </div>
            </div>

            {/* Rodapé de Ações do Formulário */}
            <div className="px-10 py-8 bg-muted/30 border-t border-border flex flex-col md:flex-row gap-4">
              <button
                type="submit"
                disabled={isSaving || isUploading}
                className="flex-1 bg-primary text-primary-foreground py-5 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
              >
                {(isSaving || isUploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                {isUploading
                  ? "Processando Imagens..."
                  : isSaving
                  ? "Salvando..."
                  : editingProperty
                  ? "Salvar Alterações"
                  : "Publicar no Inventário"}
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

        {/* Barra Lateral de Cruzamento Reverso (Somente em Edição) */}
        {editingProperty && (
          <PropertyReverseMatchSidebar
            property={editingProperty}
            contacts={contacts}
            onCreateDeal={handleCreateDealFromPropertyMatch}
          />
        )}
      </div>
    </div>
  );
}
