'use client'

import { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { getStreamUrl } from '@/app/actions';

interface VideoData {
  id: string;
  title: string;
  episode: number;
  season: number;
  directUrl: string;
}

export default function TikTokPlayer({ playlist, provider }: { playlist: VideoData[], provider: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- OBSERVER UNTUK DETEKSI SCROLL ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setActiveIndex(index);
          }
        });
      },
      { threshold: 0.6 } // Video dianggap aktif jika 60% terlihat
    );

    const slides = document.querySelectorAll('.video-slide');
    slides.forEach((slide) => observer.observe(slide));

    return () => observer.disconnect();
  }, [playlist]);

  // --- RENDER LOGIC ---
  return (
    <div ref={containerRef} className="h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-black scroll-smooth no-scrollbar">
      {playlist.map((video, index) => (
        <VideoItem 
          key={`${video.id}-${video.episode}`}
          data={video}
          isActive={index === activeIndex}
          provider={provider}
          index={index}
        />
      ))}
    </div>
  );
}

// --- SUB KOMPONEN PER VIDEO ---
function VideoItem({ data, isActive, provider, index }: { data: VideoData, isActive: boolean, provider: string, index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const hlsRef = useRef<Hls | null>(null);

  // Load URL saat video menjadi aktif (atau tetangga dekatnya)
  const loadStream = useCallback(async () => {
    if (src) return; // Sudah loaded
    setLoading(true);
    
    // Panggil Server Action
    const url = await getStreamUrl(provider, data.id, data.season, data.episode, data.directUrl);
    
    if (url) {
      setSrc(url);
    } else {
      setError(true);
    }
    setLoading(false);
  }, [provider, data, src]);

  // Efek Play/Pause & HLS Load
  useEffect(() => {
    if (isActive) {
      loadStream();
      // Play
      if (videoRef.current && src) {
        if (Hls.isSupported() && src.includes('.m3u8')) {
            if (!hlsRef.current) {
                const hls = new Hls();
                hls.loadSource(src);
                hls.attachMedia(videoRef.current);
                hlsRef.current = hls;
            }
        }
        videoRef.current.play().catch(() => videoRef.current!.muted = true);
      }
    } else {
      // Pause jika scroll lewat
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Reset biar hemat memori
      }
    }
  }, [isActive, src, loadStream]);

  // Cleanup HLS saat unmount
  useEffect(() => {
      return () => {
          if (hlsRef.current) {
              hlsRef.current.destroy();
              hlsRef.current = null;
          }
      }
  }, []);

  return (
    <div 
      className="video-slide relative h-screen w-full snap-start bg-black flex items-center justify-center overflow-hidden" 
      data-index={index}
    >
      {/* LOADING STATE */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/50 backdrop-blur-sm">
          <div className="w-10 h-10 border-4 border-white/20 border-l-[#ff0050] rounded-full animate-spin mb-2"></div>
          <p className="text-xs text-white font-bold tracking-widest">MEMUAT...</p>
        </div>
      )}

      {/* ERROR STATE */}
      {error && (
        <div className="absolute z-20 text-center px-4">
          <p className="text-red-500 font-bold">Gagal memuat video</p>
          <button onClick={() => { setError(false); setSrc(''); loadStream(); }} className="mt-2 bg-white text-black px-4 py-1 rounded-full text-xs">Coba Lagi</button>
        </div>
      )}

      {/* VIDEO PLAYER */}
      {src && (
         <video
            ref={videoRef}
            src={src.includes('.m3u8') ? undefined : src}
            className="w-full h-full object-contain md:object-cover"
            loop
            playsInline
            controls={false} // Hide native controls for cleaner look
            onClick={(e) => {
                const v = e.currentTarget;
                v.paused ? v.play() : v.pause();
            }}
         />
      )}

      {/* OVERLAY INFO (TikTok Style) */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-20 pb-8 px-4 pointer-events-none z-10">
        <div className="mb-4">
            <span className="bg-[#ff0050] px-2 py-0.5 rounded text-[10px] font-bold mb-2 inline-block shadow-sm text-white">
                EP {data.episode}
            </span>
            <h2 className="text-sm font-medium text-white drop-shadow-md line-clamp-2 leading-relaxed">
                {data.title}
            </h2>
        </div>
      </div>
      
      {/* Tombol Back */}
      <a href="/" className="absolute top-4 left-4 z-30 bg-black/40 backdrop-blur p-2 rounded-full text-white">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </a>
    </div>
  );
}
