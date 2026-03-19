import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Smile, Frown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

const Satisfaction = () => {
  const navigate = useNavigate();

  const handleSatisfaction = async () => {
    try {
      const { error } = await supabase.rpc('increment_satisfied_count');
      if (error) {
        console.error('Error incrementing satisfaction count:', error);
      }
    } catch (error) {
      console.error('An unexpected error occurred:', error);
    } finally {
      navigate('/avis-google');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements matching Index */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#5B5BD6]/5 rounded-full blur-[100px] animate-fade-in" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#5B5BD6]/10 rounded-full blur-[100px] animate-fade-in" style={{ animationDelay: '0.3s' }} />

      <div className="text-center mb-16 relative z-10 max-w-2xl mx-auto animate-fade-in">
        {/* Logo */}
        <div className="inline-block mb-8 p-4 rounded-2xl bg-white shadow-2xl shadow-[#5B5BD6]/10 animate-float border border-[#5B5BD6]/10 mx-auto">
          <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-16 w-16 object-contain" />
        </div>
        
        {/* Headline */}
        <Card className="backdrop-blur-sm bg-white/70 dark:bg-black/20 border-[#5B5BD6]/20 shadow-2xl max-w-3xl mx-auto">
          <CardHeader className="pb-4">
            <CardTitle className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground italic bg-gradient-to-r from-[#5B5BD6] to-primary bg-clip-text text-transparent">
              Votre expérience chez notre clinique vous a-t-elle satisfait ?
            </CardTitle>
            <CardDescription className="text-xl md:text-2xl text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
              Votre avis est précieux et nous aide à améliorer la qualité de nos soins.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16 max-w-2xl w-full">
          {/* Oui Button */}
          <Button 
            size="lg" 
            className="h-20 w-full text-xl md:text-2xl font-bold shadow-2xl shadow-[#5B5BD6]/20 hover:shadow-[#5B5BD6]/30 transition-all duration-300 rounded-2xl bg-gradient-to-r from-[#5B5BD6] to-primary text-primary-foreground border-2 border-[#5B5BD6]/20 backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleSatisfaction}
          >
            <Smile className="w-8 h-8 mr-3 group-hover:animate-bounce" />
            Oui, je suis satisfait
          </Button>

          {/* Non Button */}
          <Link to="/feedback" className="group">
            <Button 
              variant="outline" 
              size="lg" 
              className="h-20 w-full text-xl md:text-2xl font-bold shadow-xl shadow-gray-200/50 hover:shadow-gray-300/50 transition-all duration-300 rounded-2xl border-2 hover:border-gray-300 backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <Frown className="w-8 h-8 mr-3 group-hover:rotate-12 transition-transform duration-300" />
              Non, je ne suis pas satisfait
            </Button>
          </Link>
        </div>
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

export default Satisfaction;

