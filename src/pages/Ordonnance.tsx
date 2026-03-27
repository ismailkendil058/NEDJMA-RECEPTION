import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Printer, ChevronLeft, FileText, ClipboardList } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { useToast } from '@/components/ui/use-toast';

// Types
interface SupabaseMedication {
  id: string;
  name: string;
  dosage?: string;
  duree?: string;
  frequency_count?: number;
  frequency_unit?: 'day' | 'week';
  timing?: 'avant' | 'apres';
}

interface Medication {
  id?: string;
  name: string;
  dosage: string;
  duree: string;
  frequency_count: number;
  frequency_unit: 'day' | 'week';
  timing: 'avant' | 'apres';
  variantOptions?: SupabaseMedication[];
  selectedVariantId?: string;
}

interface FormData {
  patient_name: string;
  age: number | null;
  prescription_date: Date;
  medications: Medication[];
}

const createEmptyMedication = (): Medication => ({
  name: '',
  dosage: '',
  duree: '',
  frequency_count: 1,
  frequency_unit: 'day',
  timing: 'avant',
  variantOptions: [],
});

const NEW_MEDICATION_VALUE = '__new_medication';

const formatFrequencyLine = (med: Medication) => {
  const unitLabel = med.frequency_unit === 'day' ? 'j' : 'sem';
  const timingLabel = med.timing === 'avant' ? 'avant les repas' : 'après les repas';
  return `${med.frequency_count} fois /${unitLabel} ${timingLabel}`;
};

