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

const PRIORITY_ORDER = { U: 0, N: 1, R: 2 };

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
      const pa = PRIORITY_ORDER[a.state as keyof typeof PRIORITY_ORDER] ?? 99;
      const pb = PRIORITY_ORDER[b.state as keyof typeof PRIORITY_ORDER] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.state_number - b.state_number;
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

    const channel = supabase
      .channel(`queue-${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
          filter: `session_id=eq.${activeSession.id}`
        },
        () => {
          // Optimized: We still refetch but we could also use the payload to be even faster.
          // However, due to joined data (doctor) and complex sorting, a targeted refetch
          // is safer and still much faster than a full page refresh.
          fetchEntries(activeSession.id);
          fetchInCabinetEntries(activeSession.id);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
    return { error };
  };

  const addClient = async (phone: string, state: 'U' | 'N' | 'R', doctorId: string, patientName?: string) => {
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
      })
      .select('*, doctor:doctors(*)')
      .single();

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
    });

    if (insertError) return { error: insertError };

    // Delete from queue_entries
    const { error } = await supabase
      .from('queue_entries')
      .delete()
      .eq('id', entryId);

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
    return { error };
  };

  const deleteClient = async (entryId: string) => {
    const { error } = await supabase
      .from('queue_entries')
      .delete()
      .eq('id', entryId);
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
