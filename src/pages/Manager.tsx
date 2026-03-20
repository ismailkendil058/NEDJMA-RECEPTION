import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FeedbackStats } from '@/components/FeedbackStats';
import { LogOut, Search, Download, Users, DollarSign, Stethoscope, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

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
  receptionist_id: string;
  doctor: { name: string; initial: string } | null;
  receptionist_email?: string;
}

const Manager = () => {
  const { signOut } = useAuth();
  const [clients, setClients] = useState<CompletedClient[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [treatmentFilter, setTreatmentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const fromDate = new Date(dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('completed_clients')
      .select('*, doctor:doctors(*)')
      .gte('completed_at', fromDate.toISOString())
      .lte('completed_at', toDate.toISOString())
      .order('completed_at', { ascending: false });

    if (data) {
      const uniqueIds = [...new Set(data.map(d => d.receptionist_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', uniqueIds);

      const emailMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

      setClients(data.map(c => ({
        ...c,
        doctor: c.doctor as any,
        receptionist_email: emailMap.get(c.receptionist_id) || '—',
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('doctors').select('id, name').then(({ data }) => {
      if (data) setDoctors(data);
    });
  }, []);

  useEffect(() => { fetchData(); }, [dateFrom, dateTo]);

  const treatments = useMemo(() => {
    const set = new Set(clients.map(c => c.treatment));
    return Array.from(set).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = !searchQuery ||
        c.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.client_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.treatment.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDoctor = doctorFilter === 'all' || c.doctor?.name === doctorFilter;
      const matchesTreatment = treatmentFilter === 'all' || c.treatment === treatmentFilter;
      return matchesSearch && matchesDoctor && matchesTreatment;
    });
  }, [clients, searchQuery, doctorFilter, treatmentFilter]);

  const analytics = useMemo(() => {
    const totalClients = filtered.length;
    const totalRevenue = filtered.reduce((s, c) => s + (c.total_amount || 0), 0);
    const totalPaid = filtered.reduce((s, c) => s + (c.tranche_paid || 0), 0);

    const byDoctor = new Map<string, { count: number; revenue: number; paid: number }>();
    filtered.forEach(c => {
      const name = c.doctor?.name || 'Inconnu';
      const existing = byDoctor.get(name) || { count: 0, revenue: 0, paid: 0 };
      existing.count++;
      existing.revenue += c.total_amount || 0;
      existing.paid += c.tranche_paid || 0;
      byDoctor.set(name, existing);
    });

    return { totalClients, totalRevenue, totalPaid, byDoctor };
  }, [filtered]);

  const exportExcel = () => {
    const headers = ['Nom', 'Téléphone', 'ID', 'Médecin', 'Traitement', 'Montant Total', 'Tranche Payée', 'Réceptionniste', 'Date'];
    const rows = filtered.map(c => [
      c.client_name,
      c.phone,
      c.client_id,
      c.doctor?.name || '',
      c.treatment,
      c.total_amount,
      c.tranche_paid,
      c.receptionist_email || '',
      format(new Date(c.completed_at), 'dd/MM/yyyy HH:mm'),
    ]);

    const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passevite-rapport-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-background z-10">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-primary italic">PasseVite</h1>
          <p className="text-[10px] text-muted-foreground uppercase">le soin qui passe</p>
        </div>
        <div className="flex items-center gap-2">
          <FeedbackStats />
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link to="/ordonnance">
              <FileText className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Ordonnance</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Date filters */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-muted-foreground mb-1 block">Du</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 sm:h-10 text-sm" />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-muted-foreground mb-1 block">Au</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 sm:h-10 text-sm" />
          </div>
          <Button variant="outline" onClick={exportExcel} className="gap-1 h-9 sm:h-10 text-sm">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exporter</span>
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 sm:h-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="flex-1 sm:w-[150px] h-9 sm:h-10 text-sm"><SelectValue placeholder="Médecin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous médecins</SelectItem>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.name}>Dr. {d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={treatmentFilter} onValueChange={setTreatmentFilter}>
              <SelectTrigger className="flex-1 sm:w-[150px] h-9 sm:h-10 text-sm"><SelectValue placeholder="Traitement" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous traitements</SelectItem>
                {treatments.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Patients</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{analytics.totalClients}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Revenus</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{analytics.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">DZD</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Payé</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{analytics.totalPaid.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">DZD</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <Stethoscope className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Médecins</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{analytics.byDoctor.size}</p>
            </CardContent>
          </Card>
        </div>

        {/* Per Doctor Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {Array.from(analytics.byDoctor.entries()).map(([name, stats]) => (
            <Card key={name} className="border-0 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <p className="font-medium text-foreground mb-2 text-sm sm:text-base">Dr. {name}</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Patients</p>
                    <p className="font-semibold text-foreground">{stats.count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Revenus</p>
                    <p className="font-semibold text-foreground text-xs sm:text-sm">{stats.revenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Payé</p>
                    <p className="font-semibold text-foreground text-xs sm:text-sm">{stats.paid.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Data Table - card view on mobile, table on desktop */}
        <div className="sm:hidden space-y-2">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Aucune donnée</p>
          ) : (
            filtered.map(c => (
              <Card key={c.id} className="border-0 shadow-sm">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{c.client_name}</p>
                      <a href={`tel:${c.phone}`} className="text-xs text-primary">{c.phone}</a>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm text-foreground">{c.total_amount?.toLocaleString()} DZD</p>
                      <p className="text-xs text-muted-foreground">Payé: {c.tranche_paid?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Dr. {c.doctor?.name || '—'} · {c.treatment}</span>
                    <span>{format(new Date(c.completed_at), 'dd/MM HH:mm')}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="border-0 shadow-sm overflow-hidden hidden sm:block">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Tél.</TableHead>
                  <TableHead>Médecin</TableHead>
                  <TableHead>Traitement</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Payé</TableHead>
                  <TableHead>Réception</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune donnée</TableCell>
                  </TableRow>
                ) : (
                  filtered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.client_name}</TableCell>
                      <TableCell>
                        <a href={`tel:${c.phone}`} className="text-primary">{c.phone}</a>
                      </TableCell>
                      <TableCell>Dr. {c.doctor?.name || '—'}</TableCell>
                      <TableCell>{c.treatment}</TableCell>
                      <TableCell className="text-right">{c.total_amount?.toLocaleString()} DZD</TableCell>
                      <TableCell className="text-right">{c.tranche_paid?.toLocaleString()} DZD</TableCell>
                      <TableCell className="text-xs">{c.receptionist_email}</TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(c.completed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Manager;
