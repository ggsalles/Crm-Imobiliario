"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, History, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Sidebar } from "@/components/sidebar";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { AIMessageDrafter } from "@/components/AIMessageDrafter";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

import { 
  ChatConversationList, 
  ChatPartner 
} from "@/components/messages/ChatConversationList";
import { ChatHeader } from "@/components/messages/ChatHeader";
import { ChatMessageFeed } from "@/components/messages/ChatMessageFeed";
import { ChatInputBox } from "@/components/messages/ChatInputBox";
import { ChatContactInfo } from "@/components/messages/ChatContactInfo";
import { NewChatModal } from "@/components/messages/NewChatModal";

import { 
  Conversation, 
  ChatMessage, 
  subscribeToConversations, 
  subscribeToMessages, 
  sendChatMessage,
  markAsRead,
  uploadChatFile,
  subscribeToContacts,
  subscribeToUsers,
  createConversation,
  deleteChatMessage,
  deleteConversation
} from "@/lib/db";

function MessagesContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetId = searchParams.get("id");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab] = useState<"client" | "team">("team");
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isAiDrafterOpen, setIsAiDrafterOpen] = useState(false);
  const [convSearchQuery, setConvSearchQuery] = useState("");
  const [newChatSearchQuery, setNewChatSearchQuery] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const [convToDelete, setConvToDelete] = useState<Conversation | null>(null);
  const [isDeletingConv, setIsDeletingConv] = useState(false);
  const [msgToDelete, setMsgToDelete] = useState<ChatMessage | null>(null);
  const [isDeletingMsg, setIsDeletingMsg] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Sincronização de conversas
  useEffect(() => {
    if (!user || !profile) return;
    const ownerId = profile.role === "Admin" ? undefined : user.id;

    const unsub = subscribeToConversations(
      activeTab,
      (data) => {
        setConversations(data || []);
        setLoading(false);

        if (targetId && Array.isArray(data)) {
          const found = data.find((c) => c?.id === targetId);
          if (found) {
            setSelectedConv(found);
          }
        }
      },
      ownerId
    );

    return unsub;
  }, [user, profile, activeTab, targetId]);

  // Sincronização de contatos
  useEffect(() => {
    if (!user || !profile) return;
    const ownerId = profile.role === "Admin" ? undefined : user.id;
    const unsubContacts = subscribeToContacts(setContacts, ownerId);
    return unsubContacts;
  }, [user, profile]);

  // Sincronização de usuários da equipe
  useEffect(() => {
    if (!user || !profile || activeTab !== "team") return;
    const unsubProfiles = subscribeToUsers((data) => {
      setProfiles(data.filter((p) => p.id !== user.id));
    });
    return unsubProfiles;
  }, [user, profile, activeTab]);

  // Sincronização e leitura de mensagens
  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      return;
    }

    markAsRead(selectedConv.id);

    const unsub = subscribeToMessages(selectedConv.id, (data) => {
      setMessages((prev) => {
        const pending = prev.filter(
          (m) =>
            m.id.startsWith("temp-") &&
            !data.some((d) => d.content === m.content && d.senderId === m.senderId)
        );
        return [...data, ...pending];
      });
      markAsRead(selectedConv.id);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return unsub;
  }, [selectedConv]);

  // Helper para obter parceiro da conversa
  const getPartner = useCallback(
    (conv: Conversation | null | undefined): ChatPartner | null => {
      if (!conv) return null;
      const participants = Array.isArray(conv.participants) ? conv.participants : [];
      const partnerId = participants.find((p) => p !== user?.id);

      const latestContact = partnerId ? contacts.find((c) => c?.id === partnerId) : null;
      const latestProfile = partnerId ? profiles.find((p) => p?.id === partnerId) : null;
      const details = partnerId && conv.participantDetails ? conv.participantDetails[partnerId] : null;

      const name =
        latestContact?.name ||
        latestProfile?.displayName ||
        details?.name ||
        (conv as any)?.contactName ||
        "Usuário";
      const email = latestContact?.email || latestProfile?.email || details?.email || "";
      const photoURL =
        latestContact?.photoURL ||
        latestProfile?.photoURL ||
        details?.photoURL ||
        (conv as any)?.contactAvatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`;

      return {
        id: partnerId || (conv as any)?.contactId || conv.id,
        name,
        email,
        photoURL,
        type: latestProfile
          ? "team"
          : latestContact
          ? "client"
          : conv.category === "team"
          ? "team"
          : "client",
        role: latestProfile?.role || null,
      };
    },
    [user?.id, contacts, profiles]
  );

  const currentPartner = selectedConv ? getPartner(selectedConv) : null;

  // Envio de mensagem com atualização otimista
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || isSubmitting || !user) return;

    const messageText = newMessage.trim();
    setIsSubmitting(true);
    setNewMessage("");

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversationId: selectedConv.id,
      senderId: user.id,
      content: messageText,
      type: "text",
      createdAt: new Date().toISOString(),
      ownerId: user.id,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      await sendChatMessage(selectedConv.id, messageText);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload de arquivos e fotos
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "file"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConv) return;

    setIsUploading(true);
    const toastId = toast.loading("Enviando arquivo...");

    try {
      const fileData = await uploadChatFile(file);
      await sendChatMessage(
        selectedConv.id,
        type === "image" ? "Enviou uma imagem" : `Enviou um arquivo: ${file.name}`,
        type,
        fileData
      );
      toast.success("Arquivo enviado com sucesso", { id: toastId });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      const errorMessage = error?.message || error?.error_code || "Erro desconhecido";
      toast.error(`Erro ao enviar arquivo: ${errorMessage}`, { id: toastId });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  // Iniciar nova conversa com perfil de equipe
  const startNewConversationFromProfile = async (targetProfile: any) => {
    if (!user || !targetProfile) return;

    const existing = conversations.find(
      (c) => Array.isArray(c?.participants) && c.participants.includes(targetProfile.id)
    );
    if (existing) {
      setSelectedConv(existing);
      setIsNewChatModalOpen(false);
      return;
    }

    try {
      const details = {
        [user.id]: {
          name: profile?.displayName || user.email || "Usuário",
          email: user.email || "",
          photoURL: profile?.photoURL || null,
        },
        [targetProfile.id]: {
          name: targetProfile.displayName,
          email: targetProfile.email,
          photoURL: targetProfile.photoURL || null,
        },
      };
      const newId = await createConversation([user.id, targetProfile.id], "team", details);
      const newConv: Conversation = {
        id: newId,
        participants: [user.id, targetProfile.id],
        participantDetails: details,
        lastMessage: "",
        lastMessageAt: new Date().toISOString(),
        type: "direct",
        category: "team",
        ownerId: user.id,
        unreadCount: {},
      };
      setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newId)]);
      setSelectedConv(newConv);
      setIsNewChatModalOpen(false);
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Erro ao criar conversa.");
    }
  };

  // Iniciar conversa com contato
  const startNewConversation = async (contact: any) => {
    if (!user || !contact) return;

    const existing = conversations.find(
      (c) => Array.isArray(c?.participants) && c.participants.includes(contact.id)
    );
    if (existing) {
      setSelectedConv(existing);
      setIsNewChatModalOpen(false);
      return;
    }

    try {
      const details = {
        [user.id]: {
          name: profile?.displayName || user.email || "Usuário",
          email: user.email || "",
          photoURL: profile?.photoURL || null,
        },
        [contact.id]: {
          name: contact.name,
          email: contact.email,
          photoURL: contact.photoURL || null,
        },
      };
      const newId = await createConversation([user.id, contact.id], activeTab, details);
      const newConv: Conversation = {
        id: newId,
        participants: [user.id, contact.id],
        participantDetails: details,
        lastMessage: "",
        lastMessageAt: new Date().toISOString(),
        type: "direct",
        category: activeTab,
        ownerId: user.id,
        unreadCount: {},
      };
      setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newId)]);
      setSelectedConv(newConv);
      setIsNewChatModalOpen(false);
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Erro ao criar conversa.");
    }
  };

  // Exclusão de conversa
  const confirmDeleteConversation = async () => {
    if (!convToDelete) return;
    const convId = convToDelete.id;
    const category = convToDelete.category || activeTab || 'client';
    setIsDeletingConv(true);
    const toastId = toast.loading("Excluindo conversa...");
    setConversations((prev) => prev.filter((c) => c.id !== convId));

    try {
      await deleteConversation(convId, category);
      if (selectedConv?.id === convId) {
        setSelectedConv(null);
      }
      toast.success("Conversa excluída com sucesso!", { id: toastId });
      setConvToDelete(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao excluir conversa.", { id: toastId });
    } finally {
      setIsDeletingConv(false);
    }
  };

  // Exclusão de mensagem
  const confirmDeleteMessage = async () => {
    if (!msgToDelete) return;
    const msgId = msgToDelete.id;
    const convId = selectedConv?.id;
    setIsDeletingMsg(true);
    const toastId = toast.loading("Apagando mensagem...");
    setMessages((prev) => prev.filter((m) => m.id !== msgId));

    try {
      await deleteChatMessage(msgId, convId);
      toast.success("Mensagem apagada com sucesso!", { id: toastId });
      setMsgToDelete(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao apagar mensagem.", { id: toastId });
    } finally {
      setIsDeletingMsg(false);
    }
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      (p?.displayName || "").toLowerCase().includes(newChatSearchQuery.toLowerCase()) ||
      (p?.email || "").toLowerCase().includes(newChatSearchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 md:h-16 bg-card border-b border-border pl-14 md:pl-6 px-3 sm:px-4 md:px-5 flex items-center justify-between shrink-0 z-20 transition-colors">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={convSearchQuery}
              onChange={(e) => setConvSearchQuery(e.target.value)}
              placeholder="Pesquisar conversas..."
              className="w-full bg-background border border-border rounded-xl py-2 pl-9 pr-3 text-xs md:text-sm focus:ring-2 focus:ring-primary/20 transition-all text-foreground outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted cursor-pointer"
              title="Histórico"
            >
              <History className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* 1. Lista de Conversas (Esquerda) */}
          <ChatConversationList
            conversations={conversations}
            loading={loading}
            selectedConv={selectedConv}
            onSelectConv={setSelectedConv}
            onOpenNewChat={() => setIsNewChatModalOpen(true)}
            onDeleteConv={setConvToDelete}
            getPartner={getPartner}
            searchQuery={convSearchQuery}
            userId={user?.id}
          />

          {/* 2. Área Central de Chat */}
          <section
            className={cn(
              "flex-1 flex flex-col bg-background overflow-hidden relative transition-colors",
              selectedConv ? "flex" : "hidden md:flex"
            )}
          >
            {!selectedConv ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                  <Mail className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <h3 className="font-black text-foreground">Bem-vindo ao Centro de Mensagens</h3>
                <p className="text-sm mt-1 max-w-xs mx-auto font-medium">
                  Selecione uma conversa para começar a interagir com seus contatos e equipe.
                </p>
              </div>
            ) : (
              <>
                {/* Cabeçalho do Chat Selecionado */}
                <ChatHeader
                  partner={currentPartner}
                  onBack={() => setSelectedConv(null)}
                  onDeleteConversation={() => selectedConv && setConvToDelete(selectedConv)}
                />

                {/* Feed de Mensagens */}
                <ChatMessageFeed
                  messages={messages}
                  selectedConv={selectedConv}
                  partner={currentPartner}
                  userId={user?.id}
                  userRole={profile?.role}
                  userName={profile?.displayName || "Você"}
                  userPhoto={profile?.photoURL}
                  onDeleteMessage={setMsgToDelete}
                  messagesEndRef={messagesEndRef}
                />

                {/* Caixa de Entrada e Envio */}
                <ChatInputBox
                  message={newMessage}
                  onMessageChange={setNewMessage}
                  onSendMessage={handleSendMessage}
                  onFileUpload={handleFileUpload}
                  isSubmitting={isSubmitting}
                  isUploading={isUploading}
                  onOpenAiDrafter={() => setIsAiDrafterOpen(true)}
                  fileInputRef={fileInputRef}
                  imageInputRef={imageInputRef}
                />
              </>
            )}
          </section>

          {/* 3. Painel Lateral de Informações do Contato (Direita) */}
          <ChatContactInfo partner={currentPartner} />
        </div>
      </main>

      {/* Modal de Nova Conversa */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        searchQuery={newChatSearchQuery}
        onSearchChange={setNewChatSearchQuery}
        items={filteredProfiles}
        activeTab={activeTab}
        onSelectContact={startNewConversation}
        onSelectProfile={startNewConversationFromProfile}
      />

      {/* Modal de Redação de Mensagem com IA */}
      {isAiDrafterOpen && (
        <AIMessageDrafter
          clientName={currentPartner?.name || "Cliente"}
          onClose={() => setIsAiDrafterOpen(false)}
          onSelectMessage={(msgText) => {
            setNewMessage(msgText);
            setIsAiDrafterOpen(false);
          }}
        />
      )}

      {/* Modal de Confirmação de Exclusão de Conversa */}
      <ConfirmDeleteModal
        isOpen={!!convToDelete}
        onClose={() => setConvToDelete(null)}
        onConfirm={confirmDeleteConversation}
        title="Excluir Conversa"
        itemName={convToDelete?.contactName || "Conversa selecionada"}
        itemType="conversa"
        warningNote="Todas as mensagens trocadas nesta conversa serão removidas permanentemente."
        isDeleting={isDeletingConv}
      />

      {/* Modal de Confirmação de Exclusão de Mensagem */}
      <ConfirmDeleteModal
        isOpen={!!msgToDelete}
        onClose={() => setMsgToDelete(null)}
        onConfirm={confirmDeleteMessage}
        title="Apagar Mensagem"
        itemName={
          msgToDelete?.content
            ? `"${msgToDelete.content.substring(0, 80)}${
                msgToDelete.content.length > 80 ? "..." : ""
              }"`
            : "Mensagem com anexo"
        }
        itemType="mensagem"
        warningNote="Esta mensagem será apagada para todos os participantes do chat."
        isDeleting={isDeletingMsg}
      />
    </>
  );
}

export default function MessagesPage() {
  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500 font-sans selection:bg-primary/20">
      <Sidebar />
      <Suspense
        fallback={
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </main>
        }
      >
        <MessagesContent />
      </Suspense>
    </div>
  );
}
