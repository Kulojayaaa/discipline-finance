import { Loader2 } from 'lucide-react';

interface FullPageLoaderProps {
  label?: string;
}

export function FullPageLoader({ label = 'Loading...' }: FullPageLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}
