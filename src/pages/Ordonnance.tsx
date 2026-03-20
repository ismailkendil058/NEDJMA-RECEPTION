import { useState, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Printer } from 'lucide-react';
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

const formatDurationLabel = (value: string) => {
  const normalized = value?.trim();
  if (!normalized) return '';
  return normalized.toLowerCase().endsWith('j') ? normalized : `${normalized}j`;
};

const formatFrequencyLine = (med: Medication) => {
  const unitLabel = med.frequency_unit === 'day' ? 'j' : 'sem';
  const timingLabel = med.timing === 'avant' ? 'avant les repas' : 'après les repas';
  return `${med.frequency_count} fois /${unitLabel} ${timingLabel}`;
};

const Ordonnance = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({
    patient_name: '',
    age: null,
    prescription_date: new Date(),
    medications: [createEmptyMedication()],
  });
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch medications
  const { data: meds } = useQuery<SupabaseMedication[]>({
    queryKey: ['medications'],
    queryFn: async () => {
      const { data } = await supabase.from<SupabaseMedication>('medications').select('*').order('name');
      return data || [];
    },
  });

  // Fetch all doctors (public)
  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data } = await supabase.from('doctors').select('*').order('name');
      return data || [];
    },
  });

  const [selectedDoctorId, setSelectedDoctorId] = useState('');
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
  const doctor = doctors?.find(d => d.id === selectedDoctorId) || { name: 'PasseVite', id: '' };

  const medicationGroups = useMemo(() => {
    const grouped: Record<string, SupabaseMedication[]> = {};
    (meds || []).forEach((med) => {
      if (!grouped[med.name]) grouped[med.name] = [];
      grouped[med.name].push(med);
    });
    Object.values(grouped).forEach((options) => {
      options.sort((a, b) => (a.dosage ?? '').localeCompare(b.dosage ?? ''));
    });
    return grouped;
  }, [meds]);

  const medicationNames = useMemo(
    () => Object.keys(medicationGroups).sort((a, b) => a.localeCompare(b)),
    [medicationGroups],
  );

  const hydrateMedicationFromVariant = (
    index: number,
    variant: SupabaseMedication,
    variantOptions?: SupabaseMedication[],
  ) => {
    const resolvedOptions = variantOptions && variantOptions.length ? variantOptions : [variant];
    setFormData((prev) => {
      const newMeds = [...prev.medications];
      if (index >= newMeds.length) return prev;
      const base = newMeds[index];
      newMeds[index] = {
        ...base,
        name: variant.name,
        variantOptions: resolvedOptions,
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
      if (!med || !med.variantOptions) return prev;
      const variant = med.variantOptions.find((option) => option.id === variantId);
      if (!variant) return prev;
      newMeds[index] = {
        ...med,
        selectedVariantId: variant.id,
        dosage: variant.dosage ?? med.dosage,
        duree: variant.duree ?? med.duree,
        frequency_count: variant.frequency_count ?? med.frequency_count,
        frequency_unit: variant.frequency_unit ?? med.frequency_unit,
        timing: variant.timing ?? med.timing,
      };
      return { ...prev, medications: newMeds };
    });
  };

  const newMedMutation = useMutation({
    mutationFn: async (payload: Partial<Medication>) => {
      const { data, error } = await supabase.from('medications').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: saved => {
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      if (pendingMedIndex !== null) {
        hydrateMedicationFromVariant(pendingMedIndex, saved, [saved]);
      }
      toast({ title: 'Médicament enregistré', description: `${saved.name} est prêt.` });
      setIsNewMedDialogOpen(false);
      setPendingMedIndex(null);
    },
  });

  const startNewMedDialog = (index: number) => {
    const base = formData.medications[index];
    setPendingMedIndex(index);
    setNewMedInput({
      name: '',
      dosage: base.dosage,
      duree: base.duree,
      frequency_count: base.frequency_count,
      frequency_unit: base.frequency_unit,
      timing: base.timing,
    });
    setIsNewMedDialogOpen(true);
  };

  const handleDialogSave = () => {
    newMedMutation.mutate({
      name: newMedInput.name,
      dosage: newMedInput.dosage,
      duree: newMedInput.duree,
      frequency_count: newMedInput.frequency_count,
      frequency_unit: newMedInput.frequency_unit,
      timing: newMedInput.timing,
    });
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Omit<FormData, 'prescription_date'>) => {
      if (!doctor.id) throw new Error('No doctor');
      const sanitizedMeds = data.medications.map(med => ({
        name: med.name === NEW_MEDICATION_VALUE ? '' : med.name,
        dosage: med.dosage,
        duree: med.duree,
        frequency_count: med.frequency_count,
        frequency_unit: med.frequency_unit,
        timing: med.timing,
      }));
      const { error } = await supabase
        .from('prescriptions')
        .insert({
          doctor_id: doctor.id,
          patient_name: data.patient_name,
          age: data.age || null,
          prescription_date: format(data.prescription_date, 'yyyy-MM-dd'),
          medications: sanitizedMeds,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Ordonnance sauvée!' });
      setFormData({ ...formData, medications: [{ name: '', dosage: '', duree: '', frequency_count: 1, frequency_unit: 'day', timing: 'avant' }] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });


  const handlePrint = useReactToPrint({
    content: () => printRef.current || document.getElementById('ordonnance-print'),
    contentRef: printRef,
    documentTitle: `Ordonnance_${formData.patient_name}_${format(new Date(), 'yyyyMMdd')}`,
  });

  const addMedication = () => {
    setFormData({
      ...formData,
      medications: [...formData.medications, createEmptyMedication()],
    });
  };

  const removeMedication = (index: number) => {
    setFormData({
      ...formData,
      medications: formData.medications.filter((_, i) => i !== index),
    });
  };

  const updateMedication = (index: number, field: Exclude<keyof Medication, 'name'>, value: Medication[keyof Medication]) => {
    const newMeds = [...formData.medications];
    newMeds[index] = { ...newMeds[index], [field]: value };
    setFormData({ ...formData, medications: newMeds });
  };

  const updateMedicationName = (index: number, selectedName: string) => {
    if (selectedName === NEW_MEDICATION_VALUE) {
      const newMeds = [...formData.medications];
      newMeds[index] = {
        ...newMeds[index],
        name: NEW_MEDICATION_VALUE,
      };
      setFormData({ ...formData, medications: newMeds });
      startNewMedDialog(index);
      return;
    }
    const variants = medicationGroups[selectedName] || [];
    if (variants.length > 0) {
      hydrateMedicationFromVariant(index, variants[0], variants);
      return;
    }
    const newMeds = [...formData.medications];
    newMeds[index] = {
      ...newMeds[index],
      name: selectedName,
      variantOptions: [],
      selectedVariantId: undefined,
    };
    setFormData({ ...formData, medications: newMeds });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, prescription_date: formData.prescription_date });
  };

  // No loading - fallback doctor


  return (
    <div className="min-h-[100dvh] bg-background px-4 py-6 sm:px-8 lg:px-12">
      <main className="mx-auto flex w-full max-w-screen-xl flex-col gap-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary italic">PasseVite</h1>
            <p className="text-sm text-muted-foreground">Ordonnance</p>
          </div>
          <Badge variant="secondary" className="text-xs lg:text-sm">
            Dr. {doctor.name}
          </Badge>
        </div>
        {doctors && doctors.length > 0 && (
          <div className="flex w-full justify-center">
            <div className="w-full max-w-lg">
              <Label>Médecin</Label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map(d => (
                    <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Card className="mx-auto w-full max-w-5xl">
          <CardHeader>
            <CardTitle>Nouvelle Ordonnance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 px-6 py-6 lg:px-10 lg:py-8">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Patient</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="patient_name">Nom</Label>
                  <Input
                    id="patient_name"
                    value={formData.patient_name}
                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <Label htmlFor="age">Âge</Label>
                  <Input
                    id="age"
                    type="number"
                    min={0}
                    max={120}
                    value={formData.age || ''}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || null })}
                  />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="text"
                    inputMode="numeric"
                    value={format(formData.prescription_date, 'dd/MM/yyyy')}
                    placeholder="dd/mm/yyyy"
                    onChange={(e) => {
                      const [day, month, year] = e.target.value.split('/');
                      if (day && month && year) {
                        const parsed = new Date(Number(year), Number(month) - 1, Number(day));
                        if (!Number.isNaN(parsed.getTime())) {
                          setFormData({ ...formData, prescription_date: parsed });
                          return;
                        }
                      }
                      setFormData({ ...formData, prescription_date: new Date() });
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Médicaments */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-lg">Médicaments</h3>
                <Button type="button" variant="secondary" size="sm" onClick={addMedication}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un médicament
                </Button>
              </div>
              <div className="border border-neutral-200 rounded-2xl bg-white/60 p-3 space-y-3">
                <div className="grid grid-cols-12 gap-3 text-xs uppercase tracking-[0.2em] text-neutral-500 border-b border-dashed pb-2">
                  <span className="col-span-4">Médicament</span>
                  <span className="col-span-2">Dosage</span>
                  <span className="col-span-2">Durée</span>
                  <span className="col-span-3">Fréquence</span>
                  <span className="col-span-1 text-right">Action</span>
                </div>
                {formData.medications.map((med, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-end border-b border-neutral-100 pb-2 last:border-b-0">
                    <div className="col-span-4 space-y-1">
                        <Select value={med.name} onValueChange={(v) => updateMedicationName(index, v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Nom du médicament" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NEW_MEDICATION_VALUE}>Nouveau médicament</SelectItem>
                            {medicationNames.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Input
                        placeholder="ex: 500mg"
                        value={med.dosage}
                        onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Input
                        placeholder="ex: 5 jours"
                        value={med.duree}
                        onChange={(e) => updateMedication(index, 'duree', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <div className="flex gap-2">
                        <Select value={med.frequency_count.toString()} onValueChange={(v) => updateMedication(index, 'frequency_count', parseInt(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1x</SelectItem>
                            <SelectItem value="2">2x</SelectItem>
                            <SelectItem value="3">3x</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={med.frequency_unit} onValueChange={(v) => updateMedication(index, 'frequency_unit', v as Medication['frequency_unit'])}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">/jour</SelectItem>
                            <SelectItem value="week">/sem</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={med.timing} onValueChange={(v) => updateMedication(index, 'timing', v as Medication['timing'])}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="avant">Avant</SelectItem>
                            <SelectItem value="apres">Après</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="col-span-1 text-right">
                      {formData.medications.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeMedication(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {med.variantOptions && med.variantOptions.length > 1 && (
                      <div className="col-span-12 flex flex-wrap gap-2 text-xs text-neutral-600 pt-1">
                        <span className="font-semibold tracking-[0.4em] uppercase text-[0.6rem] text-neutral-400">
                          Suggestions
                        </span>
                        {med.variantOptions.map((option) => {
                          const isActive = option.id === med.selectedVariantId;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`rounded-full border px-3 py-1 text-[0.7rem] transition ${
                                isActive
                                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                                  : 'border-neutral-200 text-neutral-500 hover:border-primary hover:text-primary'
                              }`}
                              onClick={() => applyVariantSuggestion(index, option.id)}
                            >
                              {option.dosage ?? 'Dosage libre'}
                              {option.duree ? ` · ${formatDurationLabel(option.duree)}` : ''}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" onClick={handlePrint} className="flex-1">
                <Printer className="h-4 w-4 mr-2" /> Imprimer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog
        open={isNewMedDialogOpen}
        onOpenChange={(open) => {
          setIsNewMedDialogOpen(open);
          if (!open) {
            setPendingMedIndex(null);
          }
        }}
      >
        <DialogContent className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nouvelle fiche médicament</DialogTitle>
            <DialogDescription>Complétez les informations pour stocker ce médicament dans la base.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nom</Label>
              <Input
                value={newMedInput.name}
                onChange={(e) => setNewMedInput({ ...newMedInput, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Dosage</Label>
              <Input
                value={newMedInput.dosage}
                onChange={(e) => setNewMedInput({ ...newMedInput, dosage: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Durée</Label>
              <Input
                value={newMedInput.duree}
                onChange={(e) => setNewMedInput({ ...newMedInput, duree: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Fréquence</Label>
              <div className="flex gap-2">
                <Select value={newMedInput.frequency_count.toString()} onValueChange={(v) => setNewMedInput({ ...newMedInput, frequency_count: parseInt(v) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1x</SelectItem>
                    <SelectItem value="2">2x</SelectItem>
                    <SelectItem value="3">3x</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newMedInput.frequency_unit} onValueChange={(v) => setNewMedInput({ ...newMedInput, frequency_unit: v as Medication['frequency_unit'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">/jour</SelectItem>
                    <SelectItem value="week">/sem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Timing</Label>
              <Select value={newMedInput.timing} onValueChange={(v) => setNewMedInput({ ...newMedInput, timing: v as Medication['timing'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avant">Avant</SelectItem>
                  <SelectItem value="apres">Après</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsNewMedDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleDialogSave} disabled={!newMedInput.name || newMedMutation.isLoading}>
              {newMedMutation.isLoading ? 'Enregistrement...' : 'Sauvegarder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Template - Hidden, luxurious A4 */}
      {/* Print Template - Hidden Minimal A4 */}
      <div id="ordonnance-print" ref={printRef} className="print-only hidden print:block">
        <div className="print:w-[210mm] print:h-[297mm] print:mx-auto print:relative">
          <div
            className="ordonnance-watermark print:absolute print:inset-0 print:pointer-events-none"
            aria-hidden
            style={{
              backgroundImage: "url('/ordonnance-logo.svg')",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: '200mm',
              opacity: 0.35,
            }}
          />
          <div className="print:w-full print:h-full print:px-10 print:py-8 print:flex print:flex-col print:gap-6 print:relative print:z-10">
            <header className="print:text-center print:space-y-1">
              <p className="print:text-base print:tracking-[1em] print:uppercase print:text-neutral-500">P A S S E V I T E D E N T A L</p>
              <h1 className="print:text-5xl print:font-semibold print:text-primary print:leading-tight">Ordonnance Clinique Dentaire</h1>
              <div className="print:flex print:items-center print:justify-center print:gap-6 print:text-sm print:text-neutral-600">
                <span className="print:text-base print:font-semibold">Dr. {doctor.name}</span>
                <span>{format(formData.prescription_date, 'dd/MM/yyyy', { locale: fr })}</span>
              </div>
            </header>
            <section className="print:grid print:grid-cols-2 print:gap-4 print:items-end print:border-b print:border-neutral-200 print:pb-2">
              <div>
                <p className="print:text-xs print:tracking-[0.4em] print:text-neutral-500">Patient</p>
                <p className="print:text-2xl print:font-semibold print:text-neutral-900">{formData.patient_name}</p>
              </div>
            <div className="print:text-right print:text-sm print:text-neutral-600">
                {formData.age && <p className="print:font-medium">{formData.age} ans</p>}
              </div>
            </section>
            <section className="print:flex print:flex-col print:gap-4 print:flex-1">
              <div className="print:text-xs print:tracking-[0.4em] print:text-neutral-500">
                <span>Médicaments</span>
              </div>
              <div className="print:flex print:flex-col print:gap-3 print:flex-1">
                {formData.medications.map((med, i) => (
                  <div key={i} className="print:flex print:flex-col print:gap-1 print:border-b print:border-neutral-200 print:pb-3">
                    <p className="print:flex print:items-center print:justify-between print:text-lg print:font-semibold print:text-neutral-900">
                      <span>{med.name === NEW_MEDICATION_VALUE ? 'Nouveau médicament' : med.name} {med.dosage}</span>
                      <span className="print:text-sm print:font-bold print:text-neutral-600">Qsp {formatDurationLabel(med.duree)}</span>
                    </p>
                    <p className="print:text-base print:font-normal print:text-neutral-700">
                      {formatFrequencyLine(med)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <footer className="print:text-xs print:text-neutral-500 print:flex print:items-center print:justify-between print:tracking-[0.4em]">
              <span>PasseVite Dental Clinic</span>
              <span>+213 12345678</span>
            </footer>
          </div>
        </div>
      </div>

      </main>
      <style jsx>{`
        @page { size: A4; margin: 1.5cm; }
        #ordonnance-print { position: relative; }
        #ordonnance-print .ordonnance-watermark {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        @media print { body * { visibility: hidden; } .print-only, .print-only * { visibility: visible; } .print-only { position: absolute; left: 0; top: 0; width: 100%; } }
      `}</style>
    </div>
  );
};

export default Ordonnance;

