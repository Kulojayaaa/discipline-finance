import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-accent/20 rounded-full blur-[120px] animate-pulse" />
      
      <div className="relative z-10 max-w-md w-full mx-4 p-8 glass-morphism rounded-3xl border border-white/10 shadow-2xl text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6 group transition-all duration-500 hover:scale-110">
          <Compass className="w-10 h-10 text-primary group-hover:rotate-45 transition-transform duration-500" />
        </div>
        
        <h1 className="text-8xl font-black gradient-primary bg-clip-text text-transparent mb-2">404</h1>
        <h2 className="text-2xl font-bold font-display text-foreground mb-4">Lost in synchronization?</h2>
        <p className="text-muted-foreground mb-8 text-balance">
          It seems you've wandered off the track. Let's get you back to your routine.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="gradient-primary text-white rounded-xl px-8 h-12 shadow-lg hover:shadow-primary/25 transition-all">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl px-8 h-12 border-primary/20 hover:bg-primary/5 transition-all">
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
