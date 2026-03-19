import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ThumbsUp, MessageSquare } from 'lucide-react';

interface Feedback {
  id: string;
  name: string;
  phone: string;
  message: string;
  created_at: string;
}

export const FeedbackStats = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [satisfiedCount, setSatisfiedCount] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!isOpen) return;
    setLoading(true);

    // Fetch stats
    const { data: statsData, error: statsError } = await supabase
      .from('feedback_stats')
      .select('satisfied_count, feedback_count')
      .single();

    if (statsData) {
      setSatisfiedCount(statsData.satisfied_count);
      setFeedbackCount(statsData.feedback_count);
    }
    if (statsError) console.error('Error fetching stats:', statsError);

    // Fetch feedbacks
    const { data: feedbacksData, error: feedbacksError } = await supabase
      .from('feedbacks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (feedbacksData) setFeedbacks(feedbacksData);
    if (feedbacksError) console.error('Error fetching feedbacks:', feedbacksError);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-8 w-8 p-0">
          <MessageSquare className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Statistiques de satisfaction</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-green-100 dark:bg-green-900/50">
              <ThumbsUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-3xl font-bold">{satisfiedCount}</p>
                <p className="text-sm text-muted-foreground">Clients satisfaits</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <MessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-3xl font-bold">{feedbackCount}</p>
                <p className="text-sm text-muted-foreground">Avis & retours</p>
              </div>
            </div>
          </div>
          
          <h3 className="text-lg font-semibold mb-2">Derniers avis</h3>
          {loading ? (
            <p className="text-center text-muted-foreground">Chargement...</p>
          ) : feedbacks.length === 0 ? (
            <p className="text-center text-muted-foreground">Aucun avis pour le moment.</p>
          ) : (
            <div className="space-y-4 max-h-[40vh] overflow-y-auto">
              {feedbacks.map(fb => (
                <div key={fb.id} className="p-3 rounded-md border text-sm">
                  <p className="font-medium">{fb.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fb.name || 'Anonyme'} {fb.phone && `(${fb.phone})`} - {new Date(fb.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
