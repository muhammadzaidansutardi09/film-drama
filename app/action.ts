'use server'

const BASE_API = "https://api.sansekai.my.id/api";

async function fetchData(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://api.sansekai.my.id/',
      },
      next: { revalidate: 300 }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function getPlaylist(provider: string, id: string) {
  let playlist = [];
  let title = "Drama Series";

  if (provider === 'dramabox') {
    const data = await fetchData(`${BASE_API}/dramabox/allepisode?bookId=${id}`);
    const list = Array.isArray(data) ? data : (data?.data || []);
    if (list.length > 0) {
      title = "Dramabox Series";
      list.forEach((ep: any, index: number) => {
        let videoUrl = '';
        if (ep.cdnList) {
            ep.cdnList.forEach((cdn: any) => {
                if (cdn.videoPathList) {
                    const sorted = cdn.videoPathList.sort((a: any, b: any) => b.quality - a.quality);
                    videoUrl = sorted[0]?.videoPath || '';
                }
            });
        }
        playlist.push({
          id: id,
          title: ep.chapterName || `Ep ${index + 1}`,
          episode: (ep.chapterIndex || 0) + 1,
          season: 1,
          directUrl: videoUrl
        });
      });
    }
  } 
  else if (provider === 'netshort') {
    const data = await fetchData(`${BASE_API}/netshort/allepisode?shortPlayId=${id}`);
    title = data?.shortPlayName || 'Netshort';
    (data?.shortPlayEpisodeInfos || []).forEach((ep: any) => {
      playlist.push({
        id: id,
        title: `Ep ${ep.episodeNo}`,
        episode: ep.episodeNo,
        season: 1,
        directUrl: ep.playVoucher || ''
      });
    });
  }
  else if (provider === 'flickreels') {
    const data = await fetchData(`${BASE_API}/flickreels/detailAndAllEpisode?id=${id}`);
    title = data?.drama?.title || 'Flickreels';
    (data?.episodes || []).forEach((ep: any) => {
        playlist.push({
            id: id,
            title: ep.name || `Ep ${ep.index + 1}`,
            episode: ep.index + 1,
            season: 1,
            directUrl: ep.raw?.videoUrl || ''
        });
    });
  }
  else if (provider === 'moviebox') {
      const data = await fetchData(`${BASE_API}/moviebox/detail?subjectId=${id}`);
      title = data?.subject?.title || 'Moviebox';
      const subjectType = data?.subject?.subjectType || 1;
      
      if (subjectType == 1) {
          playlist.push({ id, title, episode: 1, season: 1, directUrl: '' });
      } else {
          const seasons = data?.resource?.seasons || [];
          if (seasons.length > 0) {
              seasons.forEach((s: any) => {
                  for (let i = 1; i <= (s.maxEp || 1); i++) {
                      playlist.push({ id, title: `S${s.se} E${i}`, episode: i, season: s.se, directUrl: '' });
                  }
              });
          } else {
              playlist.push({ id, title, episode: 1, season: 1, directUrl: '' });
          }
      }
  }
  else if (provider === 'melolo') {
      const data = await fetchData(`${BASE_API}/melolo/detail?book_id=${id}`);
      title = data?.book_name || 'Melolo';
      const chapters = data?.chapter_list || data?.catalog || [];
      chapters.forEach((ep: any, idx: number) => {
          playlist.push({
              id,
              title: ep.title || `Ep ${idx + 1}`,
              episode: ep.chapter_id || ep.id,
              season: 1,
              directUrl: ''
          });
      });
  }

  return { title, playlist };
}

export async function getStreamUrl(provider: string, id: string, season: number, episode: number, initialUrl: string) {
    if (initialUrl && initialUrl.startsWith('http')) return initialUrl;

    try {
        if (provider === 'moviebox') {
            const data = await fetchData(`${BASE_API}/moviebox/sources?subjectId=${id}`);
            if (data?.downloads) {
                for (const src of data.downloads) {
                    let url = src.url;
                    if (url.includes('google') || url.includes('gdrive')) {
                        const gen = await fetchData(`${BASE_API}/moviebox/generate-link-stream-video?url=${encodeURIComponent(url)}`);
                        if (gen?.streamUrl) return gen.streamUrl;
                    } else {
                        return url;
                    }
                }
            }
            if (data?.processedSources) {
                return data.processedSources[0]?.directUrl || '';
            }
        } 
        else if (provider === 'melolo') {
            const data = await fetchData(`${BASE_API}/melolo/stream?videoId=${episode}`);
            return data?.data?.main_url?.replace('http://', 'https://') || '';
        }
    } catch (e) {
        console.error("Stream Error", e);
    }
    return '';
}
