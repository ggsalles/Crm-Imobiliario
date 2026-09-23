'use client';

import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Phone, Mail, FileText, Loader2, Check } from 'lucide-react';
import { Tenant } from '@/lib/db';
import { toast } from 'sonner';
import { recordAuditEvent } from '@/lib/audit';

interface EditTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant | null;
  onSuccess?: () => void;
}

export function EditTenantModal({ isOpen, onClose, tenant, onSuccess }: EditTenantModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    city: '',
    state: '',
    phone: '',
    contactEmail: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        cnpj: tenant.cnpj || '',
        city: tenant.city || '',
        state: tenant.state || '',
        phone: tenant.phone || '',
        contactEmail: tenant.contactEmail || ''
      });
    }
  }, [tenant]);

  if (!isOpen || !tenant) return null;

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 14) v = v.slice(0, 14);
    // Format: 00.000.000/0000-00
    if (v.length > 12) {
      v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
    } else if (v.length > 8) {
      v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
    } else if (v.length > 5) {
      v = v.replace(/^(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (v.length > 2) {
      v = v.replace(/^(\d{2})(\d{1,3})/, '$1.$2');
    }
    setFormData(prev => ({ ...prev, cnpj: v }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) {
      v = v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (v.length > 6) {
      v = v.replace(/^(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3');
    } else if (v.length > 2) {
      v = v.replace(/^(\d{2})(\d{1,5})/, '($1) $2');
    }
    setFormData(prev => ({ ...prev, phone: v }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('O nome da imobiliária/empresa é obrigatório.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/tenants?id=${tenant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar alterações no cadastro');
      }

      toast.success('Cadastro da empresa atualizado com sucesso!');
      recordAuditEvent({
        action: 'UPDATE_COMPANY',
        title: 'Atualização Cadastral da Imobiliária (Inquilino)',
        content: `Dados cadastrais da imobiliária "${formData.name}" (CNPJ: ${formData.cnpj || 'não informado'}) foram atualizados.`,
        severity: 'medium',
        category: 'modification',
        relatedId: tenant.id,
        entityType: 'tenant',
        metadata: formData
      });
      try {
        if (onSuccess) onSuccess();
      } catch (cbErr) {
        console.warn('[EditTenantModal] Callback notice:', cbErr);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao conectar ao servidor');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-border animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground leading-tight">
                Editar Cadastro da Empresa
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                {tenant.name}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5">
          
          {/* Nome da Imobiliária */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Nome da Imobiliária / Empresa *
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Nando Imobiliária"
                className="w-full pl-9 pr-3 py-2 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* CNPJ */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              CNPJ da Empresa
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                value={formData.cnpj}
                onChange={handleCnpjChange}
                placeholder="00.000.000/0000-00"
                className="w-full pl-9 pr-3 py-2 bg-muted/30 border border-border rounded-lg text-xs text-foreground font-mono focus:ring-2 focus:ring-primary/20 focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Cidade e Estado */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Cidade
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Ex: Maricá"
                  className="w-full pl-9 pr-3 py-2 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Estado (UF)
              </label>
              <input 
                type="text"
                maxLength={2}
                value={formData.state}
                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                placeholder="RJ"
                className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-xs text-foreground uppercase text-center font-bold font-mono focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Telefone / WhatsApp */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Telefone / WhatsApp Financeiro
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="(21) 99999-9999"
                className="w-full pl-9 pr-3 py-2 bg-muted/30 border border-border rounded-lg text-xs text-foreground font-mono focus:ring-2 focus:ring-primary/20 focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* E-mail de Contato */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              E-mail de Contato / Cobrança
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                placeholder="financeiro@imobiliaria.com.br"
                className="w-full pl-9 pr-3 py-2 bg-muted/30 border border-border rounded-lg text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none font-medium"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-border mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Cadastro</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
