import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { UserCog } from 'lucide-react';

const LoginManager = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const fullEmail = email.trim().includes('@') ? email.trim() : `${email.trim()}@gmail.com`;
    const { error, data } = await signIn(fullEmail, password.trim());
    setLoading(false);
    if (error) {
      toast.error('Identifiants incorrects');
      return;
    }
    const userId = data?.user?.id || (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (roleData?.role === 'manager') {
        navigate('/manager');
      } else {
        await supabase.auth.signOut();
        toast.error('Accès refusé. Ce portail est réservé au manager.');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto">
            <h1 className="text-3xl font-bold tracking-tight text-primary italic">PasseVite</h1>
            <p className="text-xs tracking-[0.3em] text-muted-foreground mt-1 uppercase">le soin qui passe</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto">
            <UserCog className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-lg font-medium text-foreground">Espace Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex">
              <Input
                type="text"
                placeholder="nom.utilisateur"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-r-none border-r-0"
                required
              />
              <span className="inline-flex items-center px-3 h-12 rounded-r-md border border-l-0 border-input bg-muted text-muted-foreground text-sm">
                @gmail.com
              </span>
            </div>
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
              required
            />
            <Button type="submit" className="w-full h-12 text-base font-medium" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
            <div className="mt-6 p-4 rounded-xl bg-secondary/50 border border-primary/10 text-center">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Compte Démo</p>
              <p className="text-xs text-muted-foreground">Utilisateur: <span className="text-foreground font-medium">admin</span></p>
              <p className="text-xs text-muted-foreground">Mot de passe: <span className="text-foreground font-medium">admin123</span></p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginManager;
