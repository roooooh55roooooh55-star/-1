
import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { Video, AppView, UserInteractions } from './types.ts';
import { fetchCloudinaryVideos } from './cloudinaryClient.ts';
import { getRecommendedFeed } from './geminiService.ts';
import AppBar from './AppBar.tsx';
import MainContent from './MainContent.tsx';
import { GoogleGenAI, Type } from "@google/genai";

const ShortsPlayerOverlay = lazy(() => import('./ShortsPlayerOverlay.tsx'));
const LongPlayerOverlay = lazy(() => import('./LongPlayerOverlay.tsx'));
const AdminDashboard = lazy(() => import('./AdminDashboard.tsx'));
const AIOracle = lazy(() => import('./AIOracle.tsx'));
const TrendPage = lazy(() => import('./TrendPage.tsx'));
const SavedPage = lazy(() => import('./SavedPage.tsx'));
const PrivacyPage = lazy(() => import('./PrivacyPage.tsx'));
const HiddenVideosPage = lazy(() => import('./HiddenVideosPage.tsx'));

const DEFAULT_CATEGORIES = [
  'رعب حقيقي ✴️', 
  'رعب الحيوانات 🔱', 
  'هجمات مرعبة ✴️', 
  'أخطر المشاهد 🔱', 
  'رعب الحديقة ⚠️', 
  'رعب كوميدي 😂 ⚠️', 
  'لحظات مرعبة'
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [rawVideos, setRawVideos] = useState<Video[]>([]); 
  const [loading, setLoading] = useState(true);
  const [selectedShort, setSelectedShort] = useState<{ video: Video, list: Video[] } | null>(null);
  const [selectedLong, setSelectedLong] = useState<{ video: Video, list: Video[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearchingAI, setIsSearchingAI] = useState(false);
  const [isTitleYellow, setIsTitleYellow] = useState(false);

  const isOverlayActive = useMemo(() => !!selectedShort || !!selectedLong, [selectedShort, selectedLong]);

  const [interactions, setInteractions] = useState<UserInteractions>(() => {
    try {
      const saved = localStorage.getItem('al-hadiqa-interactions-v5');
      return saved ? JSON.parse(saved) : { likedIds: [], dislikedIds: [], savedIds: [], watchHistory: [] };
    } catch (e) {
      return { likedIds: [], dislikedIds: [], savedIds: [], watchHistory: [] };
    }
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(async (isHardRefresh = false) => {
    if (isHardRefresh) {
      setLoading(true);
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      localStorage.removeItem('app_videos_cache');
    }

    try {
      const data = await fetchCloudinaryVideos();
      const recommendedOrder = await getRecommendedFeed(data, interactions);
      const orderedVideos = recommendedOrder
        .map(id => data.find(v => v.id === id || v.public_id === id))
        .filter((v): v is Video => !!v);

      const remaining = data.filter(v => !recommendedOrder.includes(v.id));
      setRawVideos([...orderedVideos, ...remaining]);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      if (isHardRefresh) {
        setTimeout(() => setIsTitleYellow(false), 2500);
      }
    }
  }, [interactions]);

  useEffect(() => { 
    loadData(false); 
  }, []);
  
  useEffect(() => { 
    localStorage.setItem('al-hadiqa-interactions-v5', JSON.stringify(interactions)); 
  }, [interactions]);

  const performAISearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearchingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const videoContext = rawVideos.map(v => ({ id: v.id, title: v.title, category: v.category }));
      
      const prompt = `
        لديك هذه الفيديوهات في الحديقة المرعبة: ${JSON.stringify(videoContext)}.
        المستخدم يبحث عن: "${query}".
        قم بتحليل نية البحث واختيار الفيديوهات الأكثر ملاءمة.
        أرجع فقط مصفوفة JSON تحتوي على الـ IDs المرتبة.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const matchedIds: string[] = JSON.parse(response.text || "[]");
      const results = matchedIds
        .map(id => rawVideos.find(v => v.id === id))
        .filter((v): v is Video => !!v);
      
      setSearchResults(results);
    } catch (e) {
      const basicResults = rawVideos.filter(v => 
        v.title.toLowerCase().includes(query.toLowerCase()) || 
        v.category.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(basicResults);
    } finally {
      setIsSearchingAI(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) performAISearch(searchQuery);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const updateWatchHistory = useCallback((id: string, progress: number) => {
    setInteractions(prev => {
      const history = [...prev.watchHistory];
      const index = history.findIndex(h => h.id === id);
      if (index > -1) { 
        if (progress > history[index].progress) history[index].progress = progress; 
      } else { 
        history.push({ id, progress }); 
      }
      return { ...prev, watchHistory: history };
    });
  }, []);

  const handleLikeToggle = useCallback((id: string) => {
    setInteractions(p => {
      if (p.likedIds.includes(id)) return p;
      return {
        ...p,
        likedIds: [...p.likedIds, id],
        dislikedIds: p.dislikedIds.filter(x => x !== id)
      };
    });
    showToast("أعجبك هذا الكابوس! 💀");
  }, [showToast]);

  const handleDislike = useCallback((id: string) => {
    setInteractions(p => ({
      ...p,
      dislikedIds: Array.from(new Set([...p.dislikedIds, id])),
      likedIds: p.likedIds.filter(x => x !== id)
    }));
    showToast("تم استبعاد الفيديو ⚰️");
    setSelectedShort(null);
    setSelectedLong(null);
  }, [showToast]);

  const handleSwitchLongVideo = useCallback((v: Video) => {
    setSelectedLong(prev => prev ? { ...prev, video: v } : null);
  }, []);

  const handleHardRefresh = () => {
    setIsTitleYellow(true);
    showToast("تطهير الكاش واستحضار كوابيس جديدة 🦁");
    loadData(true);
  };

  const renderContent = () => {
    switch(currentView) {
      case AppView.ADMIN:
        return <Suspense fallback={null}><AdminDashboard onClose={() => setCurrentView(AppView.HOME)} categories={DEFAULT_CATEGORIES} initialVideos={rawVideos} /></Suspense>;
      case AppView.TREND:
        return <TrendPage onPlayShort={(v, l) => setSelectedShort({video:v, list:l})} onPlayLong={(v) => setSelectedLong({video:v, list:rawVideos})} excludedIds={interactions.dislikedIds} />;
      case AppView.LIKES:
        return <SavedPage savedIds={interactions.likedIds} allVideos={rawVideos} onPlayShort={(v, l) => setSelectedShort({video:v, list:l})} onPlayLong={(v) => setSelectedLong({video:v, list:rawVideos})} title="الإعجابات" />;
      case AppView.SAVED:
        return <SavedPage savedIds={interactions.savedIds} allVideos={rawVideos} onPlayShort={(v, l) => setSelectedShort({video:v, list:l})} onPlayLong={(v) => setSelectedLong({video:v, list:rawVideos})} title="المحفوظات" />;
      case AppView.HIDDEN:
        return <HiddenVideosPage interactions={interactions} allVideos={rawVideos} onRestore={(id) => setInteractions(prev => ({...prev, dislikedIds: prev.dislikedIds.filter(x => x !== id)}))} onPlayShort={(v, l) => setSelectedShort({video:v, list:l})} onPlayLong={(v) => setSelectedLong({video:v, list:rawVideos})} />;
      case AppView.PRIVACY:
        return <PrivacyPage onOpenAdmin={() => setCurrentView(AppView.ADMIN)} />;
      default:
        return (
          <MainContent 
            videos={rawVideos} 
            categoriesList={DEFAULT_CATEGORIES} 
            interactions={interactions}
            onPlayShort={(v, l) => setSelectedShort({video:v, list:l})}
            onPlayLong={(v, l) => setSelectedLong({video:v, list:l})}
            onHardRefresh={handleHardRefresh}
            loading={loading}
            isTitleYellow={isTitleYellow}
            onShowToast={showToast}
            onSearchToggle={() => setIsSearchOpen(true)}
            isOverlayActive={isOverlayActive}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <AppBar onViewChange={setCurrentView} onRefresh={() => loadData(false)} currentView={currentView} />
      <main className="pt-20 max-w-lg mx-auto overflow-x-hidden">{renderContent()}</main>

      {isSearchOpen && (
        <div className="fixed inset-0 z-[1200] bg-black/98 backdrop-blur-3xl flex flex-col p-6 animate-in fade-in zoom-in duration-300">
           <div className="flex items-center gap-4 mb-8">
              <input 
                type="text" autoFocus placeholder="اسأل الذكاء الاصطناعي..." 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-red-600"
              />
              <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); setSearchResults([]); }} className="text-red-600 font-black">إغلاق</button>
           </div>
           
           <div className="flex-1 overflow-y-auto space-y-4">
              {isSearchingAI && <div className="flex flex-col items-center justify-center py-10 gap-3"><div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div><p className="text-[10px] text-red-600 font-black animate-pulse">Gemini يحلل المستودع...</p></div>}
              {searchResults.map(v => (
                <div key={v.id} onClick={() => { v.type === 'short' ? setSelectedShort({video:v, list:rawVideos}) : setSelectedLong({video:v, list:rawVideos}); setIsSearchOpen(false); }} className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-transparent hover:border-red-600/20 active:scale-[0.98] transition-all">
                   <div className="w-20 h-14 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10"><video src={v.video_url} className="w-full h-full object-cover opacity-60" /></div>
                   <div className="flex flex-col"><p className="text-sm font-bold text-white line-clamp-1">{v.title}</p><span className="text-[8px] text-red-500 font-black uppercase">{v.category}</span></div>
                </div>
              ))}
           </div>
        </div>
      )}

      <Suspense fallback={null}><AIOracle /></Suspense>
      {toast && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1100] bg-red-600 px-6 py-2 rounded-full font-bold shadow-lg shadow-red-600/40 text-xs">{toast}</div>}
      
      {selectedShort && (
        <Suspense fallback={null}>
          <ShortsPlayerOverlay 
            initialVideo={selectedShort.video} 
            videoList={selectedShort.list} 
            interactions={interactions} 
            onClose={() => setSelectedShort(null)} 
            onLike={handleLikeToggle} 
            onDislike={handleDislike} 
            onSave={(id) => setInteractions(p => p.savedIds.includes(id) ? p : ({...p, savedIds: [...p.savedIds, id]}))} 
            onProgress={updateWatchHistory} 
          />
        </Suspense>
      )}
      
      {selectedLong && (
        <Suspense fallback={null}>
          <LongPlayerOverlay 
            video={selectedLong.video} 
            allLongVideos={selectedLong.list} 
            onClose={() => setSelectedLong(null)} 
            onLike={() => handleLikeToggle(selectedLong.video.id)} 
            onDislike={() => handleDislike(selectedLong.video.id)} 
            onSave={() => setInteractions(p => p.savedIds.includes(selectedLong.video.id) ? p : ({...p, savedIds: [...p.savedIds, selectedLong.video.id]}))} 
            onSwitchVideo={handleSwitchLongVideo} 
            isLiked={interactions.likedIds.includes(selectedLong.video.id)} 
            isDisliked={interactions.dislikedIds.includes(selectedLong.video.id)} 
            isSaved={interactions.savedIds.includes(selectedLong.video.id)} 
            onProgress={(p) => updateWatchHistory(selectedLong.video.id, p)} 
          />
        </Suspense>
      )}
    </div>
  );
};

export default App;
