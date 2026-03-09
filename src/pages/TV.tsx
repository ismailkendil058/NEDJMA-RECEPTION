import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface QueueState {
  U: { current: string; total: number };
  N: { current: string; total: number };
  R: { current: string; total: number };
  currentId: string;
}

const TV = () => {
  const [state, setState] = useState<QueueState>({
    U: { current: '—', total: 0 },
    N: { current: '—', total: 0 },
    R: { current: '—', total: 0 },
    currentId: '—',
  });
  const [animate, setAnimate] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevIdRef = useRef('');

  const fetchQueue = async () => {
    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      setState({ U: { current: '—', total: 0 }, N: { current: '—', total: 0 }, R: { current: '—', total: 0 }, currentId: '—' });
      return;
    }

    const { data: entries } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors(*)')
      .eq('session_id', session.id)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });

    if (!entries || entries.length === 0) {
      setState({ U: { current: '—', total: 0 }, N: { current: '—', total: 0 }, R: { current: '—', total: 0 }, currentId: '—' });
      return;
    }

    const PRIORITY = { U: 0, N: 1, R: 2 };
    const sorted = [...entries].sort((a, b) => {
      const pa = PRIORITY[a.state as keyof typeof PRIORITY] ?? 99;
      const pb = PRIORITY[b.state as keyof typeof PRIORITY] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.state_number - b.state_number;
    });

    const newState: QueueState = {
      U: { current: '—', total: 0 },
      N: { current: '—', total: 0 },
      R: { current: '—', total: 0 },
      currentId: sorted[0]?.client_id || '—',
    };

    (['U', 'N', 'R'] as const).forEach(s => {
      const stateEntries = sorted.filter(e => e.state === s);
      newState[s].total = stateEntries.length;
      if (stateEntries.length > 0) {
        newState[s].current = stateEntries[0].client_id;
      }
    });

    // Animate if current ID changed
    if (newState.currentId !== prevIdRef.current && prevIdRef.current !== '') {
      setAnimate(true);
      playSound();
      setTimeout(() => setAnimate(false), 1500);
    }
    prevIdRef.current = newState.currentId;

    setState(newState);
  };

  const playSound = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  useEffect(() => {
    fetchQueue();

    const channel = supabase
      .channel('tv-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => fetchQueue())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => fetchQueue())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const stateConfig = {
    U: { label: 'Urgence', color: 'bg-destructive text-destructive-foreground' },
    N: { label: 'Nouveau', color: 'bg-primary text-primary-foreground' },
    R: { label: 'Rendez-vous', color: 'bg-foreground text-background' },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8">
      {/* Header */}
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-4xl md:text-6xl font-bold text-primary tracking-tight">NEDJMA</h1>
        <p className="text-sm md:text-base tracking-[0.4em] text-muted-foreground mt-1">CLINIQUE DENTAIRE</p>
      </div>

      {/* Current Client - Large Center Display */}
      <div className={`mb-8 md:mb-16 transition-all duration-500 ${animate ? 'scale-110' : 'scale-100'}`}>
        <div className="text-center">
          <p className="text-sm md:text-lg text-muted-foreground mb-2">Prochain patient</p>
          <div className={`text-6xl md:text-[10rem] font-bold text-primary leading-none transition-all duration-700 ${animate ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
            {state.currentId}
          </div>
        </div>
      </div>

      {/* Three State Blocks */}
      <div className="grid grid-cols-3 gap-4 md:gap-8 w-full max-w-4xl">
        {(['U', 'N', 'R'] as const).map(s => (
          <div key={s} className="text-center">
            <Badge className={`${stateConfig[s].color} text-base md:text-lg px-4 py-1 mb-3`}>
              {stateConfig[s].label}
            </Badge>
            <div className="bg-card rounded-2xl p-4 md:p-8 shadow-sm">
              <p className="text-3xl md:text-6xl font-bold text-foreground">{state[s].current}</p>
              <p className="text-sm md:text-base text-muted-foreground mt-2">
                {state[s].total} en attente
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 md:mt-16 text-center">
        <p className="text-xs text-muted-foreground">
          Mise à jour en temps réel
        </p>
      </div>
    </div>
  );
};

export default TV;
