import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface QueueEntry {
  id: string;
  session_id: string;
  phone: string;
  patient_name?: string;
  state: 'U' | 'N' | 'R';
  doctor_id: string;
  state_number: number;
  client_id: string;
  position: number;
  status: 'waiting' | 'in_cabinet' | 'completed';
  appointment_id?: string;
  created_at: string;
  doctor?: { name: string; initial: string };
}

export interface Doctor {
  id: string;
  name: string;
  initial: string;
}

export interface ActiveSession {
  id: string;
  opened_at: string;
  is_active: boolean;
}

export function useQueue() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [inCabinetEntries, setInCabinetEntries] = useState<QueueEntry[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDoctors = useCallback(async () => {
    const { data } = await supabase.from('doctors').select('*');
    if (data) setDoctors(data);
  }, []);

  const fetchActiveSession = useCallback(async () => {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('is_active', true)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveSession(data);
    return data;
  }, []);

  const fetchEntries = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors(*)')
      .eq('session_id', sessionId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });
    if (data) {
      const sorted = sortByPriority(data as QueueEntry[]);
      setEntries(sorted);
    }
  }, []);

  const fetchInCabinetEntries = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors(*)')
      .eq('session_id', sessionId)
      .eq('status', 'in_cabinet')
      .order('created_at', { ascending: true });
    if (data) {
      setInCabinetEntries(data as QueueEntry[]);
    }
  }, []);

  const sortByPriority = (items: QueueEntry[]) => {
    return [...items].sort((a, b) => {
      // 1. U (Urgent) always has absolute priority
      if (a.state === 'U' && b.state !== 'U') return -1;
      if (a.state !== 'U' && b.state === 'U') return 1;
      if (a.state === 'U' && b.state === 'U') return a.state_number - b.state_number;

      // 2. For N (New) and R (Appointment), alternate: N1, R1, N2, R2, ...
      const getRank = (e: QueueEntry) => {
        const num = e.state_number || 0;
        if (e.state === 'N') return num * 2 - 1; // N1->1, N2->3, N3->5
        if (e.state === 'R') return num * 2;     // R1->2, R2->4, R3->6
        return 999;
      };

      const rankA = getRank(a);
      const rankB = getRank(b);

      if (rankA !== rankB) return rankA - rankB;

      // Secondary sort for items with same rank (different doctors) or unknown states
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      // Batch initial fetches for faster load
      const [docRes, session] = await Promise.all([
        supabase.from('doctors').select('*'),
        fetchActiveSession()
      ]);

      if (docRes.data) setDoctors(docRes.data);

      if (session) {
        await Promise.all([
          fetchEntries(session.id),
          fetchInCabinetEntries(session.id)
        ]);
      }
      setLoading(false);
    };
    init();
  }, [fetchActiveSession, fetchEntries, fetchInCabinetEntries]);

  // Combined Real-time subscription for queue entries
  useEffect(() => {
    if (!activeSession) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel(`queue-${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
        },
        (payload) => {
          // Re-verify if the change belongs to this session if possible, 
          // otherwise refetch to be safe.
          const sessionId = (payload.new as any)?.session_id || (payload.old as any)?.session_id;
          if (!sessionId || sessionId === activeSession.id) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              fetchEntries(activeSession.id);
              fetchInCabinetEntries(activeSession.id);
            }, 300); // Debounce rapidly chained real-time events
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id, fetchEntries, fetchInCabinetEntries]);

  // Session real-time
  useEffect(() => {
    const channel = supabase
      .channel('session-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            fetchActiveSession();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchActiveSession]);

  const openSession = async (userId: string) => {
    // Close any active sessions first
    await supabase.from('sessions').update({ is_active: false, closed_at: new Date().toISOString() }).eq('is_active', true);
    const { data, error } = await supabase
      .from('sessions')
      .insert({ opened_by: userId })
      .select()
      .single();
    if (data) {
      setActiveSession(data);
      setEntries([]);
    }
    return { data, error };
  };

  const closeSession = async () => {
    if (!activeSession) return { error: new Error('Aucune séance active') };
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false, closed_at: new Date().toISOString() })
      .eq('id', activeSession.id);
    if (!error) {
      setActiveSession(null);
      setEntries([]);
      setInCabinetEntries([]);
    }
    return { error };
  };

  // Call client - move from waiting to in_cabinet
  const callClient = async (entryId: string) => {
    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'in_cabinet' })
      .eq('id', entryId);

    if (!error && activeSession) {
      // Immediate local update
      fetchEntries(activeSession.id);
      fetchInCabinetEntries(activeSession.id);
    }
    return { error };
  };

  const addClient = async (phone: string, state: 'U' | 'N' | 'R', doctorId: string, patientName?: string, appointmentId?: string) => {
    if (!activeSession) return { error: new Error('Aucune séance active') };

    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor) return { error: new Error('Médecin introuvable') };

    // Get next number for this state in current session
    const { data: existing } = await supabase
      .from('queue_entries')
      .select('state_number')
      .eq('session_id', activeSession.id)
      .eq('state', state)
      .order('state_number', { ascending: false })
      .limit(1);

    const nextNumber = (existing && existing.length > 0) ? existing[0].state_number + 1 : 1;
    const clientId = `${state}${nextNumber}${doctor.initial}`;
    const position = entries.length + 1;

    const { data, error } = await supabase
      .from('queue_entries')
      .insert({
        session_id: activeSession.id,
        phone: phone.trim(),
        patient_name: patientName?.trim(),
        state,
        doctor_id: doctorId,
        state_number: nextNumber,
        client_id: clientId,
        position,
        appointment_id: appointmentId,
      })
      .select('*, doctor:doctors(*)')
      .single();

    if (appointmentId) {
      // Mark appointment as 'coming'
      await supabase.from('appointments').update({ status: 'coming' }).eq('id', appointmentId);
    }

    if (data && !error) {
      setEntries(prev => sortByPriority([...prev, data as QueueEntry]));
    }

    return { data, error };
  };

  const completeClient = async (
    entryId: string,
    clientName: string,
    treatment: string,
    totalAmount: number,
    tranchePaid: number,
    receptionistId: string
  ) => {
    // Find entry from either waiting or in_cabinet list
    const entry = entries.find(e => e.id === entryId) || inCabinetEntries.find(e => e.id === entryId);
    if (!entry || !activeSession) return { error: new Error('Entrée introuvable') };

    // Insert completed record
    const { error: insertError } = await supabase.from('completed_clients').insert({
      queue_entry_id: entry.id,
      session_id: activeSession.id,
      client_name: clientName.trim(),
      phone: entry.phone,
      doctor_id: entry.doctor_id,
      client_id: entry.client_id,
      state: entry.state,
      treatment,
      total_amount: totalAmount,
      tranche_paid: tranchePaid,
      receptionist_id: receptionistId,
      appointment_id: entry.appointment_id,
    });

    if (entry.appointment_id) {
      // Mark appointment as 'attended'
      await supabase.from('appointments').update({ status: 'attended' }).eq('id', entry.appointment_id);
    }

    if (insertError) return { error: insertError };

    // Delete from queue_entries
    const { error } = await supabase
      .from('queue_entries')
      .delete()
      .eq('id', entryId);

    if (!error) {
      setInCabinetEntries(prev => prev.filter(e => e.id !== entryId));
      setEntries(prev => prev.filter(e => e.id !== entryId));
    }

    return { error };
  };

  const getStats = () => {
    const stats = { U: { current: 0, total: 0 }, N: { current: 0, total: 0 }, R: { current: 0, total: 0 } };
    const waiting = entries.filter(e => e.status === 'waiting');

    (['U', 'N', 'R'] as const).forEach(state => {
      const stateEntries = waiting.filter(e => e.state === state);
      stats[state].current = stateEntries.length > 0 ? stateEntries[0].state_number : 0;
      stats[state].total = stateEntries.length;
    });

    return stats;
  };

  const updateClient = async (entryId: string, updates: { phone?: string; state?: 'U' | 'N' | 'R'; doctor_id?: string; patient_name?: string }) => {
    const { error } = await supabase
      .from('queue_entries')
      .update(updates)
      .eq('id', entryId);

    if (!error && activeSession) {
      fetchEntries(activeSession.id);
      fetchInCabinetEntries(activeSession.id);
    }
    return { error };
  };

  const deleteClient = async (entryId: string) => {
    const { error } = await supabase
      .from('queue_entries')
      .delete()
      .eq('id', entryId);

    if (!error) {
      setEntries(prev => prev.filter(e => e.id !== entryId));
      setInCabinetEntries(prev => prev.filter(e => e.id !== entryId));
    }
    return { error };
  };

  return {
    entries: entries.filter(e => e.status === 'waiting'),
    inCabinetEntries,
    activeSession,
    doctors,
    loading,
    openSession,
    closeSession,
    addClient,
    callClient,
    completeClient,
    getStats,
    fetchEntries,
    fetchInCabinetEntries,
    fetchActiveSession,
    updateClient,
    deleteClient,
  };
}