const Ordonnance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({
    patient_name: '',
    age: null,
    prescription_date: new Date(),
    medications: [createEmptyMedication()],
  });
  const printRef = useRef<HTMLDivElement>(null);

  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctorInfo, setDoctorInfo] = useState<{ id: string, name: string } | null>(null);
  const [isNewMedDialogOpen, setIsNewMedDialogOpen] = useState(false);
  const [pendingMedIndex, setPendingMedIndex] = useState<number | null>(null);
  const [newMedInput, setNewMedInput] = useState({
    name: '',
    dosage: '',
    duree: '',
    frequency_count: 1,
    frequency_unit: 'day' as Medication['frequency_unit'],
    timing: 'avant' as Medication['timing'],
  });

  useEffect(() => {
    const authData = localStorage.getItem('doctor_auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      setDoctorInfo(parsed);
      setSelectedDoctorId(parsed.id);
    }
  }, []);

  // Fetch medications & doctors
  const { data: meds } = useQuery({
    queryKey: ['medications'],
    queryFn: async () => {
      const { data } = await supabase.from('medications').select('*').order('name');
      return (data as unknown as SupabaseMedication[]) || [];
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data } = await supabase.from('doctors').select('*').order('name');
      return data || [];
    },
  });

  const doctor = doctors?.find(d => d.id === selectedDoctorId) || (doctorInfo ? { name: doctorInfo.name, id: doctorInfo.id } : { name: 'PasseVite', id: '' });

  const medicationGroups = useMemo(() => {
    const grouped: Record<string, SupabaseMedication[]> = {};
    (meds || []).forEach((med) => {
      if (!grouped[med.name]) grouped[med.name] = [];
      grouped[med.name].push(med);
    });
    return grouped;
  }, [meds]);

  const medicationNames = useMemo(
    () => Object.keys(medicationGroups).sort((a, b) => a.localeCompare(b)),
    [medicationGroups],
  );

  const hydrateMedicationFromVariant = (index: number, variant: SupabaseMedication, variantOptions?: SupabaseMedication[]) => {
    setFormData((prev) => {
      const newMeds = [...prev.medications];
      const base = newMeds[index];
      newMeds[index] = {
        ...base,
        name: variant.name,
        variantOptions: variantOptions || [variant],
        selectedVariantId: variant.id,
        dosage: variant.dosage ?? base.dosage,
        duree: variant.duree ?? base.duree,
        frequency_count: variant.frequency_count ?? base.frequency_count,
        frequency_unit: variant.frequency_unit ?? base.frequency_unit,
        timing: variant.timing ?? base.timing,
      };
      return { ...prev, medications: newMeds };
    });
  };

  const applyVariantSuggestion = (index: number, variantId: string) => {
    setFormData((prev) => {
      const newMeds = [...prev.medications];
      const med = newMeds[index];
      const variant = med.variantOptions?.find((v) => v.id === variantId);
      if (variant) {
        newMeds[index] = { ...med, ...variant, selectedVariantId: variant.id } as Medication;
      }
      return { ...prev, medications: newMeds };
    });
  };

  const newMedMutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const { data, error } = await supabase.from('medications').insert(payload).select().single();
      if (error) throw error;
      return data as SupabaseMedication;
    },
    onSuccess: (saved: SupabaseMedication) => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      if (pendingMedIndex !== null) hydrateMedicationFromVariant(pendingMedIndex, saved);
      toast({ title: 'Médicament enregistré' });
      setIsNewMedDialogOpen(false);
      setPendingMedIndex(null);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!doctor.id) throw new Error('No doctor');
      const { error } = await supabase.from('prescriptions').insert({
        doctor_id: doctor.id,
        patient_name: data.patient_name,
        age: data.age,
        prescription_date: format(data.prescription_date, 'yyyy-MM-dd'),
        medications: data.medications.map(m => ({
          name: m.name === NEW_MEDICATION_VALUE ? '' : m.name,
          dosage: m.dosage,
          duree: m.duree,
          frequency_count: m.frequency_count,
          frequency_unit: m.frequency_unit,
          timing: m.timing,
        })),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Ordonnance sauvée!' });
      setFormData({
        patient_name: '',
        age: null,
        prescription_date: new Date(),
        medications: [createEmptyMedication()],
      });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const addMedication = () => setFormData({ ...formData, medications: [...formData.medications, createEmptyMedication()] });
  const removeMedication = (index: number) => setFormData({ ...formData, medications: formData.medications.filter((_, i) => i !== index) });

  const updateMedication = (index: number, field: string, value: any) => {
    const newMeds = [...formData.medications];
    newMeds[index] = { ...newMeds[index], [field]: value } as Medication;
    setFormData({ ...formData, medications: newMeds });
  };

  const updateMedicationName = (index: number, val: string) => {
    if (val === NEW_MEDICATION_VALUE) {
      setPendingMedIndex(index);
      setNewMedInput({ ...newMedInput, name: '' });
      setIsNewMedDialogOpen(true);
      return;
    }
    const variants = medicationGroups[val] || [];
    if (variants.length > 0) {
      hydrateMedicationFromVariant(index, variants[0], variants);
    } else {
      updateMedication(index, 'name', val);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header exactly as /rendezvous */}
      <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="bg-primary/10 p-2 rounded-xl">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary italic">Ordonnance</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Prescription Médicale</p>
          </div>
        </div>
        <div className="hidden sm:block">
          <Badge variant="secondary" className="bg-primary/5 text-primary border-0 px-4 py-1.5 rounded-full font-bold">
            Dr. {doctor.name}
          </Badge>
        </div>
      </header>

      <main className="p-4 lg:p-10 flex-1 space-y-8 max-w-5xl mx-auto w-full">
        {/* Patient Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4" /> Informations Patient
              </h2>
              <Card className="border-none shadow-premium bg-white rounded-3xl overflow-hidden">
                <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Nom Complet</Label>
                    <Input
                      className="h-11 rounded-xl border-slate-200"
                      placeholder="ex: Jean Dupont"
                      value={formData.patient_name}
                      onChange={e => setFormData({ ...formData, patient_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 pl-1">Âge</Label>
                    <Input
                      type="number"
                      className="h-11 rounded-xl border-slate-200"
                      placeholder="ex: 45"
                      value={formData.age || ''}
                      onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) || null })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Médicaments
                </h2>
                <Button variant="ghost" size="sm" onClick={addMedication} className="text-primary font-bold hover:bg-primary/5 rounded-full px-4">
                  <Plus className="h-4 w-4 mr-1" /> Ajouter
                </Button>
              </div>

              <div className="space-y-4">
                {formData.medications.map((med, idx) => (
                  <Card key={idx} className="border-none shadow-premium bg-white rounded-3xl relative animate-in fade-in slide-in-from-right-2">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4 space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Produit</Label>
                          <Select value={med.name} onValueChange={v => updateMedicationName(idx, v)}>
                            <SelectTrigger className="h-11 border-slate-200 rounded-xl">
                              <SelectValue placeholder="Choisir..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NEW_MEDICATION_VALUE}>+ Nouveau médicament</SelectItem>
                              {medicationNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Dosage</Label>
                          <Input className="h-11 rounded-xl border-slate-200" value={med.dosage} onChange={e => updateMedication(idx, 'dosage', e.target.value)} />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Durée</Label>
                          <Input className="h-11 rounded-xl border-slate-200" value={med.duree} onChange={e => updateMedication(idx, 'duree', e.target.value)} />
                        </div>
                        <div className="md:col-span-3 space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400">Posologie</Label>
                          <div className="flex gap-2">
                            <Select value={med.frequency_count.toString()} onValueChange={v => updateMedication(idx, 'frequency_count', parseInt(v))}>
                              <SelectTrigger className="h-11 rounded-xl min-w-[60px]"><SelectValue /></SelectTrigger>
                              <SelectContent>{[1, 2, 3, 4, 5].map(v => <SelectItem key={v} value={v.toString()}>{v}x</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={med.timing} onValueChange={v => updateMedication(idx, 'timing', v)}>
                              <SelectTrigger className="h-11 rounded-xl flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="avant">Avant</SelectItem>
                                <SelectItem value="apres">Après</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                          <Button variant="ghost" size="icon" disabled={formData.medications.length === 1} onClick={() => removeMedication(idx)} className="h-10 w-10 text-rose-500 hover:bg-rose-50 rounded-xl">
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>

                      {med.variantOptions && med.variantOptions.length > 1 && (
                        <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap gap-2">
                          <span className="text-[9px] font-black uppercase text-slate-300 mr-2 self-center">Variantes :</span>
                          {med.variantOptions.map(opt => (
                            <Badge key={opt.id} onClick={() => applyVariantSuggestion(idx, opt.id)} variant={med.selectedVariantId === opt.id ? 'default' : 'outline'} className="cursor-pointer font-bold text-[9px] px-3 rounded-full transition-all">
                              {opt.dosage} {opt.duree ? `(${opt.duree})` : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-premium bg-primary text-primary-foreground p-6 rounded-[2rem] sticky top-24">
              <h3 className="text-xl font-black italic mb-6">Action Rapide</h3>
              <div className="space-y-4">
                <Button
                  onClick={() => saveMutation.mutate(formData)}
                  disabled={saveMutation.isPending || !formData.patient_name}
                  className="w-full h-14 rounded-2xl bg-white text-primary font-black uppercase tracking-widest text-xs hover:bg-slate-50 shadow-lg"
                >
                  {saveMutation.isPending ? 'Action...' : 'Enregistrer'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  className="w-full h-14 rounded-2xl bg-primary/20 border-white/20 text-white font-black uppercase tracking-widest text-xs hover:bg-white/10"
                >
                  <Printer className="h-4 w-4 mr-2" /> Imprimer
                </Button>
              </div>
              <div className="mt-8 pt-8 border-t border-white/10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Médecin Émetteur</p>
                <p className="font-bold text-lg">Dr. {doctor.name}</p>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* NEW MED MODAL */}
      <Dialog open={isNewMedDialogOpen} onOpenChange={setIsNewMedDialogOpen}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black italic text-primary">Nouveau Produit</DialogTitle>
            <DialogDescription className="font-bold text-[10px] uppercase text-slate-400">Ajouter à la base de données</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Nom</Label>
              <Input className="h-11 rounded-xl" value={newMedInput.name} onChange={e => setNewMedInput({ ...newMedInput, name: e.target.value })} placeholder="ex: Paracétamol" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Dosage Déf.</Label>
                <Input className="h-11 rounded-xl" value={newMedInput.dosage} onChange={e => setNewMedInput({ ...newMedInput, dosage: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Durée Déf.</Label>
                <Input className="h-11 rounded-xl" value={newMedInput.duree} onChange={e => setNewMedInput({ ...newMedInput, duree: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1 rounded-xl h-11 font-bold" onClick={() => setIsNewMedDialogOpen(false)}>Annuler</Button>
            <Button className="flex-1 rounded-xl h-11 font-bold bg-primary shadow-lg shadow-primary/20" onClick={() => newMedMutation.mutate({ name: newMedInput.name })} disabled={!newMedInput.name || newMedMutation.isPending}>
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PRINT TEMPLATE - Refined visibility for v3 compatibility */}
      <div className="invisible absolute top-0 left-0 pointer-events-none overflow-hidden h-0 w-0">
        <div ref={printRef} className="p-[40px] p-10 font-sans text-slate-800 bg-white" style={{ width: '210mm', minHeight: '297mm' }}>
          <div className="flex justify-between items-start mb-20">
            <div>
              <h1 className="text-4xl font-black italic text-primary">PasseVite</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mt-1">Clinique Médicale</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black">Dr. {doctor.name}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Spécialiste de Santé</p>
            </div>
          </div>

          <div className="flex justify-between items-end border-b-4 border-slate-50 pb-6 mb-12">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-1">Patient</p>
              <h2 className="text-3xl font-black">{formData.patient_name || '...'}</h2>
              {formData.age && <p className="text-sm font-bold text-slate-500">{formData.age} ans</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-1">Date</p>
              <p className="text-base font-bold">{format(formData.prescription_date, 'dd MMMM yyyy', { locale: fr })}</p>
            </div>
          </div>

          <div className="space-y-10 min-h-[400px]">
            <h3 className="text-xs font-black uppercase tracking-[0.6em] text-slate-300 text-center italic mb-12 underline underline-offset-[12px]">Prescription</h3>
            {formData.medications.map((m, i) => (
              <div key={i} className="relative pl-8 mb-6">
                <div className="absolute left-0 top-1.5 h-2.5 w-2.5 bg-primary rounded-full" />
                <div className="flex justify-between items-baseline mb-1">
                  <p className="text-xl font-black">{m.name}</p>
                  <p className="text-sm font-bold text-slate-400">Total: {m.duree}</p>
                </div>
                <p className="text-sm font-medium italic text-slate-500">{m.dosage} — {formatFrequencyLine(m)}</p>
              </div>
            ))}
          </div>

          <div className="mt-20 pt-10 border-t border-slate-50 flex justify-between items-center opacity-40">
            <p className="text-[8px] font-black uppercase tracking-widest">Généré par PasseVite Dental v2.0</p>
            <div className="h-20 w-32 border-2 border-slate-100 rounded-3xl flex items-center justify-center italic text-[8px] font-black text-slate-100 uppercase tracking-widest">Cachet & Signature</div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Ordonnance;
