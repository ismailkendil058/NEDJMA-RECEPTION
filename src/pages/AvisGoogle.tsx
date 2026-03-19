import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Star } from 'lucide-react';
import { config } from '@/config';

const AvisGoogle = () => {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#5B5BD6]/5 rounded-full blur-[100px] animate-fade-in" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#5B5BD6]/10 rounded-full blur-[100px] animate-fade-in" style={{ animationDelay: '0.3s' }} />

      <div className="text-center mb-16 relative z-10 max-w-2xl mx-auto animate-fade-in">
        {/* Logo */}
        <div className="inline-block mb-8 p-4 rounded-2xl bg-white shadow-2xl shadow-[#5B5BD6]/10 animate-float border border-[#5B5BD6]/10 mx-auto">
          <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-12 w-12 sm:h-16 sm:w-16 object-contain" />
        </div>
        
        {/* Thank you message */}
        <Card className="backdrop-blur-sm bg-white/70 dark:bg-black/20 border-[#5B5BD6]/20 shadow-2xl w-full max-w-xl sm:max-w-2xl lg:max-w-3xl mx-auto">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-[#5B5BD6] mb-4 leading-tight">
              Merci pour votre confiance
            </CardTitle>
            <CardDescription className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Votre avis aide d'autres patients à choisir une clinique de confiance.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-0 space-y-8">
            {/* Stars */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <Star className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 text-[#5B5BD6] fill-[#5B5BD6] animate-pulse" />
              <Star className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 text-[#5B5BD6] fill-[#5B5BD6]" />
              <Star className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 text-[#5B5BD6] fill-[#5B5BD6]" />
              <Star className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 text-[#5B5BD6] fill-[#5B5BD6]" />
              <Star className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 text-[#5B5BD6] fill-[#5B5BD6] animate-pulse" />
            </div>

            {/* CTA Button */}
            <a
              href={config.googleReviewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block group mx-auto"
            >
              <Button 
                size="lg" 
                className="h-16 sm:h-20 w-full max-w-sm sm:max-w-md text-lg sm:text-2xl font-bold shadow-2xl shadow-[#5B5BD6]/20 hover:shadow-[#5B5BD6]/30 transition-all duration-300 rounded-3xl bg-gradient-to-r from-[#5B5BD6] to-primary text-primary-foreground border-2 border-[#5B5BD6]/20 backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98] hover:-translate-y-1 min-h-[44px] flex items-center justify-center"
              >
                Laisser un avis sur Google
                <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-2 transition-transform duration-300" />
              </Button>
            </a>

            {/* Micro instructions */}
            <div className="space-y-3 sm:space-y-4 text-left w-full max-w-md mx-auto text-base sm:text-sm md:text-base leading-relaxed">
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-2xl backdrop-blur-sm border border-muted/50">
                <div className="w-8 h-8 sm:w-6 sm:h-6 bg-[#5B5BD6] rounded-full flex items-center justify-center font-bold text-sm sm:text-xs text-white mt-0.5 flex-shrink-0">1</div>
                <span>Cliquez sur le bouton ci-dessus</span>
              </div>
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-2xl backdrop-blur-sm border border-muted/50">
                <div className="w-8 h-8 sm:w-6 sm:h-6 bg-[#5B5BD6] rounded-full flex items-center justify-center font-bold text-sm sm:text-xs text-white mt-0.5 flex-shrink-0">2</div>
                <span>Choisissez 5 étoiles</span>
              </div>
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-2xl backdrop-blur-sm border border-muted/50">
                <div className="w-8 h-8 sm:w-6 sm:h-6 bg-[#5B5BD6] rounded-full flex items-center justify-center font-bold text-sm sm:text-xs text-white mt-0.5 flex-shrink-0">3</div>
                <span>Écrivez quelques mots sur votre expérience</span>
              </div>
              <p className="text-center mt-6 sm:mt-8 text-sm sm:text-xs font-medium text-muted-foreground pt-4 border-t border-muted/50">
                ⏱ Cela prend moins de 30 secondes.
              </p>
            </div>
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

export default AvisGoogle;

