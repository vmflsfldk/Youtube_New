# 프론트엔드-백엔드 연동 가이드

제공된 React 단일 파일 예제(파이어베이스 + mock 데이터)를 이 저장소의 백엔드(Cloudflare Worker 기반 REST API)와 연결하는 방법을 정리했습니다. 아래 코드 스니펫을 적용하면 UI 상태 관리와 데이터 흐름은 그대로 유지하면서, 데이터 읽기/쓰기만 워커 API로 위임할 수 있습니다.

## 1) API 베이스 URL 설정
- Vite 환경 변수 `VITE_API_BASE_URL`을 사용해 API 호스트를 지정합니다. 기본값은 동일 오리진 `/api`이며, Cloudflare Pages/Functions가 워커를 프록시합니다. 로컬에서 `wrangler dev`를 쓸 때는 `http://127.0.0.1:8787`를 지정하면 됩니다.
- 교차 오리진이 필요하면 `VITE_ALLOW_CROSS_ORIGIN_API=true`로 강제 활성화할 수 있지만, 가능하면 동일 오리진 프록시(`/api`)를 권장합니다.

```ts
// frontend/src/api-client.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include", // 세션 쿠키 유지
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  /** Google ID Token을 세션 쿠키로 교환 */
  loginWithGoogleToken: (idToken: string) =>
    request<{ userId: number }>("/users/login", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    }),

  // 아티스트
  listArtists: (mine = false) => request(`/artists${mine ? "?mine=true" : ""}`),
  createArtist: (payload: {
    youtubeChannelId: string;
    name: string;
    displayName?: string;
    tags?: string[];
    agency?: string | null;
  }) => request("/artists", { method: "POST", body: JSON.stringify(payload) }),
  toggleFavorite: (artistId: number) =>
    request("/users/me/favorites", { method: "POST", body: JSON.stringify({ artistId }) }),

  // 영상
  createVideo: (videoUrl: string, artistId: number) =>
    request("/videos", { method: "POST", body: JSON.stringify({ videoUrl, artistId }) }),
  listVideos: (artistId?: number) =>
    request(`/videos${artistId ? `?artistId=${artistId}` : ""}`),
  updateVideoCategory: (id: number, category: string | null) =>
    request(`/videos/${id}/category`, { method: "PATCH", body: JSON.stringify({ category }) }),

  // 클립
  createClip: (payload: {
    videoId: number;
    title: string;
    startSec: number;
    endSec: number;
    tags?: string[];
  }) => request("/clips", { method: "POST", body: JSON.stringify(payload) }),
  listClips: (videoId?: number, artistId?: number) => {
    const params = new URLSearchParams();
    if (videoId) params.set("videoId", String(videoId));
    if (artistId) params.set("artistId", String(artistId));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/clips${suffix}`);
  },
  autoDetectClips: (videoId: number, mode: "captions" | "chapters" | "ml" | "hybrid") =>
    request("/clips/auto-detect", { method: "POST", body: JSON.stringify({ videoId, mode }) }),

  // 라이브러리/플레이리스트
  loadLibraryMedia: () => request("/library/media"),
  listPlaylists: () => request("/playlists"),
  createPlaylist: (title: string, visibility = "PRIVATE") =>
    request("/playlists", { method: "POST", body: JSON.stringify({ title, visibility }) }),
  addPlaylistItem: (playlistId: number, item: { videoId?: number; clipId?: number; order?: number }) =>
    request(`/playlists/${playlistId}/items`, { method: "POST", body: JSON.stringify(item) }),
};
```

## 2) React 컴포넌트에서 교체할 부분
1. **Firebase 초기화 제거**: `firebaseConfig`, `initializeApp`, Firestore 컬렉션 접근 로직을 모두 제거하고, 대신 `api` 클라이언트 호출로 데이터를 로드합니다.
2. **인증 흐름**: Google One Tap 또는 `@react-oauth/google`로 받은 ID Token을 `api.loginWithGoogleToken`에 전달하면 워커가 세션 쿠키를 발급합니다. 이후 요청은 `credentials: "include"`로 쿠키를 자동 전송합니다.
3. **데이터 조회**: `useEffect`에서 `api.listArtists()`, `api.listVideos(artistId)`, `api.listClips(videoId)`를 호출해 상태를 채웁니다. 기존 `onSnapshot` 대신 폴링이나 사용자 액션 후 재호출을 사용합니다.
4. **등록/수정**: 영상 URL 입력 시 `api.createVideo(url, artistId)` 호출 결과로 반환되는 `id`, `title`, `duration` 값을 사용해 UI를 갱신합니다. 클립 저장은 `api.createClip`으로 대체하며, 중복 검사 로직은 프론트에서 유지하거나 응답 코드를 활용하세요.
5. **자동 추천**: `api.autoDetectClips(videoId, "hybrid")` 결과를 기존 `mockAnalyzeVideo` 대신 추천 리스트로 사용합니다.
6. **즐겨찾기**: `toggleFavorite` 핸들러에서 `api.toggleFavorite(artist.id)` 호출 후 로컬 상태를 갱신합니다.

## 3) 상태 매핑 참고 예시
- `Artist`: `{ id, name, displayName, youtubeChannelId, profileImageUrl, tags, agency }`
- `Video`: `{ id, artistId, title, durationSec, thumbnailUrl, channelTitle, contentType }`
- `Clip`: `{ id, videoId, title, startSec, endSec, tags, likeCount }`

API 응답 키는 워커 구현에 맞춰 camelCase로 들어오므로, 기존 예제의 `startTime/endTime` 필드는 `startSec/endSec`으로 맞춰 변환하면 됩니다.

## 4) 개발/테스트 팁
- 로컬에서 백엔드를 띄우려면 `wrangler dev`를 실행해 D1 in-memory 모드를 사용하세요. 프론트엔드는 `npm run dev --prefix frontend`로 기동하고, Vite dev 서버 프록시를 `http://127.0.0.1:8787`로 맞추면 됩니다.
- CI 테스트는 `npm test`가 `src/worker.ts`를 대상으로 실행되므로, 프론트엔드 파일 추가만으로는 영향을 주지 않습니다. 단, 배포 빌드에서는 `frontend/dist` 산출물이 필요합니다.

---
위 스텝을 적용하면 기존 React UI 로직을 유지한 채, 저장소에 포함된 워커 백엔드와 안전하게 통신할 수 있습니다.
