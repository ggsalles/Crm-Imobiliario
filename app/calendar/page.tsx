"use client";

import { Sidebar } from "@/components/sidebar";
import { Calendar } from "lucide-react";

export default function CalendarPage() {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto text-center py-20">
          <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Calendário</h1>
          <p className="text-muted-foreground">Agendamentos e reuniões em breve.</p>
        </div>
      </main>
    </div>
  );
}
