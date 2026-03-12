import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
import { Phone, Plus, LogOut, ChevronRight, ChevronLeft, Users, Clock, CheckCircle, XCircle, MessageCircle, Pencil, Trash2, UserCheck, Calendar } from 'lucide-react';

const TREATMENTS = ['Consultation', 'Blanchiment', 'Extraction', 'Détartrage', 'Soin dentaire', 'Prothèse', 'Orthodontie'];

const Accueil = () => {
  const { user, signOut } = useAuth();
  const { entries, inCabinetEntries, activeSession, doctors, openSession, closeSession, addClient, callClient, completeClient, getStats, updateClient, deleteClient } = useQueue();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
  const [editEntry, setEditEntry] = useState<QueueEntry | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editPatientName, setEditPatientName] = useState('');
  const [editState, setEditState] = useState<'U' | 'N' | 'R'>('N');
  const [editDoctorId, setEditDoctorId] = useState('');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const doctorsScrollRef = useRef<HTMLDivElement>(null);

  const scrollDoctors = (direction: 'left' | 'right') => {
    if (doctorsScrollRef.current) {
      const scrollAmount = 150;
      doctorsScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Add client form
  const [newPhone, setNewPhone] = useState('');
  const [newPatientName, setNewPatientName] = useState('');
  const [newState, setNewState] = useState<'U' | 'N' | 'R'>('N');
  const [newDoctorId, setNewDoctorId] = useState('');
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);

  // Complete form
  const [clientName, setClientName] = useState('');
  const [treatment, setTreatment] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [tranchePaid, setTranchePaid] = useState('');
  const [totalPaidPreviously, setTotalPaidPreviously] = useState(0);

  const [completedClients, setCompletedClients] = useState<any[]>([]);

  // Memoize statistics to avoid recalculating on every render
  const stats = useMemo(() => getStats(), [entries, inCabinetEntries, getStats]);

  // Memoize statistics by doctor
  const doctorStats = useMemo(() => {
    return doctors.map(doctor => {
      const doctorEntries = entries.filter(e => e.doctor_id === doctor.id);
      return {
        ...doctor,
        waitingCount: doctorEntries.length
      };
    });
  }, [doctors, entries]);

  const handleOpenSession = async () => {
    if (!user) return;
    const { error } = await openSession(user.id);
    if (error) toast.error('Erreur lors de l\'ouverture de la séance');
    else toast.success('Nouvelle séance ouverte');
  };

  const handleCloseSession = async () => {
    // Check if there are clients in waiting list or in-cabinet
    if (entries.length > 0 || inCabinetEntries.length > 0) {
      const waitingCount = entries.length;
      const inCabinetCount = inCabinetEntries.length;
      toast.error(
        `Impossible de fermer la séance avec ${waitingCount + inCabinetCount} patient(s) en attente (${waitingCount} en file d'attente, ${inCabinetCount} au cabinet)`
      );
      return;
    }

    const { error } = await closeSession();
    if (error) toast.error('Erreur lors de la fermeture de la séance');
    else toast.success('Séance fermée avec succès');
  };

  const handleAddClient = async () => {
    if (!newPhone.trim() || !newDoctorId) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await addClient(newPhone, newState, newDoctorId, newPatientName, linkedAppointmentId || undefined);
    if (error) {
      if ((error as any).code === '23505') {
        toast.error('Ce numéro de téléphone est déjà dans la file d\'attente');
      } else {
        toast.error('Erreur lors de l\'ajout');
      }
    }
    else {
      toast.success('Patient ajouté à la file');
      setShowAddModal(false);
      setNewPhone('');
      setNewPatientName('');
      setNewState('N');
      setNewDoctorId('');
      setLinkedAppointmentId(null);
    }
  };

  // Search for appointment when phone or state changes
  React.useEffect(() => {
    const searchAppointment = async () => {
      if (newState === 'R' && newPhone.length >= 8) {
        const today = new Date();
        const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const end = new Date(today.setHours(23, 59, 59, 999)).toISOString();

        const { data } = await (await import('@/integrations/supabase/client')).supabase
          .from('appointments')
          .select('id, client_name, doctor_id')
          .eq('client_phone', newPhone.trim())
          .gte('appointment_at', start)
          .lte('appointment_at', end)
          .maybeSingle();

        if (data) {
          setNewPatientName(data.client_name);
          setNewDoctorId(data.doctor_id);
          setLinkedAppointmentId(data.id);
          toast.info(`Rendez-vous trouvé pour ${data.client_name}`);
        } else {
          setLinkedAppointmentId(null);
        }
      } else if (newState !== 'R') {
        setLinkedAppointmentId(null);
      }
    };
    searchAppointment();
  }, [newPhone, newState]);

  const handleNext = async (entry: QueueEntry) => {
    // Call client - move from waiting to in_cabinet
    const { error } = await callClient(entry.id);
    if (error) {
      toast.error('Erreur lors de l\'appel du patient');
    } else {
      toast.success(`Patient ${entry.client_id} appelé au cabinet`);
    }
  };

  const handleCompleteClick = async (entry: QueueEntry) => {
    // Open completion form for in-cabinet client
    setSelectedEntry(entry);
    setClientName(entry.patient_name || '');

    // Fetch history for pre-filling
    try {
      const { data: history } = await (await import('@/integrations/supabase/client')).supabase
        .from('completed_clients')
        .select('*')
        .eq('phone', entry.phone)
        .order('completed_at', { ascending: false });

      if (history && history.length > 0) {
        const lastVisit = history[0];
        const totalPrevious = history.reduce((sum, item) => sum + (item.tranche_paid || 0), 0);

        setTreatment(lastVisit.treatment);
        setTotalAmount(lastVisit.total_amount?.toString() || '');
        setTotalPaidPreviously(totalPrevious);
        // Reset current payment for new visit
        setTranchePaid('');
      } else {
        setTreatment('');
        setTotalAmount('');
        setTotalPaidPreviously(0);
        setTranchePaid('');
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setTreatment('');
      setTotalAmount('');
      setTotalPaidPreviously(0);
      setTranchePaid('');
    }

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
      toast.success('Patient traité avec succès');
      setShowCompleteModal(false);
    }
  };

  const handleEdit = (entry: QueueEntry) => {
    setEditEntry(entry);
    setEditPhone(entry.phone);
    setEditPatientName(entry.patient_name || '');
    setEditState(entry.state);
    setEditDoctorId(entry.doctor_id);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editEntry || !editPhone.trim() || !editDoctorId) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await updateClient(editEntry.id, {
      phone: editPhone.trim(),
      patient_name: editPatientName.trim(),
      state: editState,
      doctor_id: editDoctorId,
    });
    if (error) toast.error('Erreur lors de la modification');
    else {
      toast.success('Patient modifié avec succès');
      setShowEditModal(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    const { error } = await deleteClient(entryId);
    if (error) toast.error('Erreur lors de la suppression');
    else toast.success('Patient supprimé');
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

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const matchesDoctor = doctorFilter === 'all' || e.doctor_id === doctorFilter;
      return matchesDoctor;
    });
  }, [entries, doctorFilter]);

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
            <h1 className="text-lg sm:text-xl font-bold text-primary italic">PasseVite</h1>
            <p className="text-[10px] text-muted-foreground uppercase">le soin qui passe</p>
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
          <h1 className="text-lg sm:text-xl font-bold text-primary italic">PasseVite</h1>
          <p className="text-[10px] text-muted-foreground truncate uppercase">le soin qui passe</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link to="/rendezvous">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Calendar className="h-4 w-4 mr-1" /> Rendez-vous
            </Button>
          </Link>
          <Link to="/rendezvous">
            <Button variant="outline" size="icon" className="sm:hidden h-8 w-8">
              <Calendar className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchCompleted} className="hidden sm:flex">
            <CheckCircle className="h-4 w-4 mr-1" /> Terminés
          </Button>
          <Button variant="outline" size="icon" onClick={fetchCompleted} className="sm:hidden h-8 w-8">
            <CheckCircle className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="hidden sm:flex" disabled={entries.length > 0 || inCabinetEntries.length > 0}>
                <XCircle className="h-4 w-4 mr-1" /> Fermer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="sm:hidden h-8 w-8" disabled={entries.length > 0 || inCabinetEntries.length > 0}>
                <XCircle className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[calc(100vw-2rem)]">
              <AlertDialogHeader>
                <AlertDialogTitle>Fermer la séance ?</AlertDialogTitle>
                <AlertDialogDescription>
                  {entries.length > 0 || inCabinetEntries.length > 0 ? (
                    <span className="text-destructive">
                      Impossible de fermer la séance : {entries.length + inCabinetEntries.length} patient(s) en attente
                      ({entries.length} en file d'attente, {inCabinetEntries.length} au cabinet).
                      Veuillez traiter ou supprimer tous les patients avant de fermer la séance.
                    </span>
                  ) : (
                    'Cette action va fermer la séance actuelle. La file d\'attente sera remise à zéro et l\'écran TV sera réinitialisé.'
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleCloseSession} disabled={entries.length > 0 || inCabinetEntries.length > 0}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {/* Stats by Doctor - carousel with navigation */}
      <div className="relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden sm:flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/80 shadow-md rounded-full"
            onClick={() => scrollDoctors('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden sm:flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/80 shadow-md rounded-full"
            onClick={() => scrollDoctors('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div
          ref={doctorsScrollRef}
          className="flex gap-2 p-3 sm:p-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {doctorStats.map(ds => {
            return (
              <Card
                key={ds.id}
                className="border-0 shadow-sm shrink-0 w-28 sm:w-40 snap-start cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setDoctorFilter(doctorFilter === ds.id ? 'all' : ds.id)}
              >
                <CardContent className="p-3 sm:p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground mb-1 truncate">Dr. {ds.name}</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{ds.waitingCount}</p>
                  <p className="text-xs text-muted-foreground">en attente</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* In Cabinet Section */}
      {inCabinetEntries.length > 0 && (
        <div className="p-3 sm:p-4 pb-0">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-orange-500" />
            Au cabinet ({inCabinetEntries.length})
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {inCabinetEntries.map(entry => (
              <Card
                key={entry.id}
                className="border-orange-200 bg-orange-50 shrink-0 w-40 sm:w-48 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleCompleteClick(entry)}
              >
                <CardContent className="p-3 text-center">
                  <p className="font-bold text-lg text-orange-700">{entry.client_id}</p>
                  <p className="text-xs font-medium text-orange-800 truncate">{entry.patient_name || '—'}</p>
                  <p className="text-xs text-orange-600 truncate">Dr. {entry.doctor?.name || '—'}</p>
                  <p className="text-xs text-orange-500 mt-1">Cliquer pour finaliser</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="flex-1 p-3 sm:p-4 space-y-2 pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun patient en attente</p>
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
                      {entry.patient_name && (
                        <span className="text-sm font-medium text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
                          · {entry.patient_name}
                        </span>
                      )}
                      <Badge variant="outline" className={`${stateColors[entry.state]} text-xs px-1.5 py-0`}>
                        {stateLabels[entry.state]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      Dr. {entry.doctor?.name || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <a href={`tel:${entry.phone}`} className="text-primary flex items-center justify-center p-1.5 hover:bg-secondary/50 rounded-full transition-colors" title="Appeler">
                      <Phone className="h-5 w-5" />
                    </a>
                    <a
                      href={`sms:${entry.phone}?body=${encodeURIComponent(". Cabinet PasseVite : votre tour arrive bientôt.\nVous pouvez suivre le nombre de patients avant vous ici :\nhttps://passevite.vercel.app/client\nدوركم سيأتي قريبًا.")}`}
                      className="text-primary flex items-center justify-center p-1.5 hover:bg-secondary/50 rounded-full transition-colors"
                      title="Envoyer un SMS"
                    >
                      <MessageCircle className="h-5 w-5" />
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => handleEdit(entry)}
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer le patient ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action supprimera {entry.client_id} de la file d'attente. Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleNext(entry)}
                    className="gap-1 shrink-0 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                  >
                    <span className="hidden sm:inline">Suivant</span> <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
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
            <DialogTitle>Ajouter un patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <Input
              placeholder="Nom du patient"
              value={newPatientName}
              onChange={(e) => {
                setNewPatientName(e.target.value);
                setLinkedAppointmentId(null); // Clear link if user manually changes name
              }}
              className="h-11 sm:h-12"
            />
            {linkedAppointmentId && (
              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 py-1.5 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" /> Rendez-vous lié
              </Badge>
            )}
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
            {totalPaidPreviously > 0 && (
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex justify-between items-center">
                <span className="text-xs font-medium text-emerald-800">Déjà payé (total history):</span>
                <span className="text-sm font-bold text-emerald-700">{totalPaidPreviously.toLocaleString()} DZD</span>
              </div>
            )}
            <Input
              placeholder="Tranche payée aujourd'hui (DZD)"
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
            <DialogTitle>Patients terminés</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {completedClients.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucun patient terminé</p>
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

      {/* Edit Client Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le patient · {editEntry?.client_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <Input
              placeholder="Nom du patient"
              value={editPatientName}
              onChange={(e) => setEditPatientName(e.target.value)}
              className="h-11 sm:h-12"
            />
            <Input
              placeholder="Numéro de téléphone"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              type="tel"
              className="h-11 sm:h-12"
            />
            <Select value={editState} onValueChange={(v) => setEditState(v as 'U' | 'N' | 'R')}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="État" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="U">🔴 Urgence</SelectItem>
                <SelectItem value="N">🟢 Nouveau</SelectItem>
                <SelectItem value="R">🔵 Rendez-vous</SelectItem>
              </SelectContent>
            </Select>
            <Select value={editDoctorId} onValueChange={setEditDoctorId}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="Médecin" /></SelectTrigger>
              <SelectContent>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate} className="w-full h-11 sm:h-12">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Accueil;
