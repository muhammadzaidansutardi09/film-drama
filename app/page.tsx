import Link from 'next/link';

// --- TIPE DATA (TypeScript Interface) ---
interface Movie {
  id: string;
  title: string;
  cover: string;
  label: string;
}

interface ProviderData {
  [key: string]: any; // Mengizinkan struktur data yang fleksibel dari API
}

// --- KONFIGURASI ---
const BASE_API = "https://api.sansekai.my.id/api";

// --- LOGIKA NORMALISASI DATA ---
function normalizeData(provider: string, dataSources: any[], isSearch: boolean = false): Movie[] {
  let finalList: Movie[] = [];
  const seenIds = new Set<string>();

  dataSources.forEach((source) => {
    // Cek apakah data valid
    const data = source || {}; 
    let items: Movie[] = [];

    if (provider === 'dramabox') {
      const rawItems = Array.isArray(data) ? data : (data.data || []);
      rawItems.forEach((item: any) => {
        const id = item.bookId;
        if (id) {
          items.push({
            id: String(id),
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
      if (isSearch) {
        const groups = data.data?.search_data || [];
        groups.forEach((group: any) => {
          (group.books || []).forEach((item: any) => {
            let cover = item.thumb_url || '';
            if (cover.includes('.heic')) cover = cover.replace('.heic', '.jpg');
            items.push({
              id: String(item.book_id),
              title: item.book_name,
              cover: cover,
              label: 'Melolo'
            });
          });
        });
      } else {
        (data.books || []).forEach((item: any) => {
          let cover = item.thumb_url || '';
          if (cover.includes('.heic')) cover = cover.replace('.heic', '.jpg');
          items.push({
            id: String(item.book_id),
            title: item.book_name,
            cover: cover,
            label: 'Melolo'
          });
        });
      }
    }

    // Filter Duplikat
    items.forEach(video => {
      if (!seenIds.has(video.id) && video.id) {
        seenIds.add(video.id);
        finalList.push(video);
      }
    });
  });

  // Acak jika bukan search
  if (!isSearch) {
    finalList = finalList.sort(() => Math.random() - 0.5);
  }

  return finalList;
}

// --- KOMPONEN UTAMA ---
// Definisikan tipe Props untuk halaman
type Props = {
  searchParams: Promise<{ [key: string]: string | undefined }>
}

export default async function Home(props: Props) {
  // Ambil parameter dari URL
  const searchParams = await props.searchParams;
  const currentProvider = searchParams?.provider || 'dramabox';
  const query = searchParams?.q || '';
  
  // Setup URL Endpoint (Mapping)
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
    // Mode Search
    if (searchSources[currentProvider]) {
      urlsToFetch.push(`${BASE_API}${searchSources[currentProvider]}`);
    }
  } else {
    // Mode Home
    const paths = homeSources[currentProvider] || [];
    paths.forEach(path => urlsToFetch.push(`${BASE_API}${path}`));
  }

  // Fetch Data Parallel
  const responses = await Promise.all(
    urlsToFetch.map(url => 
      fetch(url, { next: { revalidate: 60 } })
        .then(res => res.json())
        .catch(() => null)
    )
  );

  // Olah datanya
  const movies = normalizeData(currentProvider, responses, !!query);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans pb-24">
      {/* HEADER */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-white/5 shadow-lg">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-[#ff0050] to-red-700 rounded-lg flex items-center justify-center text-white font-bold text-lg">S</div>
          </Link>

          <form className="flex-1 relative">
            <input type="hidden" name="provider" value={currentProvider} />
            <input 
              type="text" 
              name="q" 
              defaultValue={query}
              placeholder={`Cari di ${currentProvider}...`}
              className="w-full bg-[#1e1e1e] border border-white/10 rounded-full py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-[#ff0050] text-gray-200 placeholder-gray-500 transition-all"
            />
            <button type="submit" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              🔍
            </button>
          </form>
        </div>
      </header>

      {/* NAVIGASI PROVIDER */}
      <nav className="fixed top-[64px] w-full z-40 bg-[#0f0f0f]/95 backdrop-blur px-2 py-3 border-b border-white/5">
        <div className="flex space-x-3 overflow-x-auto no-scrollbar px-2" style={{ scrollbarWidth: 'none' }}>
          {['dramabox', 'netshort', 'flickreels', 'moviebox', 'melolo'].map((p) => {
            const isActive = currentProvider === p;
            return (
              <Link 
                key={p}
                href={`/?provider=${p}${query ? `&q=${query}` : ''}`}
                className={`px-5 py-2 rounded-full text-xs uppercase tracking-wider transition transform duration-200 whitespace-nowrap ${
                  isActive 
                  ? 'bg-white text-black font-bold ring-2 ring-white scale-105 shadow-lg' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {p}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* KONTEN UTAMA */}
      <main className="mt-[128px] px-3 container mx-auto max-w-3xl min-h-screen">
        {query && (
          <div className="mb-4 text-sm text-gray-400">
            Hasil pencarian untuk: <span className="text-white font-bold">"{query}"</span>
            <span className="text-xs bg-[#ff0050] px-2 py-0.5 rounded ml-2 text-white">{movies.length} Ditemukan</span>
          </div>
        )}

        {movies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500 text-center px-6">
            <p>Tidak ada hasil ditemukan.</p>
            <Link href={`/?provider=${currentProvider}`} className="mt-6 text-[#ff0050] text-sm border border-[#ff0050]/50 px-6 py-2 rounded-full">
              Reset Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {movies.map((movie, index) => (
              <Link 
                key={`${movie.id}-${index}`} 
                href={`/player/${movie.id}?provider=${currentProvider}`} 
                className="group relative aspect-[3/4.5] rounded-xl overflow-hidden bg-[#1e1e1e] shadow-lg border border-white/5 block active:scale-95 transition-transform duration-200"
              >
                <img 
                  src={movie.cover} 
                  alt={movie.title}
                  className="w-full h-full object-cover transition duration-500 group-hover:scale-110 group-hover:opacity-80"
                  style={{ backgroundColor: '#222' }}
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
                
                {movie.label && (
                  <div className="absolute top-2 right-2 bg-[#ff0050]/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-sm">
                    {movie.label}
                  </div>
                )}

                <div className="absolute bottom-0 left-0 w-full p-2.5">
                  <h3 className="text-[11px] sm:text-xs font-medium text-white line-clamp-2 leading-snug drop-shadow-md">
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
