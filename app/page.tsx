import Link from 'next/link';

// --- TIPE DATA ---
interface Movie {
  id: string;
  title: string;
  cover: string;
  label: string;
}

// --- KONFIGURASI ---
const BASE_API = "https://api.sansekai.my.id/api";

// --- LOGIKA DATA (SAMA SEPERTI SEBELUMNYA) ---
function normalizeData(provider: string, dataSources: any[], isSearch: boolean = false): Movie[] {
  let finalList: Movie[] = [];
  const seenIds = new Set<string>();

  dataSources.forEach((source) => {
    const data = source || {}; 
    let items: Movie[] = [];

    if (provider === 'dramabox') {
      const rawItems = Array.isArray(data) ? data : (data.data || []);
      rawItems.forEach((item: any) => {
        if (item.bookId) {
          items.push({
            id: String(item.bookId),
            title: item.bookName || '',
            cover: item.cover || item.coverWap || '',
            label: 'Dramabox'
          });
        }
      });
    } 
    else if (provider === 'netshort') {
      const rawItems = isSearch ? (data.searchCodeSearchResult || []) : (data.contentInfos || []);
      rawItems.forEach((item: any) => {
        if (item.shortPlayId) {
          items.push({
            id: String(item.shortPlayId),
            title: item.shortPlayName || '',
            cover: item.shortPlayCover || '',
            label: 'Netshort'
          });
        }
      });
    }
    else if (provider === 'moviebox') {
      const rawItems = isSearch ? (data.items || []) : (data.subjectList || []);
      rawItems.forEach((item: any) => {
        if (item.subjectId) {
          items.push({
            id: String(item.subjectId),
            title: item.title || '',
            cover: item.cover?.url || '',
            label: item.imdbRatingValue ? `IMDB ${item.imdbRatingValue}` : 'Movie'
          });
        }
      });
    }
    else if (provider === 'flickreels') {
      const rawItems = isSearch ? (data.data || []) : (data.data?.list || []);
      rawItems.forEach((item: any) => {
        if (item.playlet_id) {
          items.push({
            id: String(item.playlet_id),
            title: item.title || '',
            cover: item.cover || '',
            label: 'Flickreels'
          });
        }
      });
    }
    else if (provider === 'melolo') {
      const processItems = (list: any[]) => {
        list.forEach((item: any) => {
          let cover = item.thumb_url || '';
          if (cover.includes('.heic')) cover = cover.replace('.heic', '.jpg');
          items.push({
            id: String(item.book_id),
            title: item.book_name,
            cover: cover,
            label: 'Melolo'
          });
        });
      };

      if (isSearch) {
        (data.data?.search_data || []).forEach((group: any) => processItems(group.books || []));
      } else {
        processItems(data.books || []);
      }
    }

    items.forEach(video => {
      if (!seenIds.has(video.id) && video.id) {
        seenIds.add(video.id);
        finalList.push(video);
      }
    });
  });

  if (!isSearch) {
    finalList = finalList.sort(() => Math.random() - 0.5);
  }

  return finalList;
}

// --- KOMPONEN UTAMA (MODERN UI) ---
type Props = {
  searchParams: Promise<{ [key: string]: string | undefined }>
}

