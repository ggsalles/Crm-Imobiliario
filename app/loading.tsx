export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 animate-in fade-in duration-150">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest animate-pulse">
          Carregando...
        </p>
      </div>
    </div>
  );
}
