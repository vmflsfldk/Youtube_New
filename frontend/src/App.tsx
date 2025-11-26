// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Shuffle,
  Plus, Search, Library, Home, Mic2, User,
  MoreVertical, Share2, Heart, Music, Film, Scissors,
  Save, X, Clock, Wand2, Hash, Youtube, ChevronRight,
  ListFilter, BarChart2, Radio, Disc, ListMusic, MoreHorizontal,
  LayoutList, Grid, ArrowUpDown, Globe, Building2, CheckCircle2, AlertCircle,
  Maximize2, Minimize2, Signal, FileVideo, Trash2, FolderPlus, PlayCircle, ListPlus,
  LogOut // 로그아웃 아이콘
} from 'lucide-react';

// --- Lightweight Cloudflare D1-style client (in-memory) ---
// Firebase를 제거하고, Cloudflare D1 API가 준비되기 전까지 간단한 메모리 저장소로
// 동일한 인터페이스를 흉내 냅니다. 실제 배포에서는 fetch로 Worker/D1 엔드포인트를
// 호출하도록 교체하면 됩니다.
const createD1Client = () => {
  const tables = new Map();
  const ensureTable = (name) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };
  const generateId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return { tables, ensureTable, generateId };
};

const d1 = createD1Client();
const db = d1; // 기존 Firestore 시그니처를 유지하기 위한 alias

const collection = (_db, ...segments) => segments.join('/');
const doc = (_dbOrPath, ...segments) => segments.join('/');
const serverTimestamp = () => ({ toDate: () => new Date() });
const orderBy = (field) => ({ orderBy: field });
const where = (field, op, value) => ({ where: { field, op, value } });
const query = (path, ..._rest) => ({ path });

const resolveTable = (path) => {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1];
};

const onSnapshot = (q, callback) => {
  const tableName = resolveTable(q.path || q);
  const table = d1.ensureTable(tableName);
  const docs = Array.from(table.values()).map((row) => ({
    id: row.id,
    data: () => row
  }));
  callback({ docs });
  return () => {};
};

const getDocs = async (q) => {
  const tableName = resolveTable(q.path || q);
  const table = d1.ensureTable(tableName);
  const docs = Array.from(table.values()).map((row) => ({
    id: row.id,
    data: () => row
  }));
  return { docs };
};

const addDoc = async (path, data) => {
  const tableName = resolveTable(path);
  const table = d1.ensureTable(tableName);
  const id = d1.generateId();
  const record = { ...data, id };
  table.set(id, record);
  return { id };
};

const setDoc = async (docPath, data) => {
  const parts = docPath.split('/').filter(Boolean);
  const id = parts.pop();
  const tableName = parts.pop();
  const table = d1.ensureTable(tableName);
  table.set(id, { ...data, id });
};

const updateDoc = async (docPath, updates) => {
  const parts = docPath.split('/').filter(Boolean);
  const id = parts.pop();
  const tableName = parts.pop();
  const table = d1.ensureTable(tableName);
  const existing = table.get(id) || { id };
  table.set(id, { ...existing, ...updates });
};

const deleteDoc = async (docPath) => {
  const parts = docPath.split('/').filter(Boolean);
  const id = parts.pop();
  const tableName = parts.pop();
  const table = d1.ensureTable(tableName);
  table.delete(id);
};

// --- Cloudflare D1 (in-memory) bootstrap ---
// 실제 배포 시에는 Worker 엔드포인트를 호출하지만, 개발 중에는 D1 스키마와 유사한
// 테이블 구조를 메모리에서 관리합니다.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Domain Services (Simulating Spring Boot Backend Logic) ---

const formatSubscriberCount = (raw) => {
  if (raw === null || raw === undefined) return "정보 없음";
  const num = Number(raw);
  if (Number.isNaN(num)) return String(raw);
  return new Intl.NumberFormat('ko-KR', { notation: "compact", maximumFractionDigits: 1 }).format(num);
};

