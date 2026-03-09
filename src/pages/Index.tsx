import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Monitor, UserCog, Tv } from 'lucide-react';

const Index = () => {
  const sections = [
    { title: 'Espace Client', description: 'Suivez votre position dans la file d\'attente', icon: Users, href: '/client', variant: 'default' as const },
    { title: 'Accueil', description: 'Gestion de la réception et de la file', icon: Monitor, href: '/accueil/login', variant: 'outline' as const },
    { title: 'Manager', description: 'Tableau de bord analytique', icon: UserCog, href: '/manager/login', variant: 'outline' as const },
    { title: 'Affichage TV', description: 'File d\'attente en temps réel', icon: Tv, href: '/tv', variant: 'outline' as const },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-primary tracking-tight">NEDJMA</h1>
        <p className="text-sm tracking-[0.4em] text-muted-foreground mt-2">CLINIQUE DENTAIRE</p>
        <p className="text-muted-foreground mt-4 max-w-md mx-auto">
          Système de gestion de file d'attente intelligent
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        {sections.map(({ title, description, icon: Icon, href }) => (
          <Link key={href} to={href}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group h-full">
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="h-6 w-6 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <h2 className="font-semibold text-foreground">{title}</h2>
                <p className="text-xs text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Index;
