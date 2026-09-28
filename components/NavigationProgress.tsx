"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Complete progress whenever the pathname or searchParams finish changing
  useEffect(() => {
    setProgress(100);
    const timer = setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 180);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  useEffect(() => {
    // Intercept clicks on links to start progress bar instantly
    const handleDocumentClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external, hash, or target="_blank" links
      if (
        href.startsWith("http://") || 
        href.startsWith("https://") || 
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        e.ctrlKey || 
        e.metaKey
      ) {
        return;
      }

      // Check if clicking current active route
      const currentFull = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
      if (href === currentFull) return;

      // Start the progress animation instantly
      setIsNavigating(true);
      setProgress(25);

      const t1 = setTimeout(() => setProgress(60), 100);
      const t2 = setTimeout(() => setProgress(85), 300);

      // Safety fallback in case navigation is aborted or cancelled
      const safetyTimeout = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 5000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(safetyTimeout);
      };
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleDocumentClick, { capture: true });
    };
  }, [pathname, searchParams]);

  if (!isNavigating && progress === 0) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-[2.5px] z-[99999] pointer-events-none overflow-hidden"
      role="progressbar"
      aria-hidden="true"
    >
      <div 
        className="h-full bg-gradient-to-r from-primary via-indigo-400 to-primary transition-all duration-200 ease-out shadow-[0_0_8px_rgba(99,102,241,0.6)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? 'width 150ms ease-out, opacity 180ms ease-out' : 'width 250ms ease-out'
        }}
      />
    </div>
  );
}