export default async function Home(props: Props) {
  const searchParams = await props.searchParams;
  const currentProvider = searchParams?.provider || 'dramabox';
  const query = searchParams?.q || '';
  
  // Logic Fetching
  let urlsToFetch: string[] = [];
  const homeSources: Record<string, string[]> = {
    'dramabox': ['/dramabox/trending', '/dramabox/latest', '/dramabox/foryou'],
    'netshort': ['/netshort/foryou', '/netshort/theaters'],
    'moviebox': ['/moviebox/trending', '/moviebox/homepage'],
    'flickreels': ['/flickreels/foryou', '/flickreels/latest'],
    'melolo': ['/melolo/trending', '/melolo/latest']
  };
  const searchSources: Record<string, string> = {
    'dramabox': `/dramabox/search?query=${query}`,
    'netshort': `/netshort/search?query=${query}`,
    'moviebox': `/moviebox/search?query=${query}&page=1`,
    'flickreels': `/flickreels/search?query=${query}`,
    'melolo': `/melolo/search?query=${query}&limit=10`
  };

  if (query) {
    if (searchSources[currentProvider]) urlsToFetch.push(`${BASE_API}${searchSources[currentProvider]}`);
  } else {
    (homeSources[currentProvider] || []).forEach(path => urlsToFetch.push(`${BASE_API}${path}`));
  }

  const responses = await Promise.all(
    urlsToFetch.map(url => fetch(url, { next: { revalidate: 60 } }).then(res => res.json()).catch(() => null))
  );

  const movies = normalizeData(currentProvider, responses, !!query);

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans selection:bg-[#ff0050] selection:text-white">
      
      {/* HEADER GLASSMORPHISM */}
      <header className="fixed top-0 left-0 w-full z-50 bg-black/60 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-tr from-[#ff0050] to-[#b30038] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(255,0,80,0.5)] transition-transform group-hover:scale-110">
              S
            </div>
            <span className="hidden sm:block font-bold text-lg tracking-tight text-white">StreamHub</span>
          </Link>

          {/* Search Bar Modern */}
          <form className="flex-1 max-w-md relative group">
            <input type="hidden" name="provider" value={currentProvider} />
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-[#ff0050] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text" 
              name="q" 
              defaultValue={query}
              placeholder={`Cari film di ${currentProvider}...`}
              className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ff0050]/50 focus:bg-[#222] transition-all"
            />
          </form>
        </div>
      </header>

      {/* NAVIGASI PILLS (Sticky) */}
      <nav className="fixed top-[65px] w-full z-40 bg-[#050505]/80 backdrop-blur-lg border-b border-white/5 py-3">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1" style={{ scrollbarWidth: 'none' }}>
            {['dramabox', 'netshort', 'flickreels', 'moviebox', 'melolo'].map((p) => {
              const isActive = currentProvider === p;
              return (
                <Link 
                  key={p}
                  href={`/?provider=${p}${query ? `&q=${query}` : ''}`}
                  className={`px-6 py-2 rounded-full text-xs font-semibold uppercase tracking-wide transition-all duration-300 whitespace-nowrap border ${
                    isActive 
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)] transform scale-105' 
                    : 'bg-[#151515] text-gray-400 border-white/5 hover:bg-[#222] hover:text-white hover:border-white/20'
                  }`}
                >
                  {p}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* KONTEN UTAMA */}
      <main className="pt-[140px] pb-24 px-4 max-w-7xl mx-auto min-h-screen">
        
        {/* Status Pencarian */}
        {query && (
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-400 animate-fade-in">
            <span>Hasil untuk: <span className="text-white font-bold text-lg">"{query}"</span></span>
            <span className="bg-[#ff0050] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">{movies.length}</span>
          </div>
        )}

        {/* Empty State */}
        {movies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center">
            <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mb-4 text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg">Belum ada konten di sini.</p>
            <Link href={`/?provider=${currentProvider}`} className="mt-4 text-[#ff0050] hover:text-white transition-colors text-sm font-medium">
              Refresh Halaman
            </Link>
          </div>
        ) : (
          /* Grid Layout Premium */
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {movies.map((movie, index) => (
              <Link 
                key={`${movie.id}-${index}`} 
                href={`/player/${movie.id}?provider=${currentProvider}`} 
                className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-[#151515] cursor-pointer"
              >
                {/* Image Wrapper with Loading Placeholder */}
                <div className="w-full h-full relative">
                  <img 
                    src={movie.cover} 
                    alt={movie.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                       (e.target as HTMLImageElement).src = 'https://placehold.co/400x600/1a1a1a/666?text=No+Image';
                    }}
                  />
                  {/* Gradient Overlay for Text Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90"></div>
                </div>

                {/* Badge Label */}
                {movie.label && (
                  <div className="absolute top-2 right-2 bg-[#ff0050] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg z-10">
                    {movie.label}
                  </div>
                )}

                {/* Movie Info */}
                <div className="absolute bottom-0 left-0 w-full p-3 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-xs sm:text-sm font-semibold text-white line-clamp-2 leading-tight drop-shadow-md group-hover:text-[#ff0050] transition-colors">
                    {movie.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
