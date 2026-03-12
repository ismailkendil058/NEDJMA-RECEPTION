import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Monitor, UserCog, Tv, Calendar } from 'lucide-react';

const Index = () => {
  const sections = [
    { title: 'Espace Client', description: 'Suivez votre position dans la file d\'attente', icon: Users, href: '/client', variant: 'default' as const },
    { title: 'Accueil', description: 'Gestion de la réception et de la file', icon: Monitor, href: '/accueil/login', variant: 'outline' as const },
    { title: 'Manager', description: 'Tableau de bord analytique', icon: UserCog, href: '/manager/login', variant: 'outline' as const },
    { title: 'Rendez-vous', description: 'Gestion des rendez-vous et agenda', icon: Calendar, href: '/rendezvous', variant: 'outline' as const },
    { title: 'Affichage TV', description: 'File d\'attente en temps réel', icon: Tv, href: '/tv', variant: 'outline' as const },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] animate-fade-in" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] animate-fade-in" style={{ animationDelay: '0.3s' }} />

      <div className="text-center mb-10 relative z-10 animate-fade-in">
        <div className="inline-block mb-4 p-2 rounded-2xl bg-white shadow-xl shadow-primary/10 animate-float border border-primary/5">
          <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-12 w-12 object-contain" />
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-primary tracking-tighter italic">
          PasseVite
        </h1>
        <p className="text-[10px] md:text-sm tracking-[0.5em] text-muted-foreground mt-2 font-medium uppercase">
          le soin qui passe
        </p>
        <div className="h-1 w-12 bg-primary/20 mx-auto mt-6 rounded-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg relative z-10">
        {sections.map(({ title, description, icon: Icon, href }, index) => (
          <Link
            key={href}
            to={href}
            className="animate-slide-up"
            style={{ animationDelay: `${0.1 * (index + 1)}s` }}
          >
            <Card className="border border-white/40 dark:border-white/5 shadow-xl shadow-primary/5 hover:shadow-primary/10 transition-all duration-300 cursor-pointer group h-full bg-white/50 dark:bg-black/20 backdrop-blur-sm active:scale-95">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <Icon className="h-7 w-7 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">{title}</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed px-2">{description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="mt-12 text-[10px] text-muted-foreground/50 uppercase tracking-[0.2em] relative z-10 animate-fade-in" style={{ animationDelay: '1s' }}>
        &copy; {new Date().getFullYear()} PasseVite &bull; Excellence en Soins
      </p>
    </div>
  );
};


export default Index;
