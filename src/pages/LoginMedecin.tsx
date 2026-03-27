import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Stethoscope } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const LoginMedecin = () => {
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const navigate = useNavigate();

    const { data: doctors, isLoading: doctorsLoading } = useQuery({
        queryKey: ['doctors'],
        queryFn: async () => {
            const { data } = await supabase.from('doctors').select('*').order('name');
            return data || [];
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDoctorId || !password.trim()) {
            toast.error('Veuillez sélectionner un médecin et entrer le mot de passe');
            return;
        }

        setLoading(true);

        // Check if the credentials match a doctor in the database
        const { data: matchedDoctor, error } = await supabase
            .from('doctors')
            .select('*')
            .eq('id', selectedDoctorId)
            .eq('password', password.trim())
            .maybeSingle();

        setLoading(false);

        if (error || !matchedDoctor) {
            toast.error('Mot de passe ou identifiants incorrects');
            return;
        }

        // Store the doctor identity in localStorage to persist the session
        localStorage.setItem('doctor_auth', JSON.stringify({
            id: matchedDoctor.id,
            name: matchedDoctor.name,
            role: 'doctor'
        }));

        toast.success(`Bienvenue Dr. ${matchedDoctor.name}`);
        navigate('/medecin-dashboard');
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
                        <Stethoscope className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg font-medium text-foreground">Espace Médecin</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Select
                                value={selectedDoctorId}
                                onValueChange={setSelectedDoctorId}
                                disabled={doctorsLoading}
                            >
                                <SelectTrigger className="h-12">
                                    <SelectValue placeholder={doctorsLoading ? "Chargement des médecins..." : "Sélectionner votre nom..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {doctors?.map(d => (
                                        <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Input
                            type="password"
                            placeholder="Mot de passe"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-12"
                            required
                        />
                        <Button type="submit" className="w-full h-12 text-base font-medium" disabled={loading || !selectedDoctorId}>
                            {loading ? 'Connexion...' : 'Se connecter'}
                        </Button>
                        <div className="mt-6 p-4 rounded-xl bg-secondary/50 border border-primary/10 text-center">
                            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Information</p>
                            <p className="text-xs text-muted-foreground">Sélectionnez votre nom dans la liste et entrez votre mot de passe pour accéder à vos patients et ordonnances.</p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default LoginMedecin;
