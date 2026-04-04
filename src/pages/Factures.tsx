import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, FileText, Calendar, Search, Download, Trash2, Tag, Filter } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface Invoice {
    id: string;
    date: string;
    payment_method: string;
    total_amount: number;
    supplier: { name: string } | null;
    created_at: string;
}

const Factures = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

    const fetchInvoices = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('invoices')
            .select('*, supplier:suppliers(name)')
            .gte('date', dateFrom)
            .lte('date', dateTo)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching invoices:', error);
        } else {
            setInvoices(data as any || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchInvoices();
    }, [dateFrom, dateTo]);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv =>
            inv.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.payment_method.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [invoices, searchQuery]);

    const totalAmount = useMemo(() => {
        return filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    }, [filteredInvoices]);

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cette facture ?')) return;
        const { error } = await supabase.from('invoices').delete().eq('id', id);
        if (error) toast.error('Erreur');
        else {
            toast.success('Facture supprimée');
            fetchInvoices();
        }
    };

    const exportExcel = () => {
        const headers = ['Fournisseur', 'Date', 'Mode Paiement', 'Montant Total'];
        const rows = filteredInvoices.map(inv => [
            inv.supplier?.name || 'Inconnu',
            format(new Date(inv.date), 'dd/MM/yyyy'),
            inv.payment_method,
            inv.total_amount,
        ]);

        const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport-factures-${dateFrom}-${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col">
            <header className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-background z-10">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <Link to="/manager/depenses"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-primary italic leading-none">PasseVite</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gestion Factures</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild variant="default" size="sm" className="h-8 sm:h-9 px-3 gap-1 rounded-full font-bold uppercase tracking-widest text-[10px]">
                        <Link to="/manager/factures/ajouter">
                            <Plus className="h-3.5 w-3.5" /> Facture
                        </Link>
                    </Button>
                </div>
            </header>

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                {/* Date filters - Exactly matching Manager dashboard */}
                <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] text-muted-foreground mb-1 block uppercase font-bold tracking-tight">Du</label>
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 sm:h-10 text-sm" />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] text-muted-foreground mb-1 block uppercase font-bold tracking-tight">Au</label>
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 sm:h-10 text-sm" />
                    </div>
                    <Button variant="outline" onClick={exportExcel} className="gap-1 h-9 sm:h-10 text-sm">
                        <Download className="h-4 w-4" /> <span className="hidden sm:inline text-xs uppercase font-bold">Exporter</span>
                    </Button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher par fournisseur..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-9 sm:h-10"
                    />
                </div>

                {/* Analytics Cards - Matching Manager aesthetic */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Card className="border-0 shadow-sm bg-primary/5">
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 text-primary">
                                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="text-[10px] sm:text-xs font-bold uppercase">Factures</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-black text-primary">{filteredInvoices.length}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-medium">Bons d'achat</p>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm bg-primary/10 ring-1 ring-primary/20 col-span-1">
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 text-primary">
                                <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="text-[10px] sm:text-xs font-bold uppercase">Total Budget</span>
                            </div>
                            <p className="text-lg sm:text-2xl font-black text-primary truncate">{totalAmount.toLocaleString()} <span className="text-[10px] font-bold">DZD</span></p>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm hidden sm:block bg-muted/10 border-dashed border-2">
                        <CardContent className="p-3 sm:p-4 flex flex-col justify-center h-full">
                            <p className="text-[9px] text-muted-foreground uppercase font-bold text-center leading-tight">
                                Période du <br /> {format(new Date(dateFrom), 'dd MMM yyyy', { locale: fr })}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm hidden sm:block bg-muted/10 border-dashed border-2">
                        <CardContent className="p-3 sm:p-4 flex flex-col justify-center h-full">
                            <p className="text-[9px] text-muted-foreground uppercase font-bold text-center leading-tight">
                                Au <br /> {format(new Date(dateTo), 'dd MMM yyyy', { locale: fr })}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* List - card view on mobile */}
                <div className="sm:hidden space-y-2">
                    {loading ? (
                        <p className="text-center py-8 text-muted-foreground text-[10px] uppercase font-bold animate-pulse tracking-widest">Chargement des factures...</p>
                    ) : filteredInvoices.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground text-[10px] uppercase font-bold tracking-widest">Aucune facture enregistrée</p>
                    ) : (
                        filteredInvoices.map(inv => (
                            <Card key={inv.id} className="border-0 shadow-sm active:bg-muted/5 transition-all">
                                <CardContent className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="min-w-0">
                                            <p className="font-black text-primary text-sm uppercase truncate tracking-tight">{inv.supplier?.name || 'Inconnu'}</p>
                                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground uppercase font-bold mt-0.5">
                                                <Calendar className="h-2.5 w-2.5" />
                                                {format(new Date(inv.date), 'dd MMMM yyyy', { locale: fr })}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-sm text-foreground tabular-nums">{inv.total_amount.toLocaleString()} DZD</p>
                                            <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-black uppercase">{inv.payment_method}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={() => handleDelete(inv.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* List - desktop window table view */}
                <Card className="border-0 shadow-sm hidden sm:block overflow-hidden rounded-xl">
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 pl-6">Fournisseur</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70">Date</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70">Paiement</TableHead>
                                <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 text-right">Montant</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-xs uppercase font-bold">Chargement en cours...</TableCell></TableRow>
                            ) : filteredInvoices.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-xs uppercase font-bold">Liste vide</TableCell></TableRow>
                            ) : (
                                filteredInvoices.map(inv => (
                                    <TableRow key={inv.id} className="group hover:bg-muted/10 transition-colors">
                                        <TableCell className="font-black uppercase tracking-tight text-sm pl-6">{inv.supplier?.name || 'Inconnu'}</TableCell>
                                        <TableCell className="text-xs font-semibold text-muted-foreground">{format(new Date(inv.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>
                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/5 text-primary-foreground/70 font-black uppercase ring-1 ring-primary/20">{inv.payment_method}</span>
                                        </TableCell>
                                        <TableCell className="text-right font-black text-primary tabular-nums">{inv.total_amount.toLocaleString()} DZD</TableCell>
                                        <TableCell>
                                            <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={() => handleDelete(inv.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </div>
    );
};

export default Factures;
