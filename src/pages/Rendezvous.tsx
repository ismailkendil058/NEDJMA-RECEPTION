import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    LogOut, Search, MessageSquare, Calendar as CalendarIcon,
    Users, CheckCircle2, XCircle, Clock, History, Plus, Phone
} from 'lucide-react';
import { format, addHours, isWithinInterval, startOfDay, endOfDay, parseISO, startOfToday, endOfToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface CompletedClient {
    id: string;
    client_name: string;
    phone: string;
    client_id: string;
    state: string;
    treatment: string;
    total_amount: number;
    tranche_paid: number;
    completed_at: string;
    doctor_id: string;
}

interface Appointment {
    id: string;
    client_phone: string;
    client_name: string;
    doctor_id: string;
    appointment_at: string;
    status: 'scheduled' | 'confirmed' | 'coming' | 'denied' | 'no_answer' | 'attended';
    notes: string;
    doctor?: { name: string; initial: string };
}

interface Doctor {
    id: string;
    name: string;
    initial: string;
}

const Rendezvous = () => {
    useAuth();

    const [clients, setClients] = useState<CompletedClient[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState<{ phone: string, name: string } | null>(null);
    const [selectedDoctorMobile, setSelectedDoctorMobile] = useState<string>('all');
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [viewingClient, setViewingClient] = useState<CompletedClient | null>(null);

    // Form state for new appointment
    const [newApptDate, setNewApptDate] = useState<Date | undefined>(new Date());
    const [newApptTime, setNewApptTime] = useState('09:00');
    const [newApptDoctor, setNewApptDoctor] = useState('');
    const [newApptNotes, setNewApptNotes] = useState('');
    const [editingApptId, setEditingApptId] = useState<string | null>(null);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // Fetch Appointments
            const { data: apptsData } = await supabase
                .from('appointments')
                .select('*, doctor:doctors(*)')
                .order('appointment_at', { ascending: true });

            // Fetch Doctors
            const { data: docsData } = await supabase
                .from('doctors')
                .select('*');

            if (apptsData) setAppointments(apptsData as any);
            if (docsData) {
                setDoctors(docsData as any);
                if (docsData.length > 0 && window.innerWidth < 640) {
                    setSelectedDoctorMobile(docsData[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    // Fetch clients with server-side debounce for scalability
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            let q = supabase
                .from('completed_clients')
                .select('*');

            if (searchQuery.trim()) {
                q = q.or(`client_name.ilike.%${searchQuery.trim()}%,phone.ilike.%${searchQuery.trim()}%`);
            }

            q = q.order('completed_at', { ascending: false }).limit(200);

            const { data } = await q;
            if (data) setClients(data as any);
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    // Deduplication and debt filtering logic
    const uniqueClients = useMemo(() => {
        const patientData = new Map<string, { latest: CompletedClient, totalPaid: number }>();

        clients.forEach(c => {
            const key = `${c.phone}_${c.client_name.toLowerCase().trim()}_${(c.treatment || '').toLowerCase().trim()}`;
            const existing = patientData.get(key);
            const currentPaid = c.tranche_paid || 0;

            if (!existing) {
                patientData.set(key, { latest: c, totalPaid: currentPaid });
            } else {
                // Keep the record with the most recent completion date as 'latest'
                const isNewer = new Date(c.completed_at) > new Date(existing.latest.completed_at);
                patientData.set(key, { // Fixo: ensure we set using the same key
                    latest: isNewer ? c : existing.latest,
                    totalPaid: existing.totalPaid + currentPaid
                });
            }
        });

        return Array.from(patientData.values())
            .map(d => ({ ...d.latest, totalPaid: d.totalPaid }))
            .sort((a, b) => a.client_name.localeCompare(b.client_name));
    }, [clients]);

    // Use uniqueClients directly because sorting and filtering is handled server-side now
    const filteredClients = uniqueClients;

    const parsedAppointments = useMemo(() => {
        return appointments.map(a => ({
            ...a,
            startOfDayTime: startOfDay(parseISO(a.appointment_at)).getTime()
        }));
    }, [appointments]);

    const upcomingAppointments = useMemo(() => {
        const now = new Date();
        const next24h = addHours(now, 24);
        return parsedAppointments.filter(a => {
            const apptDate = parseISO(a.appointment_at);
            const isWithin24h = isWithinInterval(apptDate, { start: now, end: next24h });
            return isWithin24h && a.status !== 'attended' && a.status !== 'denied';
        });
    }, [parsedAppointments]);

    const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
        const { error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', id);

        if (error) {
            toast.error('Erreur lors de la mise à jour');
        } else {
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
            toast.success('Statut mis à jour');
        }
    };

    const handleSendSMS = (phone: string, name: string, time: string) => {
        const message = `We are PasseVite clinic. Your rendezvous with your doctor is in 24H. Please confirm if you will attend.`;
        window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank');
    };

    const handleCall = (phone: string) => {
        window.open(`tel:${phone}`, '_self');
    };

    const getStatusStyle = (status: Appointment['status']) => {
        switch (status) {
            case 'coming': return 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500';
            case 'denied': return 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500';
            case 'scheduled': return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'attended': return 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const handleScheduleAppt = async () => {
        if (!selectedClient || !newApptDate || !newApptDoctor) {
            toast.error('Veuillez remplir tous les champs');
            return;
        }

        const [hours, minutes] = newApptTime.split(':');
        const h = parseInt(hours);
        const m = parseInt(minutes);

        if (h < 8 || h > 18 || (h === 18 && m > 0)) {
            toast.error('Les horaires sont limités de 08:00 à 18:00');
            return;
        }

        const appointmentAt = new Date(newApptDate);
        appointmentAt.setHours(h, m, 0, 0);

        const appointmentData = {
            client_phone: selectedClient.phone,
            client_name: selectedClient.name,
            doctor_id: newApptDoctor,
            appointment_at: appointmentAt.toISOString(),
            notes: newApptNotes,
            status: 'scheduled' as Appointment['status']
        };

        if (editingApptId) {
            const { data, error } = await supabase
                .from('appointments')
                .update(appointmentData)
                .eq('id', editingApptId)
                .select('*, doctor:doctors(*)')
                .single();

            if (error) {
                toast.error('Erreur lors de la mise à jour du rendez-vous');
            } else {
                setAppointments(prev => prev.map(a => a.id === editingApptId ? (data as any) : a).sort((a, b) =>
                    new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime()
                ));
                toast.success('Rendez-vous mis à jour');
                setIsScheduleOpen(false);
                setEditingApptId(null);
                setNewApptNotes('');
            }
        } else {
            const { data, error } = await supabase
                .from('appointments')
                .insert(appointmentData)
                .select('*, doctor:doctors(*)')
                .single();

            if (error) {
                toast.error('Erreur lors de la création du rendez-vous');
            } else {
                setAppointments(prev => [...prev, data as any].sort((a, b) =>
                    new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime()
                ));
                toast.success('Rendez-vous programmé');
                setIsScheduleOpen(false);
                setNewApptNotes('');
            }
        }
    };

    const openEditModal = (appt: Appointment) => {
        setEditingApptId(appt.id);
        setSelectedClient({ phone: appt.client_phone, name: appt.client_name });
        const date = parseISO(appt.appointment_at);
        setNewApptDate(date);
        setNewApptTime(format(date, 'HH:mm'));
        setNewApptDoctor(appt.doctor_id);
        setNewApptNotes(appt.notes || '');
        setIsScheduleOpen(true);
    };

    const getClientHistory = (phone: string, name: string, treatment: string) => {
        const history = clients.filter(c =>
            c.phone === phone &&
            c.client_name.toLowerCase().trim() === name.toLowerCase().trim() &&
            (c.treatment || '').toLowerCase().trim() === treatment.toLowerCase().trim()
        );
        const appts = appointments.filter(a => a.client_phone === phone && a.client_name.toLowerCase().trim() === name.toLowerCase().trim());
        return { history, appts };
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-xl">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-primary italic">Rendez-vous</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Gestion du cabinet</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = '/manager'} className="h-9 w-9">
                        <History className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = '/accueil'} className="h-9 w-9">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            <main className="p-4 flex-1 space-y-6">
                <Tabs defaultValue="upcoming" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl h-12">
                        <TabsTrigger value="upcoming" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <Clock className="h-4 w-4 mr-2" /> À venir
                        </TabsTrigger>
                        <TabsTrigger value="clients" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <Users className="h-4 w-4 mr-2" /> Patients
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <CalendarIcon className="h-4 w-4 mr-2" /> Calendrier
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upcoming" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid gap-4">
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Prochaines 24 Heures</h2>
                            {loading ? (
                                <div className="h-32 flex items-center justify-center border rounded-xl border-dashed">
                                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                </div>
                            ) : upcomingAppointments.length === 0 ? (
                                <Card className="border-dashed shadow-none">
                                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                                        <CalendarIcon className="h-10 w-10 text-muted-foreground/20 mb-4" />
                                        <p className="text-muted-foreground font-medium">Aucun rendez-vous prévu pour les prochaines 24h</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                upcomingAppointments.map(appt => (
                                    <Card key={appt.id} className="overflow-hidden border-none shadow-premium bg-gradient-to-br from-white to-slate-50 dark:from-white/5 dark:to-transparent cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openEditModal(appt)}>
                                        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex gap-4">
                                                <div className="bg-primary/5 p-3 rounded-2xl flex flex-col items-center justify-center min-w-[70px] h-[70px]">
                                                    <span className="text-[10px] uppercase font-bold text-primary/60">{format(parseISO(appt.appointment_at), 'EEE', { locale: fr })}</span>
                                                    <span className="text-xl font-black text-primary">{format(parseISO(appt.appointment_at), 'HH:mm')}</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-lg text-foreground">{appt.client_name}</p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                        Dr. {appt.doctor?.name || 'Inconnu'}
                                                    </p>
                                                    <div className="mt-2 flex gap-1.5">
                                                        <Badge variant="outline" className={`capitalize text-[10px] px-2 py-0 ${getStatusStyle(appt.status)}`}>
                                                            {appt.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSendSMS(appt.client_phone, appt.client_name, format(parseISO(appt.appointment_at), 'HH:mm'));
                                                    }}
                                                    variant="secondary" className="flex-1 sm:flex-none h-10 gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                                                >
                                                    <MessageSquare className="h-4 w-4" />
                                                    <span className="text-sm">SMS</span>
                                                </Button>
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCall(appt.client_phone);
                                                    }}
                                                    variant="secondary" className="flex-1 sm:flex-none h-10 gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                                                >
                                                    <Phone className="h-4 w-4" />
                                                    <span className="text-sm">Appel</span>
                                                </Button>
                                                <div className="flex gap-1 flex-1 sm:flex-none" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        onClick={() => handleUpdateStatus(appt.id, 'coming')}
                                                        size="icon" variant="outline" className="h-10 w-10 text-emerald-600 hover:text-white hover:bg-emerald-600 border-emerald-100"
                                                        title="Vient"
                                                    >
                                                        <CheckCircle2 className="h-5 w-5" />
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleUpdateStatus(appt.id, 'denied')}
                                                        size="icon" variant="outline" className="h-10 w-10 text-rose-600 hover:text-white hover:bg-rose-600 border-rose-100"
                                                        title="Refusé"
                                                    >
                                                        <XCircle className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="clients" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher un patient (nom ou téléphone)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-12 rounded-xl"
                                />
                            </div>

                            <div className="grid gap-2">
                                {loading ? (
                                    <p className="text-center py-10 text-muted-foreground">Chargement...</p>
                                ) : filteredClients.length === 0 ? (
                                    <p className="text-center py-10 text-muted-foreground">Aucun patient trouvé</p>
                                ) : (
                                    filteredClients.map(client => (
                                        <Card key={`${client.phone}_${client.client_name}_${client.treatment}`} onClick={() => setViewingClient(client)} className="cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02] transition-all group">
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="font-bold text-foreground group-hover:text-primary transition-colors">{client.client_name}</p>
                                                    <p className="text-xs text-muted-foreground">{client.phone} · <span className="text-primary/70">{client.treatment}</span></p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right hidden sm:block">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Dernière visite</p>
                                                        <p className="text-xs font-semibold">{format(parseISO(client.completed_at), 'dd/MM/yyyy')}</p>
                                                    </div>
                                                    <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>

                            <Dialog open={!!viewingClient} onOpenChange={(open) => !open && setViewingClient(null)}>
                                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
                                    {viewingClient && (
                                        <>
                                            <DialogHeader className="p-6 pb-2">
                                                <DialogTitle className="text-2xl font-black italic text-primary">Dossier Patient</DialogTitle>
                                            </DialogHeader>

                                            <div className="p-6 pt-0 flex-1 overflow-y-auto space-y-6">
                                                <div className="bg-primary/5 p-4 rounded-xl flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-lg font-bold">{viewingClient.client_name}</h3>
                                                        <p className="text-sm font-medium text-primary">{viewingClient.phone}</p>
                                                    </div>
                                                    <Button variant="default" className="gap-2" onClick={() => {
                                                        setSelectedClient({ phone: viewingClient.phone, name: viewingClient.client_name });
                                                        setIsScheduleOpen(true);
                                                    }}>
                                                        <Plus className="h-4 w-4" /> Nouveau RDV
                                                    </Button>
                                                </div>

                                                <div className="space-y-4">
                                                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                        <History className="h-3.5 w-3.5" /> Historique des Paiements
                                                    </h4>
                                                    <div className="border rounded-xl overflow-hidden">
                                                        <Table>
                                                            <TableHeader className="bg-muted/50">
                                                                <TableRow>
                                                                    <TableHead className="text-xs h-9">Date</TableHead>
                                                                    <TableHead className="text-xs h-9">Traitement</TableHead>
                                                                    <TableHead className="text-xs h-9 text-right">Total</TableHead>
                                                                    <TableHead className="text-xs h-9 text-right">Payé</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {getClientHistory(viewingClient.phone, viewingClient.client_name, viewingClient.treatment).history.map(h => (
                                                                    <TableRow key={h.id}>
                                                                        <TableCell className="text-xs py-2">{format(parseISO(h.completed_at), 'dd/MM/yy')}</TableCell>
                                                                        <TableCell className="text-xs py-2 truncate max-w-[120px]">{h.treatment}</TableCell>
                                                                        <TableCell className="text-xs py-2 text-right font-medium">{h.total_amount?.toLocaleString()}</TableCell>
                                                                        <TableCell className="text-xs py-2 text-right text-emerald-600 font-bold">{h.tranche_paid?.toLocaleString()}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>

                                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-emerald-600">Total payé pour ce traitement</p>
                                                        <p className="text-2xl font-black text-emerald-700">
                                                            {(viewingClient as any).totalPaid?.toLocaleString()} DZD
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] uppercase font-bold text-emerald-600">Montant total</p>
                                                        <p className="text-lg font-bold text-emerald-800">{viewingClient.total_amount?.toLocaleString()} DZD</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                        <CalendarIcon className="h-3.5 w-3.5" /> Historique des Rendez-vous
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {getClientHistory(viewingClient.phone, viewingClient.client_name, viewingClient.treatment).appts.length === 0 ? (
                                                            <p className="text-sm text-center py-4 bg-muted/20 rounded-xl text-muted-foreground">Aucun historique de rendez-vous</p>
                                                        ) : (
                                                            getClientHistory(viewingClient.phone, viewingClient.client_name, viewingClient.treatment).appts.map(a => (
                                                                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border text-sm">
                                                                    <div>
                                                                        <p className="font-semibold">{format(parseISO(a.appointment_at), 'PPp', { locale: fr })}</p>
                                                                        <p className="text-xs text-muted-foreground">Dr. {a.doctor?.name || '...'}</p>
                                                                    </div>
                                                                    <Badge variant="outline" className={`text-[10px] capitalize ${getStatusStyle(a.status)}`}>{a.status}</Badge>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </DialogContent>
                            </Dialog>
                        </div>
                    </TabsContent>

                    <TabsContent value="calendar" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                            <Card className="border-none shadow-premium overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="p-6 border-b bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h3 className="font-black italic text-xl text-primary">Vue Docteurs</h3>
                                            <p className="text-xs text-muted-foreground">Gestion d'agenda globale</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" className="h-9 px-3 text-xs" onClick={() => setNewApptDate(new Date())}>Aujourd'hui</Button>
                                            <Button className="h-9 px-3 text-xs gap-2" onClick={() => {
                                                setSelectedClient(null);
                                                setIsScheduleOpen(true);
                                            }}>
                                                <Plus className="h-4 w-4" /> Nouveau RDV
                                            </Button>
                                        </div>
                                        <div className="px-6 pb-4 sm:hidden">
                                            <Select value={selectedDoctorMobile} onValueChange={setSelectedDoctorMobile}>
                                                <SelectTrigger className="w-full h-11 rounded-xl">
                                                    <SelectValue placeholder="Choisir un médecin" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {doctors.map(d => (
                                                        <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="p-2 sm:p-4">
                                        <ScrollArea className="h-[600px]">
                                            <div className="grid grid-cols-[80px_1fr] gap-4">
                                                {/* Time labels */}
                                                <div className="space-y-[80px] pt-10 text-[10px] font-black text-muted-foreground/60 text-right pr-2">
                                                    {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map(t => (
                                                        <div key={t} className="h-0 flex items-center justify-end">{t}</div>
                                                    ))}
                                                </div>

                                                {/* Grid Columns for Doctors */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:min-w-[600px]">
                                                    {doctors
                                                        .filter(d => selectedDoctorMobile === 'all' || d.id === selectedDoctorMobile)
                                                        .map(doctor => (
                                                            <div key={doctor.id} className="relative bg-muted/10 rounded-xl min-h-[1000px] border border-muted-foreground/10">
                                                                <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm p-3 border-b text-center font-bold text-sm text-primary">
                                                                    {doctor.name}
                                                                </div>

                                                                {/* Appointments for this doctor on selected current day (for simplicity current today view) */}
                                                                {parsedAppointments
                                                                    .filter(a => a.status !== 'denied' && a.doctor_id === doctor.id && a.startOfDayTime === startOfDay(newApptDate || new Date()).getTime())
                                                                    .map(appt => {
                                                                        const date = parseISO(appt.appointment_at);
                                                                        const hours = date.getHours();
                                                                        const minutes = date.getMinutes();
                                                                        const offset = (hours - 8) * 80 + (minutes / 60) * 80 + 50; // Simple positioning logic

                                                                        return (
                                                                            <div
                                                                                key={appt.id}
                                                                                className={`absolute left-1 right-1 bg-white dark:bg-slate-900 border-l-4 shadow-lg p-2 rounded-lg cursor-pointer hover:scale-[1.02] transition-transform z-20 group ${appt.status === 'coming' ? 'border-l-emerald-500 ring-1 ring-emerald-100' :
                                                                                    appt.status === 'denied' ? 'border-l-rose-500 ring-1 ring-rose-100' :
                                                                                        'border-l-primary'
                                                                                    }`}
                                                                                style={{ top: `${offset}px`, height: '70px' }}
                                                                            >
                                                                                <p className={`text-[10px] font-black ${appt.status === 'coming' ? 'text-emerald-600' : appt.status === 'denied' ? 'text-rose-600' : 'text-primary'}`}>{format(date, 'HH:mm')}</p>
                                                                                <p className="text-[11px] font-bold text-foreground leading-tight truncate">{appt.client_name}</p>
                                                                                <p className={`text-[9px] truncate uppercase font-bold ${appt.status === 'coming' ? 'text-emerald-600' : appt.status === 'denied' ? 'text-rose-600' : 'text-muted-foreground'}`}>{appt.status}</p>
                                                                            </div>
                                                                        );
                                                                    })
                                                                }
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-6">
                                <Card className="border-none shadow-premium">
                                    <CardHeader className="p-4 pb-2">
                                        <CardTitle className="text-sm font-bold truncate">Sélecteur de Date</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-2 flex justify-center">
                                        <Calendar
                                            mode="single"
                                            selected={newApptDate}
                                            onSelect={setNewApptDate}
                                            className="rounded-xl border-none"
                                            locale={fr}
                                        />
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-premium bg-primary text-primary-foreground p-5 rounded-2xl">
                                    <h4 className="font-black italic text-lg mb-2">Résumé du jour</h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-primary-foreground/80">
                                            <span className="text-sm">Total RDV</span>
                                            <span className="text-xl font-black">
                                                {parsedAppointments.filter(a => a.startOfDayTime === startOfDay(newApptDate || new Date()).getTime()).length}
                                            </span>
                                        </div>
                                        <div className="h-px bg-white/20" />
                                        <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest">Aujourd'hui {format(new Date(), 'PP', { locale: fr })}</p>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>

            {/* Global Scheduling Modal */}
            <Dialog open={isScheduleOpen} onOpenChange={(open) => {
                setIsScheduleOpen(open);
                if (!open) {
                    setEditingApptId(null);
                    setNewApptNotes('');
                }
            }}>
                <DialogContent className="sm:rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold italic">
                            {editingApptId ? 'Modifier le Rendez-vous' : 'Programmer un Rendez-vous'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {!selectedClient && (
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-muted-foreground">Rechercher un Patient</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Nom ou téléphone..."
                                        className="pl-10 h-11 rounded-xl"
                                        onChange={(e) => {
                                            const found = uniqueClients.find(c => c.client_name.toLowerCase() === e.target.value.toLowerCase() || c.phone === e.target.value);
                                            if (found) setSelectedClient({ phone: found.phone, name: found.client_name });
                                        }}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">Sélectionnez un patient existant en tapant son nom exact ou son numéro.</p>
                            </div>
                        )}

                        {selectedClient && (
                            <div className="bg-muted/30 p-3 rounded-xl border border-dashed text-center relative group">
                                <Button
                                    variant="ghost" size="icon"
                                    className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setSelectedClient(null)}
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                                <p className="text-xs text-muted-foreground uppercase font-bold">Patient</p>
                                <p className="text-lg font-black text-primary">{selectedClient.name}</p>
                                <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-muted-foreground">Date</label>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal h-11 rounded-xl">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {newApptDate ? format(newApptDate, 'PP', { locale: fr }) : <span>Choisir...</span>}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="p-0 border-none shadow-none max-w-fit">
                                        <Calendar mode="single" selected={newApptDate} onSelect={(d) => { setNewApptDate(d); }} locale={fr} />
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-muted-foreground">Heure</label>
                                <Input type="time" min="08:00" max="18:00" value={newApptTime} onChange={(e) => setNewApptTime(e.target.value)} className="h-11 rounded-xl" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground">Médecin</label>
                            <Select value={newApptDoctor} onValueChange={setNewApptDoctor}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Choisir un médecin" /></SelectTrigger>
                                <SelectContent>
                                    {doctors.map(d => (
                                        <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground">Notes</label>
                            <Input placeholder="Motif du rendez-vous..." value={newApptNotes} onChange={(e) => setNewApptNotes(e.target.value)} className="h-11 rounded-xl" />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsScheduleOpen(false)} className="rounded-xl h-11 flex-1">Annuler</Button>
                        <Button onClick={handleScheduleAppt} className="rounded-xl h-11 flex-1 bg-primary">
                            {editingApptId ? 'Enregistrer' : 'Confirmer'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <footer className="p-4 border-t bg-muted/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">&copy; PasseVite - Gestion Holistique des Soins</p>
            </footer>
        </div >
    );
};

export default Rendezvous;
