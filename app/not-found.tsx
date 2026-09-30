import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] bg-background text-foreground px-4 text-center">
      <h1 className="text-6xl font-black text-primary mb-3">404</h1>
      <h2 className="text-xl md:text-2xl font-bold mb-2">Página não encontrada</h2>
      <p className="text-muted-foreground mb-6 max-w-md text-sm font-medium">
        Desculpe, a página que você está procurando não existe ou foi movida.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all text-xs cursor-pointer shadow-md shadow-primary/20"
      >
        Voltar para a página inicial
      </Link>
    </div>
  );
}
