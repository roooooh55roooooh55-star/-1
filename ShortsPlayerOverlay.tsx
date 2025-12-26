
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, UserInteractions } from './types';
import { getDeterministicStats, formatBigNumber, LOGO_URL } from './MainContent';

interface ShortsPlayerOverlayProps {
  initialVideo: Video;
  videoList: Video[];
  interactions: UserInteractions;
  onClose: () => void;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onSave: (id: string) => void;
  onProgress: (id: string, progress: number) => void;
}

const ShortsPlayerOverlay: React.FC<ShortsPlayerOverlayProps> = ({ 
  initialVideo, videoList, interactions, onClose, onLike, onDislike, onSave, onProgress
}) => {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = videoList.findIndex(v => v.id === initialVideo.id);
    return idx >= 0 ? idx : 0;
  });
  
  const [isAutoPlay, setIsAutoPlay] = useState(true); 
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const [isBuffering, setIsBuffering] = useState(true);
  const [showStatusIcon, setShowStatusIcon] = useState<'play' | 'pause' | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = currentIndex * containerRef.current.clientHeight;
    }
  }, []);

  useEffect(() => {
    const vid = videoRefs.current[currentIndex];
    if (vid) {
      setIsBuffering(true);
      vid.preload = "auto";
      vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
    }
    Object.keys(videoRefs.current).forEach((key) => {
      const idx = parseInt(key);
      const otherVid = videoRefs.current[idx];
      if (otherVid && idx !== currentIndex) otherVid.pause();
    });
  }, [currentIndex]);

  const togglePlay = (idx: number) => {
    const vid = videoRefs.current[idx];
    if (!vid) return;

    if (vid.paused) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const height = e.currentTarget.clientHeight;
    if (height === 0) return;
    const index = Math.round(e.currentTarget.scrollTop / height);
    if (index !== currentIndex && index >= 0 && index < videoList.length) setCurrentIndex(index);
  };

  const playNextSmartly = useCallback(() => {
    if (videoList.length <= 1) return;
    const nextIdx = (currentIndex + 1) % videoList.length;
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: nextIdx * containerRef.current.clientHeight, behavior: 'smooth' });
    }
  }, [currentIndex, videoList]);

  return (
    <div className="fixed inset-0 bg-black z-[500] flex flex-col overflow-hidden">
      {/* زر الإغلاق العائم */}
      <div className="absolute top-12 right-6 z-[600]">
        <button onClick={onClose} className="p-4 rounded-[1.5rem] bg-black/50 backdrop-blur-2xl text-red-600 border-2 border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.5)] active:scale-75 transition-all">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div ref={containerRef} onScroll={handleScroll} className="flex-grow overflow-y-scroll snap-y snap-mandatory scrollbar-hide h-full w-full">
        {videoList.map((video, idx) => {
          const stats = getDeterministicStats(video.video_url);
          const isLiked = interactions.likedIds.includes(video.id);
          const isSaved = interactions.savedIds.includes(video.id);
          const isActive = idx === currentIndex;
          const neonColor = '#ff0000';

          return (
            <div 
              key={`${video.id}-${idx}`} 
              className="h-full w-full snap-start relative bg-black cursor-pointer"
              onClick={() => togglePlay(idx)}
            >
              {/* إطار نيون جانبي */}
              <div 
                className={`absolute inset-0 z-10 pointer-events-none transition-all duration-1000 ${isActive ? 'opacity-20 border-x-2' : 'opacity-0 border-0'}`}
                style={{ borderColor: neonColor, boxShadow: isActive ? `inset 0 0 80px ${neonColor}22` : 'none' }}
              ></div>

              <video 
                  ref={el => { videoRefs.current[idx] = el; }}
                  src={video.video_url} 
                  className={`h-full w-full object-cover transition-opacity duration-500 ${isActive && isBuffering ? 'opacity-40' : 'opacity-100'}`}
                  playsInline loop={!isAutoPlay}
                  onWaiting={() => isActive && setIsBuffering(true)}
                  onPlaying={() => {
                    if (isActive) {
                      setIsBuffering(false);
                      setShowStatusIcon('play');
                      setTimeout(() => setShowStatusIcon(null), 600);
                    }
                  }}
                  onPause={() => {
                    if (isActive) {
                      setShowStatusIcon('pause');
                      setTimeout(() => setShowStatusIcon(null), 600);
                    }
                  }}
                  onEnded={() => isAutoPlay && playNextSmartly()}
                  onTimeUpdate={(e) => isActive && onProgress(video.id, e.currentTarget.currentTime / e.currentTarget.duration)}
              />
              
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/95 pointer-events-none z-20" />

              {/* مؤشر الحالة المركزي */}
              {isActive && showStatusIcon && (
                <div className="absolute inset-0 flex items-center justify-center z-[800] pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-2xl p-8 rounded-full border border-white/20 animate-ping">
                    {showStatusIcon === 'play' ? (
                      <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    ) : (
                      <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    )}
                  </div>
                </div>
              )}

              <div className="absolute bottom-28 left-6 flex flex-col items-center gap-7 z-40">
                <button onClick={(e) => { e.stopPropagation(); onLike(video.id); }} className="flex flex-col items-center">
                  <div className={`p-4 rounded-full border-2 transition-all duration-300 ${isLiked ? 'bg-red-600 border-red-400 text-white shadow-[0_0_30px_red]' : 'bg-black/50 border-white/20 text-white backdrop-blur-2xl'}`}>
                    <svg className="w-7 h-7" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
                  </div>
                  <span className="text-[10px] font-black text-white mt-1 drop-shadow-md">{formatBigNumber(stats.likes)}</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onSave(video.id); }} className="flex flex-col items-center">
                   <div className={`p-4 rounded-full border-2 transition-all duration-300 ${isSaved ? 'bg-yellow-500 border-yellow-300 text-white shadow-[0_0_30px_yellow]' : 'bg-black/50 border-white/20 text-white backdrop-blur-2xl'}`}>
                     <svg className="w-7 h-7" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                   </div>
                   <span className="text-[10px] font-black text-white mt-1">حفظ</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDislike(video.id); }} className="flex flex-col items-center group">
                   <div className="p-4 rounded-full border-2 bg-black/50 border-white/20 text-white backdrop-blur-2xl active:bg-red-950 transition-colors">
                     <svg className="w-7 h-7 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
                   </div>
                   <span className="text-[10px] font-black text-white mt-1">استبعاد</span>
                </button>
              </div>

              <div className="absolute bottom-28 right-6 left-28 z-40 text-right">
                <div className="flex flex-col items-end gap-4">
                  <div className="backdrop-blur-2xl bg-black/60 border-2 border-red-600 px-5 py-1.5 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                    <span className="text-[11px] font-black text-white italic tracking-widest uppercase">{video.category}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 group cursor-pointer">
                    <div className="flex flex-col items-end">
                      <h3 className="text-white text-xl font-black drop-shadow-[0_2px_15px_black] leading-tight line-clamp-2">{video.title}</h3>
                      <p className="text-red-600 text-[11px] font-black italic tracking-tighter opacity-90 mt-1">@AL_HADIQA_OFFICIAL</p>
                    </div>
                    <div className="relative shrink-0 scale-110">
                      <div className="absolute inset-0 bg-red-600 rounded-full blur-xl animate-pulse opacity-40"></div>
                      <img src={LOGO_URL} className="w-14 h-14 rounded-full border-2 border-red-600 relative z-10 shadow-2xl" alt="Channel Logo" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShortsPlayerOverlay;
