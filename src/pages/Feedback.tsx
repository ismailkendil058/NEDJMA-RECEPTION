import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { Frown } from 'lucide-react';

const Feedback = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message) return;
    setLoading(true);

    try {
      const { error } = await supabase.from('feedbacks').insert([
        { name: formData.name, phone: formData.phone, message: formData.message },
      ]);

      if (error) {
        console.error('Error submitting feedback:', error);
        // Optionally, show an error message to the user
      } else {
        navigate('/merci');
      }
    } catch (error) {
      console.error('An unexpected error occurred:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#5B5BD6]/5 rounded-full blur-[100px] animate-fade-in" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#5B5BD6]/10 rounded-full blur-[100px] animate-fade-in" style={{ animationDelay: '0.3s' }} />

      <div className="text-center mb-16 relative z-10 max-w-2xl mx-auto animate-fade-in">
        {/* Logo */}
        <div className="inline-block mb-8 p-4 rounded-2xl bg-white shadow-2xl shadow-[#5B5BD6]/10 animate-float border border-[#5B5BD6]/10 mx-auto">
          <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-16 w-16 object-contain" />
        </div>
        
        {/* Headline */}
        <Card className="backdrop-blur-sm bg-white/70 dark:bg-black/20 border-[#5B5BD6]/20 shadow-2xl max-w-3xl mx-auto mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#5B5BD6] mb-4 flex items-center justify-center gap-3">
<Frown className="w-12 h-12 text-[#5B5BD6]/70" />
              Nous sommes désolés
            </CardTitle>
            <CardDescription className="text-xl md:text-2xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
              que votre expérience n'a pas été parfaite.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Form Card */}
        <Card className="backdrop-blur-sm bg-white/80 dark:bg-black/20 border-[#5B5BD6]/20 shadow-2xl w-full max-w-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-foreground">
              Aidez-nous à améliorer la qualité de nos soins
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Que pouvons-nous améliorer ?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Input
                  name="name"
                  placeholder="Votre nom (optionnel)"
                  value={formData.name}
                  onChange={handleChange}
                  className="h-14 text-lg rounded-2xl border-2 border-muted/50 backdrop-blur-sm focus-visible:ring-[#5B5BD6] focus-visible:ring-2"
                />
              </div>
              <div>
                <Input
                  name="phone"
                  type="tel"
                  placeholder="Votre numéro de téléphone (optionnel)"
                  value={formData.phone}
                  onChange={handleChange}
                  className="h-14 text-lg rounded-2xl border-2 border-muted/50 backdrop-blur-sm focus-visible:ring-[#5B5BD6] focus-visible:ring-2"
                />
              </div>
              <div>
                <Textarea
                  name="message"
                  placeholder="Dites-nous comment nous pouvons mieux faire..."
                  value={formData.message}
                  onChange={handleChange}
                  className="min-h-[150px] resize-none text-lg rounded-2xl border-2 border-muted/50 backdrop-blur-sm focus-visible:ring-[#5B5BD6] focus-visible:ring-2 p-6"
                  required
                />
              </div>
              <Button 
                type="submit" 
                size="lg" 
                className="h-16 w-full text-xl font-bold shadow-2xl shadow-[#5B5BD6]/20 hover:shadow-[#5B5BD6]/30 transition-all duration-300 rounded-3xl bg-gradient-to-r from-[#5B5BD6] to-primary text-primary-foreground hover:-translate-y-1 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin mr-3" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-6 h-6 mr-3" />
                    Envoyer mon message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

<div className="hidden" dangerouslySetInnerHTML={{
        __html: `
          @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in { animation: fade-in 1s ease-out; }
          @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
          .animate-float { animation: float 3s ease-in-out infinite; }
        `
      }} />
    </div>
  );
};

export default Feedback;

