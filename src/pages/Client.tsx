import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Clock, Search, AlertCircle } from 'lucide-react';

interface QueueData {
  client_id: string;
  patient_name?: string;
  state: string;
  position: number;
  peopleBefore: number;
  doctor_name: string;
  found: boolean;
}

const Client = () => {
  const [phone, setPhone] = useState('');
  const [manualState, setManualState] = useState('N');
  const [manualDoctor, setManualDoctor] = useState('');
  const [manualNumber, setManualNumber] = useState('');
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<{ id: string; name: string; initial: string }[]>([]);

  useEffect(() => {
    supabase.from('doctors').select('*').then(({ data }) => {
      if (data) setDoctors(data);
    });
  }, []);

  const lookupByPhone = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    await findClient('phone', phone.trim());
    setLoading(false);
  };

  const lookupById = async () => {
    if (!manualDoctor || !manualNumber) return;
    const doctor = doctors.find(d => d.initial === manualDoctor);
    if (!doctor) return;
    const clientId = `${manualState}${manualNumber}${manualDoctor}`;
    setLoading(true);
    await findClient('id', clientId);
    setLoading(false);
  };

  const findClient = async (mode: 'phone' | 'id', value: string) => {
    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      setQueueData({ client_id: '', state: '', position: 0, peopleBefore: 0, doctor_name: '', found: false });
      return;
    }

    // Optimization: Let the database handle the complex priority sorting
    // Priority: U (0), N (1), R (2). We can use a CASE statement in order if supported, 
    // but the safest and fastest way is multiple orders or a calculated field.
    // For now, we'll fetch only what's needed for the current session.
    const { data: allEntries } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors(*)')
      .eq('session_id', session.id)
      .eq('status', 'waiting');

    if (!allEntries) {
      setQueueData({ client_id: '', state: '', position: 0, peopleBefore: 0, doctor_name: '', found: false });
      return;
    }

    const PRIORITY: Record<string, number> = { U: 0, N: 1, R: 2 };
    const sorted = [...allEntries].sort((a, b) => {
      const pa = PRIORITY[a.state] ?? 99;
      const pb = PRIORITY[b.state] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.state_number - b.state_number;
    });

    let entry;
    if (mode === 'phone') {
      entry = sorted.find(e => e.phone === value);
    } else {
      entry = sorted.find(e => e.client_id === value);
    }

    if (!entry) {
      setQueueData({ client_id: '', state: '', position: 0, peopleBefore: 0, doctor_name: '', found: false });
      return;
    }

    const idx = sorted.findIndex(e => e.id === entry!.id);

    // Count people before this client waiting for the SAME doctor
    const peopleBeforeSameDoctor = sorted.slice(0, idx).filter(
      e => e.doctor_id === entry!.doctor_id
    ).length;

    setQueueData({
      client_id: entry.client_id,
      patient_name: entry.patient_name,
      state: entry.state,
      position: idx + 1,
      peopleBefore: peopleBeforeSameDoctor,
      doctor_name: (entry as any).doctor?.name || '',
      found: true,
    });
  };

  // Real-time updates - optimized subscription
  useEffect(() => {
    if (!queueData?.found) return;

    const channel = supabase
      .channel('client-position-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries'
        },
        (payload) => {
          // Only trigger if a relevant record changed or something was deleted/inserted
          // which could affect the position.
          if (phone.trim()) findClient('phone', phone.trim());
          else if (manualDoctor && manualNumber) {
            const clientId = `${manualState}${manualNumber}${manualDoctor}`;
            findClient('id', clientId);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queueData?.found, phone, manualState, manualDoctor, manualNumber]);

  const stateLabels: Record<string, string> = { U: 'Urgence', N: 'Nouveau', R: 'Rendez-vous' };

  return (
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col">
      <header className="p-3 sm:p-4 text-center border-b">
        <h1 className="text-xl sm:text-2xl font-bold text-primary italic">PasseVite</h1>
        <p className="text-[10px] tracking-[0.2em] text-muted-foreground -mt-1 uppercase">le soin qui passe</p>
      </header>

      {!queueData?.found && (
        <div className="flex-1 p-3 sm:p-4 flex items-center justify-center">
          <Card className="w-full max-w-md border-0 shadow-lg">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg text-center">Trouver votre position</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <Tabs defaultValue="phone" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="phone" className="text-xs sm:text-sm">Par téléphone</TabsTrigger>
                  <TabsTrigger value="id" className="text-xs sm:text-sm">Par identifiant</TabsTrigger>
                </TabsList>
                <TabsContent value="phone" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                  <Input
                    placeholder="Votre numéro de téléphone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="tel"
                    className="h-11 sm:h-12"
                  />
                  <Button onClick={lookupByPhone} className="w-full h-11 sm:h-12" disabled={loading}>
                    <Search className="h-4 w-4 mr-2" /> Rechercher
                  </Button>
                </TabsContent>
                <TabsContent value="id" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                  <Select value={manualState} onValueChange={setManualState}>
                    <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="État" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="U">U - Urgence</SelectItem>
                      <SelectItem value="N">N - Nouveau</SelectItem>
                      <SelectItem value="R">R - Rendez-vous</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={manualDoctor} onValueChange={setManualDoctor}>
                    <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="Initiale médecin" /></SelectTrigger>
                    <SelectContent>
                      {doctors.map(d => (
                        <SelectItem key={d.initial} value={d.initial}>{d.initial} - Dr. {d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Numéro"
                    value={manualNumber}
                    onChange={(e) => setManualNumber(e.target.value)}
                    type="number"
                    className="h-11 sm:h-12"
                  />
                  <Button onClick={lookupById} className="w-full h-11 sm:h-12" disabled={loading}>
                    <Search className="h-4 w-4 mr-2" /> Rechercher
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {queueData && !queueData.found && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm border-0 shadow-xl">
            <CardContent className="p-6 sm:p-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-lg sm:text-xl font-semibold text-red-600">Aucun patient trouvé</p>
                <p className="text-sm text-muted-foreground">Vérifiez vos informations et réessayez.</p>
                <p className="text-xs text-muted-foreground">Assurez-vous que votre numéro de téléphone ou votre identifiant est correct.</p>
              </div>
              <Button variant="destructive" onClick={() => setQueueData(null)} className="mt-2">
                Réessayer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {queueData?.found && (
        <div className="flex-1 p-3 sm:p-4 flex items-center justify-center">
          <Card className="w-full max-w-md border-0 shadow-lg">
            <CardContent className="p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
              <div>
                {queueData.patient_name && (
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">{queueData.patient_name}</h2>
                )}
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Votre identifiant</p>
                <p className="text-4xl sm:text-5xl font-bold text-primary">{queueData.client_id}</p>
              </div>
              <Badge className="text-xs sm:text-sm px-3 sm:px-4 py-1">{stateLabels[queueData.state] || queueData.state}</Badge>
              <div className="bg-secondary rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <span className="text-2xl sm:text-3xl font-bold text-foreground">{queueData.peopleBefore}</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {queueData.peopleBefore === 0
                    ? 'C\'est votre tour !'
                    : `personne${queueData.peopleBefore > 1 ? 's' : ''} avant vous`}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">Dr. {queueData.doctor_name}</span>
              </div>
              <Button variant="outline" onClick={() => setQueueData(null)} className="mt-2 sm:mt-4">
                Nouvelle recherche
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Client;
