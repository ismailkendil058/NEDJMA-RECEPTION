import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

const Merci = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#5B5BD6]/5 rounded-full blur-[100px] animate-fade-in" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#5B5BD6]/10 rounded-full blur-[100px] animate-fade-in" style={{ animationDelay: '0.3s' }} />

      <div className="text-center mb-16 relative z-10 max-w-2xl mx-auto animate-fade-in">
        {/* Logo */}
        <div className="inline-block mb-12 p-4 rounded-2xl bg-white shadow-2xl shadow-[#5B5BD6]/10 animate-float border border-[#5B5BD6]/10 mx-auto">
          <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-16 w-16 object-contain" />
        </div>
        
        {/* Confirmation */}
        <Card className="backdrop-blur-sm bg-white/70 dark:bg-black/20 border-[#5B5BD6]/20 shadow-2xl max-w-3xl mx-auto">
          <CardHeader className="pb-6">
            <div className="w-28 h-28 bg-gradient-to-br from-[#5B5BD6] to-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#5B5BD6]/30">
              <CheckCircle2 className="w-14 h-14 text-primary-foreground" />
            </div>
            <CardTitle className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#5B5BD6] mb-4">
              Merci pour votre retour
            </CardTitle>
            <CardDescription className="text-xl md:text-2xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Notre équipe examinera votre message afin d'améliorer votre expérience.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Link to="/" className="block mx-auto" title="Retour à l'accueil">
              <Button 
                variant="outline" 
                size="lg" 
                className="h-16 w-full max-w-md text-xl font-bold shadow-xl shadow-gray-200/50 hover:shadow-gray-300/50 transition-all duration-300 rounded-3xl border-2 hover:border-[#5B5BD6]/50 backdrop-blur-sm hover:scale-[1.02] hover:text-[#5B5BD6]"
              >
                <ArrowLeft className="w-6 h-6 mr-3" />
                Retour à l'accueil
              </Button>
            </Link>
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

export default Merci;

