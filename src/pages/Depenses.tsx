import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Calendar, DollarSign, Tag, Download, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface Expense {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
    created_at: string;
}

const Depenses = () => {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // Filters
    const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [category, setCategory] = useState('');

    const fetchExpenses = async () => {
        setLoading(true);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .gte('date', dateFrom)
            .lte('date', dateTo)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching expenses:', error);
        } else {
            setExpenses(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchExpenses();
    }, [dateFrom, dateTo]);

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || !amount || !expenseDate) {
            toast.error('Veuillez remplir tous les champs obligatoires');
            return;
        }

        const { error } = await supabase.from('expenses').insert({
            description,
            amount: parseFloat(amount),
            date: expenseDate,
            category,
            created_by: user?.id
        });

        if (error) {
            toast.error("Erreur lors de l'ajout");
        } else {
            toast.success('Dépense ajoutée');
            setDescription('');
            setAmount('');
            setCategory('');
            setIsAdding(false);
            fetchExpenses();
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!confirm('Supprimer cette dépense ?')) return;
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) toast.error('Erreur');
        else {
            toast.success('Supprimée');
            fetchExpenses();
        }
    };

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e =>
            e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.category?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [expenses, searchQuery]);

    const totalAmount = useMemo(() => {
        return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    }, [filteredExpenses]);

    const exportExcel = () => {
        const headers = ['Description', 'Montant', 'Catégorie', 'Date'];
        const rows = filteredExpenses.map(e => [
            e.description,
            e.amount,
            e.category || '',
            format(new Date(e.date), 'dd/MM/yyyy'),
        ]);
        const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `depenses-${dateFrom}-${dateTo}.csv`;
        a.click();
    };

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col">
            <header className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-background z-10 text-destructive">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <Link to="/manager"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-primary italic leading-none">PasseVite</h1>
                        <p className="text-[10px] text-muted-foreground uppercase">Gestion Dépenses</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="h-8 sm:h-9">
                        <Link to="/manager/factures">
                            <Tag className="h-4 w-4 mr-1" /> Factures
                        </Link>
                    </Button>
                    <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "ghost" : "default"} size="sm" className="h-8 sm:h-9">
                        {isAdding ? "Annuler" : <><Plus className="h-4 w-4 mr-1" /> Ajouter</>}
                    </Button>
                </div>
            </header>

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                {/* Date filters - Exactly as in Manager.tsx */}
                <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-xs text-muted-foreground mb-1 block uppercase font-bold tracking-tighter">Du</label>
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 sm:h-10 text-sm" />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-xs text-muted-foreground mb-1 block uppercase font-bold tracking-tighter">Au</label>
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 sm:h-10 text-sm" />
                    </div>
                    <Button variant="outline" onClick={exportExcel} className="gap-1 h-9 sm:h-10 text-sm">
                        <Download className="h-4 w-4" /> <span className="hidden sm:inline">Exporter</span>
                    </Button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher une dépense..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-9 sm:h-10"
                    />
                </div>

                {/* Analytics Card - Matching Manager.tsx style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <Card className="border-0 shadow-sm bg-destructive/5 text-destructive ring-1 ring-destructive/10">
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="text-xs font-bold uppercase tracking-tight opacity-70">Total Dépenses</span>
                            </div>
                            <p className="text-2xl sm:text-3xl font-black">{totalAmount.toLocaleString()}</p>
                            <p className="text-[10px] font-bold uppercase opacity-60 mt-1">Algérien Dinars (DZD)</p>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm hidden sm:flex items-center justify-center bg-muted/20 border-dashed border-2">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest px-4 text-center">
                            Rapport périodique du {format(new Date(dateFrom), 'dd/MM')} au {format(new Date(dateTo), 'dd/MM')}
                        </p>
                    </Card>
                </div>

                {isAdding && (
                    <Card className="border-primary/20 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
                        <CardContent className="p-4 sm:p-6">
                            <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Description *</label>
                                    <Input
                                        placeholder="Loyer, Electricité, Matériel..."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="h-9 sm:h-10"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Montant (DZD) *</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="h-9 sm:h-10 font-bold text-destructive"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Date *</label>
                                    <Input
                                        type="date"
                                        value={expenseDate}
                                        onChange={(e) => setExpenseDate(e.target.value)}
                                        className="h-9 sm:h-10"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Catégorie</label>
                                    <Input
                                        placeholder="Charges, Personnel..."
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="h-9 sm:h-10"
                                    />
                                </div>
                                <div className="sm:col-span-2 pt-2">
                                    <Button type="submit" className="w-full h-10 font-bold uppercase tracking-widest text-xs">
                                        Sauvegarder
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* List - card view on mobile, table on desktop (Mirroring Manager.tsx) */}
                <div className="sm:hidden space-y-2">
                    {loading ? (
                        <p className="text-center py-8 text-muted-foreground text-xs uppercase animate-pulse">Chargement...</p>
                    ) : filteredExpenses.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground text-xs uppercase">Aucune donnée</p>
                    ) : (
                        filteredExpenses.map(e => (
                            <Card key={e.id} className="border-0 shadow-sm active:bg-muted/50 transition-colors">
                                <CardContent className="p-3 space-y-1.5">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground text-sm truncate uppercase tracking-tight">{e.description}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-medium">{e.category || 'Non classé'}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-black text-sm text-destructive tracking-tight">-{e.amount?.toLocaleString()} DZD</p>
                                            <p className="text-[10px] text-muted-foreground">{format(new Date(e.date), 'dd/MM/yyyy')}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDeleteExpense(e.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                <Card className="border-0 shadow-sm overflow-hidden hidden sm:block">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="text-[10px] uppercase font-bold">Description</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold">Catégorie</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold text-right">Montant</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold text-right">Date</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs uppercase animate-pulse">Chargement...</TableCell>
                                    </TableRow>
                                ) : filteredExpenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs uppercase">Aucune donnée</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredExpenses.map(e => (
                                        <TableRow key={e.id} className="group hover:bg-muted/20">
                                            <TableCell className="font-bold uppercase tracking-tight text-sm">{e.description}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground font-medium uppercase">{e.category || '—'}</TableCell>
                                            <TableCell className="text-right font-black text-destructive text-sm">-{e.amount?.toLocaleString()} DZD</TableCell>
                                            <TableCell className="text-right text-xs font-medium">
                                                {format(new Date(e.date), 'dd/MM/yyyy', { locale: fr })}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                                                    onClick={() => handleDeleteExpense(e.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
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

export default Depenses;
