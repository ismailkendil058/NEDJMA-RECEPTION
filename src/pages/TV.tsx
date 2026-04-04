import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';

interface Doctor {
  id: string;
  name: string;
  initial: string;
}

interface DoctorQueueInfo {
  doctor: Doctor;
  nextPatient: string;
  nextPatientName?: string;
  waitingCount: number;
}

interface Announcement {
  clientId: string;
  patientName?: string;
  doctorName: string;
}

const LiveClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right animate-fade-in">
      <p className="text-2xl md:text-3xl font-black text-primary tabular-nums tracking-tight">
        {time.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 capitalize font-medium tracking-[0.2em]">
        {time.toLocaleDateString('fr-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>
  );
};

const TV = () => {
  const [doctorQueues, setDoctorQueues] = useState<DoctorQueueInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [animate, setAnimate] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const announcementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevWaitingIds = useRef<Set<string>>(new Set());
  const waitingMeta = useRef<Map<string, { clientId: string; patientName?: string; doctorName: string }>>(new Map());

  const speakAnnouncement = useCallback((clientId: string, patientName: string | undefined, doctorName: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const displayName = patientName || `Monsieur ou Madame ${clientId}`;
    const text =
      `${displayName}, ` +
      `veuillez vous présenter, s'il vous plaît, ` +
      `au cabinet du Docteur ${doctorName}. ` +
      `Merci.`;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'fr-FR';
    utter.rate = 0.88;
    utter.pitch = 1.05;
    utter.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr') && v.localService) ||
      voices.find(v => v.lang.startsWith('fr'));
    if (frVoice) utter.voice = frVoice;

    utter.onend = () => {
      setTimeout(() => {
        const utter2 = new SpeechSynthesisUtterance(text);
        utter2.lang = utter.lang;
        utter2.rate = utter.rate;
        utter2.pitch = utter.pitch;
        utter2.volume = utter.volume;
        if (frVoice) utter2.voice = frVoice;
        window.speechSynthesis.speak(utter2);
      }, 1200);
    };

    window.speechSynthesis.speak(utter);
  }, []);

  const showAnnouncement = useCallback((clientId: string, patientName: string | undefined, doctorName: string) => {
    if (announcementTimer.current) clearTimeout(announcementTimer.current);
    setAnnouncement({ clientId, patientName, doctorName });
    speakAnnouncement(clientId, patientName, doctorName);
    announcementTimer.current = setTimeout(() => {
      setAnnouncement(null);
    }, 10000);
  }, [speakAnnouncement]);

  const fetchQueue = useCallback(async () => {
    const [docsRes, sessionRes] = await Promise.all([
      supabase.from('doctors').select('id, name, initial').order('name', { ascending: true }),
      supabase.from('sessions').select('id').eq('is_active', true).maybeSingle()
    ]);

    const doctors = docsRes.data;
    const session = sessionRes.data;

    if (!doctors || doctors.length === 0) {
      setDoctorQueues([]);
      return;
    }

    if (!session) {
      setDoctorQueues(
        doctors.map(d => ({ doctor: d, nextPatient: '—', waitingCount: 0 }))
      );
      prevWaitingIds.current = new Set();
      waitingMeta.current = new Map();
      return;
    }

    const { data: allSessionEntries } = await supabase
      .from('queue_entries')
      .select('id, status, client_id, patient_name, doctor_id, state, state_number, doctor:doctors(name, initial)')
      .eq('session_id', session.id);

    const waitingEntries = (allSessionEntries || []).filter(e => e.status === 'waiting');
    const inCabinetIds = new Set((allSessionEntries || []).filter(e => e.status === 'in_cabinet').map(e => e.id));
    const currentWaitingIds = new Set(waitingEntries.map(e => e.id));

    prevWaitingIds.current.forEach(id => {
      if (!currentWaitingIds.has(id)) {
        if (inCabinetIds.has(id)) {
          const meta = waitingMeta.current.get(id);
          if (meta) {
            showAnnouncement(meta.clientId, meta.patientName, meta.doctorName);
          }
        }
        waitingMeta.current.delete(id);
      }
    });

    waitingEntries.forEach(e => {
      if (!waitingMeta.current.has(e.id)) {
        waitingMeta.current.set(e.id, {
          clientId: e.client_id,
          patientName: e.patient_name,
          doctorName: (e as any).doctor?.name || '',
        });
      }
    });

    prevWaitingIds.current = currentWaitingIds;

    const newQueues: DoctorQueueInfo[] = doctors.map(doctor => {
      const doctorEntries = (waitingEntries || []).filter(
        e => e.doctor_id === doctor.id
      );
      const sorted = [...doctorEntries].sort((a, b) => {
        if (a.state === 'U' && b.state !== 'U') return -1;
        if (a.state !== 'U' && b.state === 'U') return 1;
        if (a.state === 'U' && b.state === 'U') return a.state_number - b.state_number;

        const getRank = (e: any) => {
          const num = e.state_number || 0;
          if (e.state === 'N') return num * 2 - 1;
          if (e.state === 'R') return num * 2;
          return 999;
        };

        const rankA = getRank(a);
        const rankB = getRank(b);

        if (rankA !== rankB) return rankA - rankB;
        return (a.state_number || 0) - (b.state_number || 0);
      });
      return {
        doctor,
        nextPatient: sorted.length > 0 ? sorted[0].client_id : '—',
        nextPatientName: sorted.length > 0 ? sorted[0].patient_name : undefined,
        waitingCount: sorted.length,
      };
    });

    setDoctorQueues(newQueues);
    setLoading(false);
  }, [showAnnouncement]);

  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        window.speechSynthesis.getVoices();
      });
    }

    fetchQueue();

    const channel = supabase
      .channel('tv-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => fetchQueue())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => fetchQueue())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (announcementTimer.current) clearTimeout(announcementTimer.current);
      window.speechSynthesis?.cancel();
    };
  }, [fetchQueue]);

  if (loading) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] animate-fade-in" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] animate-fade-in" />

        <div className="flex flex-col items-center gap-8 relative z-10 gpu">
          <div className="p-4 rounded-3xl bg-white shadow-2xl shadow-primary/20 animate-float gpu border border-primary/5">
            <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-16 w-16 object-contain" />
          </div>
          <div className="text-center space-y-3">
            <h1 className="text-5xl font-black italic text-primary tracking-tighter animate-fade-in gpu">PasseVite</h1>
            <p className="text-xs tracking-[0.5em] text-muted-foreground uppercase font-bold animate-fade-in gpu" style={{ animationDelay: '0.2s' }}>
              Chargement de la file
            </p>
          </div>
          <div className="w-48 h-1.5 bg-primary/10 rounded-full overflow-hidden mt-4">
            <div className="h-full bg-primary animate-[shimmer_2s_infinite] w-full" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col p-6 relative" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] animate-fade-in gpu pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-fade-in gpu pointer-events-none" style={{ animationDelay: '0.3s' }} />

      {/* ── Full-screen Announcement Overlay ── */}
      {announcement && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white backdrop-blur-xl transition-all duration-500"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)',
            animation: 'tvFadeIn 0.4s ease',
          }}
        >
          {/* Pulsing rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[80vh] h-[80vh] rounded-full border border-white/10 animate-[ping_3s_linear_infinite]" />
            <div className="w-[60vh] h-[60vh] rounded-full border border-white/20 animate-[ping_4s_linear_infinite]" style={{ animationDelay: '1s' }} />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center px-6">
            <div className="inline-block p-1.5 px-4 rounded-full bg-white/20 backdrop-blur-md border border-white/20 mb-10 animate-slide-up">
              <p className="text-sm md:text-lg font-bold tracking-[0.4em] uppercase">
                Prochain patient
              </p>
            </div>

            <div
              className="text-[25vw] md:text-[20vw] font-black leading-none tracking-tighter italic animate-slide-up"
              style={{
                animationDelay: '0.1s',
                textShadow: '0 10px 80px rgba(0,0,0,0.3)',
              }}
            >
              {announcement.clientId}
            </div>

            {announcement.patientName && (
              <div
                className="text-5xl md:text-7xl font-black mt-4 md:mt-8 tracking-tight animate-slide-up"
                style={{ animationDelay: '0.2s' }}
              >
                {announcement.patientName}
              </div>
            )}

            <div
              className="mt-12 md:mt-20 space-y-4 animate-slide-up"
              style={{ animationDelay: '0.3s' }}
            >
              <p className="text-xl md:text-3xl font-light opacity-80 tracking-widest uppercase">
                Veuillez vous présenter au
              </p>
              <div className="bg-black/20 backdrop-blur-lg p-6 md:p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
                <p className="text-4xl md:text-6xl font-black tracking-tight italic">
                  Cabinet Dr. {announcement.doctorName}
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 w-full h-2 bg-white/10 overflow-hidden">
            <div
              className="h-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)]"
              style={{ animation: 'tvProgress 10s linear forwards' }}
            />
          </div>
        </div>
      )}

      {/* CSS keyframes */}
      <style>{`
        @keyframes tvFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes tvProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 md:mb-12 relative z-10">
        <div className="flex items-center gap-6 animate-slide-up gpu">
          <div className="p-2.5 rounded-2xl bg-white shadow-xl shadow-primary/10 animate-float gpu border border-primary/5 hidden md:block">
            <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-10 w-10 object-contain" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-primary tracking-tighter italic leading-none">PasseVite</h1>
            <p className="text-[10px] md:text-xs tracking-[0.5em] text-muted-foreground mt-2 font-bold uppercase opacity-80">le soin qui passe</p>
          </div>
        </div>
        <LiveClock />
      </div>

      {/* Doctor Cards Grid */}
      <div
        className="flex-1 min-h-0 grid gap-6 md:gap-8 relative z-10"
        style={{
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
        }}
      >
        {doctorQueues.length === 0 ? (
          <div className="col-span-2 row-span-2 flex flex-col items-center justify-center text-center animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center mb-6">
              <span className="text-5xl">🩺</span>
            </div>
            <p className="text-2xl font-black text-primary tracking-tight italic">Aucune session active</p>
            <p className="text-muted-foreground mt-2 font-medium">Le système est en attente d'initialisation</p>
          </div>
        ) : (
          doctorQueues.map(({ doctor, nextPatient, nextPatientName, waitingCount }, index) => {
            const isAnimating = animate === doctor.id;
            return (
              <Card
                key={doctor.id}
                className={`
                  relative overflow-hidden border border-white/40 dark:border-white/5 
                  shadow-2xl shadow-primary/5 bg-white/50 dark:bg-black/20 
                  backdrop-blur-md transition-all duration-700 animate-slide-up gpu
                  flex flex-col
                  ${isAnimating ? 'ring-4 ring-primary scale-[1.02] z-20 shadow-primary/20' : 'z-10'}
                `}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/20" />
                <div className="absolute top-0 left-0 h-1.5 bg-primary transition-all duration-1000" style={{ width: waitingCount > 0 ? '100%' : '0%' }} />

                {/* Doctor Header */}
                <div className="p-6 md:p-8 flex items-center gap-5 border-b border-primary/5 bg-primary/[0.02]">
                  <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xl shadow-lg shadow-primary/20 animate-float gpu">
                    {doctor.initial || doctor.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-primary font-bold tracking-[0.3em] uppercase mb-1">Docteur</p>
                    <p className="text-2xl md:text-3xl font-black text-foreground truncate tracking-tight">{doctor.name}</p>
                  </div>
                </div>

                {/* Next Patient Body */}
                <CardContent className="flex-1 flex flex-col items-center justify-center p-8 md:p-12">
                  <div className="text-center space-y-4">
                    <p className="text-xs md:text-sm text-muted-foreground font-bold tracking-[0.4em] uppercase opacity-70">
                      Prochain patient
                    </p>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full scale-0 group-hover:scale-110 transition-transform duration-700 opacity-50" />
                      <div className={`
                        text-[8rem] md:text-[10rem] font-black text-primary leading-none tracking-tighter italic relative z-10
                        transition-all duration-700 ${isAnimating ? 'animate-bounce' : ''}
                      `}>
                        {nextPatient}
                      </div>
                    </div>
                    {nextPatientName && (
                      <div className="inline-block px-6 py-2 rounded-full bg-primary/5 border border-primary/10">
                        <p className="text-lg md:text-2xl font-bold text-foreground tracking-tight">
                          {nextPatientName}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Footer Status */}
                <div className="px-8 py-6 flex items-center justify-between bg-primary/[0.03] border-t border-primary/5 mt-auto">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${waitingCount > 0 ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`} />
                    <p className="text-sm font-bold text-muted-foreground tracking-widest uppercase">En attente</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-black tabular-nums tracking-tighter ${waitingCount > 0 ? 'text-primary' : 'text-muted-foreground/30'}`}>
                      {waitingCount}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground/50 uppercase">Patients</span>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Footer Branding */}
      <div className="mt-8 flex justify-center opacity-40 animate-fade-in" style={{ animationDelay: '1s' }}>
        <p className="text-[10px] md:text-xs font-bold tracking-[0.5em] text-muted-foreground uppercase">
          &copy; {new Date().getFullYear()} PasseVite &bull; Excellence en Soins
        </p>
      </div>
    </div>
  );
};

export default TV;
