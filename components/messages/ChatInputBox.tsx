"use client";

import { RefObject, useState } from "react";
import { 
  Send, 
  Loader2, 
  Image as ImageIcon, 
  Paperclip, 
  Smile, 
  Sparkles 
} from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "😉", "😊", "😇", 
  "😍", "🥰", "😘", "😜", "😎", "🥳", "🤔", "👍", "👎", "👏", 
  "🙌", "🙏", "👋", "🎉", "🚀", "💡", "🔥", "❤️", "👀", "✨",
  "✅", "❌", "🤝", "💼", "📅", "📞", "💪", "💯", "⭐", "🌈"
];

export interface ChatInputBoxProps {
  message: string;
  onMessageChange: (value: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => void;
  isSubmitting: boolean;
  isUploading: boolean;
  onOpenAiDrafter?: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  imageInputRef: RefObject<HTMLInputElement | null>;
}

export function ChatInputBox({
  message,
  onMessageChange,
  onSendMessage,
  onFileUpload,
  isSubmitting,
  isUploading,
  onOpenAiDrafter,
  fileInputRef,
  imageInputRef,
}: ChatInputBoxProps) {
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  return (
    <footer className="p-3 md:p-4 border-t border-border shrink-0 bg-card/30 backdrop-blur-md transition-colors">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => onFileUpload(e, "file")}
      />
      <input
        type="file"
        ref={imageInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => onFileUpload(e, "image")}
      />

      <form
        onSubmit={onSendMessage}
        className="flex items-center gap-2 bg-card rounded-2xl p-1.5 pr-2 border border-border focus-within:ring-2 focus-within:ring-primary/20 transition-all"
      >
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-background rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            title="Enviar Imagem"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-background rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            title="Anexar Arquivo"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>
          {onOpenAiDrafter && (
            <button
              type="button"
              onClick={onOpenAiDrafter}
              className="p-2 text-muted-foreground hover:text-primary hover:bg-background rounded-xl transition-all cursor-pointer"
              title="Redigir com IA"
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </button>
          )}
        </div>

        <input
          type="text"
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="Escreva uma mensagem..."
          className="flex-1 bg-transparent border-none py-2 px-2 text-xs md:text-sm focus:ring-0 font-medium text-foreground placeholder:text-muted-foreground outline-none"
        />

        <div className="relative">
          {isEmojiOpen && (
            <div className="absolute bottom-full mb-3 right-0 w-60 p-3 bg-card border border-border rounded-2xl shadow-xl z-50 grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onMessageChange(message + emoji);
                    setIsEmojiOpen(false);
                  }}
                  className="text-lg p-1 hover:bg-muted rounded-lg transition-all hover:scale-110 active:scale-95 cursor-pointer"
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
              "p-2 rounded-xl transition-all text-muted-foreground hover:bg-background cursor-pointer",
              isEmojiOpen ? "text-primary bg-primary/10" : "hover:text-primary"
            )}
            title="Inserir Emoji"
          >
            <Smile className="w-4 h-4" />
          </button>
        </div>

        <button
          type="submit"
          disabled={!message.trim() || isSubmitting}
          className="w-9 h-9 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-primary/20 shrink-0 cursor-pointer"
          title="Enviar"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </footer>
  );
}
