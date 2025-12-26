
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Video, UserInteractions } from './types.ts';

export const LOGO_URL = "https://i.top4top.io/p_3643ksmii1.jpg";

// مصفوفة الألوان المخصصة للأقسام (تم تثبيت النيون الأحمر بناءً على الطلب)
export const CATEGORY_COLORS: Record<string, string> = {
  'رعب حقيقي': '#ff0000',
  'رعب الحيوانات': '#ff0000',
  'هجمات مرعبة': '#ff0000',
  'أخطر المشاهد': '#ff0000',
  'رعب الحديقة': '#ff0000',
  'رعب كوميدي': '#ff0000',
  'لحظات مرعبة': '#ff0000',
};

export const getCategoryColor = (category: string) => {
  return '#ff0000'; // توحيد النيون الأحمر بناءً على الطلب الجديد
};

export const getDeterministicStats = (seed: string) => {
  let hash = 0;
  if (!seed) return { views: 0, likes: 0 };
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const views = Math.abs(hash % 10000) + 500;
  const likes = Math.abs(Math.floor(views * 0.15 + (hash % 100)));
  return { views, likes };
};

export const formatBigNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const VideoCardThumbnail: React.FC<{ 
  video: Video, 
  isOverlayActive: boolean, 
  progress?: number, 
  showTitleOnTop?: boolean 
}> = ({ video, isOverlayActive, progress, showTitleOnTop }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const neonColor = '#ff0000';

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (isOverlayActive) {
      v.pause();
      if (observerRef.current) observerRef.current.disconnect();
      return;
    }

    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    }, { threshold: 0.1 });

    observerRef.current.observe(v);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [video.video_url, isOverlayActive]);

  return (
    <div className="w-full h-full relative bg-neutral-950 overflow-hidden group rounded-2xl shadow-2xl border border-white/5">
      <video 
        ref={videoRef}
        src={video.video_url} 
        poster={video.poster_url}
        muted loop playsInline 
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-700"
      />
      
      {/* وسم القسم الاحترافي داخل الفيديو بإطار نيون أحمر */}
      <div className="absolute top-2 right-2 z-30">
        <div className="backdrop-blur-md bg-black/40 border border-red-600 px-2 py-0.5 rounded-full">
          <span className="text-[7px] font-black text-white italic tracking-tighter whitespace-nowrap uppercase">
            {video.category}
          </span>
        </div>
      </div>
      
      {/* العنوان المدمج فوق الفيديو */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 z-20">
        <p className="text-white text-[9px] font-black line-clamp-1 italic text-right drop-shadow-lg leading-tight">{video.title}</p>
      </div>

      {progress !== undefined && progress > 0 && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 z-30">
          <div className="h-full bg-red-600 shadow-[0_0_8px_red] transition-all duration-500" style={{ width: `${progress * 100}%` }}></div>
        </div>
      )}
    </div>
  );
};

interface MainContentProps {
  videos: Video[];
  categoriesList: string[];
  interactions: UserInteractions;
  onPlayShort: (v: Video, list: Video[]) => void;
  onPlayLong: (v: Video, list: Video[]) => void;
  onHardRefresh: () => void;
  loading: boolean;
  isTitleYellow: boolean;
  onShowToast?: (msg: string) => void;
  onSearchToggle?: () => void;
  isOverlayActive: boolean;
}

