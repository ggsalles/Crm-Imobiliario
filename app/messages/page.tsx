"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { 
  Search, 
  Bell, 
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
  Loader2,
  Edit3,
  Mail,
  User,
  Building2,
  ExternalLink,
  Target,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  downloadFile
} from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

import { Suspense } from "react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [convSearchQuery, setConvSearchQuery] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

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
      setConversations(data);
      setLoading(false);
      
      if (targetId) {
        const found = data.find(c => c.id === targetId);
        if (found) {
          setSelectedConv(found);
          return;
        }
      }

      if (!selectedConv && data.length > 0) {
        setSelectedConv(data[0]);
      }
    }, ownerId);

    return unsub;
  }, [user, profile, activeTab, selectedConv, targetId]);

  useEffect(() => {
    if (!user || !profile) return;
    const ownerId = profile.role === 'Admin' ? undefined : user.id;

    let unsubContacts: (() => void) | undefined;
    
    import("@/lib/db").then(({ subscribeToContacts }) => {
      unsubContacts = subscribeToContacts((data) => setContacts(data), ownerId);
    });

    return () => {
      if (unsubContacts) unsubContacts();
    };
  }, [user, profile]);

  useEffect(() => {
    if (!user || !profile || activeTab !== 'team') return;

    let unsubProfiles: (() => void) | undefined;
    
    import("@/lib/db").then(({ subscribeToUsers }) => {
      unsubProfiles = subscribeToUsers((data) => {
        // Filter out the current user from the list
        setProfiles(data.filter(p => p.id !== user.id));
      });
    });

    return () => {
      if (unsubProfiles) unsubProfiles();
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
      setMessages(data);
      // Also mark as read when new messages are received while viewing the conversation
      markAsRead(selectedConv.id);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return unsub;
  }, [selectedConv]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await sendChatMessage(selectedConv.id, newMessage);
      setNewMessage("");
      // Scroll behavior is handled in the messages subscriber
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
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
    if (!user) return;
    
    // Check if conversation already exists
    const existing = conversations.find(c => c.participants.includes(contact.id));
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
      const newId = await import("@/lib/db").then(({ createConversation }) => 
        createConversation([user.id, contact.id], activeTab, details)
      );
      setIsNewChatModalOpen(false);
      // Selection will happen automatically via subscribeToConversations
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const getPartner = (conv: Conversation) => {
    const partnerId = conv.participants.find(p => p !== user?.id);
    if (!partnerId) return null;
    
    // Try to get latest data from contacts/profiles if available
    const latestContact = contacts.find(c => c.id === partnerId);
    const latestProfile = profiles.find(p => p.id === partnerId);
    
    const details = conv.participantDetails[partnerId];
    
    const name = latestContact?.name || latestProfile?.displayName || details?.name || "Usuário";
    const email = latestContact?.email || latestProfile?.email || details?.email || "";
    const photoURL = latestContact?.photoURL || latestProfile?.photoURL || details?.photoURL || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`;
    
    return { 
      id: partnerId,
      name, 
      email, 
      photoURL, 
      type: latestProfile ? 'team' : (latestContact ? 'client' : 'unknown'),
      role: latestProfile?.role || null
    };
  };

  const filteredItems = profiles.filter(p => 
        p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const startNewConversationFromProfile = async (targetProfile: any) => {
    if (!user) return;
    
    const existing = conversations.find(c => c.participants.includes(targetProfile.id));
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
      const newId = await import("@/lib/db").then(({ createConversation }) => 
        createConversation([user.id, targetProfile.id], 'team', details)
      );
      setIsNewChatModalOpen(false);
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </main>
      </div>
    );
  }

  return (
    <>
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 bg-white border-b px-8 flex items-center justify-between shrink-0 z-20">
          <div className="flex-1 max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              value={convSearchQuery}
              onChange={(e) => setConvSearchQuery(e.target.value)}
              placeholder="Pesquisar conversas..." 
              className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-6">
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <Bell className="w-6 h-6" />
            </button>
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <History className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Conversation List */}
          <section className="w-96 bg-white border-r flex flex-col shrink-0">
            <div className="p-6 shrink-0">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Centro de Mensagens</h2>
                <button 
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              </div>

              {/* No more tabs - focusing on Team */}
              <div className="flex p-1 bg-slate-100 rounded-2xl">
                <button 
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl bg-white text-blue-600 shadow-sm"
                >
                  Equipe
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-6">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-20 px-8">
                  <p className="text-sm text-slate-400 italic">Nenhuma conversa encontrada nesta categoria.</p>
                </div>
              ) : (
                conversations
                  .filter(conv => {
                    const partner = getPartner(conv);
                    return partner?.name.toLowerCase().includes(convSearchQuery.toLowerCase()) ||
                           conv.lastMessage?.toLowerCase().includes(convSearchQuery.toLowerCase());
                  })
                  .map(conv => {
                    const partner = getPartner(conv);
                    const isActive = selectedConv?.id === conv.id;
                  
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConv(conv)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-3xl transition-all mb-2 text-left group",
                        isActive ? "bg-blue-50" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Image 
                          src={partner?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.name || "U")}`} 
                          alt={partner?.name || "Partner"} 
                          width={56}
                          height={56}
                          className="w-14 h-14 rounded-2xl object-cover shadow-sm bg-slate-100"
                          referrerPolicy="no-referrer"
                          unoptimized
                        />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={cn("font-bold truncate text-sm transition-colors", isActive ? "text-blue-600" : "text-slate-900")}>
                            {partner?.name}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter shrink-0 pt-0.5">
                            {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), "HH:mm") : ""}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate group-hover:text-slate-700 transition-colors">
                          {conv.lastMessage || "Nenhuma mensagem ainda"}
                        </p>
                      </div>

                      {(conv.unreadCount?.[user?.id || ""] || 0) > 0 && (
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-lg shadow-blue-500/20">
                          {conv.unreadCount?.[user?.id || ""]}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Middle: Chat Area */}
          <section className="flex-1 flex flex-col bg-white overflow-hidden relative">
            {!selectedConv ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Mail className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="font-bold text-slate-700">Bem-vindo ao Centro de Mensagens</h3>
                <p className="text-sm mt-1 max-w-xs mx-auto">Selecione uma conversa para começar a interagir com seus contatos e equipe.</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <header className="h-20 border-b px-8 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl overflow-hidden relative shadow-sm border border-slate-100">
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
                      <h3 className="font-bold text-slate-900 text-sm leading-none">{getPartner(selectedConv)?.name}</h3>
                      <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mt-1">Online agora</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-colors">
                      <Video className="w-5 h-5" />
                    </button>
                    <button className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-colors">
                      <Phone className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-slate-100 mx-1" />
                    <button className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </header>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/20">
                  {/* Date Separator */}
                  <div className="flex items-center justify-center">
                    <span className="px-4 py-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] rounded-full border border-slate-100 shadow-sm">
                      Hoje
                    </span>
                  </div>

                  <div className="flex flex-col gap-8">
                    {messages.map((msg, i) => {
                      const isOwn = msg.senderId === user?.id;
                      const partner = getPartner(selectedConv);
                      const senderName = isOwn ? (profile?.displayName || "Você") : (partner?.name || "Usuário");
                      const senderPhoto = isOwn 
                        ? (profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0D8ABC&color=fff`) 
                        : partner?.photoURL;

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={cn(
                            "flex gap-3 max-w-[85%]",
                            isOwn ? "self-end flex-row-reverse" : "self-start"
                          )}
                        >
                          <div className="w-10 h-10 rounded-xl overflow-hidden relative shrink-0 mt-1 shadow-sm bg-slate-200">
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
                              "relative group",
                              isOwn ? "items-end text-right" : "items-start text-left"
                            )}>
                              <div className={cn(
                                "rounded-[24px] p-4 text-sm shadow-sm transition-all group-hover:shadow-md",
                                isOwn 
                                  ? "bg-blue-600 text-white rounded-tr-none" 
                                  : "bg-white text-slate-700 rounded-tl-none border border-slate-100"
                              )}>
                                <p className="font-bold text-[10px] uppercase tracking-widest opacity-60 mb-1">
                                  {senderName}
                                </p>
                                {msg.type === 'text' ? (
                                  msg.content
                                ) : msg.type === 'image' ? (
                                  <div className="space-y-2">
                                    <div className="relative w-full aspect-square min-w-[200px] rounded-xl overflow-hidden bg-slate-100">
                                      <Image 
                                        src={msg.fileUrl || ""} 
                                        alt={msg.fileName || "Imagem"} 
                                        fill
                                        className="object-cover cursor-pointer hover:scale-105 transition-transform"
                                        onClick={() => window.open(msg.fileUrl, '_blank')}
                                        unoptimized
                                      />
                                    </div>
                                    <p className="text-[10px] opacity-70 italic">Imagem enviada</p>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 p-2 bg-black/5 rounded-xl">
                                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                      <FileText className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold truncate text-xs">{msg.fileName}</p>
                                      <button 
                                        onClick={() => msg.fileUrl && downloadFile(msg.fileUrl, msg.fileName || "arquivo")}
                                        className="text-[10px] font-bold underline hover:opacity-80 uppercase tracking-widest block"
                                      >
                                        Download
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <div className={cn(
                                "mt-1.5 flex items-center gap-2 px-1",
                                isOwn ? "flex-row-reverse" : "flex-row"
                              )}>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {msg.createdAt ? format(new Date(msg.createdAt), "HH:mm") : ""}
                                </span>
                                {isOwn && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
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
                <footer className="p-6 border-t shrink-0">
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

                  <form onSubmit={handleSendMessage} className="flex items-center gap-4 bg-slate-50 rounded-[32px] p-2 pr-2 border border-slate-100 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                    <div className="flex gap-1">
                      <button type="button" className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-full transition-all">
                        <Plus className="w-5 h-5" />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-full transition-all disabled:opacity-50"
                      >
                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-full transition-all disabled:opacity-50"
                      >
                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escreva uma mensagem..."
                      className="flex-1 bg-transparent border-none py-4 px-4 text-sm focus:ring-0 font-medium placeholder:text-slate-400"
                    />
                    
                    <button type="button" className="p-3 text-slate-400 hover:text-blue-600 transition-colors">
                      <Smile className="w-5 h-5" />
                    </button>

                    <button 
                      type="submit"
                      disabled={!newMessage.trim() || isSubmitting}
                      className="w-12 h-12 bg-blue-600 text-white rounded-[20px] flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/30 shrink-0"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </form>
                </footer>
              </>
            )}
          </section>

          {/* Right: Contact Context (Mini 360) */}
          <section className="w-96 bg-white border-l shrink-0 hidden xl:flex flex-col overflow-y-auto">
            {!selectedConv ? (
              <div className="p-12 text-center text-slate-400 mt-20">
                <Target className="w-10 h-10 mx-auto mb-4 opacity-10" />
                <p className="text-xs">Contexto do contato aparecerá aqui</p>
              </div>
            ) : (
              <div className="p-8 space-y-10">
                {/* Profile Header */}
                <div className="text-center">
                  <div className="w-32 h-32 rounded-[40px] overflow-hidden border-4 border-blue-50 p-1 mx-auto shadow-md mb-6 relative group">
                    <Image 
                      src={getPartner(selectedConv)?.photoURL || ""} 
                      fill
                      className="w-full h-full object-cover rounded-[32px] transition-transform group-hover:scale-110"
                      alt="Profile"
                      referrerPolicy="no-referrer"
                      unoptimized
                    />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{getPartner(selectedConv)?.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                    {getPartner(selectedConv)?.type === 'team' ? (getPartner(selectedConv)?.role || 'Equipe') : 'Contato Cadastrado'}
                  </p>
                  
                  <div className="flex justify-center gap-2 mt-4">
                    <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-bold uppercase rounded-lg border border-green-100">ATIVO</span>
                    {getPartner(selectedConv)?.type === 'team' ? (
                      <span className="px-3 py-1 bg-purple-50 text-purple-600 text-[10px] font-bold uppercase rounded-lg border border-purple-100">EQUIPE</span>
                    ) : (
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded-lg border border-blue-100">CLIENTE</span>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Informações de Contato</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-slate-500 transition-colors group">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                        <Mail className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium truncate">{getPartner(selectedConv)?.email || 'Sem e-mail'}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Activities Shortcut */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Atalhos</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Link 
                      href={getPartner(selectedConv)?.type === 'client' 
                        ? `/contacts/${getPartner(selectedConv)?.id}` 
                        : `/users`
                      }
                      className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100"
                    >
                      <User className="w-5 h-5 mb-2" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Ver Perfil</span>
                    </Link>
                    <button className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100">
                      <Target className="w-5 h-5 mb-2" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Novo Negócio</span>
                    </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
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
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b">
                <h3 className="text-2xl font-bold text-slate-900">Nova Conversa</h3>
                <p className="text-slate-500 text-sm mt-1">Selecione um contato para iniciar o chat.</p>
              </div>
              
              <div className="p-6">
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar contatos..." 
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-slate-400 text-sm italic">Nenhum {activeTab === 'client' ? 'contato' : 'membro da equipe'} encontrado.</p>
                    </div>
                  ) : (
                    filteredItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => activeTab === 'client' ? startNewConversation(item) : startNewConversationFromProfile(item)}
                        className="w-full flex items-center gap-4 p-4 rounded-3xl hover:bg-slate-50 transition-all text-left group"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden relative shadow-sm bg-slate-100 border border-slate-200">
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
                          <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                            {activeTab === 'client' ? item.name : item.displayName}
                          </h4>
                          <p className="text-xs text-slate-500 truncate">{item.email}</p>
                        </div>
                        <Plus className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                      </button>
                    ))
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
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
    <div className="flex min-h-screen bg-slate-50 font-sans selection:bg-blue-100">
      <Sidebar />
      <Suspense fallback={
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </main>
      }>
        <MessagesContent />
      </Suspense>
    </div>
  );
}