const fetchChannelInfo = async (channelId) => {
  const endpoint = `/api/public/youtube-channel?channelId=${encodeURIComponent(channelId)}`;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      return { success: false, error: `status_${response.status}` };
    }
    const data = await response.json();
    return {
      success: true,
      data: {
        title: data.title || "채널 정보 없음",
        description: "",
        thumbnailUrl: data.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${channelId}`,
        subscriberCount: formatSubscriberCount(data.subscriberCount)
      }
    };
  } catch (error) {
    console.error("채널 정보를 불러오지 못했습니다.", error);
    return { success: false, error: "network_error" };
  }
};

const mockCheckLiveStatus = async (artists) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const liveArtists = artists
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.random() > 0.5 ? 2 : 1)
        .map(artist => ({
          artistId: artist.id,
          artistName: artist.primaryName || artist.name,
          artistImg: artist.imageUrl,
          isLive: true,
          liveVideoId: "jfKfPfyJRdk", 
          title: `🔴 [LIVE] ${artist.primaryName || artist.name} 깜짝 라이브 방송! 소통해요 👋`,
          viewers: Math.floor(Math.random() * 50000) + 1000
        }));
      
      resolve({
        success: true,
        data: liveArtists
      });
    }, 800);
  });
};

const mockRegisterAndSuggestVideo = async (url) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      const videoId = (match && match[2].length === 11) ? match[2] : null;
      
      if (videoId) {
        const mockDescriptionChapters = [
          { start: 0, end: 45, label: "Intro", type: "chapter" },
          { start: 45, end: 180, label: "1절 (Verse 1)", type: "chapter" },
          { start: 180, end: 220, label: "하이라이트 (Chorus)", type: "chapter" }
        ];

        resolve({
          success: true,
          data: {
            youtubeId: videoId,
            title: "Simulated Fetch: 아티스트의 멋진 라이브 영상 [4K]",
            channelTitle: "Official Artist Channel",
            duration: 245, 
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            category: "Live", 
            suggestions: mockDescriptionChapters
          }
        });
      } else {
        resolve({ success: false, error: "Invalid URL" });
      }
    }, 1000); 
  });
};

const mockAnalyzeVideo = (duration) => {
  const candidates = [
    { start: 82, end: 105, label: "AI 추천: 보컬 하이라이트", score: 98, type: "ai_vocal" },
    { start: 140, end: 155, label: "AI 추천: 관객 반응 최고조", score: 92, type: "ai_reaction" },
    { start: 200, end: 220, label: "AI 추천: 댄스 브레이크", score: 85, type: "ai_visual" }
  ];
  return candidates.filter(c => c.end <= duration);
};

const buildApiHeaders = (user) => {
  const headers = { "Content-Type": "application/json" };
  // [수정] 헤더 이름을 백엔드 로직과 일치시킴 (X-Demo -> X-User)
  if (user?.email) headers["X-User-Email"] = user.email;
  if (user?.displayName) headers["X-User-Name"] = user.displayName;
  return headers;
};

// --- Mock Data ---
const MOCK_LIVE_ARTISTS = [
  { id: 'bts', name: 'BTS', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BTS' },
  { id: 'bp', name: 'BLACKPINK', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BLACKPINK' },
  { id: 'svt', name: 'SEVENTEEN', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SEVENTEEN' },
];

const INITIAL_PLAYLIST = [
  { id: 'p1', title: 'Love Poem', artist: 'IU', duration: 245 },
  { id: 'p2', title: 'Dynamite', artist: 'BTS', duration: 199 },
];

// --- Helpers ---
const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const formatViewers = (num) => {
  return new Intl.NumberFormat('ko-KR', { notation: "compact", maximumFractionDigits: 1 }).format(num);
};

// --- Main Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  
  // Selection State
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null); 
  
  // Data State
  const [artists, setArtists] = useState([]);
  const [videos, setVideos] = useState([]);
  const [clips, setClips] = useState([]);
  const [favorites, setFavorites] = useState(new Set()); 
  const [savedPlaylists, setSavedPlaylists] = useState([]); 

  // Player & Playlist State
  const [currentClip, setCurrentClip] = useState(null);
  const [playlist, setPlaylist] = useState(INITIAL_PLAYLIST); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [isLooping, setIsLooping] = useState(true);
  const [isVideoVisible, setIsVideoVisible] = useState(false); 
  
  const playerRef = useRef(null);
  const playerIntervalRef = useRef(null);

  const [isGoogleSdkReady, setIsGoogleSdkReady] = useState(false);
  const googleInitRef = useRef(false);
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const existing = document.querySelector('script[data-google-identity]');
    if (existing) {
      setIsGoogleSdkReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => setIsGoogleSdkReady(true);
    script.onerror = () => console.error('Google Identity Services SDK 로드에 실패했습니다.');
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  const ensureAuthenticated = useCallback(() => {
    if (!user) {
      alert('Google 계정으로 로그인 후 이용 가능합니다.');
      return false;
    }
    return true;
  }, [user]);

  // --- Google Login & Logout Handlers ---
  const handleGoogleLogin = async () => {
    if (!GOOGLE_CLIENT_ID) {
      alert('Google OAuth Client ID가 설정되지 않았습니다.');
      return;
    }

    if (!isGoogleSdkReady || !window.google?.accounts?.id) {
      alert('Google 로그인 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (!googleInitRef.current) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: ({ credential }) => {
          if (!credential) return;

          try {
            const payload = JSON.parse(
              atob(
                credential
                  .split('.')[1]
                  .replace(/-/g, '+')
                  .replace(/_/g, '/')
              )
            );

            setUser({
              uid: payload.sub,
              displayName: payload.name || payload.email,
              email: payload.email,
              photoURL: payload.picture,
              isAnonymous: false,
            });
          } catch (error) {
            console.error('Google ID 토큰 파싱 실패', error);
            alert('Google 로그인 중 문제가 발생했습니다. 다시 시도해주세요.');
          }
        },
        cancel_on_tap_outside: true,
      });
      googleInitRef.current = true;
    }

    window.google.accounts.id.prompt();
  };

  const handleLogout = async () => {
    if (user?.email && window.google?.accounts?.id) {
      window.google.accounts.id.revoke(user.email, () => {
        setUser(null);
        setFavorites(new Set());
        setSavedPlaylists([]);
      });
      return;
    }

    setUser(null);
    setFavorites(new Set());
    setSavedPlaylists([]);
  };

  useEffect(() => {
    if (!user) return;

    const qArtists = query(collection(db, 'artifacts', appId, 'users', user.uid, 'artists'), orderBy('createdAt', 'desc'));
    const unsubArtists = onSnapshot(qArtists, (snapshot) => setArtists(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qVideos = query(collection(db, 'artifacts', appId, 'users', user.uid, 'videos'), orderBy('createdAt', 'desc'));
    const unsubVideos = onSnapshot(qVideos, (snapshot) => setVideos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qClips = query(collection(db, 'artifacts', appId, 'users', user.uid, 'clips'), orderBy('createdAt', 'desc'));
    const unsubClips = onSnapshot(qClips, (snapshot) => setClips(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qPlaylists = query(collection(db, 'artifacts', appId, 'users', user.uid, 'playlists'), orderBy('createdAt', 'desc'));
    const unsubPlaylists = onSnapshot(qPlaylists, (snapshot) => setSavedPlaylists(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qFavs = query(collection(db, 'artifacts', appId, 'users', user.uid, 'favorite_artists'));
    const unsubFavs = onSnapshot(qFavs, (snapshot) => {
      const favSet = new Set(snapshot.docs.map(d => d.data().artistId));
      setFavorites(favSet);
    });

    return () => { unsubArtists(); unsubVideos(); unsubClips(); unsubPlaylists(); unsubFavs(); };
  }, [user]);

  // --- YouTube IFrame API Loader ---
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // --- Player Logic ---
  const loadClipToPlayer = (clip) => {
    setCurrentClip(clip);
    setIsPlaying(true);
    if (!playlist.find(p => p.id === clip.id)) {
      setPlaylist(prev => [{
        id: clip.id,
        title: clip.title,
        artist: clip.artistName || 'Unknown', 
        duration: clip.endTime - clip.startTime,
        ...clip // Store full object for restoration
      }, ...prev]);
    }
  };

  const playFullVideo = (video) => {
    const artist = artists.find(a => a.id === video.artistId);
    const fullClip = {
        id: video.id,
        videoId: video.id,
        youtubeId: video.youtubeId,
        title: video.title,
        startTime: 0,
        endTime: video.duration,
        artistName: artist ? (artist.primaryName || artist.name) : 'Unknown',
        tags: ['Full Video']
    };
    loadClipToPlayer(fullClip);
  };

  const addToQueue = (e, item, isVideo = false) => {
    e.stopPropagation();
    let newItem = { ...item };
    
    if (isVideo) {
        let artistName = item.artistName;
        if (!artistName) {
            const artist = artists.find(a => a.id === item.artistId);
            artistName = artist ? (artist.primaryName || artist.name) : 'Unknown';
        }
        
        newItem = {
            id: item.id,
            videoId: item.id,
            youtubeId: item.youtubeId,
            title: item.title,
            artist: artistName,
            duration: item.duration,
            startTime: 0,
            endTime: item.duration,
            tags: ['Video']
        };
    } else {
        const video = videos.find(v => v.id === item.videoId);
        const artist = artists.find(a => a.id === video?.artistId);
        
        newItem = {
            ...item,
            artist: artist ? (artist.primaryName || artist.name) : 'Unknown',
            duration: item.endTime - item.startTime
        };
    }
    
    setPlaylist(prev => [...prev, newItem]);
  };

  useEffect(() => {
    if (playerIntervalRef.current) clearInterval(playerIntervalRef.current);
    if (isPlaying && currentClip) {
      playerIntervalRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const currentTime = playerRef.current.getCurrentTime();
          setPlayerProgress(currentTime);
          if (currentTime >= currentClip.endTime + 0.5 && isLooping) {
             playerRef.current.seekTo(currentClip.startTime);
          }
        }
      }, 200);
    }
    return () => clearInterval(playerIntervalRef.current);
  }, [isPlaying, currentClip, isLooping]);

  const toggleFavorite = async (e, artist) => {
    e.stopPropagation();
    if (!ensureAuthenticated()) return;
    const isFav = favorites.has(artist.id);
    const favRef = collection(db, 'artifacts', appId, 'users', user.uid, 'favorite_artists');

    if (isFav) {
      const q = query(favRef, where("artistId", "==", artist.id));
      const snapshot = await getDocs(q);
      snapshot.forEach(async (d) => await deleteDoc(d.ref));
    } else {
      await addDoc(favRef, { artistId: artist.id, createdAt: serverTimestamp() });
    }
  };


  // --- Layout Components ---

  const Sidebar = () => (
    <div className="w-60 bg-[#030303] h-full flex flex-col pt-4 pb-[72px] hidden md:flex flex-shrink-0 z-20 border-r border-[#1A1A1A]">
      <div className="px-6 flex items-center gap-1 text-white font-bold text-xl cursor-pointer mb-8" onClick={() => setView('home')}>
        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
           <Play fill="white" size={14} className="ml-0.5" />
        </div>
        <span className="tracking-tighter">Music</span>
      </div>
      
      {/* Main Nav: Takes up available space */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <SidebarItem icon={<Home />} label="홈" active={view === 'home'} onClick={() => setView('home')} />
        <SidebarItem icon={<User />} label="아티스트" active={view === 'artist_list' || view === 'artist_detail'} onClick={() => setView('artist_list')} />
        <SidebarItem icon={<Disc />} label="곡 DB" active={view === 'library'} onClick={() => setView('library')} />
        <SidebarItem icon={<Radio />} label="라이브 방송" active={view === 'live'} onClick={() => setView('live')} />
        
        <div className="my-2 border-t border-[#282828] pt-2"></div>
        <SidebarItem 
            icon={<FileVideo className="text-red-500"/>} 
            label="영상/클립 등록" 
            active={view === 'register_media'} 
            onClick={() => { setSelectedArtist(null); setView('register_media'); }} 
        />
      </nav>

      {/* Google Login Section: Fixed at Bottom */}
      <div className="p-4 border-t border-[#282828] mt-auto bg-[#030303]">
        {user && !user.isAnonymous ? (
            // 로그인된 상태 (Logged In)
            <div className="flex items-center gap-3 group cursor-pointer p-2 rounded hover:bg-[#1A1A1A]">
                <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    alt="Profile" 
                    className="w-9 h-9 rounded-full bg-neutral-800 border border-[#333]" 
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user.displayName || "User"}</p>
                    <p className="text-[10px] text-[#888] truncate">{user.email}</p>
                </div>
                <button 
                    onClick={handleLogout} 
                    className="text-[#666] hover:text-red-500 p-1.5 rounded-full hover:bg-[#333] transition-colors" 
                    title="로그아웃"
                >
                    <LogOut size={16}/>
                </button>
            </div>
        ) : (
            // 비로그인 상태 (Anonymous)
            <button
                onClick={handleGoogleLogin}
                className="w-full bg-white text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#F1F1F1] transition-colors text-sm shadow-lg"
            >
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Google 계정으로 로그인</span>
            </button>
        )}
      </div>
    </div>
  );

  const SidebarItem = ({ icon, label, active, onClick }) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-5 px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-[#282828] text-white font-medium' : 'text-[#909090] hover:text-white'}`}
    >
      {React.cloneElement(icon, { size: 22 })}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  // ... (RightSidebar, ArtistCard, RegisterMediaView, HomeView, LiveBroadcastView, ArtistListView, SongDatabaseView, AddArtistView, AddVideoView, ClipEditorView, BottomPlayer components remain exactly as before) ...
  // For brevity and to follow "single file" rule, I will include them below.

  const RightSidebar = () => {
    const [activeTab, setActiveTab] = useState('queue'); // 'queue' or 'playlists'
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const saveCurrentQueue = async () => {
        if (!ensureAuthenticated()) return;
        const name = prompt("새 플레이리스트 이름을 입력하세요:");
        if (!name) return;
        
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'playlists'), {
            name,
            items: playlist,
            createdAt: serverTimestamp()
        });
        setActiveTab('playlists');
    };

    const createEmptyPlaylist = async () => {
        if (!ensureAuthenticated()) return;
        if (!newPlaylistName) return;
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'playlists'), {
            name: newPlaylistName,
            items: [],
            createdAt: serverTimestamp()
        });
        setNewPlaylistName("");
        setIsCreating(false);
    };

    const loadPlaylist = (items) => {
        setPlaylist(items || []);
        setActiveTab('queue');
    };

    const deletePlaylist = async (e, id) => {
        e.stopPropagation();
        if (!ensureAuthenticated()) return;
        if (window.confirm("정말 삭제하시겠습니까?")) {
            await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'playlists', id));
        }
    };

    const removeFromQueue = (idx) => {
        setPlaylist(prev => prev.filter((_, i) => i !== idx));
    };

    return (
        <div className="w-80 bg-[#030303] h-full hidden lg:flex flex-col border-l border-[#282828] pt-6 pb-24 z-20">
            <div className="px-6 mb-6">
                <h3 className="text-[#AAAAAA] text-sm font-bold mb-4 flex items-center gap-2">
                    <Radio size={14} className="text-red-500"/> 라이브 중인 아티스트
                </h3>
                <div className="space-y-3">
                {MOCK_LIVE_ARTISTS.slice(0, 2).map(artist => (
                    <div key={artist.id} className="flex items-center gap-3 group cursor-pointer">
                    <div className="relative">
                        <img src={artist.avatar} className="w-8 h-8 rounded-full border-2 border-red-500 p-0.5" alt={artist.name}/>
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black"></div>
                    </div>
                    <span className="text-xs font-medium text-white group-hover:underline">{artist.name}</span>
                    </div>
                ))}
                </div>
            </div>

            <div className="h-px bg-[#282828] mx-6 mb-4"></div>

            <div className="flex px-6 mb-4 gap-4">
                <button 
                    onClick={() => setActiveTab('queue')}
                    className={`text-sm font-bold pb-2 border-b-2 transition-colors ${activeTab === 'queue' ? 'text-white border-white' : 'text-[#666] border-transparent hover:text-[#AAA]'}`}
                >
                    지금 재생 중
                </button>
                <button 
                    onClick={() => setActiveTab('playlists')}
                    className={`text-sm font-bold pb-2 border-b-2 transition-colors ${activeTab === 'playlists' ? 'text-white border-white' : 'text-[#666] border-transparent hover:text-[#AAA]'}`}
                >
                    보관함
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
                {activeTab === 'queue' ? (
                    <div className="space-y-2">
                        <div className="flex gap-2 px-2 mb-4">
                            <button onClick={saveCurrentQueue} className="flex-1 bg-[#222] hover:bg-[#333] text-white text-xs py-2 rounded flex items-center justify-center gap-1">
                                <Save size={12}/> 저장
                            </button>
                            <button onClick={() => setPlaylist([])} className="flex-1 bg-[#222] hover:bg-[#333] text-[#AAAAAA] hover:text-red-500 text-xs py-2 rounded flex items-center justify-center gap-1">
                                <Trash2 size={12}/> 비우기
                            </button>
                        </div>

                        {playlist.length === 0 && (
                            <div className="text-center text-[#555] py-10 text-xs">재생목록이 비어있습니다.</div>
                        )}

                        {playlist.map((track, idx) => (
                            <div key={`${track.id}-${idx}`} className="group flex justify-between items-center p-2 rounded hover:bg-[#1A1A1A] cursor-pointer">
                                <div className="flex items-center gap-3 overflow-hidden" onClick={() => setCurrentClip(track)}>
                                    <div className="w-8 h-8 bg-[#282828] rounded flex items-center justify-center text-[#AAAAAA] flex-shrink-0 group-hover:bg-[#333]">
                                        {currentClip?.id === track.id ? <BarChart2 size={12} className="text-red-500 animate-pulse"/> : <Music size={12}/>}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-xs truncate font-medium ${currentClip?.id === track.id ? 'text-red-500' : 'text-[#E1E1E1]'}`}>{track.title}</p>
                                        <p className="text-[10px] text-[#888] truncate">{track.artist}</p>
                                    </div>
                                </div>
                                <button onClick={() => removeFromQueue(idx)} className="opacity-0 group-hover:opacity-100 text-[#666] hover:text-red-500 px-2">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2 px-2">
                        {isCreating ? (
                            <div className="bg-[#1A1A1A] p-3 rounded mb-2 border border-[#333]">
                                <input 
                                    value={newPlaylistName} 
                                    onChange={e => setNewPlaylistName(e.target.value)} 
                                    placeholder="플레이리스트 이름"
                                    className="w-full bg-black text-white text-xs px-2 py-1.5 rounded border border-[#333] mb-2 focus:border-white outline-none"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button onClick={createEmptyPlaylist} className="flex-1 bg-white text-black text-xs py-1 rounded font-bold">생성</button>
                                    <button onClick={() => setIsCreating(false)} className="flex-1 bg-[#333] text-white text-xs py-1 rounded">취소</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setIsCreating(true)} className="w-full bg-[#222] hover:bg-[#333] text-white text-xs py-2 rounded flex items-center justify-center gap-1 mb-4">
                                <Plus size={12}/> 새 플레이리스트
                            </button>
                        )}

                        {savedPlaylists.map(pl => (
                            <div key={pl.id} onClick={() => loadPlaylist(pl.items)} className="group bg-[#111] hover:bg-[#1A1A1A] p-3 rounded border border-[#222] hover:border-[#333] cursor-pointer transition-all">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="text-white text-sm font-bold truncate pr-4">{pl.name}</h4>
                                    <button onClick={(e) => deletePlaylist(e, pl.id)} className="text-[#444] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={12}/>
                                    </button>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-[#666]">
                                    <span>곡 {pl.items?.length || 0}개</span>
                                    <PlayCircle size={12} className="group-hover:text-white transition-colors"/>
                                </div>
                            </div>
                        ))}
                        {savedPlaylists.length === 0 && !isCreating && (
                            <div className="text-center text-[#555] py-10 text-xs">저장된 플레이리스트가 없습니다.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
  };

  const ArtistCard = ({ artist }) => (
    <div 
      onClick={() => { setSelectedArtist(artist); setView('artist_detail'); }}
      className="group relative bg-[#181818] hover:bg-[#282828] p-4 rounded-md cursor-pointer transition-all duration-200"
    >
      <div className="aspect-square rounded-full overflow-hidden mb-4 shadow-lg group-hover:shadow-xl transition-all relative">
        <img 
          src={artist.imageUrl} 
          alt={artist.name} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
           <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Play size={24} fill="white" className="text-white ml-1"/>
           </div>
        </div>
      </div>
      <div className="text-left">
        <h3 className="font-bold text-white text-base mb-1 truncate">{artist.primaryName || artist.name}</h3>
        <p className="text-sm text-[#AAAAAA] truncate">{artist.agency || "Agency Unknown"}</p>
      </div>
      
      <button 
        onClick={(e) => toggleFavorite(e, artist)}
        className={`absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-all ${
          favorites.has(artist.id) ? 'text-red-500' : 'text-white opacity-0 group-hover:opacity-100'
        }`}
      >
        <Heart size={18} fill={favorites.has(artist.id) ? "currentColor" : "none"} />
      </button>
    </div>
  );

  const RegisterMediaView = () => {
    const [selectedArtistId, setSelectedArtistId] = useState("");
    const [url, setUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const filteredArtists = useMemo(() => {
       if(!searchTerm) return artists;
       return artists.filter(a => (a.primaryName || a.name).toLowerCase().includes(searchTerm.toLowerCase()));
    }, [artists, searchTerm]);

    const handleRegisterAndSuggest = async () => {
         if (!ensureAuthenticated()) return;
         if (!url || !selectedArtistId) return;
         setIsLoading(true);
         const res = await mockRegisterAndSuggestVideo(url);
         
         if(res.success) {
             const newVideo = {
                 artistId: selectedArtistId, 
                 ...res.data, 
                 createdAt: serverTimestamp()
             };
             const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'videos'), newVideo);
             
             const artist = artists.find(a => a.id === selectedArtistId);
             setSelectedArtist(artist);
             setSelectedVideo({ id: docRef.id, ...newVideo }); 
             setView('clip_editor');
         } else {
             alert("URL 오류 또는 이미 등록된 영상입니다.");
         }
         setIsLoading(false);
    };

    return (
        <div className="p-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300 min-h-full">
             <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/20 rounded-full mb-4">
                    <FileVideo className="text-red-600" size={32}/>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">영상 및 클립 등록</h2>
                <p className="text-[#AAAAAA] text-sm">아티스트를 선택하고 유튜브 링크를 입력하면 AI가 하이라이트를 추천합니다.</p>
             </div>
             
             <div className="w-full max-w-2xl bg-[#181818] p-8 rounded-xl border border-[#333] shadow-2xl space-y-8">
                 <div className="space-y-3">
                    <label className="text-xs font-bold text-[#AAAAAA] uppercase flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center text-[10px]">1</span>
                        아티스트 선택
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-[#666]" size={18}/>
                        <input 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="아티스트 검색..."
                            className="w-full bg-[#0E0E0E] text-white pl-10 pr-4 py-3 rounded-t-lg border-b border-[#333] focus:outline-none"
                        />
                        <div className="max-h-40 overflow-y-auto bg-[#0E0E0E] border border-[#333] rounded-b-lg border-t-0">
                            {filteredArtists.map(artist => (
                                <div 
                                    key={artist.id}
                                    onClick={() => { setSelectedArtistId(artist.id); setSearchTerm(artist.primaryName || artist.name); }}
                                    className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-[#222] ${selectedArtistId === artist.id ? 'bg-[#222] text-red-500' : 'text-white'}`}
                                >
                                    <img src={artist.imageUrl} className="w-6 h-6 rounded-full" alt=""/>
                                    <span className="text-sm">{artist.primaryName || artist.name}</span>
                                    {selectedArtistId === artist.id && <CheckCircle2 size={14} className="ml-auto"/>}
                                </div>
                            ))}
                            {filteredArtists.length === 0 && <div className="p-3 text-xs text-[#555] text-center">검색 결과 없음</div>}
                        </div>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <label className="text-xs font-bold text-[#AAAAAA] uppercase flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center text-[10px]">2</span>
                        YouTube URL 입력
                    </label>
                    <input 
                      value={url} 
                      onChange={e => setUrl(e.target.value)} 
                      placeholder="https://www.youtube.com/watch?v=..." 
                      className="w-full bg-[#0E0E0E] text-white px-4 py-3 rounded-lg border border-[#333] focus:border-red-500 outline-none transition-colors"
                    />
                 </div>
                 <div className="pt-4">
                     <button 
                       onClick={handleRegisterAndSuggest} 
                       disabled={isLoading || !url || !selectedArtistId}
                       className="w-full bg-red-600 text-white font-bold py-4 rounded-lg hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                     >
                        {isLoading ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/> : <><Wand2 size={18}/> 분석 및 등록 시작</>}
                     </button>
                 </div>
                 <div className="bg-[#222] p-4 rounded-lg text-xs text-[#888] flex gap-2 items-start">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0"/>
                    <span>영상을 등록하면 메타데이터만 저장되며, 원본 영상은 YouTube 플레이어를 통해 재생됩니다. 저작권 정책을 준수합니다.</span>
                 </div>
             </div>
        </div>
    )
  };

  const HomeView = () => {
    const latestVideos = useMemo(() => [...videos].sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).slice(0, 8), [videos]);
    const latestClips = useMemo(() => [...clips].sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).slice(0, 8), [clips]);

    return (
    <div className="p-8 space-y-10 pb-32">
      <div className="flex gap-2 mb-4">
        <button className="px-3 py-1.5 rounded-lg bg-white text-black text-sm font-bold">홈</button>
        <button className="px-3 py-1.5 rounded-lg bg-[#282828] hover:bg-[#3E3E3E] text-white text-sm font-bold transition-colors">뮤직</button>
        <button className="px-3 py-1.5 rounded-lg bg-[#282828] hover:bg-[#3E3E3E] text-white text-sm font-bold transition-colors">팟캐스트</button>
      </div>

      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <FileVideo className="text-red-600"/> 최신 영상
          </h2>
          <button onClick={() => setView('register_media')} className="text-xs text-[#AAAAAA] hover:text-white">더보기</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {latestVideos.map(video => {
             const artist = artists.find(a => a.id === video.artistId);
             return (
              <div key={video.id} className="group cursor-pointer" onClick={() => playFullVideo(video)}>
                <div className="relative aspect-video rounded-lg overflow-hidden mb-3">
                  <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                    {formatTime(video.duration)}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-3">
                     <button 
                        onClick={(e) => addToQueue(e, video, true)}
                        className="bg-black/60 p-3 rounded-full backdrop-blur-sm hover:bg-white hover:text-black transition-all transform hover:scale-110"
                        title="대기열에 추가"
                     >
                        <ListPlus size={20}/>
                     </button>
                     <button className="bg-black/60 p-3 rounded-full backdrop-blur-sm hover:bg-white hover:text-black transition-all transform hover:scale-110">
                        <Play size={20} className="ml-1"/>
                     </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-white font-bold line-clamp-2 text-sm mb-1 leading-snug group-hover:text-red-500 transition-colors">{video.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#AAAAAA]">
                     <img src={artist?.imageUrl} className="w-4 h-4 rounded-full" alt=""/>
                     <span className="truncate">{artist?.primaryName || artist?.name || 'Unknown'}</span>
                     <span>•</span>
                     <span>{video.createdAt?.toDate ? new Date(video.createdAt.toDate()).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
             )
          })}
          {latestVideos.length === 0 && (
            <div className="col-span-full py-16 text-center text-[#555] border-2 border-dashed border-[#282828] rounded-xl bg-[#111]">
              <FileVideo size={48} className="mx-auto mb-4 opacity-30" />
              <p>등록된 최신 영상이 없습니다.</p>
              <button onClick={() => setView('register_media')} className="mt-4 text-red-500 hover:underline text-sm">첫 영상 등록하기</button>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Scissors className="text-red-600"/> 최신 클립
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {latestClips.map(clip => {
            const video = videos.find(v => v.id === clip.videoId);
            const artist = artists.find(a => a.id === video?.artistId);
            return (
              <div 
                key={clip.id} 
                onClick={() => loadClipToPlayer({ ...clip, youtubeId: video?.youtubeId, artistName: artist?.primaryName })}
                className="flex items-center gap-4 p-3 pr-4 rounded-xl bg-[#181818] hover:bg-[#282828] group cursor-pointer transition-all border border-transparent hover:border-[#333]"
              >
                <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-800 shadow-lg">
                  <img src={video?.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent">
                     <Play size={20} fill="white" className="text-white opacity-80 group-hover:opacity-100"/>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-bold text-sm truncate mb-1">{clip.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-[#AAAAAA]">
                    <span className="truncate max-w-[100px]">{artist?.primaryName || artist?.name}</span>
                    <span className="w-1 h-1 bg-neutral-600 rounded-full"></span>
                    <span className="text-red-400 flex items-center gap-1 font-mono">
                        <Clock size={10} />
                        {formatTime(clip.endTime - clip.startTime)}
                    </span>
                  </div>
                  {clip.tags && (
                      <div className="flex gap-1 mt-2">
                          {clip.tags.slice(0,2).map((t,i) => <span key={i} className="text-[10px] bg-[#333] px-1.5 py-0.5 rounded text-[#CCC]">#{t}</span>)}
                      </div>
                  )}
                </div>
                <button 
                    onClick={(e) => addToQueue(e, clip, false)}
                    className="text-[#666] hover:text-white p-2 rounded-full hover:bg-[#333] transition-colors opacity-0 group-hover:opacity-100"
                    title="대기열 추가"
                >
                    <ListPlus size={18}/>
                </button>
              </div>
            );
          })}
          {latestClips.length === 0 && (
             <div className="col-span-full py-10 text-center text-[#555]">
                생성된 클립이 없습니다. 영상을 등록하고 클립을 만들어보세요!
             </div>
          )}
        </div>
      </section>
    </div>
    );
  };

  const LiveBroadcastView = () => {
    const [liveStreams, setLiveStreams] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const fetchLive = async () => {
        setIsLoading(true);
        const res = await mockCheckLiveStatus(artists);
        if (res.success) {
          setLiveStreams(res.data);
        }
        setIsLoading(false);
      };
      
      if (artists.length > 0) {
        fetchLive();
      } else {
        setIsLoading(false);
      }
    }, [artists]);

    return (
      <div className="p-8 pb-32 min-h-full bg-[#030303] text-white animate-in fade-in duration-300">
        <h2 className="text-3xl font-black tracking-tight flex items-center gap-3 mb-8">
            <Radio size={32} className="text-red-600 animate-pulse"/> 라이브 방송
            <span className="text-sm font-normal text-[#666] mt-2">등록된 아티스트의 실시간 방송을 확인하세요.</span>
        </h2>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#555]">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-4"/>
            <p>방송 상태 확인 중...</p>
          </div>
        ) : liveStreams.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {liveStreams.map((stream, idx) => (
              <div key={idx} className="bg-[#181818] rounded-xl overflow-hidden border border-[#333] shadow-2xl">
                 <div className="aspect-video w-full bg-black">
                    <iframe 
                      width="100%" 
                      height="100%" 
                      src={`https://www.youtube.com/embed/${stream.liveVideoId}?autoplay=0&controls=1`} 
                      title={stream.title}
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    ></iframe>
                 </div>
                 <div className="p-5">
                    <div className="flex items-start gap-4">
                       <div className="relative">
                          <img src={stream.artistImg} className="w-12 h-12 rounded-full border-2 border-red-600 p-0.5" alt=""/>
                          <div className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#181818]">LIVE</div>
                       </div>
                       <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-lg leading-snug mb-1 line-clamp-1">{stream.title}</h3>
                          <p className="text-[#AAAAAA] text-sm mb-3">{stream.artistName}</p>
                          <div className="flex items-center gap-4 text-xs font-medium text-red-500">
                             <span className="flex items-center gap-1"><User size={12}/> {formatViewers(stream.viewers)}명 시청 중</span>
                             <span className="flex items-center gap-1"><Signal size={12}/> 실시간 스트리밍</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-[#555] border-2 border-dashed border-[#222] rounded-xl">
            <Radio size={48} className="mb-4 opacity-50"/>
            <p className="text-lg font-bold text-[#888] mb-2">현재 방송 중인 아티스트가 없습니다.</p>
            <p className="text-sm">알림을 켜두면 방송 시작 시 알려드릴게요!</p>
          </div>
        )}
      </div>
    );
  };

  const ArtistListView = () => {
    const [groupMode, setGroupMode] = useState('all'); 
    const [searchTerm, setSearchTerm] = useState("");

    const groupedData = useMemo(() => {
        let filtered = artists;
        if (searchTerm) {
            filtered = artists.filter(a => (a.name || "").toLowerCase().includes(searchTerm.toLowerCase()));
        }

        if (groupMode === 'all') return { '전체 아티스트': filtered };

        const groups = {};
        filtered.forEach(artist => {
            let key = '기타 (Etc)';
            if (groupMode === 'agency' && artist.agency) key = artist.agency;
            if (groupMode === 'country' && artist.country) key = artist.country;
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(artist);
        });

        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key];
            return acc;
        }, {});
    }, [artists, groupMode, searchTerm]);

    return (
        <div className="p-8 pb-32 min-h-full bg-[#030303] text-white animate-in fade-in duration-300">
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <User size={32} className="text-red-600"/> 아티스트 라이브러리
                    </h2>
                    
                    <button 
                        onClick={() => setView('add_artist')}
                        className="text-sm font-medium text-white bg-[#282828] hover:bg-[#3E3E3E] px-4 py-2 rounded-full flex items-center gap-2 transition-colors"
                    >
                        <Plus size={16} /> 새 아티스트 등록
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-[#212121] p-1 rounded-lg flex items-center">
                        <button onClick={() => setGroupMode('all')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${groupMode === 'all' ? 'bg-[#333] text-white shadow-sm' : 'text-[#AAAAAA] hover:text-white'}`}><Grid size={16}/> 전체</button>
                        <button onClick={() => setGroupMode('agency')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${groupMode === 'agency' ? 'bg-[#333] text-white shadow-sm' : 'text-[#AAAAAA] hover:text-white'}`}><Building2 size={16}/> 소속사별</button>
                        <button onClick={() => setGroupMode('country')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${groupMode === 'country' ? 'bg-[#333] text-white shadow-sm' : 'text-[#AAAAAA] hover:text-white'}`}><Globe size={16}/> 국가별</button>
                    </div>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" size={16}/>
                        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="아티스트 검색..." className="w-full bg-[#181818] border border-[#333] text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-white transition-colors text-sm"/>
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {Object.entries(groupedData).map(([groupName, groupArtists]) => (
                    <div key={groupName}>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-[#282828] pb-2">
                            {groupName} <span className="text-[#666] text-sm font-normal">({groupArtists.length})</span>
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {groupArtists.map(artist => <ArtistCard key={artist.id} artist={artist} />)}
                        </div>
                    </div>
                ))}
                {artists.length === 0 && <div className="text-center py-20 text-[#555]">등록된 아티스트가 없습니다.</div>}
            </div>
        </div>
    );
  };

  const SongDatabaseView = () => {
    const [dbMode, setDbMode] = useState('by_artist');
    const [searchTerm, setSearchTerm] = useState("");

    const enrichedVideos = useMemo(() => {
      return videos.map(video => {
        const artist = artists.find(a => a.id === video.artistId);
        return {
          ...video,
          artistName: artist ? (artist.primaryName || artist.name) : "Unknown Artist",
          artistImg: artist ? artist.imageUrl : null
        };
      });
    }, [videos, artists]);

    const groupedByArtist = useMemo(() => {
      const groups = {};
      enrichedVideos.forEach(v => {
        if (!groups[v.artistName]) groups[v.artistName] = [];
        groups[v.artistName].push(v);
      });
      return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [enrichedVideos]);

    const groupedBySong = useMemo(() => {
      const groups = {};
      enrichedVideos.forEach(v => {
        const key = v.title; 
        if (!groups[key]) groups[key] = [];
        groups[key].push(v);
      });
      return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [enrichedVideos]);

    const filterData = (data, isArtistMode) => {
        if(!searchTerm) return data;
        const lowerTerm = searchTerm.toLowerCase();
        return data.filter(([key, items]) => {
            if(key.toLowerCase().includes(lowerTerm)) return true; 
            return items.some(item => 
               (isArtistMode ? item.title : item.artistName).toLowerCase().includes(lowerTerm)
            );
        });
    };

    const filteredArtistGroups = filterData(groupedByArtist, true);
    const filteredSongGroups = filterData(groupedBySong, false);

    return (
      <div className="p-8 pb-32 min-h-full bg-[#030303] text-white animate-in fade-in duration-300">
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black tracking-tight flex items-center gap-3"><Disc size={32} className="text-red-600"/> 곡 데이터베이스</h2>
            <div className="bg-[#212121] p-1 rounded-lg flex items-center">
               <button onClick={() => setDbMode('by_artist')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${dbMode === 'by_artist' ? 'bg-[#333] text-white shadow-sm' : 'text-[#AAAAAA] hover:text-white'}`}>아티스트별 보기</button>
               <button onClick={() => setDbMode('by_song')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${dbMode === 'by_song' ? 'bg-[#333] text-white shadow-sm' : 'text-[#AAAAAA] hover:text-white'}`}>곡명별 보기</button>
            </div>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" size={18}/>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={dbMode === 'by_artist' ? "아티스트 또는 곡 검색..." : "곡 제목 또는 아티스트 검색..."} className="w-full bg-[#181818] border border-[#333] text-white pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-white transition-colors placeholder-[#666]"/>
          </div>
        </div>
        <div className="w-full overflow-hidden rounded-xl border border-[#333] bg-[#0E0E0E]">
           <div className="grid grid-cols-12 bg-[#1F1F1F] p-4 text-xs font-bold text-[#AAAAAA] uppercase tracking-wider border-b border-[#333]">
              <div className="col-span-5">{dbMode === 'by_artist' ? '아티스트 / 곡' : '곡 제목 / 아티스트'}</div>
              <div className="col-span-4">앨범/채널</div>
              <div className="col-span-2 text-right">길이</div>
              <div className="col-span-1 text-center">액션</div>
           </div>
           <div className="divide-y divide-[#222]">
             {(dbMode === 'by_artist' ? filteredArtistGroups : filteredSongGroups).map(([groupKey, items]) => (
                <div key={groupKey} className="group bg-[#0E0E0E]">
                   <div className="p-4 bg-[#141414] hover:bg-[#1A1A1A] transition-colors flex items-center gap-3 sticky top-0 z-10">
                      <div className="w-8 h-8 rounded bg-[#333] flex items-center justify-center text-[#AAAAAA]">{dbMode === 'by_artist' ? <User size={16}/> : <Music size={16}/>}</div>
                      <span className="font-bold text-lg text-white">{groupKey}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#333] text-[#AAAAAA]">{items.length}개</span>
                   </div>
                   <div className="bg-[#050505]">
                      {items.map((video) => (
                        <div key={video.id} className="grid grid-cols-12 p-3 hover:bg-[#1A1A1A] items-center text-sm transition-colors border-b border-[#1A1A1A] last:border-0">
                           <div className="col-span-5 flex items-center gap-4 pl-8">
                              <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-[#333]">
                                 <img src={video.thumbnailUrl} className="w-full h-full object-cover opacity-80" alt=""/>
                                 <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Play size={14} className="fill-white text-white opacity-0 group-hover:opacity-100"/></div>
                              </div>
                              <div className="min-w-0">
                                 <div className="text-white font-medium truncate">{video.title}</div>
                                 <div className="text-[#666] text-xs truncate">{dbMode === 'by_artist' ? 'YouTube' : video.artistName}</div>
                              </div>
                           </div>
                           <div className="col-span-4 text-[#AAAAAA] truncate pr-4">{video.channelTitle}</div>
                           <div className="col-span-2 text-right text-[#AAAAAA] font-mono">{formatTime(video.duration)}</div>
                           <div className="col-span-1 flex justify-center gap-2">
                              <button onClick={(e) => addToQueue(e, video, true)} className="p-1.5 hover:bg-[#333] rounded text-[#AAAAAA] hover:text-white" title="대기열에 추가"><ListPlus size={14} /></button>
                              <button onClick={() => { setSelectedArtist({ id: video.artistId, name: video.artistName }); setSelectedVideo(video); setView('clip_editor'); }} className="p-1.5 hover:bg-[#333] rounded text-[#AAAAAA] hover:text-white" title="클립 만들기"><Scissors size={14} /></button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             ))}
           </div>
        </div>
      </div>
    );
  };
  const AddArtistView = () => {
      const [step, setStep] = useState(1);
      const [channelId, setChannelId] = useState("");
      const [isLoading, setIsLoading] = useState(false);
      const [fetchedInfo, setFetchedInfo] = useState(null);
      
      // DB 필드에 맞춘 상태 관리
      const [names, setNames] = useState({ ko: "", en: "", ja: "" });
      const [agency, setAgency] = useState("");
      const [tags, setTags] = useState("");
      const [countries, setCountries] = useState({
          kr: false,
          en: false,
          jp: false
      });

      const handleFetch = async () => {
         if (!channelId) return;
         setIsLoading(true);
         const res = await fetchChannelInfo(channelId);
         setIsLoading(false);
         if (res.success) {
            setFetchedInfo(res.data);
            // 채널 제목을 기본적으로 한국어 이름으로 설정 (필요시 변경 가능)
            setNames(prev => ({ ...prev, ko: res.data.title }));
            setStep(2);
         } else {
            alert("채널을 찾을 수 없습니다.");
         }
      };

      const toggleCountry = (code) => {
          setCountries(prev => ({ ...prev, [code]: !prev[code] }));
      };

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!ensureAuthenticated()) return;
        const primaryName = names.ko || names.en || names.ja || fetchedInfo.title;
        
        // DB 스키마 및 ArtistRequest DTO에 맞춘 데이터 구조
        const newArtist = {
            youtubeChannelId: channelId,
            name: primaryName,
            primaryName, // UI용 (필요시)
            names, // 다국어 이름 객체 (API 요청 시 풀어서 보냄)
            nameKo: names.ko,
            nameEn: names.en,
            nameJp: names.ja,
            agency: agency, // 소속사
            availableKo: countries.kr, // 활동 국가 플래그
            availableEn: countries.en,
            availableJp: countries.jp,
            tags: tags.split(',').map(t => t.trim()).filter(t => t), // 태그 배열 변환
            imageUrl: fetchedInfo.thumbnailUrl,
            subscriberCount: fetchedInfo.subscriberCount,
            createdAt: serverTimestamp()
        };

        // Firestore(또는 D1 Mock)에 저장
        const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'artists'), newArtist);

        // Cloudflare Worker API에도 즉시 반영
        try {
          const apiResponse = await fetch('/api/artists', {
            method: 'POST',
            headers: buildApiHeaders(user),
            body: JSON.stringify({
              name: primaryName,
              displayName: names.ko || primaryName,
              youtubeChannelId: channelId,
              availableKo: countries.kr,
              availableEn: countries.en,
              availableJp: countries.jp,
              agency: agency || null,
              tags: tags.split(',').map(t => t.trim()).filter(Boolean)
            })
          });
          if (apiResponse.ok) {
            const payload = await apiResponse.json();
            await updateDoc(doc(collection(db, 'artifacts', appId, 'users', user.uid, 'artists'), docRef.id), {
              d1Id: payload.id
            });
          } else {
            console.warn('API artist sync failed', await apiResponse.text());
          }
        } catch (error) {
          console.error('API artist sync error', error);
        }
        
        // 폼 초기화 및 이동
        setStep(1);
        setChannelId("");
        setFetchedInfo(null);
        setNames({ ko: "", en: "", ja: "" });
        setAgency("");
        setTags("");
        setCountries({ kr: false, en: false, jp: false });
        
        setView('artist_list');
      };

      return (
          <div className="p-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
             <h2 className="text-2xl font-bold text-white mb-2">아티스트 등록</h2>
             <p className="text-[#AAAAAA] text-sm mb-8">YouTube 채널 ID로 아티스트 정보를 자동으로 가져옵니다.</p>
             
             {step === 1 && (
                <div className="w-full max-w-md space-y-4">
                    <div className="relative">
                       <Search className="absolute left-3 top-3.5 text-[#AAAAAA]" size={18}/>
                       <input 
                            value={channelId} 
                            onChange={e => setChannelId(e.target.value)} 
                            placeholder="YouTube Channel ID (e.g. UC...)" 
                            className="bg-[#181818] text-white pl-10 pr-4 py-3 rounded-lg w-full border border-[#333] focus:border-red-500 outline-none transition-colors"
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button onClick={() => setView('artist_list')} className="flex-1 py-3 text-[#AAAAAA] hover:text-white">취소</button>
                        <button onClick={handleFetch} disabled={isLoading || !channelId} className="flex-1 bg-white text-black font-bold rounded-lg hover:bg-[#F1F1F1] disabled:opacity-50 flex items-center justify-center gap-2">
                            {isLoading ? "검색 중..." : "채널 검색"}
                        </button>
                    </div>
                </div>
             )}

             {step === 2 && fetchedInfo && (
                <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6 bg-[#181818] p-6 rounded-xl border border-[#333]">
                    <div className="flex items-center gap-4 pb-4 border-b border-[#333]">
                        <img src={fetchedInfo.thumbnailUrl} className="w-16 h-16 rounded-full" alt=""/>
                        <div>
                            <h3 className="text-white font-bold">{fetchedInfo.title}</h3>
                            <p className="text-xs text-[#AAAAAA]">{fetchedInfo.subscriberCount} Subscribers</p>
                        </div>
                        <CheckCircle2 className="text-green-500 ml-auto" />
                    </div>

                    {/* 활동 국가 체크박스 */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#AAAAAA]">활동 국가 (다중 선택 가능)</label>
                        <div className="flex gap-4">
                            {['KR', 'EN', 'JP'].map((code) => (
                                <label key={code} className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={countries[code.toLowerCase()]} 
                                        onChange={() => toggleCountry(code.toLowerCase())}
                                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 bg-[#0E0E0E]"
                                    />
                                    <span className="text-sm text-white">{code}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 다국어 이름 입력 */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-[#AAAAAA]">다국어 이름 설정</label>
                        <input value={names.ko} onChange={e => setNames({...names, ko: e.target.value})} placeholder="한국어 이름" className="bg-[#0E0E0E] text-white px-3 py-2 rounded w-full border border-[#333] text-sm focus:border-white outline-none"/>
                        <input value={names.en} onChange={e => setNames({...names, en: e.target.value})} placeholder="English Name" className="bg-[#0E0E0E] text-white px-3 py-2 rounded w-full border border-[#333] text-sm focus:border-white outline-none"/>
                        <input value={names.ja} onChange={e => setNames({...names, ja: e.target.value})} placeholder="日本語の名前" className="bg-[#0E0E0E] text-white px-3 py-2 rounded w-full border border-[#333] text-sm focus:border-white outline-none"/>
                    </div>

                    {/* 소속사 입력 */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#AAAAAA]">소속사</label>
                        <input 
                            value={agency} 
                            onChange={e => setAgency(e.target.value)} 
                            placeholder="소속사 입력" 
                            className="bg-[#0E0E0E] text-white px-3 py-2 rounded w-full border border-[#333] text-sm focus:border-white outline-none"
                        />
                    </div>

                    {/* 태그 입력 */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#AAAAAA]">태그 (쉼표 구분)</label>
                        <input 
                            value={tags} 
                            onChange={e => setTags(e.target.value)} 
                            placeholder="K-POP, Boy Group, ..." 
                            className="bg-[#0E0E0E] text-white px-3 py-2 rounded w-full border border-[#333] text-sm focus:border-white outline-none"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 text-[#AAAAAA] hover:text-white">뒤로</button>
                        <button type="submit" className="flex-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">등록 완료</button>
                    </div>
                </form>
             )}
          </div>
      )
  };
  const AddVideoView = () => {
    const [url, setUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const handleRegisterAndSuggest = async () => {
         if (!ensureAuthenticated()) return;
         if (!url) return;
         setIsLoading(true);
         const res = await mockRegisterAndSuggestVideo(url);
         if(res.success) {
             const newVideo = { artistId: selectedArtist.id, ...res.data, createdAt: serverTimestamp() };
             const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'videos'), newVideo);
             let apiVideoId = null;
             try {
               const artistIdForApi = Number(selectedArtist?.d1Id ?? selectedArtist?.id);
               if (Number.isFinite(artistIdForApi)) {
                 const apiResponse = await fetch('/api/videos', {
                   method: 'POST',
                   headers: buildApiHeaders(user),
                   body: JSON.stringify({
                     artistId: artistIdForApi,
                     videoUrl: url,
                     category: res.data.category?.toLowerCase?.()
                   })
                 });
                 if (apiResponse.ok) {
                   const payload = await apiResponse.json();
                   apiVideoId = payload.id;
                   await updateDoc(doc(collection(db, 'artifacts', appId, 'users', user.uid, 'videos'), docRef.id), {
                     d1Id: apiVideoId
                   });
                 } else {
                   console.warn('API video sync failed', await apiResponse.text());
                 }
               } else {
                 console.warn('API video sync skipped: missing artist D1 id');
               }
             } catch (error) {
               console.error('API video sync error', error);
             }

             const selectedVideoRecord = {
               id: apiVideoId ?? docRef.id,
               d1Id: apiVideoId ?? null,
               ...newVideo,
             };
             setSelectedVideo(selectedVideoRecord);
             setView('clip_editor');
         } else { alert("URL 오류 또는 이미 등록된 영상입니다."); }
         setIsLoading(false);
    };
    return (
        <div className="p-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
             <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold text-white mb-2">영상 등록 및 분석</h2>
                <p className="text-[#AAAAAA] text-sm">영상을 등록하면 AI가 자동으로 클립 후보를 제안합니다.</p>
             </div>
             <div className="w-full max-w-md bg-[#181818] p-8 rounded-xl border border-[#333] shadow-2xl">
                 <div className="mb-6">
                    <label className="text-xs font-bold text-[#AAAAAA] mb-2 block uppercase">Video URL</label>
                    <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="bg-[#0E0E0E] text-white px-4 py-3 rounded-lg w-full border border-[#333] focus:border-red-500 outline-none transition-colors"/>
                 </div>
                 <div className="space-y-3">
                     <button onClick={handleRegisterAndSuggest} disabled={isLoading || !url} className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-[#F1F1F1] disabled:opacity-50 flex items-center justify-center gap-2">
                        {isLoading ? <span className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full"/> : <><Wand2 size={16}/> 등록 및 분석 시작</>}
                     </button>
                     <button onClick={() => setView('artist_detail')} className="w-full py-3 text-[#AAAAAA] hover:text-white text-sm">취소</button>
                 </div>
                 <div className="mt-6 pt-6 border-t border-[#333] text-xs text-[#555] flex gap-2">
                    <AlertCircle size={14} /> <span>영상 설명란의 타임스탬프와 자막 데이터를 분석하여 하이라이트 구간을 자동으로 추출합니다.</span>
                 </div>
             </div>
        </div>
    )
  }
  const ClipEditorView = () => {
    const [editorPlayer, setEditorPlayer] = useState(null);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(15);
    const [duration, setDuration] = useState(0);
    const [clipTitle, setClipTitle] = useState("");
    const [tags, setTags] = useState("");
    const [recommendations, setRecommendations] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
      if (!window.YT || !selectedVideo) return;
      if (selectedVideo.suggestions) { setRecommendations(prev => [...prev, ...selectedVideo.suggestions]); }
      const newPlayer = new window.YT.Player('editor-player', {
        height: '100%', width: '100%', videoId: selectedVideo.youtubeId,
        playerVars: { 'autoplay': 1, 'controls': 1 },
        events: {
          'onReady': (event) => { setEditorPlayer(event.target); const d = event.target.getDuration(); setDuration(d); setEndTime(Math.min(d, 15)); }
        }
      });
      return () => { if(newPlayer.destroy) newPlayer.destroy(); }
    }, [selectedVideo]);

    const runAutoRecommendation = () => {
      setIsAnalyzing(true);
      setTimeout(() => {
        const recs = mockAnalyzeVideo(duration);
        setRecommendations(prev => {
            const combined = [...prev, ...recs];
            return combined.filter((v,i,a)=>a.findIndex(t=>(t.start === v.start))===i);
        });
        setIsAnalyzing(false);
      }, 1500);
    };

    const saveClip = async () => {
      if (!ensureAuthenticated()) return;
      if (!clipTitle) return alert("제목을 입력해주세요.");
      if (startTime >= endTime) return alert("종료 시간은 시작 시간보다 뒤여야 합니다.");
      const isDuplicate = clips.some(c => c.videoId === selectedVideo.id && Math.abs(c.startTime - startTime) < 1 && Math.abs(c.endTime - endTime) < 1);
      if (isDuplicate) return alert("이미 동일한 구간의 클립이 존재합니다.");
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'clips'), {
        videoId: selectedVideo.id, youtubeId: selectedVideo.youtubeId, title: clipTitle, startTime, endTime, tags: tagArray, createdAt: serverTimestamp()
      });
      try {
        const videoD1Id = Number(selectedVideo?.d1Id ?? selectedVideo?.id);
        if (Number.isFinite(videoD1Id)) {
          const apiResponse = await fetch('/api/clips', {
            method: 'POST',
            headers: buildApiHeaders(user),
            body: JSON.stringify({
              videoId: videoD1Id,
              title: clipTitle,
              startSec: startTime,
              endSec: endTime,
              tags: tagArray
            })
          });
          if (apiResponse.ok) {
            const payload = await apiResponse.json();
            await updateDoc(doc(collection(db, 'artifacts', appId, 'users', user.uid, 'clips'), docRef.id), {
              d1Id: payload.id
            });
          } else {
            console.warn('API clip sync failed', await apiResponse.text());
          }
        } else {
          console.warn('API clip sync skipped: missing video D1 id');
        }
      } catch (error) {
        console.error('API clip sync error', error);
      }
      alert("클립이 저장되었습니다."); setView('artist_detail');
    };

    return (
      <div className="h-full flex flex-col p-6 bg-[#030303]">
        <div className="flex items-center gap-4 mb-6 text-[#AAAAAA]">
          <button onClick={() => setView('artist_detail')} className="hover:text-white"><SkipBack/></button>
          <span className="text-white font-bold text-lg">클립 에디터</span>
          <span className="text-sm">/</span>
          <span className="text-sm truncate max-w-md">{selectedVideo.title}</span>
        </div>
        <div className="flex-1 flex gap-8 min-h-0">
          <div className="flex-1 flex flex-col gap-4">
             <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-[#282828]"><div id="editor-player"></div></div>
             <div className="bg-[#181818] p-4 rounded-lg border border-[#282828]">
                <div className="flex justify-between text-xs text-[#AAAAAA] mb-2 font-mono"><span>{formatTime(startTime)}</span><span>{formatTime(endTime)}</span></div>
                <div className="relative h-1.5 bg-[#333] rounded-full mb-4"><div className="absolute h-full bg-red-600 rounded-full" style={{ left: `${(startTime / duration) * 100}%`, width: `${((endTime - startTime) / duration) * 100}%` }} /></div>
                <div className="flex justify-center gap-4">
                   <button onClick={() => setStartTime(editorPlayer?.getCurrentTime() || 0)} className="px-4 py-2 bg-[#282828] hover:bg-[#3E3E3E] rounded text-xs text-white font-bold">시작점 설정 ([)</button>
                   <button onClick={() => setEndTime(editorPlayer?.getCurrentTime() || 0)} className="px-4 py-2 bg-[#282828] hover:bg-[#3E3E3E] rounded text-xs text-white font-bold">종료점 설정 (])</button>
                </div>
             </div>
          </div>
          <div className="w-80 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
             <div className="bg-[#181818] p-4 rounded-lg border border-[#282828]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2"><Wand2 size={14}/> AI 추천 & 챕터</h3>
                  <button onClick={runAutoRecommendation} disabled={isAnalyzing} className="text-xs text-purple-400 hover:text-purple-300">{isAnalyzing ? "분석중..." : "AI 정밀분석 실행"}</button>
                </div>
                <div className="space-y-2">
                   {recommendations.map((rec, i) => (
                      <div key={i} onClick={() => { setStartTime(rec.start); setEndTime(rec.end); editorPlayer?.seekTo(rec.start); }} className="p-2 hover:bg-[#282828] rounded cursor-pointer text-xs text-[#AAAAAA] flex justify-between items-center border border-transparent hover:border-[#333]">
                         <div className="flex flex-col"><span className="text-white font-bold">{rec.label}</span><span className="text-[10px]">{rec.type === 'chapter' ? 'Youtube Chapter' : 'AI Analysis'}</span></div>
                         <span className="font-mono">{formatTime(rec.start)}</span>
                      </div>
                   ))}
                   {recommendations.length === 0 && !isAnalyzing && <p className="text-xs text-[#555] text-center py-4">감지된 구간이 없습니다.</p>}
                </div>
             </div>
             <div className="bg-[#181818] p-4 rounded-lg border border-[#282828] space-y-4">
                <input value={clipTitle} onChange={e => setClipTitle(e.target.value)} placeholder="클립 제목" className="w-full bg-[#030303] text-white px-3 py-2 rounded border border-[#333] focus:border-white focus:outline-none text-sm"/>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="#태그1, #태그2" className="w-full bg-[#030303] text-white px-3 py-2 rounded border border-[#333] focus:border-white focus:outline-none text-sm"/>
                <button onClick={saveClip} className="w-full bg-white text-black font-bold py-2 rounded hover:bg-[#F1F1F1] text-sm">저장하기</button>
             </div>
          </div>
        </div>
      </div>
    )
  };

  const BottomPlayer = () => {
    const displayClip = currentClip || { title: "재생 중인 곡 없음", artist: "Artist", startTime: 0, endTime: 0 };
    const progress = displayClip.endTime > 0 ? ((playerProgress - displayClip.startTime) / (displayClip.endTime - displayClip.startTime)) * 100 : 0;

    return (
      <div className="fixed bottom-0 left-0 right-0 h-[72px] bg-[#212121] flex items-center px-4 z-50 border-t border-[#333]">
        {/* Hidden/Floating Global Player */}
        <div className={`fixed bottom-24 right-4 z-40 transition-all duration-300 shadow-2xl rounded-lg overflow-hidden border border-[#333] ${isVideoVisible ? 'w-80 aspect-video opacity-100 translate-y-0' : 'w-0 h-0 opacity-0 translate-y-10'}`}>
            <div id="global-player" className="w-full h-full"></div>
            {/* Close Button for PiP */}
            <button onClick={() => setIsVideoVisible(false)} className="absolute top-2 right-2 bg-black/60 p-1 rounded-full text-white hover:bg-black/80"><X size={14}/></button>
        </div>
        
        {/* Hidden Div Placeholder if not visible to maintain player instance */}
        {!isVideoVisible && <div id="global-player-placeholder" className="hidden"></div>}

        {/* Progress Bar (Absolute Top) */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#333] group cursor-pointer">
           <div className="h-full bg-red-600 absolute top-0 left-0" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}></div>
           <div className="absolute top-[-4px] h-[10px] w-full opacity-0 group-hover:opacity-100"></div>
        </div>

        {/* Info */}
        <div className="w-[30%] flex items-center gap-4">
           <div className="flex items-center gap-4 text-white">
              <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-[#AAAAAA]">
                 <SkipBack size={20} fill="currentColor"/>
              </button>
              <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-[#AAAAAA]">
                 {isPlaying ? <Pause size={32} fill="currentColor"/> : <Play size={32} fill="currentColor"/>}
              </button>
              <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-[#AAAAAA]">
                 <SkipForward size={20} fill="currentColor"/>
              </button>
           </div>
           <div className="text-xs text-[#AAAAAA] ml-4 font-mono">
              {formatTime(playerProgress)} / {formatTime(displayClip.endTime)}
           </div>
        </div>

        {/* Center: Song Info */}
        <div className="flex-1 flex items-center justify-center gap-4 min-w-0 px-4">
            {currentClip && (
                <>
                <div className="relative group/thumb cursor-pointer" onClick={() => setIsVideoVisible(!isVideoVisible)}>
                    <img src={videos.find(v => v.id === currentClip.videoId)?.thumbnailUrl || "https://via.placeholder.com/40"} className="w-10 h-10 object-cover rounded bg-neutral-800" alt=""/>
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded">
                        {isVideoVisible ? <Minimize2 size={16} className="text-white"/> : <Maximize2 size={16} className="text-white"/>}
                    </div>
                </div>
                <div className="min-w-0 text-center md:text-left">
                   <div className="text-white text-sm font-medium truncate">{currentClip.title}</div>
                   <div className="text-[#AAAAAA] text-xs truncate flex items-center gap-1 justify-center md:justify-start">
                     <span>{currentClip.tags?.[0] ? `#${currentClip.tags[0]}` : 'Clip'}</span>
                     <span>•</span>
                     <span>{currentClip.artistName || 'Artist'}</span>
                   </div>
                </div>
                <button className="text-[#AAAAAA] hover:text-white"><Heart size={16}/></button>
                <button className="text-[#AAAAAA] hover:text-white"><MoreHorizontal size={16}/></button>
                </>
            )}
        </div>

        {/* Right: Controls */}
        <div className="w-[30%] flex justify-end items-center gap-4 text-[#AAAAAA]">
             <button 
                onClick={() => setIsVideoVisible(!isVideoVisible)}
                className={`hover:text-white transition-colors ${isVideoVisible ? 'text-red-500' : ''}`}
                title="비디오 모드 전환"
             >
                <Film size={20}/>
             </button>
             <button className={`hover:text-white ${isLooping ? 'text-white' : ''}`} onClick={() => setIsLooping(!isLooping)}><Repeat size={20}/></button>
             <button className="hover:text-white"><Shuffle size={20}/></button>
             <button className="hover:text-white hidden lg:block"><ListMusic size={20}/></button>
        </div>
      </div>
    );
  };

  if (!user) {
    const isGoogleReady = isGoogleSdkReady && GOOGLE_CLIENT_ID;

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center mx-auto">
            <Play fill="white" size={24} className="ml-0.5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">유튜브 라이브 클립 스튜디오</h1>
            <p className="text-[#AAAAAA] text-sm leading-relaxed">
              맞춤형 라이브 클립을 생성하고 플레이리스트를 관리하려면 Google 계정으로 로그인해 주세요.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={!isGoogleReady}
              className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-[#F1F1F1] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" className="w-5 h-5" />
              {isGoogleReady ? "Google 계정으로 시작하기" : "Google 모듈을 불러오는 중..."}
            </button>

            <button
              onClick={() => setUser({
                uid: 'demo-user',
                displayName: '게스트',
                email: '',
                photoURL: '',
                isAnonymous: true,
              })}
              className="w-full bg-[#181818] text-white font-semibold py-3 rounded-lg hover:bg-[#222] border border-[#282828] transition-colors"
            >
              로그인 없이 둘러보기 (데모 모드)
            </button>
          </div>

          {!GOOGLE_CLIENT_ID && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              환경 변수 VITE_GOOGLE_CLIENT_ID 가 설정되어 있지 않아 실제 로그인은 비활성화되어 있습니다.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#030303] text-white font-sans overflow-hidden select-none">
      <Sidebar />
      <main className="flex-1 relative flex flex-col min-w-0 bg-[#030303]">
        <header className="h-16 flex items-center justify-between px-8 sticky top-0 z-10 bg-[#030303]/95 backdrop-blur-md">
           <div className="flex-1 max-w-xl relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" size={20} />
              <input type="text" placeholder="검색" className="w-full bg-[#212121] text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:bg-white focus:text-black placeholder-[#AAAAAA] transition-colors" />
           </div>
           <div className="ml-4 w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold">ME</div>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
           {view === 'home' && <HomeView />}
           {view === 'artist_list' && <ArtistListView />}
           {view === 'artist_detail' && <ArtistDetailView />}
           {view === 'add_artist' && <AddArtistView />}
           {view === 'add_video' && <AddVideoView />}
           {view === 'clip_editor' && <ClipEditorView />}
           {view === 'library' && <SongDatabaseView />}
           {view === 'live' && <LiveBroadcastView />}
           {view === 'register_media' && <RegisterMediaView />}
        </div>
      </main>
      <RightSidebar />
      <BottomPlayer />
    </div>
  );
}
