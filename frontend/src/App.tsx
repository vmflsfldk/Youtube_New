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
  LogOut, GripVertical, Pencil // 로그아웃, 드래그 핸들, 편집 아이콘
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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

const buildApiUrl = (path) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
};

const apiFetch = (path, init) => fetch(buildApiUrl(path), init);

const fetchChannelInfo = async (channelId) => {
  const endpoint = `/api/public/youtube-channel?channelId=${encodeURIComponent(channelId)}`;
  try {
    const response = await apiFetch(endpoint);
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
  if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;
  // 백엔드 로직과 일치하도록 'X-User-Email'로 변경
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

const INITIAL_PLAYLIST = [];

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
  const [selectedClip, setSelectedClip] = useState(null); 
  
  // Data State
  const [artists, setArtists] = useState([]);
  const [videos, setVideos] = useState([]);
  const [clips, setClips] = useState([]);
  const [favorites, setFavorites] = useState(new Set()); 
  const [savedPlaylists, setSavedPlaylists] = useState([]); 

  // Player & Playlist State - localStorage에서 복원
  const [playlist, setPlaylist] = useState(() => {
    try {
      const saved = localStorage.getItem('player_queue');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("재생목록 로드 실패", e);
      return [];
    }
  });
  const [currentClip, setCurrentClip] = useState(() => {
    try {
      const saved = localStorage.getItem('player_current_clip');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [isLooping, setIsLooping] = useState(() => {
    try {
      const saved = localStorage.getItem('player_loop');
      return saved === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isVideoVisible, setIsVideoVisible] = useState(() => {
    try {
      const saved = localStorage.getItem('player_video_visible');
      return saved === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isMobileQueueOpen, setIsMobileQueueOpen] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const playerRef = useRef(null);
  const playerIntervalRef = useRef(null);
  const progressBarRef = useRef(null);

  const [isGoogleSdkReady, setIsGoogleSdkReady] = useState(false);
  const googleInitRef = useRef(false);
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // 대기열(Queue) localStorage 저장
  useEffect(() => {
    localStorage.setItem('player_queue', JSON.stringify(playlist));
  }, [playlist]);

  // 현재 재생 중인 클립 localStorage 저장
  useEffect(() => {
    if (currentClip) {
      localStorage.setItem('player_current_clip', JSON.stringify(currentClip));
    } else {
      localStorage.removeItem('player_current_clip');
    }
  }, [currentClip]);

  // 루프 설정 localStorage 저장
  useEffect(() => {
    localStorage.setItem('player_loop', String(isLooping));
  }, [isLooping]);

  // 비디오 표시 설정 localStorage 저장
  useEffect(() => {
    localStorage.setItem('player_video_visible', String(isVideoVisible));
  }, [isVideoVisible]);

  useEffect(() => {
    const restoreSession = async () => {
      if (typeof window === 'undefined') return;
      const stored = localStorage.getItem('googleAuth');
      if (!stored) {
        setIsRestoringSession(false);
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        const token = parsed?.token;
        const savedUser = parsed?.user;
        if (!token || !savedUser?.email) throw new Error('invalid stored credentials');

        const headers = buildApiHeaders({ token, email: savedUser.email, displayName: savedUser.displayName });
        const response = await apiFetch('/api/users/login', { method: 'POST', headers });
        if (!response.ok) throw new Error('session validation failed');

        const apiUser = await response.json();
        const restoredUser = {
          uid: String(apiUser.id ?? savedUser.uid ?? apiUser.email ?? savedUser.email),
          displayName: apiUser.displayName || savedUser.displayName || savedUser.email,
          email: apiUser.email || savedUser.email,
          photoURL: savedUser.photoURL || '',
          isAnonymous: false,
          token
        };

        setUser(restoredUser);
      } catch (error) {
        console.warn('기존 세션을 복원하지 못했습니다.', error);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('googleAuth');
        }
      } finally {
        setIsRestoringSession(false);
      }
    };

    restoreSession();
  }, []);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user?.token && !user.isAnonymous) {
      const { token, ...userProfile } = user;
      localStorage.setItem('googleAuth', JSON.stringify({ token, user: userProfile }));
      return;
    }

    localStorage.removeItem('googleAuth');
  }, [user]);

  const ensureAuthenticated = useCallback(() => {
    if (!user) {
      alert('Google 계정으로 로그인 후 이용 가능합니다.');
      return false;
    }
    return true;
  }, [user]);

  // --- Player Logic: Play Next/Prev ---
  const playNext = useCallback(() => {
      if (playlist.length === 0) return;
      const currentIndex = playlist.findIndex(p => p.id === currentClip?.id);
      const nextIndex = (currentIndex + 1) % playlist.length;
      setCurrentClip(playlist[nextIndex]);
  }, [playlist, currentClip]);

  const playPrev = useCallback(() => {
      if (playlist.length === 0) return;
      const currentIndex = playlist.findIndex(p => p.id === currentClip?.id);
      const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
      setCurrentClip(playlist[prevIndex]);
  }, [playlist, currentClip]);

  const requestApiToken = async (credential) => {
    const response = await apiFetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: credential,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || '로그인 토큰 발급에 실패했습니다.');
    }

    const data = await response.json();
    return data;
  };

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
        callback: async ({ credential }) => {
          if (!credential) return;

          try {
            const { token: apiToken, user: apiUser } = await requestApiToken(credential);

            if (!apiUser?.email) {
              throw new Error('사용자 정보가 올바르지 않습니다.');
            }

            const profile = {
              uid: String(apiUser.id ?? apiUser.email),
              displayName: apiUser.displayName || apiUser.email,
              email: apiUser.email,
              photoURL: '',
              isAnonymous: false,
            };
            setUser({ ...profile, token: apiToken });
          } catch (error) {
            console.error('Google 로그인 처리 실패', error);
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
        if (typeof window !== 'undefined') {
          localStorage.removeItem('googleAuth');
        }
      });
      return;
    }

    setUser(null);
    setFavorites(new Set());
    setSavedPlaylists([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('googleAuth');
    }
  };

  useEffect(() => {
    fetch('/api/artists')
      .then((res) => res.json())
      .then((data) => {
        const mappedArtists = data.map((artist) => ({
          ...artist,
          imageUrl: artist.profileImageUrl,
          primaryName: artist.displayName
        }));
        setArtists(mappedArtists);
      })
      .catch((err) => console.error("아티스트 로딩 실패:", err));

    fetch('/api/public/library')
      .then((res) => res.json())
      .then((data) => {
        const mappedVideos = data.videos.map((v) => ({
          ...v,
          youtubeId: v.youtubeVideoId,
          duration: v.durationSec,
        }));

        const mappedClips = data.clips.map((c) => ({
          ...c,
          startTime: c.startSec,
          endTime: c.endSec,
          youtubeId: c.youtubeVideoId
        }));

        setVideos(mappedVideos);
        setClips(mappedClips);
      })
      .catch((err) => console.error("라이브러리 로딩 실패:", err));

    setSavedPlaylists([]);

    setFavorites(new Set());

  }, []);

  // --- YouTube IFrame API Loader ---
  const [isYouTubeApiReady, setIsYouTubeApiReady] = useState(false);

  useEffect(() => {
    // 이미 로드되어 있다면 바로 true 설정
    if (window.YT && window.YT.Player) {
      setIsYouTubeApiReady(true);
    } else {
      // 로드되지 않았다면 스크립트 추가 및 콜백 설정
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // 유튜브 API가 준비되면 실행될 전역 콜백 함수
      window.onYouTubeIframeAPIReady = () => {
        setIsYouTubeApiReady(true);
      };
    }
  }, []);

  // --- Global YouTube Player Initialization (디버깅 로그 추가) ---
  useEffect(() => {
    // 1. 기본 조건 체크
    if (!currentClip) {
        console.log("[GlobalPlayer] currentClip이 없습니다. 플레이어 생성을 스킵합니다.");
        return;
    }
    if (!isYouTubeApiReady || !window.YT) {
        console.log("[GlobalPlayer] YouTube API 대기 중...");
        return;
    }

    console.log("[GlobalPlayer] 초기화 시작. Video ID:", currentClip.youtubeId);

    // 2. 이미 플레이어가 있는 경우: 영상 로드만 수행
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        console.log("[GlobalPlayer] 기존 플레이어 재사용. loadVideoById 호출");
        try {
            playerRef.current.loadVideoById({
                videoId: currentClip.youtubeId,
                startSeconds: currentClip.startTime,
                endSeconds: currentClip.endTime
            });
        } catch (e) {
            console.error("[GlobalPlayer] loadVideoById 실패:", e);
        }
        return;
    }

    // 3. 플레이어 DOM 요소 확인
    const playerContainer = document.getElementById('global-player');
    if (!playerContainer) {
        console.error("[GlobalPlayer] #global-player 엘리먼트를 찾을 수 없습니다!");
        return;
    }

    // 4. 플레이어 새로 생성
    try {
        playerRef.current = new window.YT.Player('global-player', {
            height: '100%',
            width: '100%',
            videoId: currentClip.youtubeId,
            playerVars: {
                autoplay: 1,
                controls: 0,
                start: currentClip.startTime,
                end: currentClip.endTime,
                origin: window.location.origin,
                playsinline: 1, // iOS 모바일 재생 필수 설정
                enablejsapi: 1  // API 제어 허용
            },
            events: {
                onReady: (event) => {
                    console.log("[GlobalPlayer] onReady 이벤트 발생! 플레이어 준비됨.");
                    event.target.playVideo();
                    setIsPlaying(true);
                },
                onStateChange: (event) => {
                    console.log("[GlobalPlayer] 상태 변경됨:", event.data);
                    // -1:시작안함, 0:종료, 1:재생중, 2:일시정지, 3:버퍼링, 5:동영상신호
                    if (event.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
                    if (event.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
                    if (event.data === window.YT.PlayerState.ENDED) {
                        console.log("[GlobalPlayer] 영상 종료. 다음 곡 재생 시도.");
                        if (isLooping) {
                            event.target.seekTo(currentClip.startTime);
                            event.target.playVideo();
                        } else {
                            playNext();
                        }
                    }
                },
                onError: (e) => {
                    console.error("[GlobalPlayer] 유튜브 플레이어 에러 발생:", e.data);
                }
            }
        });
    } catch (err) {
        console.error("[GlobalPlayer] 플레이어 생성 중 예외 발생:", err);
    }
  }, [currentClip, isYouTubeApiReady, isLooping, playNext]);

  // --- Player Logic ---
  const loadClipToPlayer = (clip) => {
    if (!clip?.youtubeId) {
      alert("유효한 YouTube ID가 없어 클립을 재생할 수 없습니다.");
      return;
    }

    const normalizedClip = {
      ...clip,
      startTime: clip.startTime ?? 0,
      endTime: clip.endTime ?? clip.duration ?? 0
    };

    setCurrentClip(normalizedClip);
    setIsPlaying(true);
    if (!playlist.find(p => p.id === normalizedClip.id)) {
      setPlaylist(prev => [{
        id: normalizedClip.id,
        title: normalizedClip.title,
        artist: normalizedClip.artistName || 'Unknown',
        duration: normalizedClip.endTime - normalizedClip.startTime,
        ...normalizedClip // Store full object for restoration
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
        endTime: video.duration || 3600,
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

    // 토스트 메시지 표시
    setToastMessage(`재생목록에 추가: ${newItem.title}`);
    setTimeout(() => setToastMessage(null), 2000);
  };

  useEffect(() => {
    if (playerIntervalRef.current) clearInterval(playerIntervalRef.current);
    
    if (isPlaying && currentClip && playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      playerIntervalRef.current = setInterval(() => {
        const currentTime = playerRef.current.getCurrentTime();
        setPlayerProgress(currentTime);

        if (currentClip.endTime && currentTime >= currentClip.endTime) {
             if (isLooping) {
                 playerRef.current.seekTo(currentClip.startTime);
             } else {
                 playNext();
             }
        }
      }, 500);
    }
    return () => clearInterval(playerIntervalRef.current);
  }, [isPlaying, currentClip, isLooping, playNext]);

  const togglePlay = () => {
      if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
          if (isPlaying) {
              playerRef.current.pauseVideo();
          } else {
              playerRef.current.playVideo();
          }
          setIsPlaying(!isPlaying);
      }
  };

  const seekWithinClip = useCallback((clientX, rect) => {
    if (!currentClip || !playerRef.current) return;

    const barRect = rect || progressBarRef.current?.getBoundingClientRect();
    const clipDuration = (currentClip.endTime ?? 0) - (currentClip.startTime ?? 0);

    if (!barRect || !barRect.width || clipDuration <= 0) return;

    const offsetX = clientX - barRect.left;
    const ratio = Math.min(Math.max(offsetX / barRect.width, 0), 1);
    const targetTime = (currentClip.startTime ?? 0) + ratio * clipDuration;
    const clampedTime = Math.min(Math.max(targetTime, currentClip.startTime ?? 0), currentClip.endTime ?? targetTime);

    playerRef.current.seekTo(clampedTime);
    setPlayerProgress(clampedTime);
  }, [currentClip]);

  const handleProgressBarMouseDown = useCallback((e) => {
    if (!currentClip || !playerRef.current) return;

    const rect = e.currentTarget?.getBoundingClientRect();
    if (!rect) return;

    seekWithinClip(e.clientX, rect);

    const handleMove = (moveEvent) => {
      if (moveEvent.buttons !== 1) {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        return;
      }
      seekWithinClip(moveEvent.clientX, rect);
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [currentClip, seekWithinClip]);

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

  const deleteClip = async (e, clip) => {
    e.stopPropagation();
    if (!ensureAuthenticated()) return;
    if (!window.confirm(`"${clip.title}" 클립을 삭제하시겠습니까?`)) return;

    try {
      // 로컬 DB에서 삭제
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'clips', clip.id));

      // API에서 삭제 (d1Id가 있는 경우)
      if (clip.d1Id) {
        const apiResponse = await apiFetch(`/api/clips/${clip.d1Id}`, {
          method: 'DELETE',
          headers: buildApiHeaders(user)
        });

        if (!apiResponse.ok) {
          console.warn('API clip deletion failed', await apiResponse.text());
        }
      }

      // 로컬 상태에서 제거
      setClips(prev => prev.filter(c => c.id !== clip.id));
      alert('클립이 삭제되었습니다.');
    } catch (error) {
      console.error('Clip deletion error:', error);
      alert('클립 삭제 중 오류가 발생했습니다.');
    }
  };

  const editClip = (e, clip) => {
    e.stopPropagation();
    const parentVideo = videos.find(v => v.id === clip.videoId);
    if (!parentVideo) {
      alert('원본 영상을 찾을 수 없습니다.');
      return;
    }
    setSelectedVideo(parentVideo);
    setSelectedClip(clip);
    setView('clip_editor');
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

  const MobileNav = () => (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#030303]/95 backdrop-blur-md border-t border-[#222] z-[60] pb-safe">
      <div className="flex justify-around items-center h-14">
        <button className={`flex flex-col items-center justify-center w-full h-full ${view === 'home' ? 'text-white' : 'text-[#666]'}`} onClick={() => setView('home')}>
           <Home size={24} />
           <span className="text-[10px] mt-1">홈</span>
        </button>
        <button className={`flex flex-col items-center justify-center w-full h-full ${view === 'artist_list' ? 'text-white' : 'text-[#666]'}`} onClick={() => setView('artist_list')}>
           <User size={24} />
           <span className="text-[10px] mt-1">아티스트</span>
        </button>
        <button className={`flex flex-col items-center justify-center w-full h-full ${view === 'library' ? 'text-white' : 'text-[#666]'}`} onClick={() => setView('library')}>
           <Disc size={24} />
           <span className="text-[10px] mt-1">곡 DB</span>
        </button>
        <button className={`flex flex-col items-center justify-center w-full h-full ${view === 'register_media' ? 'text-white' : 'text-[#666]'}`} onClick={() => setView('register_media')}>
           <FileVideo size={24} />
           <span className="text-[10px] mt-1">등록</span>
        </button>
      </div>
    </div>
  );

  // ... (RightSidebar, ArtistCard, RegisterMediaView, HomeView, LiveBroadcastView, ArtistListView, SongDatabaseView, AddArtistView, AddVideoView, ClipEditorView, BottomPlayer components remain exactly as before) ...
  // For brevity and to follow "single file" rule, I will include them below.

  const RightSidebar = () => {
    const [activeTab, setActiveTab] = useState('queue'); // 'queue' or 'playlists'
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [liveArtists, setLiveArtists] = useState([]);
    const [isLoadingLive, setIsLoadingLive] = useState(true);

    // 터치 지원 상태
    const [touchStartY, setTouchStartY] = useState(null);
    const [touchCurrentY, setTouchCurrentY] = useState(null);
    const [isDraggingTouch, setIsDraggingTouch] = useState(false);
    const longPressTimerRef = useRef(null);
    const touchScrollStartRef = useRef(0);

    // 라이브 아티스트 가져오기
    useEffect(() => {
      const fetchLiveArtists = async () => {
        if (!user || !artists.length) {
          setIsLoadingLive(false);
          return;
        }

        setIsLoadingLive(true);
        try {
          const response = await apiFetch('/api/artists/live', {
            method: 'GET',
            headers: buildApiHeaders(user)
          });

          if (response.ok) {
            const data = await response.json();
            // 라이브 중인 아티스트만 필터링
            const live = data.filter(artistData => artistData.liveVideos.length > 0);
            setLiveArtists(live);
          }
        } catch (error) {
          console.error('Failed to fetch live artists:', error);
        }
        setIsLoadingLive(false);
      };

      fetchLiveArtists();
      // 5분마다 업데이트
      const interval = setInterval(fetchLiveArtists, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }, [user, artists]);

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
        const trackToRemove = playlist[idx];
        const newPlaylist = playlist.filter((_, i) => i !== idx);

        setPlaylist(newPlaylist);

        // 현재 재생 중인 곡을 삭제하는 경우
        if (currentClip && trackToRemove.id === currentClip.id) {
            if (newPlaylist.length > 0) {
                // 다음 곡이 있으면 다음 곡 재생
                const nextIndex = idx >= newPlaylist.length ? 0 : idx;
                setCurrentClip(newPlaylist[nextIndex]);
            } else {
                // 재생목록이 비었으면 재생 중지
                setCurrentClip(null);
                setIsPlaying(false);
                if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
                    playerRef.current.stopVideo();
                }
            }
        }
    };

    // 드래그 앤 드롭 핸들러
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOverIndex(null);
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const newPlaylist = [...playlist];
        const draggedItem = newPlaylist[draggedIndex];

        // 드래그된 항목 제거
        newPlaylist.splice(draggedIndex, 1);
        // 새 위치에 삽입
        newPlaylist.splice(dropIndex, 0, draggedItem);

        setPlaylist(newPlaylist);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    // 터치 이벤트 핸들러
    const handleTouchStart = (e, index) => {
        const touch = e.touches[0];
        setTouchStartY(touch.clientY);
        setTouchCurrentY(touch.clientY);

        // 길게 누르기 타이머 시작 (500ms)
        longPressTimerRef.current = setTimeout(() => {
            setDraggedIndex(index);
            setIsDraggingTouch(true);
            // 햅틱 피드백 (지원하는 경우)
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 500);
    };

    const handleTouchMove = (e, index) => {
        if (!isDraggingTouch) {
            // 드래그 시작 전이면 스크롤 허용을 위해 타이머 취소
            const touch = e.touches[0];
            const deltaY = Math.abs(touch.clientY - touchStartY);
            if (deltaY > 10) {
                clearTimeout(longPressTimerRef.current);
            }
            return;
        }

        // 드래그 중이면 스크롤 방지
        e.preventDefault();

        const touch = e.touches[0];
        setTouchCurrentY(touch.clientY);

        // 터치 위치에 따라 dragOverIndex 업데이트
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element) {
            const trackElement = element.closest('[data-track-index]');
            if (trackElement) {
                const overIndex = parseInt(trackElement.dataset.trackIndex);
                if (overIndex !== draggedIndex) {
                    setDragOverIndex(overIndex);
                }
            }
        }
    };

    const handleTouchEnd = (e, index) => {
        clearTimeout(longPressTimerRef.current);

        if (isDraggingTouch && draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
            // 드롭 처리
            const newPlaylist = [...playlist];
            const draggedItem = newPlaylist[draggedIndex];

            newPlaylist.splice(draggedIndex, 1);
            newPlaylist.splice(dragOverIndex, 0, draggedItem);

            setPlaylist(newPlaylist);

            // 햅틱 피드백
            if (navigator.vibrate) {
                navigator.vibrate(30);
            }
        }

        // 상태 초기화
        setDraggedIndex(null);
        setDragOverIndex(null);
        setIsDraggingTouch(false);
        setTouchStartY(null);
        setTouchCurrentY(null);
    };

    const handleTouchCancel = () => {
        clearTimeout(longPressTimerRef.current);
        setDraggedIndex(null);
        setDragOverIndex(null);
        setIsDraggingTouch(false);
        setTouchStartY(null);
        setTouchCurrentY(null);
    };

    return (
        <div className={`
            bg-[#030303] border-l border-[#282828] z-[60]
            lg:w-80 lg:flex lg:flex-col lg:relative lg:pt-6 lg:pb-24 lg:translate-x-0
            fixed inset-0 w-full h-full flex flex-col transition-transform duration-300
            ${isMobileQueueOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
            {/* Mobile-only header with close button */}
            <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-[#282828]">
                <h3 className="text-white font-bold text-lg">재생 대기열</h3>
                <button
                    onClick={() => setIsMobileQueueOpen(false)}
                    className="text-white hover:text-red-500 active:scale-90 transition-all p-2 -m-2"
                >
                    <X size={28} />
                </button>
            </div>

            <div className="px-6 mb-6 mt-4 lg:mt-0">
                <h3 className="text-[#AAAAAA] text-sm font-bold mb-4 flex items-center gap-2">
                    <Radio size={14} className="text-red-500"/> 라이브 중인 아티스트
                </h3>
                <div className="space-y-3">
                {isLoadingLive ? (
                    <div className="flex items-center justify-center py-4">
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : liveArtists.length > 0 ? (
                    liveArtists.slice(0, 3).map(artistData => {
                        const artist = artistData.artist;
                        const liveVideo = artistData.liveVideos[0];
                        const platformColor = liveVideo.platform === 'youtube' ? 'border-red-500 bg-red-500' : 'border-[#00FFA3] bg-[#00FFA3]';

                        return (
                            <div
                                key={artist.id}
                                className="flex items-center gap-3 group cursor-pointer hover:bg-[#1A1A1A] p-2 rounded-lg transition-colors"
                                onClick={() => setView('live')}
                            >
                                <div className="relative">
                                    <img
                                        src={artist.profileImageUrl || 'https://via.placeholder.com/40'}
                                        className={`w-10 h-10 rounded-full border-2 ${platformColor} p-0.5`}
                                        alt={artist.displayName || artist.name}
                                    />
                                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${platformColor} rounded-full border-2 border-black animate-pulse`}></div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white group-hover:text-red-400 truncate transition-colors">
                                        {artist.displayName || artist.name}
                                    </p>
                                    <p className="text-[10px] text-[#666] truncate">
                                        {liveVideo.platform === 'youtube' ? '🔴 YouTube' : '🟢 치지직'} · {liveVideo.viewerCount ? `${formatViewers(liveVideo.viewerCount)}명` : 'LIVE'}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center text-[#555] py-4 text-xs">
                        현재 라이브 중인 아티스트가 없습니다
                    </div>
                )}
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
                            <button onClick={() => {
                                setPlaylist([]);
                                setCurrentClip(null);
                                setIsPlaying(false);
                                if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
                                    playerRef.current.stopVideo();
                                }
                            }} className="flex-1 bg-[#222] hover:bg-[#333] text-[#AAAAAA] hover:text-red-500 text-xs py-2 rounded flex items-center justify-center gap-1">
                                <Trash2 size={12}/> 비우기
                            </button>
                        </div>

                        {playlist.length === 0 && (
                            <div className="text-center text-[#555] py-10 text-xs">재생목록이 비어있습니다.</div>
                        )}

                        {playlist.map((track, idx) => (
                            <div
                                key={`${track.id}-${idx}`}
                                data-track-index={idx}
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, idx)}
                                onDragEnd={handleDragEnd}
                                onTouchStart={(e) => handleTouchStart(e, idx)}
                                onTouchMove={(e) => handleTouchMove(e, idx)}
                                onTouchEnd={(e) => handleTouchEnd(e, idx)}
                                onTouchCancel={handleTouchCancel}
                                style={{
                                    transition: draggedIndex === null ? 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'opacity 0.2s, transform 0.2s',
                                    transform: draggedIndex === idx && isDraggingTouch && touchCurrentY !== null
                                        ? `translateY(${touchCurrentY - touchStartY}px) scale(1.05)`
                                        : draggedIndex === idx
                                        ? 'scale(0.95)'
                                        : 'scale(1)',
                                }}
                                className={`group flex items-center gap-2 p-2 rounded cursor-move
                                    ${draggedIndex === idx ? 'opacity-50 shadow-2xl z-50' : 'opacity-100'}
                                    ${dragOverIndex === idx ? 'bg-[#333] border-2 border-red-500 border-dashed' : 'hover:bg-[#1A1A1A] border-2 border-transparent'}
                                    ${isDraggingTouch && draggedIndex === idx ? 'bg-[#1A1A1A] shadow-lg' : ''}
                                `}
                            >
                                <div className="text-[#666] group-hover:text-[#AAA] flex-shrink-0 cursor-grab active:cursor-grabbing touch-none">
                                    <GripVertical size={14} />
                                </div>
                                <div className="flex items-center gap-3 overflow-hidden flex-1" onClick={(e) => { e.stopPropagation(); setCurrentClip(track); }}>
                                    <div className="w-8 h-8 bg-[#282828] rounded flex items-center justify-center text-[#AAAAAA] flex-shrink-0 group-hover:bg-[#333] transition-colors duration-200">
                                        {currentClip?.id === track.id ? <BarChart2 size={12} className="text-red-500 animate-pulse"/> : <Music size={12}/>}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-xs truncate font-medium transition-colors duration-200 ${currentClip?.id === track.id ? 'text-red-500' : 'text-[#E1E1E1]'}`}>{track.title}</p>
                                        <p className="text-[10px] text-[#888] truncate">{track.artist || track.artistName || 'Unknown'}</p>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); removeFromQueue(idx); }} className="opacity-0 group-hover:opacity-100 text-[#666] hover:text-red-500 px-2 flex-shrink-0 transition-all duration-200">
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
    const [loadingMessage, setLoadingMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const filteredArtists = useMemo(() => {
       if(!searchTerm) return artists;
       return artists.filter(a => (a.primaryName || a.name).toLowerCase().includes(searchTerm.toLowerCase()));
    }, [artists, searchTerm]);

    const handleRegisterAndSuggest = async () => {
         if (!url || !selectedArtistId) return;
         setIsLoading(true);
         
         try {
             // 1단계: 영상 저장 (Video Registration)
             setLoadingMessage("영상 정보를 저장하고 있습니다...");
             const videoRes = await fetch('/api/videos', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     // 로그인된 유저 정보 헤더 (필요시)
                     'X-User-Email': user?.email || '',
                     'X-User-Name': user?.displayName || ''
                 },
                 body: JSON.stringify({
                     videoUrl: url,
                     artistId: selectedArtistId
                 })
             });

             if (!videoRes.ok) {
                 throw new Error("영상 등록에 실패했습니다.");
             }

             const videoData = await videoRes.json();

             // 2단계: 클립 구간 자동 추정 (댓글/챕터 분석)
             setLoadingMessage("댓글과 챕터를 분석하여 노래 구간을 찾고 있습니다...");
             const detectRes = await fetch('/api/clips/auto-detect', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'X-User-Email': user?.email || '',
                     'X-User-Name': user?.displayName || ''
                 },
                 body: JSON.stringify({
                     videoId: videoData.id,
                     mode: 'chapters' // 'chapters' 모드는 worker.ts에서 댓글과 설명란을 모두 분석함
                 })
             });

             const candidates = await detectRes.json();

             // 3단계: 데이터 매핑 및 에디터로 이동
             const artist = artists.find(a => a.id === selectedArtistId);
             setSelectedArtist(artist);
             
             // 백엔드 데이터를 프론트엔드 형식에 맞게 변환
             const suggestions = candidates.map((c: any) => ({
                 start: c.startSec,
                 end: c.endSec,
                 label: c.label,
                 type: 'comment_timestamp', // 타입을 지정하여 UI에 표시
                 score: c.score
             }));

             setSelectedVideo({ 
                 id: videoData.id, 
                 youtubeId: videoData.youtubeVideoId,
                 title: videoData.title,
                 thumbnailUrl: videoData.thumbnailUrl,
                 duration: videoData.durationSec,
                 suggestions: suggestions // 분석된 후보군 전달
             }); 
             
             setView('clip_editor');

         } catch (error) {
             console.error(error);
             alert("처리 중 오류가 발생했습니다: " + (error as Error).message);
         } finally {
             setIsLoading(false);
             setLoadingMessage("");
         }
    };

    return (
        <div className="p-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300 min-h-full">
             <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/20 rounded-full mb-4">
                    <FileVideo className="text-red-600" size={32}/>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">영상 및 클립 등록</h2>
                <p className="text-[#AAAAAA] text-sm">아티스트를 선택하고 유튜브 링크를 입력하면 영상을 저장하고 댓글을 분석합니다.</p>
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
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/>
                                <span>{loadingMessage}</span>
                            </div>
                        ) : (
                            <><Wand2 size={18}/> 영상 저장 및 구간 분석 시작</>
                        )}
                     </button>
                 </div>
                 <div className="bg-[#222] p-4 rounded-lg text-xs text-[#888] flex gap-2 items-start">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0"/>
                    <span>영상이 먼저 라이브러리에 저장되며, 이후 댓글 타임스탬프를 분석하여 클립 후보를 제안합니다.</span>
                 </div>
             </div>
        </div>
    )
  };

  const HomeView = () => {
    const latestVideos = useMemo(() => [...videos].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    }).slice(0, 8), [videos]);
    const latestClips = useMemo(() => [...clips].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    }).slice(0, 8), [clips]);

    return (
    <div className="p-4 md:p-8 space-y-10 pb-32 md:pb-32">
      <div className="md:hidden flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
          <Play fill="white" size={14} className="ml-0.5" />
        </div>
        <span className="text-white font-bold text-xl tracking-tighter">Music</span>
      </div>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                     <span>{video.createdAt ? new Date(video.createdAt).toLocaleDateString() : 'N/A'}</span>
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
                onClick={(e) => addToQueue(e, clip, false)}
                className="flex items-center gap-4 p-3 pr-4 rounded-xl bg-[#181818] hover:bg-[#282828] group cursor-pointer transition-all border border-transparent hover:border-[#333]"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    loadClipToPlayer({ ...clip, youtubeId: video?.youtubeId, artistName: artist?.primaryName });
                  }}
                  className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-neutral-800 shadow-lg hover:scale-105 transition-transform"
                  title="즉시 재생"
                >
                  <img src={video?.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition-colors">
                     <Play size={24} fill="white" className="text-white drop-shadow-lg"/>
                  </div>
                </button>
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
                <div className="text-[#666] group-hover:text-white transition-colors">
                  <ListPlus size={18}/>
                </div>
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
        if (!ensureAuthenticated()) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        try {
          const response = await apiFetch('/api/artists/live', {
            method: 'GET',
            headers: buildApiHeaders(user)
          });

          if (response.ok) {
            const data = await response.json();
            // API 응답 형식: { artist: {...}, liveVideos: [{platform, videoId, title, ...}] }[]
            // 플랫폼별로 라이브 스트림을 평탄화
            const streams = data.flatMap(artistData =>
              artistData.liveVideos.map(video => ({
                ...video,
                artistId: artistData.artist.id,
                artistName: artistData.artist.displayName || artistData.artist.name,
                artistImg: artistData.artist.profileImageUrl || 'https://via.placeholder.com/150'
              }))
            );
            setLiveStreams(streams);
          }
        } catch (error) {
          console.error('Failed to fetch live streams:', error);
        }
        setIsLoading(false);
      };

      if (user && artists.length > 0) {
        fetchLive();
      } else {
        setIsLoading(false);
      }
    }, [user, artists]);

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
                 <div className="aspect-video w-full bg-black relative">
                    {stream.platform === 'youtube' ? (
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${stream.videoId}?autoplay=0&controls=1`}
                        title={stream.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    ) : (
                      // 치지직 썸네일
                      <div
                        className="w-full h-full cursor-pointer group relative"
                        onClick={() => window.open(stream.url, '_blank')}
                      >
                        <img
                          src={stream.thumbnailUrl || 'https://via.placeholder.com/1280x720?text=CHZZK+LIVE'}
                          alt={stream.title}
                          className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-all">
                          <div className="bg-[#00FFA3] text-black px-6 py-3 rounded-full font-bold text-lg flex items-center gap-2 group-hover:scale-110 transition-transform">
                            <Play size={24} fill="currentColor" />
                            치지직에서 시청하기
                          </div>
                        </div>
                        <div className="absolute top-4 right-4 bg-[#00FFA3] text-black text-xs font-bold px-2 py-1 rounded">
                          CHZZK
                        </div>
                      </div>
                    )}
                 </div>
                 <div className="p-5">
                    <div className="flex items-start gap-4">
                       <div className="relative">
                          <img src={stream.artistImg} className="w-12 h-12 rounded-full border-2 border-red-600 p-0.5" alt=""/>
                          <div className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#181818]">LIVE</div>
                       </div>
                       <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-lg leading-snug mb-1 line-clamp-1">{stream.title || '제목 없음'}</h3>
                          <p className="text-[#AAAAAA] text-sm mb-3">{stream.artistName}</p>
                          <div className="flex items-center gap-4 text-xs font-medium text-red-500">
                             {stream.viewerCount !== undefined && (
                               <span className="flex items-center gap-1"><User size={12}/> {formatViewers(stream.viewerCount)}명 시청 중</span>
                             )}
                             <span className="flex items-center gap-1">
                               <Signal size={12}/>
                               {stream.platform === 'youtube' ? 'YouTube Live' : '치지직 Live'}
                             </span>
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

  const ArtistDetailView = () => {
    if (!selectedArtist) return <div className="p-10 text-center text-[#555]">아티스트 정보가 없습니다.</div>;

    const artistVideos = useMemo(() => videos.filter(v => v.artistId === selectedArtist.id), [videos, selectedArtist]);
    const artistClips = useMemo(() => {
        const artistVideoIds = new Set(artistVideos.map(v => v.id));
        return clips.filter(c => artistVideoIds.has(c.videoId));
    }, [clips, artistVideos]);

    return (
      <div className="p-8 pb-32 min-h-full bg-[#030303] text-white animate-in fade-in duration-300">
         {/* 아티스트 헤더 */}
         <div className="flex flex-col md:flex-row items-center md:items-end gap-8 mb-12">
            <img 
              src={selectedArtist.imageUrl} 
              alt={selectedArtist.name} 
              className="w-48 h-48 rounded-full object-cover shadow-2xl border-4 border-[#222]"
            />
            <div className="text-center md:text-left flex-1">
               <h1 className="text-5xl font-black mb-2 tracking-tight">{selectedArtist.primaryName || selectedArtist.name}</h1>
               <div className="text-[#AAAAAA] text-lg mb-4 flex items-center justify-center md:justify-start gap-2">
                  <span>{selectedArtist.agency || "소속사 정보 없음"}</span>
                  <span>•</span>
                  <span>구독자 {selectedArtist.subscriberCount || "비공개"}</span>
               </div>
               <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                  {selectedArtist.tags?.map((tag: string, i: number) => (
                     <span key={i} className="px-3 py-1 bg-[#222] rounded-full text-xs text-[#CCC] border border-[#333]">#{tag}</span>
                  ))}
               </div>
               <div className="flex gap-3 justify-center md:justify-start">
                  <button className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all">
                     <Play fill="currentColor" size={18}/> 셔플 재생
                  </button>
                  <button 
                    onClick={(e) => toggleFavorite(e, selectedArtist)}
                    className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all border ${favorites.has(selectedArtist.id) ? 'bg-white text-black border-white' : 'bg-black text-white border-[#333] hover:border-white'}`}
                  >
                     <Heart size={18} fill={favorites.has(selectedArtist.id) ? "currentColor" : "none"}/> {favorites.has(selectedArtist.id) ? "팔로잉" : "팔로우"}
                  </button>
               </div>
            </div>
         </div>

         {/* 등록된 영상 섹션 */}
         <section className="mb-12">
            <div className="flex justify-between items-end mb-6 border-b border-[#282828] pb-4">
               <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FileVideo className="text-red-600"/> 등록된 영상 <span className="text-[#666] text-sm font-normal">({artistVideos.length})</span>
               </h2>
               <button onClick={() => setView('add_video')} className="text-sm font-bold text-[#AAAAAA] hover:text-white flex items-center gap-1 transition-colors">
                  <Plus size={16}/> 영상 추가
               </button>
            </div>
            
            {artistVideos.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {artistVideos.map(video => (
                     <div key={video.id} className="group cursor-pointer" onClick={() => playFullVideo(video)}>
                        <div className="relative aspect-video rounded-lg overflow-hidden mb-3 bg-[#111] border border-[#222] group-hover:border-[#444] transition-all">
                           <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"/>
                           <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                              {formatTime(video.duration)}
                           </div>
                           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2 bg-black/40 backdrop-blur-[2px]">
                              <button 
                                onClick={(e) => addToQueue(e, video, true)}
                                className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform" title="대기열 추가"
                              >
                                 <ListPlus size={20}/>
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedVideo(video); setView('clip_editor'); }}
                                className="p-2 bg-[#333] text-white rounded-full hover:scale-110 transition-transform" title="클립 만들기"
                              >
                                 <Scissors size={20}/>
                              </button>
                           </div>
                        </div>
                        <h3 className="font-bold text-white text-sm truncate pr-2 group-hover:text-red-500 transition-colors">{video.title}</h3>
                        <p className="text-xs text-[#666] mt-0.5">{video.createdAt ? new Date(video.createdAt).toLocaleDateString() : 'Unknown Date'}</p>
                     </div>
                  ))}
               </div>
            ) : (
               <div className="py-10 text-center text-[#444] bg-[#111] rounded-xl border border-dashed border-[#222]">
                  <p className="mb-2">등록된 영상이 없습니다.</p>
                  <button onClick={() => setView('add_video')} className="text-red-500 hover:underline text-sm">첫 영상을 등록해보세요</button>
               </div>
            )}
         </section>

         {/* 클립 섹션 */}
         <section>
            <div className="flex justify-between items-end mb-6 border-b border-[#282828] pb-4">
               <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Scissors className="text-red-600"/> 하이라이트 클립 <span className="text-[#666] text-sm font-normal">({artistClips.length})</span>
               </h2>
            </div>
            {artistClips.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {artistClips.map(clip => {
                     const parentVideo = videos.find(v => v.id === clip.videoId);
                     return (
                        <div key={clip.id} onClick={(e) => addToQueue(e, clip, false)} className="flex gap-3 p-3 rounded-lg bg-[#181818] hover:bg-[#222] group cursor-pointer transition-colors border border-transparent hover:border-[#333]">
                           <button
                              onClick={(e) => {
                                 e.stopPropagation();
                                 loadClipToPlayer({...clip, youtubeId: parentVideo?.youtubeId, artistName: selectedArtist.primaryName});
                              }}
                              className="relative w-24 h-16 flex-shrink-0 rounded overflow-hidden bg-black hover:scale-105 transition-transform"
                              title="즉시 재생"
                           >
                              <img src={parentVideo?.thumbnailUrl} className="w-full h-full object-cover opacity-70 group-hover:opacity-100"/>
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition-colors">
                                 <Play size={24} fill="white" className="text-white drop-shadow-lg"/>
                              </div>
                           </button>
                           <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <h4 className="text-white font-bold text-sm truncate mb-1 group-hover:text-red-400 transition-colors">{clip.title}</h4>
                              <div className="flex items-center gap-2 text-xs text-[#666]">
                                 <Clock size={10}/> <span>{formatTime(clip.endTime - clip.startTime)}</span>
                                 {clip.tags?.[0] && <span className="bg-[#333] px-1 rounded text-[10px] text-[#999]">#{clip.tags[0]}</span>}
                              </div>
                           </div>
                           <div className="flex flex-col gap-1 self-center opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                 onClick={(e) => editClip(e, clip)}
                                 className="p-1.5 text-[#666] hover:text-blue-400 hover:bg-[#282828] rounded transition-all"
                                 title="클립 수정"
                              >
                                 <Pencil size={14}/>
                              </button>
                              <button
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    addToQueue(e, clip, false);
                                 }}
                                 className="p-1.5 text-[#666] hover:text-green-400 hover:bg-[#282828] rounded transition-all"
                                 title="대기열 추가"
                              >
                                 <ListPlus size={14}/>
                              </button>
                              <button
                                 onClick={(e) => deleteClip(e, clip)}
                                 className="p-1.5 text-[#666] hover:text-red-400 hover:bg-[#282828] rounded transition-all"
                                 title="클립 삭제"
                              >
                                 <Trash2 size={14}/>
                              </button>
                           </div>
                        </div>
                     );
                  })}
               </div>
            ) : (
               <div className="py-8 text-center text-[#444]">생성된 클립이 없습니다.</div>
            )}
         </section>
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
      const [chzzkChannelId, setChzzkChannelId] = useState("");
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
          const apiResponse = await apiFetch('/api/artists', {
            method: 'POST',
            headers: buildApiHeaders(user),
            body: JSON.stringify({
              name: primaryName,
              displayName: names.ko || primaryName,
              youtubeChannelId: channelId,
              chzzkChannelId: chzzkChannelId || null,
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
        setChzzkChannelId("");
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

                    {/* 치지직 채널 ID 입력 */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#AAAAAA] flex items-center gap-2">
                          치지직 채널 ID (선택사항)
                          <span className="text-[10px] bg-[#00FFA3] text-black px-1.5 py-0.5 rounded font-bold">CHZZK</span>
                        </label>
                        <input
                            value={chzzkChannelId}
                            onChange={e => setChzzkChannelId(e.target.value)}
                            placeholder="치지직 채널 ID 입력 (예: c1a2b3c4...)"
                            className="bg-[#0E0E0E] text-white px-3 py-2 rounded w-full border border-[#333] text-sm focus:border-white outline-none"
                        />
                        <p className="text-[10px] text-[#666]">라이브 방송 탭에서 치지직 라이브를 확인할 수 있습니다.</p>
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
                 const apiResponse = await apiFetch('/api/videos', {
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
    const isEditMode = !!selectedClip;

    useEffect(() => {
      if (!window.YT || !selectedVideo) return;

      // 수정 모드일 때 기존 클립 데이터 로드
      if (selectedClip) {
        setStartTime(selectedClip.startTime || 0);
        setEndTime(selectedClip.endTime || 15);
        setClipTitle(selectedClip.title || "");
        setTags(selectedClip.tags?.join(', ') || "");
      } else {
        // 생성 모드: 등록 화면에서 넘어온 suggestions가 있다면 초기값으로 사용
        if (selectedVideo.suggestions && selectedVideo.suggestions.length > 0) {
          setRecommendations(selectedVideo.suggestions);
        } else {
          setRecommendations([]);
        }
      }

      const newPlayer = new window.YT.Player('editor-player', {
        height: '100%', width: '100%', videoId: selectedVideo.youtubeId,
        playerVars: { 'autoplay': 1, 'controls': 1 },
        events: {
          'onReady': (event) => {
            setEditorPlayer(event.target);
            const d = event.target.getDuration();
            setDuration(d);
            if (!selectedClip) {
              setEndTime(Math.min(d, 15));
            }
            // 수정 모드일 때 시작 시간으로 이동
            if (selectedClip) {
              event.target.seekTo(selectedClip.startTime || 0);
            }
          }
        }
      });
      return () => { if(newPlayer.destroy) newPlayer.destroy(); }
    }, [selectedVideo, selectedClip]);

    const runAutoRecommendation = async () => {
      if (!selectedVideo?.id) return;
      setIsAnalyzing(true);

      try {
        const response = await apiFetch('/api/clips/auto-detect', {
          method: 'POST',
          headers: buildApiHeaders(user),
          body: JSON.stringify({
            videoId: selectedVideo.id,
            mode: 'chapters'
          })
        });

        if (response.ok) {
          const candidates = await response.json();

          const newRecs = candidates.map((c) => ({
            start: c.startSec,
            end: c.endSec,
            label: c.label,
            type: 'comment_chapter',
            score: c.score
          }));

          setRecommendations(prev => {
            const combined = [...prev, ...newRecs];
            return combined.filter((v,i,a) => a.findIndex(t => Math.abs(t.start - v.start) < 1) === i);
          });
        } else {
          console.warn("구간 추천 실패:", await response.text());
          alert("댓글이나 챕터 정보를 가져오지 못했습니다. 영상에 타임스탬프 댓글이 있는지 확인해주세요.");
        }
      } catch (error) {
        console.error("Auto-detect error:", error);
        alert("분석 중 오류가 발생했습니다.");
      } finally {
        setIsAnalyzing(false);
      }
    };

    const saveClip = async () => {
      if (!ensureAuthenticated()) return;
      if (!clipTitle) return alert("제목을 입력해주세요.");
      if (startTime >= endTime) return alert("종료 시간은 시작 시간보다 뒤여야 합니다.");

      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);

      if (isEditMode) {
        // 수정 모드
        try {
          // 로컬 DB 업데이트
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'clips', selectedClip.id), {
            title: clipTitle,
            startTime,
            endTime,
            tags: tagArray
          });

          // API 업데이트 (d1Id가 있는 경우)
          if (selectedClip.d1Id) {
            const apiResponse = await apiFetch(`/api/clips/${selectedClip.d1Id}`, {
              method: 'PUT',
              headers: buildApiHeaders(user),
              body: JSON.stringify({
                title: clipTitle,
                startSec: startTime,
                endSec: endTime,
                tags: tagArray
              })
            });

            if (!apiResponse.ok) {
              console.warn('API clip update failed', await apiResponse.text());
            }
          }

          // 로컬 상태 업데이트
          setClips(prev => prev.map(c => c.id === selectedClip.id
            ? { ...c, title: clipTitle, startTime, endTime, tags: tagArray }
            : c
          ));

          alert("클립이 수정되었습니다.");
          setSelectedClip(null);
          setView('artist_detail');
        } catch (error) {
          console.error('Clip update error:', error);
          alert('클립 수정 중 오류가 발생했습니다.');
        }
      } else {
        // 생성 모드
        const isDuplicate = clips.some(c => c.videoId === selectedVideo.id && Math.abs(c.startTime - startTime) < 1 && Math.abs(c.endTime - endTime) < 1);
        if (isDuplicate) return alert("이미 동일한 구간의 클립이 존재합니다.");

        const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'clips'), {
          videoId: selectedVideo.id, youtubeId: selectedVideo.youtubeId, title: clipTitle, startTime, endTime, tags: tagArray, createdAt: serverTimestamp()
        });
        try {
          const videoD1Id = Number(selectedVideo?.d1Id ?? selectedVideo?.id);
          if (Number.isFinite(videoD1Id)) {
            const apiResponse = await apiFetch('/api/clips', {
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
        alert("클립이 저장되었습니다.");
        setView('artist_detail');
      }
    };

    return (
      <div className="h-full flex flex-col p-6 bg-[#030303]">
        <div className="flex items-center gap-4 mb-6 text-[#AAAAAA]">
          <button onClick={() => setView('artist_detail')} className="hover:text-white"><SkipBack/></button>
          <span className="text-white font-bold text-lg">{isEditMode ? '클립 수정' : '클립 에디터'}</span>
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
                  <button onClick={runAutoRecommendation} disabled={isAnalyzing} className="text-xs text-purple-400 hover:text-purple-300">{isAnalyzing ? "분석중..." : "댓글/챕터 가져오기"}</button>
                </div>
                <div className="space-y-2">
                   {recommendations.map((rec, i) => (
                      <div key={i} onClick={() => { setStartTime(rec.start); setEndTime(rec.end); editorPlayer?.seekTo(rec.start); }} className="p-2 hover:bg-[#282828] rounded cursor-pointer text-xs text-[#AAAAAA] flex justify-between items-center border border-transparent hover:border-[#333]">
                         <div className="flex flex-col"><span className="text-white font-bold">{rec.label}</span><span className="text-[10px]">{rec.type === 'chapter' ? 'YouTube Chapter' : 'Comment Timestamp'}</span></div>
                         <span className="font-mono">{formatTime(rec.start)}</span>
                      </div>
                   ))}
                   {recommendations.length === 0 && !isAnalyzing && <p className="text-xs text-[#555] text-center py-4">'댓글/챕터 가져오기'를 눌러<br/>타임스탬프를 불러오세요.</p>}
                </div>
             </div>
             <div className="bg-[#181818] p-4 rounded-lg border border-[#282828] space-y-4">
                <input value={clipTitle} onChange={e => setClipTitle(e.target.value)} placeholder="클립 제목" className="w-full bg-[#030303] text-white px-3 py-2 rounded border border-[#333] focus:border-white focus:outline-none text-sm"/>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="#태그1, #태그2" className="w-full bg-[#030303] text-white px-3 py-2 rounded border border-[#333] focus:border-white focus:outline-none text-sm"/>
                <button onClick={saveClip} className="w-full bg-white text-black font-bold py-2 rounded hover:bg-[#F1F1F1] text-sm">
                  {isEditMode ? '수정 완료' : '저장하기'}
                </button>
             </div>
          </div>
        </div>
      </div>
    )
  };

  const BottomPlayer = () => {
    const displayClip = currentClip || { title: "재생 중인 곡 없음", artistName: "Artist", startTime: 0, endTime: 0 };
    const duration = (displayClip.endTime - displayClip.startTime) || 1;
    const currentProgress = Math.max(0, playerProgress - displayClip.startTime);
    const progressPercent = Math.min(100, Math.max(0, (currentProgress / duration) * 100));

    // [디버깅] 재생 버튼 클릭 핸들러
    const togglePlay = useCallback((e) => {
      e?.stopPropagation(); // 상위 클릭 이벤트 전파 방지
      console.log("[BottomPlayer] 재생 버튼 클릭됨");

      // 1. 현재 곡이 없는 경우
      if (!currentClip) {
          console.log("[BottomPlayer] 현재 곡 없음. 대기열 확인:", playlist.length);
          if (playlist.length > 0) {
              setCurrentClip(playlist[0]);
              // setIsPlaying은 onReady에서 자동으로 설정됨
          } else {
              alert("재생할 곡이 없습니다. 영상을 대기열에 추가해주세요.");
          }
          return;
      }

      // 2. 플레이어 객체 확인
      if (!playerRef.current) {
          console.warn("[BottomPlayer] playerRef.current가 없음 (플레이어 미초기화). 잠시 후 재시도...");
          // 플레이어가 초기화될 때까지 짧은 지연 후 재시도
          setTimeout(() => {
              if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
                  console.log("[BottomPlayer] 재시도: 플레이어 준비됨, 재생 시작");
                  playerRef.current.playVideo();
                  setIsPlaying(true);
              }
          }, 500);
          return;
      }

      if (typeof playerRef.current.getPlayerState !== 'function') {
          console.error("[BottomPlayer] getPlayerState 함수가 없음. 플레이어가 아직 로딩 중이거나 깨짐.");
          return;
      }

      // 3. 실제 재생 명령
      try {
          const playerState = playerRef.current.getPlayerState();
          console.log("[BottomPlayer] 현재 플레이어 상태(API):", playerState);

          if (playerState === 1 || playerState === 3) { // 재생중(1) or 버퍼링(3)
              console.log("[BottomPlayer] 일시정지 명령 전송 (pauseVideo)");
              playerRef.current.pauseVideo();
              setIsPlaying(false);
          } else {
              console.log("[BottomPlayer] 재생 명령 전송 (playVideo)");
              playerRef.current.playVideo();
              setIsPlaying(true);
          }
      } catch (e) {
          console.error("[BottomPlayer] API 호출 중 에러:", e);
      }
    }, [currentClip, playlist]);

    const handleSeek = (e) => {
        const newTime = parseFloat(e.target.value);
        setPlayerProgress(displayClip.startTime + newTime);
        if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
            playerRef.current.seekTo(displayClip.startTime + newTime, true);
        }
    };

    return (
      <div className="fixed left-0 right-0 z-50 bg-[#212121] border-t border-[#333] md:bottom-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] h-[64px] md:h-[72px] flex items-center px-4 shadow-lg transition-all duration-200 group">

        {/* 인터랙티브 재생바 */}
        <div className="absolute top-[-6px] left-0 right-0 h-[12px] flex items-center cursor-pointer">
           <div className="absolute w-full h-[2px] bg-[#333] group-hover:h-[4px] transition-all"></div>
           <div className="absolute h-[2px] bg-red-600 group-hover:h-[4px] transition-all" style={{ width: `${progressPercent}%` }}></div>
           <input type="range" min={0} max={duration} step="0.1" value={currentProgress} onChange={handleSeek} className="absolute w-full h-full opacity-0 cursor-pointer z-10"/>
           <div className="absolute w-3 h-3 bg-red-600 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ left: `${progressPercent}%`, transform: 'translateX(-50%)' }}></div>
        </div>

        {/* 재생 컨트롤 */}
        <div className="flex items-center gap-3 md:gap-4 text-white mr-4">
           <button onClick={(e) => { e.stopPropagation(); playPrev(); }} className="p-2 active:scale-90 transition-transform text-[#AAA] hover:text-white"><SkipBack size={20} fill="currentColor"/></button>

           <button onClick={togglePlay} className="p-2 -m-2 active:scale-90 transition-transform">
              {isPlaying ? <Pause size={28} fill="currentColor"/> : <Play size={28} fill="currentColor"/>}
           </button>

           <button onClick={(e) => { e.stopPropagation(); playNext(); }} className="p-2 active:scale-90 transition-transform text-[#AAA] hover:text-white"><SkipForward size={20} fill="currentColor"/></button>

           <div className="text-xs text-[#AAAAAA] ml-2 font-mono hidden md:block w-20">
              {formatTime(currentProgress)} / {formatTime(duration)}
           </div>
        </div>

        <div className="flex-1 min-w-0 mr-4 cursor-pointer active:opacity-70" onClick={() => setIsVideoVisible(true)}>
            <div className="text-white text-sm font-medium truncate">{displayClip.title}</div>
            <div className="text-[#AAAAAA] text-xs truncate">{displayClip.artistName}</div>
        </div>

        <div className="flex items-center gap-4 text-[#AAAAAA]">
             <button
               className={`hover:text-white ${isLooping ? 'text-red-500' : ''}`}
               onClick={(e) => { e.stopPropagation(); setIsLooping(!isLooping); }}
             >
               <Repeat size={20}/>
             </button>
             <button
               className={`hover:text-white transition-colors ${isMobileQueueOpen ? 'text-red-500' : ''}`}
               onClick={(e) => { e.stopPropagation(); setIsMobileQueueOpen(!isMobileQueueOpen); }}
             >
               <ListMusic size={20}/>
             </button>
        </div>
      </div>
    );
  };

  if (isRestoringSession) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#333] border-t-white animate-spin" aria-label="세션 확인 중" />
          <p className="text-sm text-[#AAAAAA]">이전 로그인 세션을 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

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
        <header className="hidden md:flex h-16 items-center justify-between px-8 sticky top-0 z-10 bg-[#030303]/95 backdrop-blur-md">
           <div className="flex-1 max-w-xl relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" size={20} />
              <input type="text" placeholder="검색" className="w-full bg-[#212121] text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:bg-white focus:text-black placeholder-[#AAAAAA] transition-colors" />
           </div>
           <div className="ml-4 w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold">ME</div>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-[calc(64px+56px+env(safe-area-inset-bottom))] md:pb-24">
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

      <div
          className={`fixed z-40 transition-all duration-300 shadow-2xl rounded-lg overflow-hidden border border-[#333] bg-black
          ${isVideoVisible
              ? 'bottom-32 right-4 w-80 aspect-video opacity-100 translate-y-0 pointer-events-auto'
              : '-bottom-10 -right-10 w-px h-px opacity-0 pointer-events-none'
          }`}
      >
          <div id="global-player" className="w-full h-full"></div>

          {isVideoVisible && (
              <button onClick={() => setIsVideoVisible(false)} className="absolute top-2 right-2 bg-black/60 p-1 rounded-full text-white hover:bg-black/80">
                  <X size={14}/>
              </button>
          )}
      </div>

      {/* 토스트 메시지 */}
      {toastMessage && (
        <div className="fixed bottom-32 md:bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#1DB954] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <ListPlus size={18} />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      <BottomPlayer />
      <MobileNav />
    </div>
  );
}
