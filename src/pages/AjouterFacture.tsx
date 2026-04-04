import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Save, ShoppingCart, User, DollarSign, Package, X, Calendar } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface InvoiceItemForm {
    productName: string;
    quantity: number;
    expirationDate: string;
    unitPrice: number;
}

const AjouterFacture = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const isReceptionistMode = location.pathname.includes('/accueil');
    const backPath = isReceptionistMode ? '/accueil' : '/manager/factures';

    // Section 1
    const [supplierName, setSupplierName] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [paymentMethod, setPaymentMethod] = useState('caisse');

    // Section 2
    const [items, setItems] = useState<InvoiceItemForm[]>([]);

    // New Item temporary
    const [newProductName, setNewProductName] = useState('');
    const [newQuantity, setNewQuantity] = useState('');
    const [newExpirationDate, setNewExpirationDate] = useState('');
    const [newUnitPrice, setNewUnitPrice] = useState('');

    const addItemCount = () => {
        if (!newProductName || !newQuantity || !newUnitPrice) {
            toast.error('Champs obligatoires manquants');
            return;
        }
        setItems([...items, {
            productName: newProductName,
            quantity: parseFloat(newQuantity),
            expirationDate: newExpirationDate || '',
            unitPrice: parseFloat(newUnitPrice)
        }]);
        setNewProductName('');
        setNewQuantity('');
        setNewExpirationDate('');
        setNewUnitPrice('');
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const totalFacture = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    }, [items]);

    const handleSave = async () => {
        if (!supplierName || items.length === 0) {
            toast.error('Fournisseur ou produits manquants');
            return;
        }

        try {
            setLoading(true);
            const { data: supplierData, error: supplierError } = await supabase
                .from('suppliers')
                .upsert({ name: supplierName, created_by: user?.id }, { onConflict: 'name' })
                .select('id')
                .single();
            if (supplierError) throw supplierError;

            const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .insert({
                    supplier_id: supplierData.id,
                    date,
                    payment_method: paymentMethod as any,
                    total_amount: totalFacture,
                    created_by: user?.id
                })
                .select('id')
                .single();
            if (invoiceError) throw invoiceError;

            for (const item of items) {
                const { data: pData, error: pError } = await supabase
                    .from('products')
                    .upsert({ name: item.productName, created_by: user?.id }, { onConflict: 'name' })
                    .select('id')
                    .single();
                if (pError) throw pError;

                await supabase.from('invoice_items').insert({
                    invoice_id: invoiceData.id,
                    product_id: pData.id,
                    quantity: item.quantity,
                    expiration_date: item.expirationDate || null,
                    unit_price: item.unitPrice,
                    total_price: item.quantity * item.unitPrice
                });
            }
            toast.success('Facture enregistrée');
            navigate(backPath);
        } catch (err: any) {
            toast.error('Erreur lors de l’enregistrement');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col">
            <header className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-background z-10">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <Link to={backPath}><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-lg sm:text-xl font-bold text-primary italic leading-none">PasseVite</h1>
                        <p className="text-[10px] text-muted-foreground uppercase">{isReceptionistMode ? 'Saisie Stock' : 'Nouvelle Facture'}</p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={loading} size="sm" className="h-8 sm:h-9 py-0">
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {loading ? "..." : "Enregistrer"}
                </Button>
            </header>

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 max-w-5xl mx-auto w-full flex-1 pb-20">
                {/* Info Facture Card - Manager Style */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Fournisseur</label>
                        <Input
                            placeholder="Nom du fournisseur..."
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            className="h-9 sm:h-10 text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="h-9 sm:h-10 text-sm"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Règlement</label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger className="h-9 sm:h-10 text-sm">
                                <SelectValue placeholder="Mode..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="check">Chèque</SelectItem>
                                <SelectItem value="caisse">Caisse</SelectItem>
                                <SelectItem value="ccp">CCP</SelectItem>
                                <SelectItem value="manager payment">Manager Payment</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Analytics Card for Total - Manager Style */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Card className="border-0 shadow-sm col-span-2 sm:col-span-1 bg-primary/5 ring-1 ring-primary/10">
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 text-primary">
                                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="text-xs text-muted-foreground">Total Facture</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-primary tabular-nums">{totalFacture.toLocaleString()} <span className="text-[10px] font-medium">DZD</span></p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm hidden sm:block">
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 text-muted-foreground">
                                <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="text-xs">Produits</span>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-foreground">{items.length}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Add Product Form - Matching Manager Search Layout */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                        <p className="text-xs font-bold uppercase text-primary tracking-widest mb-2 border-l-2 border-primary pl-2">Entrée de Stock</p>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-end">
                            <div className="sm:col-span-5">
                                <label className="text-[10px] text-muted-foreground mb-1 block">Désignation</label>
                                <Input
                                    placeholder="Nom du produit..."
                                    value={newProductName}
                                    onChange={(e) => setNewProductName(e.target.value)}
                                    className="h-9 sm:h-10 text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2 sm:col-span-5 w-full">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground mb-1 block">Qté</label>
                                    <Input type="number" placeholder="0" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} className="h-9 sm:h-10 text-sm text-center" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground mb-1 block">P.Unit</label>
                                    <Input type="number" placeholder="0" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} className="h-9 sm:h-10 text-sm text-center" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground mb-1 block">Pérémpt.</label>
                                    <Input type="date" value={newExpirationDate} onChange={(e) => setNewExpirationDate(e.target.value)} className="h-9 sm:h-10 text-[10px]" />
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <Button onClick={addItemCount} size="sm" className="w-full h-9 sm:h-10 text-xs font-bold gap-1 mt-1 sm:mt-0">
                                    <Plus className="h-3.5 w-3.5" /> Ajouter
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* List of Products Added */}
                <div className="space-y-2">
                    {items.length === 0 ? (
                        <p className="text-center py-8 text-muted-foreground text-xs uppercase font-medium border-2 border-dashed border-muted rounded-xl">Aucun produit ajouté au bon</p>
                    ) : (
                        <>
                            {/* Mobile view cards */}
                            <div className="sm:hidden space-y-2">
                                {items.map((item, idx) => (
                                    <Card key={idx} className="border-0 shadow-sm relative">
                                        <CardContent className="p-3 pr-10">
                                            <div className="flex justify-between items-start">
                                                <div className="min-w-0">
                                                    <p className="font-bold text-foreground text-sm uppercase truncate tracking-tight">{item.productName}</p>
                                                    <p className="text-[10px] text-muted-foreground">x{item.quantity} · {item.unitPrice} DZD/u</p>
                                                    {item.expirationDate && <p className="text-[9px] text-destructive font-medium uppercase mt-0.5">Exp: {item.expirationDate}</p>}
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-sm text-primary tabular-nums">{(item.quantity * item.unitPrice).toLocaleString()} DZD</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeItem(idx)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Desktop view Table */}
                            <Card className="border-0 shadow-sm hidden sm:block overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="text-[10px] uppercase font-bold h-9">Produit</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Qté</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Prix Unitaire</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold h-9 text-right">Total</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item, idx) => (
                                            <TableRow key={idx} className="group hover:bg-muted/10 h-12">
                                                <TableCell className="py-2">
                                                    <p className="font-bold uppercase text-sm tracking-tight">{item.productName}</p>
                                                    {item.expirationDate && <p className="text-[9px] text-destructive/80 font-medium tracking-tight">Exp date: {item.expirationDate}</p>}
                                                </TableCell>
                                                <TableCell className="py-2 text-center font-bold tabular-nums">x{item.quantity}</TableCell>
                                                <TableCell className="py-2 text-center text-xs text-muted-foreground tabular-nums">{item.unitPrice.toLocaleString()} DZD</TableCell>
                                                <TableCell className="py-2 text-right font-bold text-primary tabular-nums">
                                                    {(item.quantity * item.unitPrice).toLocaleString()} DZD
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => removeItem(idx)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AjouterFacture;
