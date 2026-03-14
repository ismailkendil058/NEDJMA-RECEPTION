import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
    <div className="text-right">
      <p className="text-xl md:text-2xl font-bold text-foreground tabular-nums">
        {time.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 capitalize">
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
  // Map entryId -> { clientId, patientName, doctorName } for entries we've seen while waiting
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

    // Pick a French voice if available
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr') && v.localService) ||
      voices.find(v => v.lang.startsWith('fr'));
    if (frVoice) utter.voice = frVoice;

    // Repeat twice with a pause
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
    // Optimization: Parallel fetch doctors and active session
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

    // Fetch both waiting and in-cabinet entries to distinguish deletions from calls
    const { data: allSessionEntries } = await supabase
      .from('queue_entries')
      .select('id, status, client_id, patient_name, doctor_id, state, state_number, doctor:doctors(name, initial)')
      .eq('session_id', session.id);

    const waitingEntries = (allSessionEntries || []).filter(e => e.status === 'waiting');
    const inCabinetIds = new Set((allSessionEntries || []).filter(e => e.status === 'in_cabinet').map(e => e.id));

    const currentWaitingIds = new Set(waitingEntries.map(e => e.id));

    // Detect entries that disappeared from waiting
    prevWaitingIds.current.forEach(id => {
      if (!currentWaitingIds.has(id)) {
        // ONLY announce if it moved to cabinet. 
        // If it was deleted from the table, it won't be in inCabinetIds.
        if (inCabinetIds.has(id)) {
          const meta = waitingMeta.current.get(id);
          if (meta) {
            showAnnouncement(meta.clientId, meta.patientName, meta.doctorName);
          }
        }
        waitingMeta.current.delete(id);
      }
    });

    // Update meta map with current waiting entries
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
        // 1. U (Urgent) always has absolute priority
        if (a.state === 'U' && b.state !== 'U') return -1;
        if (a.state !== 'U' && b.state === 'U') return 1;
        if (a.state === 'U' && b.state === 'U') return a.state_number - b.state_number;

        // 2. For N (New) and R (Appointment), alternate: N1, R1, N2, R2, ...
        const getRank = (e: any) => {
          const num = e.state_number || 0;
          if (e.state === 'N') return num * 2 - 1; // N1->1, N2->3, N3->5
          if (e.state === 'R') return num * 2;     // R1->2, R2->4, R3->6
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
    // Preload voices (browsers are lazy about this)
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
      <div className="h-[100dvh] transition-all duration-300 flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-primary/5 animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black italic text-primary tracking-tighter">PasseVite</h1>
            <p className="text-[10px] tracking-[0.4em] text-muted-foreground uppercase font-medium">Initialisation du système</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col p-3 md:p-5" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Full-screen Announcement Overlay ── */}
      {announcement && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.75) 100%)',
            animation: 'tvFadeIn 0.4s ease',
          }}
        >
          {/* Pulsing ring */}
          <div
            className="absolute w-[min(60vw,60vh)] h-[min(60vw,60vh)] rounded-full opacity-20"
            style={{ background: 'white', animation: 'tvPulse 2s ease-in-out infinite' }}
          />

          <p
            className="text-lg md:text-2xl font-light tracking-[0.35em] uppercase opacity-80 mb-6"
            style={{ animation: 'tvSlideUp 0.5s ease 0.1s both' }}
          >
            Prochain patient
          </p>

          <div
            className="text-[20vw] md:text-[18vw] font-black leading-none tracking-tight"
            style={{
              animation: 'tvSlideUp 0.5s ease 0.2s both',
              textShadow: '0 4px 40px rgba(0,0,0,0.25)',
            }}
          >
            {announcement.clientId}
          </div>

          {announcement.patientName && (
            <div
              className="text-4xl md:text-6xl font-bold mt-4 md:mt-6 text-center px-4"
              style={{ animation: 'tvSlideUp 0.5s ease 0.25s both' }}
            >
              {announcement.patientName}
            </div>
          )}

          <div
            className="mt-8 md:mt-12 text-center"
            style={{ animation: 'tvSlideUp 0.5s ease 0.35s both' }}
          >
            <p className="text-base md:text-xl font-light opacity-75 tracking-widest uppercase mb-1">
              Veuillez vous présenter au cabinet de
            </p>
            <p className="text-3xl md:text-5xl font-bold tracking-tight">
              Dr. {announcement.doctorName}
            </p>
          </div>

          {/* Progress bar */}
          <div
            className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-full"
            style={{ width: '100%' }}
          >
            <div
              className="h-full bg-white rounded-full"
              style={{ animation: 'tvProgress 10s linear forwards' }}
            />
          </div>
        </div>
      )}

      {/* CSS keyframes injected inline */}
      <style>{`
        @keyframes tvFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes tvSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tvPulse {
          0%, 100% { transform: scale(1);   opacity: 0.15; }
          50%       { transform: scale(1.12); opacity: 0.28; }
        }
        @keyframes tvProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight italic">PasseVite</h1>
          <p className="text-[8px] md:text-[10px] tracking-[0.4em] text-muted-foreground mt-0.5 uppercase">le soin qui passe</p>
        </div>
        <LiveClock />
      </div>

      {/* Doctor Cards Grid */}
      <div
        className="flex-1 min-h-0 grid gap-2 md:gap-3"
        style={{
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
        }}
      >
        {doctorQueues.length === 0 ? (
          <div className="col-span-2 row-span-2 flex flex-col items-center justify-center text-center">
            <p className="text-4xl mb-3">🩺</p>
            <p className="text-lg text-muted-foreground">Aucune session active</p>
          </div>
        ) : (
          doctorQueues.map(({ doctor, nextPatient, nextPatientName, waitingCount }) => {
            const isAnimating = animate === doctor.id;
            return (
              <div
                key={doctor.id}
                className={`bg-card rounded-xl shadow-sm border border-border flex flex-col overflow-hidden transition-all duration-500 min-h-0 ${isAnimating ? 'ring-2 ring-primary scale-[1.01]' : ''}`}
              >
                {/* Doctor Header */}
                <div className="bg-primary/10 px-3 py-2 flex items-center gap-2 border-b border-border shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                    {doctor.initial || doctor.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Docteur</p>
                    <p className="font-semibold text-foreground truncate text-sm">{doctor.name}</p>
                  </div>
                </div>

                {/* Next Patient */}
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-3 text-center">
                  <p className="text-[10px] md:text-xs text-muted-foreground tracking-widest uppercase mb-2">
                    Prochain patient
                  </p>
                  <div
                    className={`flex flex-col items-center justify-center transition-all duration-700 ${isAnimating ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
                      }`}
                  >
                    <div className="text-4xl md:text-7xl font-bold text-primary leading-none">
                      {nextPatient}
                    </div>
                    {nextPatientName && (
                      <div className="text-xs md:text-sm font-medium text-muted-foreground mt-1 truncate max-w-full px-2">
                        {nextPatientName}
                      </div>
                    )}
                  </div>
                </div>

                {/* Waiting Count Footer */}
                <div className="border-t border-border px-3 py-2 flex items-center justify-between shrink-0">
                  <p className="text-xs text-muted-foreground">En attente</p>
                  <span className={`text-base font-bold tabular-nums ${waitingCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {waitingCount}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TV;
