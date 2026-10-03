"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { isPlatformAdmin } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit";

function getModuleInfo(pathname: string): { name: string; category: string; description: string } | null {
  if (!pathname || pathname === "/login" || pathname === "/register" || pathname === "/auth/callback") {
    return null;
  }

  if (pathname === "/" || pathname === "/dashboard") {
    return {
      name: "Dashboard (Visão Geral)",
      category: "navigation",
      description: "Acessou o painel de controle e indicadores gerais."
    };
  }

  if (pathname.startsWith("/properties")) {
    if (pathname.includes("/new")) {
      return {
        name: "Cadastro de Imóvel",
        category: "navigation",
        description: "Acessou o formulário de cadastro de novo imóvel."
      };
    }
    if (pathname.split("/").length > 2) {
      return {
        name: "Ficha do Imóvel",
        category: "navigation",
        description: "Visualizou os detalhes de um imóvel específico no inventário."
      };
    }
    return {
      name: "Módulo de Imóveis",
      category: "navigation",
      description: "Acessou o catálogo e inventário completo de imóveis."
    };
  }

  if (pathname.startsWith("/contacts")) {
    if (pathname.split("/").length > 2) {
      return {
        name: "Ficha de Contato",
        category: "navigation",
        description: "Visualizou os detalhes e histórico de um contato/lead."
      };
    }
    return {
      name: "Módulo de Contatos",
      category: "navigation",
      description: "Acessou a lista de contatos e carteira de clientes."
    };
  }

  if (pathname.startsWith("/pipeline")) {
    return {
      name: "Funil de Vendas (Pipeline)",
      category: "navigation",
      description: "Acessou o quadro Kanban de oportunidades e negociações."
    };
  }

  if (pathname.startsWith("/deals")) {
    return {
      name: "Ficha de Negociação",
      category: "navigation",
      description: "Acessou os detalhes e propostas de uma oportunidade de negócio."
    };
  }

  if (pathname.startsWith("/activities")) {
    return {
      name: "Módulo de Atividades",
      category: "navigation",
      description: "Acessou o painel de tarefas, compromissos e follow-ups."
    };
  }

  if (pathname.startsWith("/calendar")) {
    return {
      name: "Agenda & Calendário",
      category: "navigation",
      description: "Acessou a visualização da agenda e visitas marcadas."
    };
  }

  if (pathname.startsWith("/companies")) {
    return {
      name: "Módulo de Construtoras",
      category: "navigation",
      description: "Acessou o catálogo de construtoras e parceiros comerciais."
    };
  }

  if (pathname.startsWith("/users")) {
    return {
      name: "Gestão de Usuários & Equipe",
      category: "navigation",
      description: "Acessou o painel de gestão de corretores, membros e licenças."
    };
  }

  if (pathname.startsWith("/settings")) {
    return {
      name: "Configurações do Sistema",
      category: "navigation",
      description: "Acessou as configurações de perfil, tema e preferências."
    };
  }

  if (pathname.startsWith("/audit")) {
    return {
      name: "Painel de Auditoria & Segurança",
      category: "navigation",
      description: "Acessou os relatórios de auditoria e trilha de conformidade."
    };
  }

  if (pathname.startsWith("/vitrine")) {
    return {
      name: "Vitrine Pública de Imóveis",
      category: "navigation",
      description: "Acessou a vitrine digital para clientes e corretores."
    };
  }

  return {
    name: `Página ${pathname}`,
    category: "navigation",
    description: `Acessou a página ${pathname}.`
  };
}

export function ModuleAccessTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  const lastTrackedKeyRef = useRef<string>("");
  const lastTrackedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!pathname) return;

    // Platform Admin / Master is kept in Ghost Mode to keep audit logs clean
    const userEmail = (profile?.email || user?.email || "").toLowerCase();
    if (isPlatformAdmin(userEmail)) {
      return;
    }

    const moduleInfo = getModuleInfo(pathname);
    if (!moduleInfo) return;

    const queryString = searchParams?.toString() || "";
    const trackingKey = `${pathname}?${queryString}`;
    const now = Date.now();

    // Deduplication / Throttling: avoid spamming if user re-renders or quickly clicks on the same page within 45 seconds
    if (lastTrackedKeyRef.current === trackingKey && now - lastTrackedTimeRef.current < 45000) {
      return;
    }

    lastTrackedKeyRef.current = trackingKey;
    lastTrackedTimeRef.current = now;

    const isVitrine = pathname.startsWith("/vitrine");
    const brokerId = searchParams?.get("broker") || undefined;
    const tenantParam = searchParams?.get("tenant") || undefined;

    recordAuditEvent({
      action: isVitrine ? "VITRINE_VIEW" : "MODULE_ACCESS",
      title: `Acesso: ${moduleInfo.name}`,
      content: isVitrine 
        ? `Acesso à Vitrine Pública${brokerId ? ` (Consultor ID: ${brokerId})` : ""}.` 
        : `${profile?.displayName || user?.email || "Usuário"} acessou o ${moduleInfo.name}.`,
      severity: "info",
      category: "system",
      entityType: "system",
      metadata: {
        pathname,
        module: moduleInfo.name,
        description: moduleInfo.description,
        searchParams: queryString || undefined,
        brokerId,
        tenantParam,
        userRole: profile?.role || "Membro",
        userType: profile?.userType || "funcionário"
      }
    });
  }, [pathname, searchParams, user, profile]);

  return null;
}
