"use client";

import { Deal } from "@/lib/db";
import { TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";

interface ContactDealsTableProps {
  deals: Deal[];
}

export function ContactDealsTable({ deals }: ContactDealsTableProps) {
  const router = useRouter();

  return (
    <div className="bg-card rounded-[32px] border border-border overflow-hidden shadow-sm">
      <div className="p-8 border-b border-border flex items-center justify-between text-foreground bg-card sticky top-0 z-10">
        <h2 className="text-xl font-bold">Negócios Ativos</h2>
        <button 
          onClick={() => router.push('/pipeline')} 
          className="text-primary font-bold text-sm hover:opacity-80 cursor-pointer"
        >
          Ver todos
        </button>
      </div>
      {deals.length > 0 ? (
        <div className="divide-y divide-border">
          {deals.map((deal) => (
            <div key={deal.id} className="p-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">{deal.title}</h4>
                  <div className="text-sm text-muted-foreground font-medium">
                    Estágio: <span className="text-primary uppercase text-[10px] bg-primary/10 px-2 py-0.5 rounded-md font-bold">{
                      deal.stage === 'lead' ? 'Novo Lead' :
                      deal.stage === 'qualification' ? 'Qualificação' :
                      deal.stage === 'proposal' ? 'Proposta' :
                      deal.stage === 'negotiation' ? 'Análise Jurídica' :
                      deal.stage === 'closed' ? 'Vendido/Alugado' : deal.stage
                    }</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-foreground">R$ {deal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div className="text-xs text-muted-foreground">{new Date(deal.createdAt || '').toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-20 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <TrendingUp className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-bold text-foreground">Sem negócios ativos no momento</h3>
          <p className="text-muted-foreground text-sm mt-1">Crie um novo negócio para começar o pipeline.</p>
        </div>
      )}
    </div>
  );
}
