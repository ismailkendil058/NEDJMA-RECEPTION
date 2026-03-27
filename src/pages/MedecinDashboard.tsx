import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import {
    Search, LogOut, Calendar as CalendarIcon, FileText,
    Users, TrendingUp, Plus, Clock, History,
    PieChart, DollarSign, Activity, FileDown, Edit3,
    X, Printer, ClipboardList, CheckCircle2, ChevronRight,
    LayoutDashboard, MapPin, Phone, ArrowUpRight, User, Trash2,
    Calendar as CalIcon, MessageSquare, XCircle
} from 'lucide-react';
import { format, parseISO, startOfToday, endOfToday, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const MedecinDashboard = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    // LOGGED IN DOCTOR INFO
    const [doctorInfo, setDoctorInfo] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        const authData = localStorage.getItem('doctor_auth');
        if (authData) {
            setDoctorInfo(JSON.parse(authData));
        } else {
            navigate('/medecin/login');
        }
    }, [navigate]);

    // DASHBOARD DATA
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // CALENDAR STATE
    const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
    const parsedAppointments = useMemo(() => {
        return appointments.map(a => ({
            ...a,
            startOfDayTime: startOfDay(parseISO(a.appointment_at)).getTime()
        }));
    }, [appointments]);

    // FILTERS & SEARCH
    const [searchOrdonnance, setSearchOrdonnance] = useState('');
    const [searchPatient, setSearchPatient] = useState('');
    const [patientFilter, setPatientFilter] = useState('all');

    // SELECTED PATIENT FOR FICHE MALADE
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [isPatientDialogOpen, setIsPatientDialogOpen] = useState(false);

    // Fetch Patient History (Appointments & Ordonnances)
    const { data: patientHistory, isLoading: isLoadingHistory } = useQuery({
        queryKey: ['patient-history', selectedPatient?.phone, selectedPatient?.client_name],
        enabled: !!selectedPatient,
        queryFn: async () => {
            const [appts, ords] = await Promise.all([
                supabase.from('appointments').select('*, doctor:doctors(*)').eq('client_phone', selectedPatient.phone).order('appointment_at', { ascending: false }),
                supabase.from('prescriptions').select('*').eq('patient_name', selectedPatient.client_name).order('prescription_date', { ascending: false })
            ]);
            return { appointments: appts.data || [], ordonnances: ords.data || [] };
        }
    });

    const fetchDashboardData = async () => {
        if (!doctorInfo) return;
        setLoading(true);
        try {
            const { data: rxData } = await supabase
                .from('prescriptions')
                .select('*')
                .eq('doctor_id', doctorInfo.id)
                .order('prescription_date', { ascending: false });
            if (rxData) setPrescriptions(rxData);

            const { data: aptData } = await supabase
                .from('appointments')
                .select('*')
                .eq('doctor_id', doctorInfo.id)
                .order('appointment_at', { ascending: false });
            if (aptData) setAppointments(aptData);

            const { data: clientData } = await supabase
                .from('completed_clients')
                .select('*')
                .eq('doctor_id', doctorInfo.id)
                .order('completed_at', { ascending: false });
            if (clientData) setPatients(clientData);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast.error('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (doctorInfo) {
            fetchDashboardData();
        }
    }, [doctorInfo]);

    const handleSignOut = async () => {
        localStorage.removeItem('doctor_auth');
        await signOut();
        toast.success('Déconnecté avec succès');
        navigate('/');
    };

    // FILTERED DATA
    const filteredPrescriptions = useMemo(() => {
        return prescriptions.filter(rx =>
            rx.patient_name.toLowerCase().includes(searchOrdonnance.toLowerCase()) ||
            JSON.stringify(rx.medications).toLowerCase().includes(searchOrdonnance.toLowerCase())
        );
    }, [prescriptions, searchOrdonnance]);

    const filteredPatientsList = useMemo(() => {
        return patients.filter(p => {
            const matchesSearch = p.client_name.toLowerCase().includes(searchPatient.toLowerCase()) || p.phone.includes(searchPatient);
            const matchesStatus = patientFilter === 'all' || (patientFilter === 'completed' ? p.state === 'fully_treated' : p.state !== 'fully_treated');
            return matchesSearch && matchesStatus;
        });
    }, [patients, searchPatient, patientFilter]);

    // ANALYTICS CALCULATIONS
    const [selectedRevenueDate, setSelectedRevenueDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const selectedDayRevenue = useMemo(() => {
        const targetDate = new Date(selectedRevenueDate);
        targetDate.setHours(0, 0, 0, 0);
        const targetEnd = new Date(selectedRevenueDate);
        targetEnd.setHours(23, 59, 59, 999);

        return patients.reduce((acc, p) => {
            const pDate = new Date(p.completed_at);
            return (pDate >= targetDate && pDate <= targetEnd) ? acc + (p.tranche_paid || 0) : acc;
        }, 0);
    }, [patients, selectedRevenueDate]);

    const monthlyData = useMemo(() => {
        const last6Months = Array.from({ length: 6 }).map((_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - (5 - i));
            return format(date, 'MMM', { locale: fr });
        });

        const revenuePerMonth = last6Months.map(month => {
            const total = patients.reduce((acc, p) => {
                const pMonth = format(new Date(p.completed_at), 'MMM', { locale: fr });
                return pMonth === month ? acc + (p.tranche_paid || 0) : acc;
            }, 0);
            return { month, revenue: total };
        });

        return revenuePerMonth;
    }, [patients]);

    const treatmentDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        patients.forEach(p => {
            const t = p.treatment || 'Autre';
            counts[t] = (counts[t] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [patients]);

    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header following RendezVous.tsx style */}
            <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-xl">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-primary italic">PasseVite Médecin</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Tableau de bord de soins</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex flex-col text-right">
                        <span className="text-sm font-bold text-slate-700">Dr. {doctorInfo ? doctorInfo.name : 'Chargement...'}</span>
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Session Active</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9 text-rose-500 hover:bg-rose-50 rounded-full">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            <main className="p-4 lg:p-6 flex-1 space-y-6 max-w-7xl mx-auto w-full">
                <Tabs defaultValue="ordonnances" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-xl h-12">
                        <TabsTrigger value="ordonnances" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <FileText className="h-4 w-4 mr-2" /> Ordonnances
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <CalendarIcon className="h-4 w-4 mr-2" /> Agenda
                        </TabsTrigger>
                        <TabsTrigger value="patients" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <Users className="h-4 w-4 mr-2" /> Patients
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <PieChart className="h-4 w-4 mr-2" /> Analyses
                        </TabsTrigger>
                    </TabsList>

                    {/* ORDONNANCES CONTENT */}
                    <TabsContent value="ordonnances" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h1 className="text-2xl font-black italic text-slate-800">Gestion des Ordonnances</h1>
                                <Button onClick={() => navigate('/ordonnance')} className="rounded-xl h-11 px-6 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
                                    <Plus className="h-4 w-4 mr-2" /> Nouvelle Ordonnance
                                </Button>
                            </div>

                            <Card className="border-none shadow-premium overflow-hidden bg-gradient-to-br from-white to-slate-50">
                                <CardHeader className="p-6 border-b bg-muted/10">
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <div className="relative flex-1 min-w-[200px]">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                placeholder="Rechercher par patient ou médicament..."
                                                value={searchOrdonnance}
                                                onChange={e => setSearchOrdonnance(e.target.value)}
                                                className="pl-10 h-11 border-slate-200 rounded-xl focus:ring-primary/20"
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-muted/30">
                                            <TableRow>
                                                <TableHead className="font-bold text-xs">Patient</TableHead>
                                                <TableHead className="font-bold text-xs">Date</TableHead>
                                                <TableHead className="font-bold text-xs">Médicaments</TableHead>
                                                <TableHead className="text-right font-bold text-xs">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPrescriptions.map(rx => (
                                                <TableRow key={rx.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <TableCell className="font-bold">{rx.patient_name}</TableCell>
                                                    <TableCell className="text-slate-500 text-sm">
                                                        {format(new Date(rx.prescription_date), 'dd MMM yyyy', { locale: fr })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {rx.medications?.slice(0, 2).map((med: any, i: number) => (
                                                                <Badge key={i} variant="secondary" className="bg-slate-100 text-[10px] font-medium border-0">
                                                                    {med.name}
                                                                </Badge>
                                                            ))}
                                                            {rx.medications?.length > 2 && <span className="text-[10px] text-slate-400">+{rx.medications.length - 2}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => navigate('/ordonnance')} className="rounded-lg h-8 w-8 text-primary hover:bg-primary/5">
                                                            <FileText className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* CALENDAR CONTENT */}
                    <TabsContent value="calendar" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                            <Card className="border-none shadow-premium bg-white rounded-3xl overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="p-6 border-b bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h3 className="font-black italic text-xl text-primary">Mon Emploi du Temps</h3>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{format(calendarDate || new Date(), 'EEEE dd MMMM yyyy', { locale: fr })}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" className="h-10 px-4 text-xs font-bold uppercase tracking-widest rounded-xl" onClick={() => setCalendarDate(new Date())}>Aujourd'hui</Button>
                                        </div>
                                    </div>

                                    <div className="p-4 sm:p-8">
                                        <ScrollArea className="h-[600px] pr-4">
                                            <div className="grid grid-cols-[60px_1fr] gap-6">
                                                {/* Time labels */}
                                                <div className="space-y-[80px] pt-10 text-[10px] font-black text-slate-300 text-right pr-4 border-r border-slate-100">
                                                    {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map(t => (
                                                        <div key={t} className="h-0 flex items-center justify-end">{t}</div>
                                                    ))}
                                                </div>

                                                {/* Single Column for current Doctor */}
                                                <div className="relative bg-slate-50/30 rounded-3xl min-h-[1000px] border border-dashed border-slate-200">
                                                    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md p-4 border-b text-center font-black text-xs text-primary uppercase tracking-[0.2em] rounded-t-3xl">
                                                        Planning Dr. {doctorInfo?.name}
                                                    </div>

                                                    {/* Appointments for this doctor on selected current day */}
                                                    {parsedAppointments
                                                        .filter(a => a.status !== 'denied' && a.doctor_id === doctorInfo?.id && a.startOfDayTime === startOfDay(calendarDate || new Date()).getTime())
                                                        .map(appt => {
                                                            const date = parseISO(appt.appointment_at);
                                                            const hours = date.getHours();
                                                            const minutes = date.getMinutes();
                                                            const offset = (hours - 8) * 80 + (minutes / 60) * 80 + 64; // Adjusted offset for header

                                                            return (
                                                                <Card
                                                                    key={appt.id}
                                                                    className={cn(
                                                                        "absolute left-4 right-4 shadow-xl border-l-4 p-4 rounded-2xl cursor-pointer hover:scale-[1.02] transition-all z-20 group",
                                                                        appt.status === 'completed' ? 'border-l-emerald-500 bg-white' : 'border-l-primary bg-white'
                                                                    )}
                                                                    style={{ top: `${offset}px`, height: '80px' }}
                                                                    onClick={() => { setSelectedPatient(patients.find(p => p.phone === appt.client_phone)); setIsPatientDialogOpen(true); }}
                                                                >
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <p className="text-[10px] font-black text-primary mb-1 uppercase tracking-widest">{format(date, 'HH:mm')}</p>
                                                                            <p className="text-sm font-black text-slate-800 leading-tight">{appt.client_name}</p>
                                                                        </div>
                                                                        <Badge className={cn("text-[8px] font-black rounded-full h-5",
                                                                            appt.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/5 text-primary'
                                                                        )}>
                                                                            {appt.status.toUpperCase()}
                                                                        </Badge>
                                                                    </div>
                                                                </Card>
                                                            );
                                                        })
                                                    }
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-6">
                                <Card className="border-none shadow-premium bg-white rounded-3xl p-2">
                                    <Calendar
                                        mode="single"
                                        selected={calendarDate}
                                        onSelect={setCalendarDate}
                                        className="rounded-2xl"
                                        locale={fr}
                                    />
                                </Card>

                                <Card className="border-none shadow-premium bg-primary text-white p-6 rounded-[2rem]">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-10 w-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                            <CalIcon className="h-5 w-5 text-white" />
                                        </div>
                                        <h4 className="font-black italic text-lg">Résumé Journée</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">À venir</span>
                                            <span className="text-2xl font-black">
                                                {parsedAppointments.filter(a => a.doctor_id === doctorInfo?.id && a.status === 'scheduled' && a.startOfDayTime === startOfDay(calendarDate || new Date()).getTime()).length}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Terminés</span>
                                            <span className="text-2xl font-black">
                                                {parsedAppointments.filter(a => a.doctor_id === doctorInfo?.id && a.status === 'completed' && a.startOfDayTime === startOfDay(calendarDate || new Date()).getTime()).length}
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* PATIENTS CONTENT */}
                    <TabsContent value="patients" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <h1 className="text-2xl font-black italic text-slate-800">Votre Fichier Patient</h1>
                                <div className="relative w-full sm:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Nom ou téléphone..."
                                        value={searchPatient}
                                        onChange={e => setSearchPatient(e.target.value)}
                                        className="pl-10 h-11 border-slate-200 rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredPatientsList.map(p => (
                                    <Card key={p.id} className="border-none shadow-premium bg-white hover:shadow-lg transition-all cursor-pointer group" onClick={() => { setSelectedPatient(p); setIsPatientDialogOpen(true); }}>
                                        <CardContent className="p-6">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-xl group-hover:bg-primary group-hover:text-white transition-all">
                                                    {p.client_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{p.client_name}</h3>
                                                    <p className="text-xs text-slate-400">{p.phone}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2 border-t pt-4">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-slate-400 uppercase tracking-widest">Traitement</span>
                                                    <span className="text-slate-700">{p.treatment}</span>
                                                </div>
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-slate-400 uppercase tracking-widest">Dernière séance</span>
                                                    <span className="text-slate-700">{format(new Date(p.completed_at), 'dd/MM/yy')}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* ANALYTICS CONTENT */}
                    <TabsContent value="analytics" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="border-none shadow-premium bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-3xl">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <DollarSign className="h-8 w-8 text-white/20" />
                                            <Input
                                                type="date"
                                                value={selectedRevenueDate}
                                                onChange={e => setSelectedRevenueDate(e.target.value)}
                                                className="w-auto h-7 text-[10px] font-bold bg-white/10 border-0 rounded-full text-white cursor-pointer"
                                            />
                                        </div>
                                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Revenu du Jour Choisi</p>
                                        <h3 className="text-3xl font-black">{selectedDayRevenue.toLocaleString()} DZD</h3>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-premium bg-white rounded-3xl">
                                    <CardContent className="p-6">
                                        <Users className="h-8 w-8 text-primary/20 mb-4" />
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Patients Actifs</p>
                                        <h3 className="text-3xl font-black text-slate-800">{patients.length}</h3>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-premium bg-white rounded-3xl">
                                    <CardContent className="p-6">
                                        <FileText className="h-8 w-8 text-primary/20 mb-4" />
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ordonnances</p>
                                        <h3 className="text-3xl font-black text-slate-800">{prescriptions.length}</h3>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <Card className="border-none shadow-premium bg-white rounded-3xl">
                                    <CardHeader>
                                        <CardTitle className="text-lg font-black italic">Croissance du Revenu</CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-premium bg-white rounded-3xl">
                                    <CardHeader>
                                        <CardTitle className="text-lg font-black italic">Répartition des Soins</CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie
                                                    data={treatmentDistribution}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {treatmentDistribution.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip />
                                            </RePieChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>

            {/* FICHE MALADE DIALOG */}
            <Dialog open={isPatientDialogOpen} onOpenChange={setIsPatientDialogOpen}>
                <DialogContent className="max-w-3xl overflow-hidden rounded-3xl p-0 border shadow-2xl bg-white animate-in zoom-in-95 duration-200">
                    {selectedPatient && (
                        <div className="flex flex-col h-[85vh]">
                            {/* Simple Header */}
                            <div className="p-6 border-b flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-primary/5 rounded-full flex items-center justify-center">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">{selectedPatient.client_name}</h3>
                                        <p className="text-xs text-slate-400 font-medium">{selectedPatient.phone}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6 space-y-6">
                                {/* Quick Stats Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dernier Traitement</span>
                                        <span className="font-bold text-slate-700">{selectedPatient.treatment || 'N/A'}</span>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Payé</span>
                                        <span className="font-bold text-emerald-600">{(selectedPatient.tranche_paid || 0).toLocaleString()} DZD</span>
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dette Restante</span>
                                        <span className="font-bold text-rose-500">{(selectedPatient.total_amount - (selectedPatient.tranche_paid || 0)).toLocaleString()} DZD</span>
                                    </div>
                                </div>

                                {/* Observations */}
                                <div className="bg-white rounded-2xl border shadow-sm p-6">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                        <Edit3 className="h-4 w-4" /> Observations
                                    </h4>
                                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                                        {selectedPatient.notes || "Aucune observation médicale enregistrée."}
                                    </p>
                                </div>

                                {/* History Tabs */}
                                <Tabs defaultValue="rendezvous" className="w-full">
                                    <TabsList className="bg-slate-100/50 p-1 rounded-xl mb-4 h-11 w-full sm:w-auto">
                                        <TabsTrigger value="rendezvous" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 text-xs font-bold uppercase tracking-wider">Agenda</TabsTrigger>
                                        <TabsTrigger value="ordonnances" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 text-xs font-bold uppercase tracking-wider">Ordonnances</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="rendezvous" className="mt-0 space-y-3">
                                        {isLoadingHistory ? (
                                            <div className="p-10 text-center text-slate-300 animate-pulse font-bold text-sm uppercase">Chargement...</div>
                                        ) : patientHistory?.appointments.length === 0 ? (
                                            <div className="p-8 text-center text-slate-300 border border-dashed rounded-2xl text-xs font-black uppercase">Aucune séance passée</div>
                                        ) : (
                                            patientHistory?.appointments.map((a: any, idx: number) => (
                                                <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-8 w-8 bg-slate-50 flex items-center justify-center rounded-lg text-xs font-black text-slate-400 uppercase tracking-tighter">
                                                            {format(new Date(a.appointment_at), 'dd/MM')}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">Séance avec Dr. {a.doctor?.name || 'Généraliste'}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(a.appointment_at), 'HH:mm')}</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200">{a.status}</Badge>
                                                </div>
                                            ))
                                        )}
                                    </TabsContent>

                                    <TabsContent value="ordonnances" className="mt-0 space-y-3">
                                        {isLoadingHistory ? (
                                            <div className="p-10 text-center text-slate-300 animate-pulse font-bold text-sm uppercase">Recherche...</div>
                                        ) : patientHistory?.ordonnances.length === 0 ? (
                                            <div className="p-8 text-center text-slate-300 border border-dashed rounded-2xl text-xs font-black uppercase">Aucune ordonnance émise</div>
                                        ) : (
                                            patientHistory?.ordonnances.map((o: any, idx: number) => (
                                                <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between group cursor-pointer hover:border-primary transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <FileText className="h-5 w-5 text-slate-300" />
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700">Ordonnance du {format(new Date(o.prescription_date), 'dd MMMM yyyy', { locale: fr })}</p>
                                                            <div className="flex gap-1 mt-1">
                                                                {o.medications.slice(0, 2).map((m: any, i: number) => (
                                                                    <Badge key={i} className="bg-slate-50 text-slate-400 border-none text-[8px] font-black">{m.name}</Badge>
                                                                ))}
                                                                {o.medications.length > 2 && <span className="text-[8px] font-bold text-slate-300">+{o.medications.length - 2}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Printer className="h-4 w-4 text-slate-200 group-hover:text-primary transition-colors" />
                                                </div>
                                            ))
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </div>

                            <div className="p-4 border-t bg-white flex justify-end">
                                <Button onClick={() => setIsPatientDialogOpen(false)} className="rounded-xl h-11 px-8 font-black uppercase text-xs tracking-widest">
                                    Fermer
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <footer className="p-4 border-t bg-muted/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">&copy; PasseVite - Gestion Holistique des Soins</p>
            </footer>
        </div>
    );
};

export default MedecinDashboard;
