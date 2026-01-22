'use client'

import { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { getStreamUrl } from '@/app/actions';

// --- DEFINISI TIPE DATA ---
interface VideoData {
  id: string;
  title: string;
  episode: number;
  season: number;
  directUrl: string;
}

// --- KOMPONEN UTAMA (CONTAINER) ---
export default function TikTokPlayer({ playlist, provider }: { playlist: VideoData[], provider: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- OBSERVER UNTUK DETEKSI SCROLL ---
  useEffect(() => {
    const options = {
      root: containerRef.current,
      threshold: 0.6 // Video dianggap aktif jika 60% terlihat
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.getAttribute('data-index'));
          setActiveIndex(index);
        }
      });
    }, options);

    const slides = document.querySelectorAll('.video-slide');
    slides.forEach((slide) => observer.observe(slide));

    return () => observer.disconnect();
  }, [playlist]);

  // --- RENDER LIST VIDEO ---
  return (
    <div 
      ref={containerRef} 
      className="h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-black scroll-smooth no-scrollbar"
    >
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

// --- SUB KOMPONEN (ITEM VIDEO INDIVIDUAL) ---
function VideoItem({ data, isActive, provider, index }: { data: VideoData, isActive: boolean, provider: string, index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const hlsRef = useRef<Hls | null>(null);

  // Fungsi: Load URL Streaming dari Server
  const loadStream = useCallback(async () => {
    if (src) return; // Jangan load lagi kalau sudah ada URL
    setLoading(true);
    
    try {
      // Panggil Server Action
      const url = await getStreamUrl(provider, data.id, data.season, data.episode, data.directUrl);
      
      if (url) {
        setSrc(url);
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [provider, data, src]);

  // Efek: Handle Play/Pause dan HLS Logic
  useEffect(() => {
    // A. JIKA VIDEO SEDANG DITONTON (ACTIVE)
    if (isActive) {
      loadStream();
      
      if (videoRef.current && src) {
        // Setup HLS jika formatnya .m3u8
        if (Hls.isSupported() && src.includes('.m3u8')) {
            if (!hlsRef.current) {
                const hls = new Hls();
                hls.loadSource(src);
                hls.attachMedia(videoRef.current);
                hlsRef.current = hls;
            }
        }
        
        // Coba Play Video
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Jika browser memblokir autoplay suara, mute dulu lalu play lagi
            if (videoRef.current) {
                videoRef.current.muted = true;
                videoRef.current.play();
            }
          });
        }
      }
    } 
    // B. JIKA VIDEO DI-SCROLL LEWAT (INACTIVE)
    else {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Reset ke awal untuk hemat memori HP
      }
    }
  }, [isActive, src, loadStream]);

  // Cleanup: Hancurkan HLS saat komponen hilang (Unmount)
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
      {/* 1. TAMPILAN LOADING */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/50 backdrop-blur-sm pointer-events-none">
          <div className="w-10 h-10 border-4 border-white/20 border-l-[#ff0050] rounded-full animate-spin mb-2"></div>
          <p className="text-xs text-white font-bold tracking-widest">MEMUAT...</p>
        </div>
      )}

      {/* 2. TAMPILAN ERROR */}
      {error && (
        <div className="absolute z-20 text-center px-4">
          <p className="text-red-500 font-bold mb-2">Gagal memuat video</p>
          <button 
            onClick={() => { setError(false); setSrc(''); loadStream(); }} 
            className="bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold hover:bg-gray-200 transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 3. PLAYER VIDEO */}
      {src && (
         <video
            ref={videoRef}
            src={src.includes('.m3u8') ? undefined : src} // Jika HLS, src dihandle library
            className="w-full h-full object-contain md:object-cover"
            loop
            playsInline
            controls={false} // Sembunyikan kontrol bawaan biar rapi (seperti TikTok)
            onClick={(e) => {
                // Tap layar untuk Play/Pause
                const v = e.currentTarget;
                v.paused ? v.play() : v.pause();
            }}
         />
      )}

      {/* 4. INFO OVERLAY (JUDUL & EPISODE) */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-24 pb-10 px-4 pointer-events-none z-10">
        <div className="mb-2">
            <span className="bg-[#ff0050] px-2 py-0.5 rounded text-[10px] font-bold mb-2 inline-block shadow-sm text-white">
                EP {data.episode}
            </span>
            <h2 className="text-sm font-medium text-white drop-shadow-md line-clamp-2 leading-relaxed">
                {data.title}
            </h2>
        </div>
      </div>
      
      {/* 5. TOMBOL KEMBALI */}
      <a href="/" className="absolute top-6 left-4 z-30 bg-black/30 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/50 transition">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </a>
    </div>
  );
}