const MainContent: React.FC<MainContentProps> = ({ 
  videos, categoriesList, interactions, onPlayShort, onPlayLong, onHardRefresh, loading, isTitleYellow, onSearchToggle, isOverlayActive
}) => {
  const [startY, setStartY] = useState(0);
  const [pullOffset, setPullOffset] = useState(0);

  const filteredVideos = useMemo(() => {
    const excludedIds = interactions.dislikedIds;
    return videos.filter(v => !excludedIds.includes(v.id || v.video_url));
  }, [videos, interactions.dislikedIds]);

  const shorts = useMemo(() => filteredVideos.filter(v => v.type === 'short'), [filteredVideos]);
  const longs = useMemo(() => filteredVideos.filter(v => v.type === 'long'), [filteredVideos]);

  const topShorts = useMemo(() => {
    const picked: Video[] = [];
    const shuffledCats = [...categoriesList].sort(() => Math.random() - 0.5);
    for (const cat of shuffledCats) {
      if (picked.length >= 4) break;
      const catName = cat.split(' ')[0];
      const categoryShorts = shorts.filter(s => s.category.includes(catName));
      if (categoryShorts.length > 0) {
        picked.push(categoryShorts[Math.floor(Math.random() * categoryShorts.length)]);
      }
    }
    if (picked.length < 4) {
      const remaining = shorts.filter(s => !picked.find(p => p.id === s.id));
      picked.push(...remaining.slice(0, 4 - picked.length));
    }
    return picked.slice(0, 4);
  }, [shorts, categoriesList]);

  // استخراج الفيديوهات غير المكتملة بدون تكرار
  const unwatchedData = useMemo(() => {
    const seen = new Set();
    const result: { video: Video, progress: number }[] = [];
    const history = [...interactions.watchHistory].reverse();
    
    for (const h of history) {
      if (h.progress > 0.05 && h.progress < 0.95) {
        const video = videos.find(v => v.id === h.id || v.video_url === h.id);
        if (video && !seen.has(video.id)) {
          seen.add(video.id);
          result.push({ video, progress: h.progress });
        }
      }
    }
    return result;
  }, [interactions.watchHistory, videos]);

  return (
    <div 
      onTouchStart={(e) => window.scrollY === 0 && setStartY(e.touches[0].pageY)}
      onTouchMove={(e) => startY !== 0 && (e.touches[0].pageY - startY) > 0 && (e.touches[0].pageY - startY) < 120 && setPullOffset(e.touches[0].pageY - startY)}
      onTouchEnd={() => { pullOffset > 70 && onHardRefresh(); setPullOffset(0); setStartY(0); }}
      className="flex flex-col pb-40 pt-0 px-4 w-full bg-black min-h-screen relative transition-transform duration-200"
      style={{ transform: `translateY(${pullOffset / 2}px)` }}
      dir="rtl"
    >
      <section className="flex items-center justify-between py-1 border-b border-white/5 bg-black sticky top-0 z-40">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onHardRefresh}>
          <img src={LOGO_URL} className="w-8 h-8 rounded-full border border-red-600 shadow-[0_0_10px_red]" alt="Logo" />
          <div className="flex flex-col text-right">
            <h1 className={`text-base font-black italic transition-all duration-500 ${isTitleYellow ? 'text-yellow-400 drop-shadow-[0_0_20px_#facc15]' : 'text-red-600 drop-shadow-[0_0_10px_red]'}`}>
              الحديقة المرعبة
            </h1>
            <p className="text-[5px] text-blue-400 font-black tracking-widest uppercase -mt-0.5 opacity-60">AI DISCOVERY ACTIVE</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
           <button onClick={() => window.open('https://snaptubeapp.com', '_blank')} className="w-10 h-10 rounded-xl border border-yellow-600/30 flex items-center justify-center text-yellow-600 active:scale-90 transition-all bg-yellow-600/5 shadow-[0_0_15px_rgba(202,138,4,0.2)]">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z M15.5,13.5c-0.83,0-1.5-0.67-1.5-1.5s0.67-1.5,1.5-1.5 s1.5,0.67,1.5,1.5S16.33,13.5,15.5,13.5z M8.5,13.5c-0.83,0-1.5-0.67-1.5-1.5s0.67-1.5,1.5-1.5s1.5,0.67,1.5,1.5S9.33,13.5,8.5,13.5z M12,18c-2.33,0-4.39-1.39-5.33-3.41c-0.12-0.27,0.01-0.59,0.28-0.71c0.27-0.12,0.59,0.01,0.71,0.28C8.42,15.89,10.1,17,12,17 s3.58-1.11,4.34-2.84c0.12-0.27,0.44-0.4,0.71-0.28c0.27,0.12,0.4,0.44,0.28,0.71C16.39,16.61,14.33,18,12,18z"/><path d="M12,15c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S13.1,15,12,15z" opacity=".3"/></svg>
           </button>
           <button onClick={onSearchToggle} className="w-10 h-10 rounded-xl bg-blue-500/5 border border-blue-500/30 flex items-center justify-center text-blue-500 active:scale-90 transition-all">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
           </button>
        </div>
      </section>

      {/* قسم رعشة البداية (Grid) */}
      <section className="mt-4">
        <div className="flex items-center gap-2 mb-3 px-2">
          <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_red]"></span>
          <h2 className="text-xs font-black text-red-600 uppercase tracking-[0.2em] italic">رعشة البداية</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {topShorts.map(v => (
            <div key={v.id} onClick={() => onPlayShort(v, shorts)} className="aspect-[9/16]">
              <VideoCardThumbnail video={v} isOverlayActive={isOverlayActive} />
            </div>
          ))}
        </div>
      </section>

      {/* قسم نواصل الحكاية - الآن شريط يدوياً بحجم موحد */}
      {unwatchedData.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-3 px-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-ping shadow-[0_0_10px_yellow]"></span>
            <h2 className="text-xs font-black text-yellow-500 uppercase tracking-[0.2em] italic">نواصل الحكاية</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-2 py-2">
            {unwatchedData.map(({ video, progress }) => (
              <div 
                key={video.id} 
                onClick={() => video.type === 'short' ? onPlayShort(video, shorts) : onPlayLong(video, longs)} 
                className="w-44 aspect-video shrink-0 snap-center active:scale-95 transition-transform"
              >
                <VideoCardThumbnail video={video} isOverlayActive={isOverlayActive} progress={progress} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* قسم كوابيس مختارة */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-3 px-2">
          <span className="w-2 h-2 bg-purple-600 rounded-full shadow-[0_0_8px_purple]"></span>
          <h2 className="text-xs font-black text-purple-600 uppercase tracking-[0.2em] italic">كوابيس مختارة</h2>
        </div>
        <div className="flex flex-col gap-4">
          {longs.slice(0, 4).map(video => (
            <div key={video.id} onClick={() => onPlayLong(video, longs)} className="aspect-video">
              <VideoCardThumbnail video={video} isOverlayActive={isOverlayActive} />
            </div>
          ))}
        </div>
      </section>

      {/* قسم شورتس سريعة - شريط أفقي */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-3 px-2">
          <span className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_10px_cyan] animate-pulse"></span>
          <h2 className="text-xs font-black text-cyan-500 uppercase tracking-[0.2em] italic">شورتس سريعة</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-2">
          {shorts.slice(4, 30).map(v => (
             <div key={v.id} onClick={() => onPlayShort(v, shorts)} className="w-32 aspect-[9/16] shrink-0 snap-center active:scale-95 transition-transform">
                <VideoCardThumbnail video={v} isOverlayActive={isOverlayActive} />
             </div>
          ))}
        </div>
      </section>

      {/* أقسام التصنيفات */}
      {categoriesList.map((cat, i) => {
        const catName = cat.split(' ')[0];
        const catVideos = longs.filter(v => v.category.includes(catName));
        if (catVideos.length === 0) return null;
        return (
          <section key={i} className="mt-10">
            <div className="flex items-center gap-2 mb-4 px-2 border-r-4 border-red-600">
              <h2 className="text-xs font-black text-white/90 uppercase tracking-[0.1em]">{cat}</h2>
            </div>
            <div className="flex flex-col gap-6">
              {catVideos.map(v => (
                <div key={v.id} onClick={() => onPlayLong(v, longs)} className="aspect-video">
                  <VideoCardThumbnail video={v} isOverlayActive={isOverlayActive} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {loading && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50">
           <span className="text-yellow-500 font-black text-[10px] animate-pulse bg-black/80 px-4 py-1 rounded-full border border-yellow-500/30 backdrop-blur-md shadow-[0_0_20px_#eab308]">جاري استحضار الفيديوهات...</span>
        </div>
      )}
    </div>
  );
};

export default MainContent;
