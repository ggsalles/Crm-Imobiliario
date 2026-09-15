"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Search, 
  History, 
  Settings,
  MoreVertical,
  Phone,
  Video,
  Send,
  Plus,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Loader2,
  Edit3,
  Mail,
  User,
  Building2,
  ExternalLink,
  Target,
  FileText,
  Wand2,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Conversation, 
  ChatMessage, 
  subscribeToConversations, 
  subscribeToMessages, 
  sendChatMessage,
  markAsRead,
  uploadChatFile,
  downloadFile,
  subscribeToContacts,
  subscribeToUsers,
  createConversation,
  deleteChatMessage,
  deleteConversation
} from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

import { Suspense } from "react";

import { AIMessageDrafter } from "@/components/AIMessageDrafter";

function MessagesContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<'client' | 'team'>('team');
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isAiDrafterOpen, setIsAiDrafterOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [convSearchQuery, setConvSearchQuery] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmMsgId, setDeleteConfirmMsgId] = useState<string | null>(null);

  const emojis = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "😉", "😊", "😇", 
    "😍", "🥰", "😘", "😜", "😎", "🥳", "🤔", "👍", "👎", "👏", 
    "🙌", "🙏", "👋", "🎉", "🚀", "💡", "🔥", "❤️", "👀", "✨",
    "✅", "❌", "🤝", "💼", "📅", "📞", "💪", "💯", "⭐", "🌈"
  ];

  useEffect(() => {
    if (deleteConfirmId) {
      const timer = setTimeout(() => setDeleteConfirmId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirmId]);

  useEffect(() => {
    if (deleteConfirmMsgId) {
      const timer = setTimeout(() => setDeleteConfirmMsgId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirmMsgId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !profile) return;

    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsub = subscribeToConversations(activeTab, (data) => {
      setConversations(data || []);
      setLoading(false);
      
      if (targetId && Array.isArray(data)) {
        const found = data.find(c => c?.id === targetId);
        if (found) {
          setSelectedConv(found);
          return;
        }
      }
    }, ownerId);

    return unsub;
  }, [user, profile, activeTab, targetId]);

  useEffect(() => {
    if (!user || !profile) return;
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    const unsubContacts = subscribeToContacts((data) => setContacts(data), ownerId);

    return () => {
      unsubContacts();
    };
  }, [user, profile]);

  useEffect(() => {
    if (!user || !profile || activeTab !== 'team') return;

    const unsubProfiles = subscribeToUsers((data) => {
      // Filter out the current user from the list
      setProfiles(data.filter(p => p.id !== user.id));
    });

    return () => {
      unsubProfiles();
    };
  }, [user, profile, activeTab]);

  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      return;
    }
    
    // Initial mark as read when selecting a conversation
    markAsRead(selectedConv.id);

    const unsub = subscribeToMessages(selectedConv.id, (data) => {
      setMessages(prev => {
        const pending = prev.filter(m => m.id.startsWith('temp-') && !data.some(d => d.content === m.content && d.senderId === m.senderId));
        return [...data, ...pending];
      });
      // Also mark as read when new messages are received while viewing the conversation
      markAsRead(selectedConv.id);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return unsub;
  }, [selectedConv]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || isSubmitting || !user) return;

    const messageText = newMessage.trim();
    setIsSubmitting(true);
    setNewMessage("");

    // Optimistically show message immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversationId: selectedConv.id,
      senderId: user.id,
      content: messageText,
      type: 'text',
      createdAt: new Date().toISOString(),
      ownerId: user.id
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      await sendChatMessage(selectedConv.id, messageText);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file || !selectedConv) return;

    setIsUploading(true);
    const toastId = toast.loading("Enviando arquivo...");

    try {
      const fileData = await uploadChatFile(file);
      await sendChatMessage(
        selectedConv.id, 
        type === 'image' ? "Enviou uma imagem" : `Enviou um arquivo: ${file.name}`,
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
      if (e.target) e.target.value = '';
    }
  };

  const startNewConversation = async (contact: any) => {
    if (!user || !contact) return;
    
    // Check if conversation already exists
    const existing = (conversations || []).find(c => Array.isArray(c?.participants) && c.participants.includes(contact.id));
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
          photoURL: profile?.photoURL || null 
        },
        [contact.id]: { 
          name: contact.name, 
          email: contact.email, 
          photoURL: contact.photoURL || null 
        }
      };
      const newId = await createConversation([user.id, contact.id], activeTab, details);
      const newConv: Conversation = {
        id: newId,
        participants: [user.id, contact.id],
        participantDetails: details,
        lastMessage: "",
        lastMessageAt: new Date().toISOString(),
        type: 'direct',
        category: activeTab,
        ownerId: user.id,
        unreadCount: {}
      };
      setConversations(prev => [newConv, ...prev.filter(c => c.id !== newId)]);
      setSelectedConv(newConv);
      setIsNewChatModalOpen(false);
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const getPartner = (conv: Conversation | null | undefined) => {
    if (!conv) return null;
    const participants = Array.isArray(conv.participants) ? conv.participants : [];
    const partnerId = participants.find(p => p !== user?.id);
    
    // Try to get latest data from contacts/profiles if available
    const latestContact = partnerId ? (contacts || []).find(c => c?.id === partnerId) : null;
    const latestProfile = partnerId ? (profiles || []).find(p => p?.id === partnerId) : null;
    
    const details = partnerId && conv.participantDetails ? conv.participantDetails[partnerId] : null;
    
    const name = latestContact?.name || latestProfile?.displayName || details?.name || (conv as any)?.contactName || "Usuário";
    const email = latestContact?.email || latestProfile?.email || details?.email || "";
    const photoURL = latestContact?.photoURL || latestProfile?.photoURL || details?.photoURL || (conv as any)?.contactAvatar || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`;
    
    return { 
      id: partnerId || (conv as any)?.contactId || conv.id,
      name, 
      email, 
      photoURL, 
      type: latestProfile ? 'team' : (latestContact ? 'client' : (conv.category === 'team' ? 'team' : 'client')),
      role: latestProfile?.role || null
    };
  };

  const filteredItems = (profiles || []).filter(p => 
        (p?.displayName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p?.email || "").toLowerCase().includes(searchQuery.toLowerCase())
      );

  const startNewConversationFromProfile = async (targetProfile: any) => {
    if (!user || !targetProfile) return;
    
    const existing = (conversations || []).find(c => Array.isArray(c?.participants) && c.participants.includes(targetProfile.id));
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
          photoURL: profile?.photoURL || null 
        },
        [targetProfile.id]: { 
          name: targetProfile.displayName, 
          email: targetProfile.email, 
          photoURL: targetProfile.photoURL || null 
        }
      };
      const newId = await createConversation([user.id, targetProfile.id], 'team', details);
      setIsNewChatModalOpen(false);
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

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
              className="w-full bg-background border border-border rounded-xl py-2 pl-9 pr-3 text-xs md:text-sm focus:ring-2 focus:ring-primary/20 transition-all text-foreground"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <button className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
              <History className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Conversation List */}
          <section className={cn("w-full md:w-80 bg-card border-r border-border flex flex-col shrink-0 transition-colors", selectedConv ? "hidden md:flex" : "flex")}>
            <div className="p-4 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base md:text-lg font-bold tracking-tight">Centro de Mensagens</h2>
                <button 
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {/* No more tabs - focusing on Team */}
              <div className="flex p-0.5 bg-muted/50 rounded-xl">
                <button 
                  className="flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg bg-background text-primary shadow-xs"
                >
                  Equipe
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-20 px-8">
                  <p className="text-sm text-muted-foreground italic">Nenhuma conversa encontrada nesta categoria.</p>
                </div>
              ) : (
                conversations
                  .filter(conv => {
                    const partner = getPartner(conv);
                    return (partner?.name || "").toLowerCase().includes(convSearchQuery.toLowerCase()) ||
                           (conv.lastMessage || "").toLowerCase().includes(convSearchQuery.toLowerCase());
                  })
                  .map(conv => {
                    const partner = getPartner(conv);
                    const isActive = selectedConv?.id === conv.id;
                  
                  return (
                    <div
                      key={conv.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedConv(conv)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedConv(conv);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all mb-1 text-left group cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                        isActive ? "bg-primary/10" : "hover:bg-muted/50"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Image 
                          src={partner?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.name || "U")}`} 
                          alt={partner?.name || "Partner"} 
                          width={44}
                          height={44}
                          className="w-11 h-11 rounded-xl object-cover shadow-xs bg-muted"
                          referrerPolicy="no-referrer"
                          unoptimized
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background shadow-xs" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <h4 className={cn("font-bold truncate text-xs md:text-sm transition-colors", isActive ? "text-primary" : "text-foreground")}>
                            {partner?.name}
                          </h4>
                        </div>
                        <p className={cn("text-xs truncate transition-colors", isActive ? "text-primary/70" : "text-muted-foreground group-hover:text-foreground")}>
                          {conv.lastMessage || "Nenhuma mensagem ainda"}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0 relative min-w-[60px]">
                        <span className={cn(
                          "text-[9px] font-bold text-muted-foreground uppercase tracking-tighter shrink-0 pt-0.5 transition-all duration-200",
                          deleteConfirmId === conv.id ? "opacity-0 scale-90" : "group-hover:opacity-0 group-hover:scale-95"
                        )}>
                          {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), "HH:mm") : ""}
                        </span>
                        
                        {(conv.unreadCount?.[user?.id || ""] || 0) > 0 && (
                          <span className={cn(
                            "w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 shadow-xs shadow-primary/20 transition-all duration-200",
                            deleteConfirmId === conv.id ? "opacity-0 scale-90" : "group-hover:opacity-0 group-hover:scale-95"
                          )}>
                            {conv.unreadCount?.[user?.id || ""]}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (deleteConfirmId === conv.id) {
                              try {
                                await deleteConversation(conv.id);
                                if (selectedConv?.id === conv.id) {
                                  setSelectedConv(null);
                                }
                                toast.success("Conversa excluída com sucesso");
                                setDeleteConfirmId(null);
                              } catch (err) {
                                console.error(err);
                                toast.error("Erro ao excluir conversa");
                              }
                            } else {
                              setDeleteConfirmId(conv.id);
                            }
                          }}
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 right-0 p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center z-10",
                            deleteConfirmId === conv.id 
                              ? "bg-red-500 text-white scale-110 shadow-md shadow-red-500/20 opacity-100" 
                              : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          )}
                          title={deleteConfirmId === conv.id ? "Clique novamente para confirmar" : "Excluir conversa"}
                        >
                          <Trash2 className={cn("w-3.5 h-3.5", deleteConfirmId === conv.id && "animate-pulse")} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Middle: Chat Area */}
          <section className={cn("flex-1 flex flex-col bg-background overflow-hidden relative transition-colors", selectedConv ? "flex" : "hidden md:flex")}>
            {!selectedConv ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                  <Mail className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <h3 className="font-black text-foreground">Bem-vindo ao Centro de Mensagens</h3>
                <p className="text-sm mt-1 max-w-xs mx-auto font-medium">Selecione uma conversa para começar a interagir com seus contatos e equipe.</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <header className="h-14 md:h-16 border-b border-border px-3 md:px-5 flex items-center justify-between shrink-0 bg-card/30 backdrop-blur-md transition-colors">
                  <div className="flex items-center gap-2.5">
                    <button 
                      onClick={() => setSelectedConv(null)}
                      className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg overflow-hidden relative shadow-xs border border-border">
                      <Image 
                        src={getPartner(selectedConv)?.photoURL || ""} 
                        alt="Partner" 
                        fill
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        unoptimized
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-xs md:text-sm leading-none">{getPartner(selectedConv)?.name}</h3>
                      <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-0.5">Online agora</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
                      <Video className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
                      <Phone className="w-4 h-4" />
                    </button>
                    <div className="w-px h-5 bg-border mx-1" />
                    <button className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </header>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-muted/5 transition-colors">
                  {/* Date Separator */}
                  <div className="flex items-center justify-center">
                    <span className="px-3 py-0.5 bg-card text-[9px] font-bold text-muted-foreground uppercase tracking-widest rounded-full border border-border shadow-xs">
                      Hoje
                    </span>
                  </div>

                  <div className="flex flex-col gap-4">
                    {messages.map((msg, i) => {
                      const isOwn = msg.senderId === user?.id;
                      const partner = getPartner(selectedConv);
                      const senderName = isOwn ? (profile?.displayName || "Você") : (partner?.name || "Usuário");
                      const senderPhoto = isOwn 
                        ? (profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0D8ABC&color=fff`) 
                        : (partner?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0D8ABC&color=fff`);

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={cn(
                            "flex gap-2.5 max-w-[85%]",
                            isOwn ? "self-end flex-row-reverse" : "self-start"
                          )}
                        >
                          <div className="w-8 h-8 rounded-lg overflow-hidden relative shrink-0 mt-0.5 shadow-xs bg-muted">
                            <Image 
                              src={senderPhoto || ""} 
                              alt={senderName} 
                              fill
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              unoptimized
                            />
                          </div>
                          
                          <div className={cn(
                            "flex flex-col",
                            isOwn ? "items-end" : "items-start"
                          )}>
                            <div className={cn(
                              "relative group/msg",
                              isOwn ? "items-end text-right" : "items-start text-left"
                            )}>
                              {(isOwn || profile?.role === 'Admin') && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (deleteConfirmMsgId === msg.id) {
                                      try {
                                        await deleteChatMessage(msg.id);
                                        setMessages(prev => prev.filter(m => m.id !== msg.id));
                                        toast.success("Mensagem apagada com sucesso");
                                        setDeleteConfirmMsgId(null);
                                      } catch (err) {
                                        console.error(err);
                                        toast.error("Erro ao apagar mensagem");
                                      }
                                    } else {
                                      setDeleteConfirmMsgId(msg.id);
                                    }
                                  }}
                                  className={cn(
                                    "absolute top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center z-10 border border-border bg-card shadow-xs",
                                    isOwn ? "-left-10" : "-right-10",
                                    deleteConfirmMsgId === msg.id 
                                      ? "bg-red-500 text-white border-red-500 scale-110 shadow-md shadow-red-500/20 opacity-100" 
                                      : "opacity-0 group-hover/msg:opacity-100 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                  )}
                                  title={deleteConfirmMsgId === msg.id ? "Clique novamente para confirmar" : "Apagar mensagem"}
                                >
                                  <Trash2 className={cn("w-3 h-3", deleteConfirmMsgId === msg.id && "animate-pulse")} />
                                </button>
                              )}

                              <div className={cn(
                                "rounded-2xl p-3 text-xs md:text-sm shadow-xs transition-all group-hover:shadow-md",
                                isOwn 
                                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                                  : "bg-card text-foreground rounded-tl-none border border-border/50"
                              )}>
                                <p className={cn(
                                  "font-bold text-[9px] uppercase tracking-wider mb-0.5",
                                  isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
                                )}>
                                  {senderName}
                                </p>
                                {msg.type === 'text' ? (
                                  <span className="font-medium">{msg.content}</span>
                                ) : msg.type === 'image' ? (
                                  <div className="space-y-1.5">
                                    <div className="relative w-full aspect-square min-w-[180px] rounded-lg overflow-hidden bg-muted">
                                      <Image 
                                        src={msg.fileUrl || ""} 
                                        alt={msg.fileName || "Imagem"} 
                                        fill
                                        className="object-cover cursor-pointer hover:scale-105 transition-transform"
                                        onClick={() => window.open(msg.fileUrl, '_blank')}
                                        unoptimized
                                      />
                                    </div>
                                    <p className="text-[9px] opacity-70 italic font-medium">Imagem enviada</p>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 p-1.5 bg-black/10 rounded-lg">
                                    <div className="w-8 h-8 bg-white/10 rounded-md flex items-center justify-center">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold truncate text-xs">{msg.fileName}</p>
                                      <button 
                                        onClick={() => msg.fileUrl && downloadFile(msg.fileUrl, msg.fileName || "arquivo")}
                                        className="text-[9px] font-bold underline hover:opacity-80 uppercase tracking-wider block"
                                      >
                                        Download
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <div className={cn(
                                "mt-1 flex items-center gap-1.5 px-0.5",
                                isOwn ? "flex-row-reverse" : "flex-row"
                              )}>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                  {msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}
                                </span>
                                {isOwn && (
                                  (() => {
                                    if (msg.id.startsWith('temp-')) {
                                      return <Clock className="w-3 h-3 text-muted-foreground animate-pulse" title="Enviando..." />;
                                    }
                                    const partnerId = selectedConv?.participants?.find(p => p !== user?.id);
                                    const partnerUnread = partnerId && selectedConv?.unreadCount ? (selectedConv.unreadCount[partnerId] || 0) : 0;
                                    const isRead = partnerUnread === 0;

                                    if (isRead) {
                                      return <CheckCheck className="w-3 h-3 text-primary" title="Lida" />;
                                    }
                                    return <CheckCheck className="w-3 h-3 text-muted-foreground/60" title="Entregue (Ainda não lida)" />;
                                  })()
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Footer / Input */}
                <footer className="p-3 md:p-4 border-t border-border shrink-0 bg-card/30 backdrop-blur-md transition-colors">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={(e) => handleFileUpload(e, 'file')}
                  />
                  <input 
                    type="file" 
                    ref={imageInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'image')}
                  />

                  <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-card rounded-2xl p-1.5 pr-2 border border-border focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <div className="flex gap-0.5">
                      <button 
                        type="button" 
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-background rounded-xl transition-all disabled:opacity-50"
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-background rounded-xl transition-all disabled:opacity-50"
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                      </button>
                    </div>
                    
                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escreva uma mensagem..."
                      className="flex-1 bg-transparent border-none py-2 px-2 text-xs md:text-sm focus:ring-0 font-medium text-foreground placeholder:text-muted-foreground"
                    />
                    
                    <div className="relative">
                      {isEmojiOpen && (
                        <div className="absolute bottom-full mb-3 right-0 w-60 p-3 bg-card border border-border rounded-2xl shadow-xl z-50 grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto">
                          {emojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setNewMessage(prev => prev + emoji);
                                setIsEmojiOpen(false);
                              }}
                              className="text-lg p-1 hover:bg-muted rounded-lg transition-all hover:scale-110 active:scale-95"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                      <button 
                        type="button" 
                        onClick={() => setIsEmojiOpen(!isEmojiOpen)}
                        className={cn(
                          "p-2 rounded-xl transition-all text-muted-foreground hover:bg-background",
                          isEmojiOpen ? "text-primary bg-primary/10" : "hover:text-primary"
                        )}
                        title="Inserir Emoji"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                    </div>

                    <button 
                      type="submit"
                      disabled={!newMessage.trim() || isSubmitting}
                      className="w-9 h-9 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-primary/20 shrink-0"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </form>
                </footer>
              </>
            )}
          </section>

          {/* Right: Contact Context (Mini 360) */}
          <section className="w-72 md:w-80 bg-card border-l border-border shrink-0 hidden xl:flex flex-col overflow-y-auto transition-colors">
            {!selectedConv ? (
              <div className="p-8 text-center text-muted-foreground mt-12">
                <Target className="w-8 h-8 mx-auto mb-3 opacity-10" />
                <p className="text-xs font-medium">Selecione uma conversa para ver os detalhes</p>
              </div>
            ) : (
              <div className="p-5 space-y-6">
                {/* Profile Header */}
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20 p-0.5 mx-auto shadow-xs mb-3 relative group">
                    <Image 
                      src={getPartner(selectedConv)?.photoURL || ""} 
                      fill
                      className="w-full h-full object-cover rounded-xl transition-transform group-hover:scale-105"
                      alt="Profile"
                      referrerPolicy="no-referrer"
                      unoptimized
                    />
                  </div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">{getPartner(selectedConv)?.name}</h3>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                    {getPartner(selectedConv)?.type === 'team' ? (getPartner(selectedConv)?.role || 'Equipe') : 'Contato Cadastrado'}
                  </p>
                  
                  <div className="flex justify-center gap-1.5 mt-2.5">
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase rounded-md border border-emerald-500/20">ATIVO</span>
                    {getPartner(selectedConv)?.type === 'team' ? (
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-[9px] font-bold uppercase rounded-md border border-purple-500/20">EQUIPE</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-bold uppercase rounded-md border border-primary/20">CLIENTE</span>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-1.5">Informações de Contato</h4>
                  <div className="p-3 bg-muted/40 rounded-xl border border-border/60 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block tracking-wider">E-mail</span>
                        <span className="text-xs font-bold truncate block text-foreground">
                          {getPartner(selectedConv)?.email || 'Sem e-mail'}
                        </span>
                      </div>
                    </div>
                    {getPartner(selectedConv)?.email && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(getPartner(selectedConv)?.email || '');
                          toast.success("E-mail copiado!");
                        }}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-lg transition-colors shrink-0"
                        title="Copiar e-mail"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* New Chat Modal */}
      <AnimatePresence>
        {isNewChatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsNewChatModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b border-border">
                <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight">Nova Conversa</h3>
                <p className="text-muted-foreground text-xs mt-0.5 font-medium">Selecione um contato para iniciar o chat.</p>
              </div>
              
              <div className="p-4 md:p-5">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar contatos..." 
                    className="w-full bg-background border border-border rounded-xl py-2 pl-9 pr-3 text-xs md:text-sm focus:ring-2 focus:ring-primary/20 text-foreground font-medium"
                  />
                </div>

                <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-xs italic font-medium">Nenhum {activeTab === 'client' ? 'contato' : 'membro da equipe'} encontrado.</p>
                    </div>
                  ) : (
                    filteredItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => activeTab === 'client' ? startNewConversation(item) : startNewConversationFromProfile(item)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-all text-left group"
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden relative shadow-xs bg-muted border border-border">
                          <Image 
                            src={(activeTab === 'client' ? item.photoURL : item.photoURL) || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeTab === 'client' ? item.name : item.displayName)}&background=0D8ABC&color=fff`} 
                            alt={activeTab === 'client' ? item.name : item.displayName} 
                            fill
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            unoptimized
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-foreground text-xs md:text-sm group-hover:text-primary transition-colors uppercase tracking-tight">
                            {activeTab === 'client' ? item.name : item.displayName}
                          </h4>
                          <p className="text-[11px] text-muted-foreground truncate font-medium">{item.email}</p>
                        </div>
                        <Plus className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </button>
                    ))
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-muted/30 flex justify-end">
                <button 
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function MessagesPage() {
  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500 font-sans selection:bg-primary/20">
      <Sidebar />
      <Suspense fallback={
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </main>
      }>
        <MessagesContent />
      </Suspense>
    </div>
  );
}
