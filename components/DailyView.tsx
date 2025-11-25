import React, { useState, useEffect, useCallback } from 'react';
import { DailyContent, UserState } from '../types';
import { fetchDailyWisdom } from '../services/geminiService';
import { ChevronLeft, ChevronRight, CheckCircle, Heart, BookOpen, Lightbulb } from './Icons';
// @ts-ignore
import confetti from 'canvas-confetti';

interface DailyViewProps {
  user: UserState;
  onUpdateUser: (updates: Partial<UserState>) => void;
}

// Helper to parse markdown bold (**text**) into JSX
const parseBold = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-royal-900 dark:text-gold-400">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const LOADING_MESSAGES = [
  "Abrindo o pergaminho...",
  "Lendo o texto bíblico...",
  "Consultando a sabedoria...",
  "Preparando reflexão..."
];

const DailyView: React.FC<DailyViewProps> = ({ user, onUpdateUser }) => {
  const [content, setContent] = useState<DailyContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [journalText, setJournalText] = useState('');
  const [showNextSuggestion, setShowNextSuggestion] = useState(false);

  // Cycle loading messages
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [loading]);

  // Use a cache key to avoid refetching if we already have it in memory or LS
  const loadContent = useCallback(async (day: number) => {
    setLoading(true);
    setError(null);
    setShowNextSuggestion(false);
    
    // CACHE KEY ATUALIZADA - "v22_ai_restored"
    // Força o recarregamento para usar a nova chave de API
    const cacheKey = `wisdom_day_${day}_v22_ai_restored`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Se a interpretação for o texto genérico antigo, forçamos recarregar
        if (parsed.interpretation && !parsed.interpretation.startsWith("A sabedoria de Salomão é profunda.")) {
            setContent(parsed);
            setLoading(false);
            return;
        }
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }

    try {
      const result = await fetchDailyWisdom(day);

      if (result) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
          setContent(result);
        } catch (e) {
          console.warn("Could not cache to local storage", e);
          setContent(result);
        }
      } else {
        throw new Error("Falha ao carregar texto.");
      }
    } catch (err: any) {
      console.error("Load content error:", err);
      setError("Erro inesperado. Tente recarregar a página.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent(user.currentDay);
    setJournalText(user.journalEntries[user.currentDay] || '');
  }, [user.currentDay, loadContent, user.journalEntries]);

  const handleNextDay = () => {
    if (user.currentDay < 31) {
      onUpdateUser({ currentDay: user.currentDay + 1 });
      window.scrollTo(0, 0);
    }
  };

  const handlePrevDay = () => {
    if (user.currentDay > 1) {
      onUpdateUser({ currentDay: user.currentDay - 1 });
      window.scrollTo(0, 0);
    }
  };

  const toggleComplete = () => {
    const isCompleted = user.completedDays.includes(user.currentDay);
    let newCompleted = [...user.completedDays];
    
    if (isCompleted) {
      newCompleted = newCompleted.filter(d => d !== user.currentDay);
      setShowNextSuggestion(false);
    } else {
      newCompleted.push(user.currentDay);
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.8 },
        colors: ['#fbbf24', '#1e3a8a', '#ffffff'],
        disableForReducedMotion: true
      });

      if (user.currentDay < 31) {
        setShowNextSuggestion(true);
      }
    }
    onUpdateUser({ completedDays: newCompleted });
  };

  const toggleFavorite = () => {
    const isFav = user.favorites.includes(user.currentDay);
    let newFavs = [...user.favorites];
    if (isFav) {
      newFavs = newFavs.filter(d => d !== user.currentDay);
    } else {
      newFavs.push(user.currentDay);
    }
    onUpdateUser({ favorites: newFavs });
  };

  const saveJournal = (text: string) => {
    setJournalText(text);
    onUpdateUser({
      journalEntries: {
        ...user.journalEntries,
        [user.currentDay]: text
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse px-6 text-center">
        <div className="w-16 h-16 border-4 border-gold-400 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="text-royal-900 dark:text-gold-400 font-serif text-lg font-medium">{LOADING_MESSAGES[loadingMsgIndex]}</p>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-100 dark:border-red-900/50 max-w-md w-full">
          <p className="text-red-600 dark:text-red-400 mb-4 font-medium">{error || "Erro ao carregar."}</p>
          <button 
            onClick={() => loadContent(user.currentDay)} 
            className="px-6 py-3 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-700 dark:text-red-100 rounded-lg transition font-medium w-full"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = user.completedDays.includes(user.currentDay);
  const isFavorite = user.favorites.includes(user.currentDay);

  return (
    <div className="max-w-3xl mx-auto px-4 pb-24 pt-4 fade-in">
      
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={handlePrevDay}
          disabled={user.currentDay === 1}
          className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition ${user.currentDay === 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <ChevronLeft className="text-royal-800 dark:text-gold-400" />
        </button>
        
        <span className="font-serif font-bold text-lg text-royal-900 dark:text-slate-200">
          Dia {content.day} de 31
        </span>

        <button 
          onClick={handleNextDay}
          disabled={user.currentDay === 31}
          className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition ${user.currentDay === 31 ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <ChevronRight className="text-royal-800 dark:text-gold-400" />
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        
        {/* Top Decoration */}
        <div className="h-2 bg-gradient-to-r from-royal-800 via-gold-500 to-royal-800"></div>

        <div className="p-6 md:p-8">
          
          {/* Header & Actions */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
               <div className="bg-gold-100 dark:bg-gold-900/30 p-2 rounded-lg text-gold-600 dark:text-gold-400">
                  <BookOpen size={24} />
               </div>
               <div>
                  <h2 className="text-2xl md:text-3xl font-serif font-bold text-royal-900 dark:text-white">
                    {content.scriptureReference}
                  </h2>
                  <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Versão NVI</p>
               </div>
            </div>
            <div className="flex gap-2">
               <button onClick={toggleFavorite} className="transition-transform active:scale-95 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                 <Heart 
                  className={isFavorite ? "text-red-500" : "text-slate-300 hover:text-red-400"} 
                  fill={isFavorite ? "currentColor" : "none"} 
                />
               </button>
            </div>
          </div>

          {/* Full Scripture Text (Verse by Verse) */}
          <div className="mb-10 p-6 bg-paper-light dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="space-y-4">
              {content.scriptureVerses && content.scriptureVerses.length > 0 ? (
                content.scriptureVerses.map((item) => (
                  <div key={item.verse} className="flex gap-3 items-start group">
                    <span className="text-xs font-bold text-gold-500 mt-1.5 w-6 text-right font-serif opacity-70 group-hover:opacity-100 select-none">
                      {item.verse}
                    </span>
                    <p className="flex-1 text-lg text-slate-700 dark:text-slate-300 font-serif leading-relaxed text-justify">
                      {item.text}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-center text-slate-500 italic">Texto não disponível.</p>
              )}
            </div>
          </div>
          
          <div className="w-full h-px bg-slate-200 dark:bg-slate-700 mb-10"></div>

          {/* Interpretation */}
          <div className="mb-8">
            <h3 className="text-lg font-bold font-serif text-royal-900 dark:text-slate-100 mb-3">
              Entendimento
            </h3>
            <div className="p-4 bg-royal-50 dark:bg-royal-900/20 rounded-xl border-l-4 border-royal-800 dark:border-royal-400">
               <p className="text-slate-700 dark:text-slate-300 leading-7">
                 {parseBold(content.interpretation)}
               </p>
            </div>
          </div>

          {/* Practical Steps */}
          <div className="mb-8">
            <h3 className="text-lg font-bold font-serif text-royal-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gold-100 dark:bg-gold-900 flex items-center justify-center text-gold-600 text-xs">⚡</span>
              Aplicação Prática
            </h3>
            <ul className="space-y-3">
              {content.practicalSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-royal-800 dark:bg-gold-500 flex-shrink-0"></span>
                  <span>{parseBold(step)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Historical Curiosity */}
          {content.historicalCuriosity && (
            <div className="mb-8">
               <h3 className="text-lg font-bold font-serif text-royal-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                 <Lightbulb className="text-gold-500" size={20} />
                 Curiosidade Histórica
               </h3>
               <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                 <p className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
                   "{content.historicalCuriosity}"
                 </p>
               </div>
            </div>
          )}

          {/* Reflection Area */}
          <div className="mt-8">
             <h3 className="text-lg font-bold font-serif text-royal-900 dark:text-slate-100 mb-3">
              Reflexão
            </h3>
            <p className="text-slate-600 dark:text-slate-400 italic mb-4">
              {parseBold(content.reflectionQuestion)}
            </p>
            <textarea
              value={journalText}
              onChange={(e) => saveJournal(e.target.value)}
              placeholder="Escreva seus pensamentos e orações sobre o capítulo de hoje..."
              className="w-full p-4 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none transition resize-none min-h-[150px] dark:text-white"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 dark:bg-slate-900 p-4 border-t border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-center gap-4">
          <button
            onClick={toggleComplete}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium transition-all transform active:scale-95 ${
              isCompleted 
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                : 'bg-royal-800 text-white hover:bg-royal-900 shadow-lg shadow-royal-900/20'
            }`}
          >
            {isCompleted ? (
              <>
                <CheckCircle size={20} />
                Leitura Concluída
              </>
            ) : (
              "Marcar como Lido"
            )}
          </button>
          
          {showNextSuggestion && user.currentDay < 31 && (
             <button
               onClick={handleNextDay}
               className="flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium bg-gold-100 text-gold-700 hover:bg-gold-200 dark:bg-gold-900/40 dark:text-gold-300 transition-all animate-pulse"
             >
               Ler Próximo Dia <ChevronRight size={18} />
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyView;