import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Check, X, ChefHat, Utensils, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Dish = {
  id: number;
  dishName: string;
  cuisineType: string;
  complexity: string;
  mealType: string;
  imageUrl: string;
};

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const queryClient = useQueryClient();

  // Fetch onboarding state to see if they're already done
  const { data: state, isLoading: stateLoading } = useQuery<any>({
    queryKey: ["/api/onboarding/state"],
  });

  // Fetch curated dishes
  const { data: fetchedDishes, isLoading: dishesLoading } = useQuery<Dish[]>({
    queryKey: ["/api/onboarding/dishes"],
  });

  useEffect(() => {
    if (fetchedDishes && dishes.length === 0) {
      setDishes(fetchedDishes);
    }
  }, [fetchedDishes]);

  useEffect(() => {
    if (state?.completed) {
      setLocation("/");
    }
  }, [state, setLocation]);

  const selectRole = async (role: 'cook' | 'eater') => {
    try {
      await apiRequest("POST", "/api/onboarding/mode", { cookingMode: role });
      setStep(2);
    } catch (e) {
      toast({ description: "Failed to save your role", variant: "destructive" });
    }
  };

  const handleSwipe = async (liked: boolean) => {
    if (currentIndex >= dishes.length) return;
    
    const dish = dishes[currentIndex];
    
    try {
      await apiRequest("POST", "/api/onboarding/swipe", {
        ...dish,
        liked
      });
      
      setCurrentIndex(prev => prev + 1);
      
      if (currentIndex === dishes.length - 1) {
        // Finished
        await apiRequest("POST", "/api/onboarding/complete");
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
        setLocation("/");
        toast({ title: "Taste Profile Created! 🎉", description: "Your AI Copilot is now customized to your preferences." });
      }
    } catch (err) {
      toast({ description: "Failed to save swipe", variant: "destructive" });
    }
  };

  if (stateLoading || dishesLoading) {
    return <div className="flex h-screen items-center justify-center bg-zinc-950"><Loader2 className="h-8 w-8 animate-spin text-purple-500" /></div>;
  }

  if (step === 1) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl text-center"
        >
          <div className="mx-auto w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="h-8 w-8 text-purple-500" />
          </div>
          <h1 className="text-3xl font-bold mb-3 text-zinc-100">Setup Kitchen Copilot</h1>
          <p className="text-zinc-400 mb-8 leading-relaxed">
            I need to learn about your household to give the best suggestions. First, what best describes your primary role?
          </p>
          
          <div className="grid gap-4">
            <Button
              variant="outline"
              className="h-auto p-6 bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 hover:border-purple-500 flex flex-col items-center gap-3 group transition-all"
              onClick={() => selectRole('cook')}
            >
              <ChefHat className="h-8 w-8 text-zinc-400 group-hover:text-purple-400 transition-colors" />
              <div>
                <span className="block text-lg font-semibold text-zinc-200">The Cook</span>
                <span className="block text-sm text-zinc-500 font-normal">I actively plan and cook the meals</span>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-6 bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 hover:border-purple-500 flex flex-col items-center gap-3 group transition-all"
              onClick={() => selectRole('eater')}
            >
              <Utensils className="h-8 w-8 text-zinc-400 group-hover:text-purple-400 transition-colors" />
              <div>
                <span className="block text-lg font-semibold text-zinc-200">The Eater</span>
                <span className="block text-sm text-zinc-500 font-normal">I mostly just eat what's made</span>
              </div>
            </Button>
          </div>

          <button
            className="mt-4 text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
            onClick={async () => {
              await apiRequest("POST", "/api/onboarding/complete");
              queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
              setLocation("/");
            }}
          >
            Skip setup →
          </button>
        </motion.div>
      </div>
    );
  }

  // Step 2: Tinder-like swiping
  const activeDish = dishes[currentIndex];

  return (
    <div className="flex h-full flex-col items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100 overflow-hidden">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Build your Taste Profile</h2>
        <p className="text-zinc-400">Would your household enjoy this?</p>
        <div className="text-xs font-mono text-purple-400 mt-2 tracking-wider">
          {Math.min(currentIndex + 1, dishes.length)} / {dishes.length}
        </div>
      </div>
      
      <div className="relative w-full max-w-sm aspect-[3/4] flex items-center justify-center perspective-1000">
        <AnimatePresence>
          {activeDish && (
            <DishCard 
              key={activeDish.id} 
              dish={activeDish} 
              onSwipe={(dir) => handleSwipe(dir === 'right')} 
            />
          )}
        </AnimatePresence>
        
        {!activeDish && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 rounded-3xl">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-4" />
            <p className="text-zinc-400 font-medium tracking-wide">Finalizing taste profile...</p>
          </div>
        )}
      </div>

      <div className="flex gap-8 mt-12">
        <Button
          size="icon"
          onClick={() => handleSwipe(false)}
          className="h-16 w-16 rounded-full bg-zinc-900 border-2 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xl"
        >
          <X className="h-8 w-8" />
        </Button>
        <Button
          size="icon"
          onClick={() => handleSwipe(true)}
          className="h-16 w-16 rounded-full bg-zinc-900 border-2 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white transition-all shadow-xl"
        >
          <Check className="h-8 w-8" />
        </Button>
      </div>

      <button
        className="mt-6 text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
        onClick={async () => {
          await apiRequest("POST", "/api/onboarding/complete");
          queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
          setLocation("/");
        }}
      >
        Skip →
      </button>
    </div>
  );
}

function DishCard({ dish, onSwipe }: { dish: Dish, onSwipe: (dir: 'left'|'right') => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);
  
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [0, -100], [0, 1]);

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(e, { offset, velocity }) => {
        const swipe = offset.x;

        if (swipe > 100) {
          onSwipe('right');
        } else if (swipe < -100) {
          onSwipe('left');
        }
      }}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0, transition: { duration: 0.2 } }}
      className="absolute w-full h-full bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing origin-bottom"
    >
      <img src={dish.imageUrl} alt={dish.dishName} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div className="absolute inset-0 border-4 border-transparent rounded-3xl pointer-events-none" />
      
      {/* Overlay indicators */}
      <motion.div 
        style={{ opacity: likeOpacity }} 
        className="absolute top-8 left-8 border-4 border-green-500 text-green-500 font-bold text-4xl px-4 py-2 rounded-xl uppercase tracking-widest rotate-[-15deg] pointer-events-none"
      >
        LIKE
      </motion.div>
      <motion.div 
        style={{ opacity: nopeOpacity }} 
        className="absolute top-8 right-8 border-4 border-red-500 text-red-500 font-bold text-4xl px-4 py-2 rounded-xl uppercase tracking-widest rotate-[15deg] pointer-events-none"
      >
        NOPE
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/90 pb-8 via-black/60 to-transparent">
        <h3 className="text-3xl font-bold text-white mb-2">{dish.dishName}</h3>
        <div className="flex gap-2 text-sm text-zinc-300 font-medium">
          <span className="capitalize px-2 py-1 bg-white/20 rounded backdrop-blur-md">{dish.cuisineType}</span>
          <span className="capitalize px-2 py-1 bg-purple-500/80 rounded backdrop-blur-md text-white">{dish.complexity}</span>
        </div>
      </div>
    </motion.div>
  );
}
