import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQueue, QueueEntry } from '@/hooks/useQueue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Phone, Plus, LogOut, Search, ChevronRight, Users, Clock, CheckCircle, XCircle, MessageCircle } from 'lucide-react';

const TREATMENTS = ['Consultation', 'Blanchiment', 'Extraction', 'Détartrage', 'Soin dentaire', 'Prothèse', 'Orthodontie'];

const Accueil = () => {
  const { user, signOut } = useAuth();
  const { entries, activeSession, doctors, openSession, closeSession, addClient, completeClient, getStats } = useQueue();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');

  // Add client form
  const [newPhone, setNewPhone] = useState('');
  const [newState, setNewState] = useState<'U' | 'N' | 'R'>('N');
  const [newDoctorId, setNewDoctorId] = useState('');

  // Complete form
  const [clientName, setClientName] = useState('');
  const [treatment, setTreatment] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [tranchePaid, setTranchePaid] = useState('');

  const [completedClients, setCompletedClients] = useState<any[]>([]);

  const stats = getStats();

  const handleOpenSession = async () => {
    if (!user) return;
    const { error } = await openSession(user.id);
    if (error) toast.error('Erreur lors de l\'ouverture de la séance');
    else toast.success('Nouvelle séance ouverte');
  };

  const handleCloseSession = async () => {
    const { error } = await closeSession();
    if (error) toast.error('Erreur lors de la fermeture de la séance');
    else toast.success('Séance fermée avec succès');
  };

  const handleAddClient = async () => {
    if (!newPhone.trim() || !newDoctorId) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await addClient(newPhone, newState, newDoctorId);
    if (error) toast.error('Erreur lors de l\'ajout');
    else {
      toast.success('Client ajouté à la file');
      setShowAddModal(false);
      setNewPhone('');
      setNewState('N');
      setNewDoctorId('');
    }
  };

  const handleNext = (entry: QueueEntry) => {
    setSelectedEntry(entry);
    setClientName('');
    setTreatment('');
    setTotalAmount('');
    setTranchePaid('');
    setShowCompleteModal(true);
  };

  const handleComplete = async () => {
    if (!selectedEntry || !user || !clientName.trim() || !treatment) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await completeClient(
      selectedEntry.id,
      clientName,
      treatment,
      parseFloat(totalAmount) || 0,
      parseFloat(tranchePaid) || 0,
      user.id
    );
    if (error) toast.error('Erreur');
    else {
      toast.success('Client traité avec succès');
      setShowCompleteModal(false);
    }
  };

  const fetchCompleted = async () => {
    if (!activeSession) return;
    const { data } = await (await import('@/integrations/supabase/client')).supabase
      .from('completed_clients')
      .select('*, doctor:doctors(*)')
      .eq('session_id', activeSession.id)
      .order('completed_at', { ascending: false });
    setCompletedClients(data || []);
    setShowCompleted(true);
  };

  const filtered = entries.filter(e => {
    const matchesSearch = !searchQuery || e.phone.includes(searchQuery) || e.client_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDoctor = doctorFilter === 'all' || e.doctor_id === doctorFilter;
    return matchesSearch && matchesDoctor;
  });

  const stateColors = {
    U: 'bg-destructive text-destructive-foreground',
    N: 'bg-primary text-primary-foreground',
    R: 'bg-foreground text-background',
  };

  const stateLabels = { U: 'Urgence', N: 'Nouveau', R: 'Rendez-vous' };

  if (!activeSession) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <header className="flex items-center justify-between p-3 sm:p-4 border-b">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-primary">NEDJMA</h1>
            <p className="text-xs text-muted-foreground">Accueil</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm text-center border-0 shadow-lg">
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
                <Clock className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">Bienvenue</h2>
                <p className="text-sm text-muted-foreground mt-1">Aucune séance active</p>
              </div>
              <Button onClick={handleOpenSession} className="w-full h-12 text-base">
                Ouvrir une nouvelle séance
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-background z-10">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-primary">NEDJMA</h1>
          <p className="text-xs text-muted-foreground truncate">Accueil · Séance active</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={fetchCompleted} className="hidden sm:flex">
            <CheckCircle className="h-4 w-4 mr-1" /> Terminés
          </Button>
          <Button variant="outline" size="icon" onClick={fetchCompleted} className="sm:hidden h-8 w-8">
            <CheckCircle className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="hidden sm:flex">
                <XCircle className="h-4 w-4 mr-1" /> Fermer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="sm:hidden h-8 w-8">
                <XCircle className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[calc(100vw-2rem)]">
              <AlertDialogHeader>
                <AlertDialogTitle>Fermer la séance ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action va fermer la séance actuelle. La file d'attente sera remise à zéro et l'écran TV sera réinitialisé.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleCloseSession}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {/* Stats by Doctor - scrollable on mobile */}
      <div className="flex gap-2 p-3 sm:p-4 overflow-x-auto sm:grid sm:grid-cols-4 sm:overflow-visible">
        {doctors.map(doctor => {
          const waiting = entries.filter(e => e.doctor_id === doctor.id);
          return (
            <Card key={doctor.id} className="border-0 shadow-sm shrink-0 w-28 sm:w-auto">
              <CardContent className="p-3 sm:p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1 truncate">Dr. {doctor.name}</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{waiting.length}</p>
                <p className="text-xs text-muted-foreground">en attente</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search & Filter */}
      <div className="px-3 sm:px-4 flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 sm:h-10"
          />
        </div>
        <Select value={doctorFilter} onValueChange={setDoctorFilter}>
          <SelectTrigger className="w-24 sm:w-32 h-9 sm:h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {doctors.map(d => (
              <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Queue List */}
      <div className="flex-1 p-3 sm:p-4 space-y-2 pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun client en attente</p>
          </div>
        ) : (
          filtered.map((entry, index) => (
            <Card key={entry.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-primary">{index + 1}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm sm:text-base text-foreground">{entry.client_id}</span>
                      <Badge variant="outline" className={`${stateColors[entry.state]} text-xs px-1.5 py-0`}>
                        {stateLabels[entry.state]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <a href={`tel:${entry.phone}`} className="text-xs sm:text-sm text-primary flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{entry.phone}</span>
                      </a>
                      <a
                        href={`sms:${entry.phone}?body=${encodeURIComponent("Bonjour,\n\nIci la Clinique Nedjma. Nous vous informons que votre tour est prévu dans environ 30 minutes.\nNous vous remercions de bien vouloir vous présenter à l'accueil à temps.\n\nMerci pour votre compréhension et à tout à l'heure.\nClinique Nedjma")}`}
                        className="text-primary hover:text-primary/80"
                        title="Envoyer un SMS"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      Dr. {entry.doctor?.name || '—'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleNext(entry)}
                  className="gap-1 shrink-0 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Suivant</span> <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* FAB to add client */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6">
        <Button
          size="lg"
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      </div>

      {/* Add Client Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <Input
              placeholder="Numéro de téléphone"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              type="tel"
              className="h-11 sm:h-12"
            />
            <Select value={newState} onValueChange={(v) => setNewState(v as 'U' | 'N' | 'R')}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="État" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="U">🔴 Urgence</SelectItem>
                <SelectItem value="N">🟢 Nouveau</SelectItem>
                <SelectItem value="R">🔵 Rendez-vous</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newDoctorId} onValueChange={setNewDoctorId}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="Médecin" /></SelectTrigger>
              <SelectContent>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleAddClient} className="w-full h-11 sm:h-12">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Client Modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finaliser · {selectedEntry?.client_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <Input
              placeholder="Nom du client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="h-11 sm:h-12"
            />
            <Select value={treatment} onValueChange={setTreatment}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="Traitement" /></SelectTrigger>
              <SelectContent>
                {TREATMENTS.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Montant total (DZD)"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              type="number"
              className="h-11 sm:h-12"
            />
            <Input
              placeholder="Tranche payée (DZD)"
              value={tranchePaid}
              onChange={(e) => setTranchePaid(e.target.value)}
              type="number"
              className="h-11 sm:h-12"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleComplete} className="w-full h-11 sm:h-12">Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completed Clients Dialog */}
      <Dialog open={showCompleted} onOpenChange={setShowCompleted}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clients terminés</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {completedClients.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucun client terminé</p>
            ) : (
              completedClients.map((c: any) => (
                <Card key={c.id} className="border-0 shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{c.client_name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{c.client_id} · {c.treatment}</p>
                        <a href={`tel:${c.phone}`} className="text-xs sm:text-sm text-primary">{c.phone}</a>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm text-foreground">{c.total_amount?.toLocaleString()} DZD</p>
                        <p className="text-xs text-muted-foreground">Payé: {c.tranche_paid?.toLocaleString()} DZD</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Accueil;
