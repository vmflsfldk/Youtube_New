# 기능 및 화면 가이드 (Features & Screens Guide)

## 목차 (Table of Contents)

1. [프로젝트 개요](#프로젝트-개요)
2. [주요 기능](#주요-기능)
3. [화면별 상세 가이드](#화면별-상세-가이드)
4. [컴포넌트 구조](#컴포넌트-구조)
5. [사용자 플로우](#사용자-플로우)

---

## 프로젝트 개요

**YouTube 클립 플레이어**는 유튜브 영상에서 하이라이트 클립을 생성하고 관리하는 웹 애플리케이션입니다.

### 핵심 가치
- 🎵 **음악 팬을 위한 최적화**: K-pop 등 음악 영상의 하이라이트 구간을 쉽게 저장하고 재생
- 🤖 **AI 기반 자동 추천**: 댓글, 챕터, 타임스탬프를 분석하여 자동으로 클립 구간 추천
- 📱 **크로스 플랫폼**: 데스크톱과 모바일에서 모두 사용 가능한 반응형 디자인
- 🔗 **YouTube 연동**: YouTube IFrame API를 활용한 원활한 영상 재생

### 기술 스택
- **프론트엔드**: React 18.3 + TypeScript 5.4 + Vite 5.4 + Tailwind CSS 3.4
- **백엔드**: Cloudflare Workers + D1 Database (SQLite)
- **인증**: Google OAuth 2.0
- **외부 API**: YouTube Data API v3, YouTube IFrame Player API

---

## 주요 기능

### 1. 사용자 인증 (Authentication)

#### Google OAuth 로그인
- **제공자**: Google OAuth 2.0
- **토큰 관리**: JWT 기반 세션
- **저장소**: localStorage에 토큰 및 사용자 정보 저장
- **익명 모드**: 게스트 사용자 지원 (읽기 전용)

**관련 코드**: `frontend/src/App.tsx:245-400`

#### 사용자 프로필
- 표시 이름 (Display Name)
- 이메일 주소
- 프로필 사진 (Google 계정 연동)

---

### 2. 아티스트 관리 (Artist Management)

#### 아티스트 등록
- **입력 정보**:
  - YouTube 채널 ID 또는 핸들 (@username)
  - 아티스트명 (한국어, 영어, 일본어)
  - 소속사/Agency
  - 태그 (쉼표로 구분)
  - 국가별 활동 여부 (한국/영어권/일본)

- **자동 채움**:
  - 채널 제목
  - 구독자 수
  - 프로필 이미지 (채널 썸네일)

**화면**: `AddArtistView` (`frontend/src/App.tsx:1792-1986`)

#### 아티스트 목록 보기
- **뷰 모드**:
  - **전체 보기** (All Artists)
  - **소속사별 그룹화** (By Agency)
  - **국가별 그룹화** (By Country)

- **기능**:
  - 실시간 검색 필터
  - 즐겨찾기 (♥ 버튼)
  - 프로필 이미지 클릭으로 상세 페이지 이동

**화면**: `ArtistListView` (`frontend/src/App.tsx:1478-1550`)

#### 아티스트 상세 페이지
- **표시 정보**:
  - 대형 프로필 이미지 (192x192)
  - 아티스트명, 소속사, 구독자 수
  - 태그 배지
  - 즐겨찾기 상태

- **콘텐츠 섹션**:
  - **등록된 영상**: 그리드 뷰로 썸네일 표시
  - **생성된 클립**: 클립 목록

- **가능한 액션**:
  - 새 영상 추가
  - 영상에서 클립 생성
  - 재생 목록에 추가

**화면**: `ArtistDetailView` (`frontend/src/App.tsx:1551-1684`)

---

### 3. 영상 및 클립 관리 (Video & Clip Management)

#### 영상 등록

##### 방법 1: 아티스트 페이지에서 직접 등록
1. 아티스트 상세 페이지 접속
2. "Add Video" 버튼 클릭
3. YouTube URL 입력
4. 자동으로 메타데이터 추출 및 저장

##### 방법 2: 통합 등록 화면 사용
1. "Register Media" 화면 접속
2. 아티스트 선택 (드롭다운 + 검색)
3. YouTube URL 입력
4. 자동 분석 실행

**화면**:
- `AddVideoView` (`frontend/src/App.tsx:1987-2060`)
- `RegisterMediaView` (`frontend/src/App.tsx:1097-1262`)

#### 자동 메타데이터 추출
영상 URL을 입력하면 다음 정보를 자동으로 가져옵니다:
- 제목 (Title)
- 재생 시간 (Duration)
- 썸네일 이미지
- 채널 정보
- 카테고리 (Music, Entertainment 등)

**API**: `POST /api/videos`

#### 클립 생성

##### 클립 에디터 기능
- **타임라인 슬라이더**: 시작/종료 시간을 시각적으로 조정
- **숫자 입력**: 초 단위로 정확한 시간 입력
- **실시간 미리보기**: YouTube 플레이어로 즉시 확인
- **클립 정보 입력**:
  - 제목 (Title)
  - 태그 (Tags, 쉼표로 구분)
- **중복 감지**: 동일 시간 구간 클립 생성 방지

**화면**: `ClipEditorView` (`frontend/src/App.tsx:2061-2280`)

##### AI 자동 추천
영상을 등록하면 자동으로 클립 구간을 추천합니다:

- **분석 소스**:
  1. **영상 설명** (Description)의 타임스탬프
  2. **댓글** (Comments)의 타임스탬프
  3. **챕터** (Chapters)
  4. **자막** (Captions) - 가사 패턴 분석

- **추천 형식**:
  ```json
  {
    "label": "Chorus",
    "startSec": 73,
    "endSec": 98,
    "score": 0.92
  }
  ```

- **사용 방법**:
  1. 추천 목록에서 항목 클릭
  2. 자동으로 시작/종료 시간 적용
  3. 필요시 미세 조정
  4. 저장

**API**: `POST /api/clips/auto-detect`

---

### 4. 플레이어 기능 (Playback Features)

#### 글로벌 플레이어
화면 하단에 고정된 플레이어 컨트롤:

- **기본 컨트롤**:
  - ⏯️ 재생/일시정지
  - ⏮️ 이전 트랙
  - ⏭️ 다음 트랙
  - 🔀 셔플 모드
  - 🔁 반복 모드

- **진행바**:
  - 현재 재생 시간 표시
  - 드래그로 특정 구간으로 이동 (Seek)
  - 남은 시간 표시

- **볼륨 컨트롤**: YouTube 플레이어 네이티브 컨트롤 사용

**컴포넌트**: `BottomPlayer` (`frontend/src/App.tsx:2281-2525`)

#### 클립 루핑 (Loop)
- 클립 종료 시 자동으로 시작 지점으로 돌아가기
- YouTube IFrame API의 `onStateChange` 이벤트 활용
- `ENDED` 상태 감지 → `seekTo(startSec)` 실행

**로직**: `frontend/src/components/clipPlayerStateChange.ts`

#### 재생 모드
1. **클립 모드**: 지정된 시작/종료 시간만 재생
2. **전체 영상 모드**: 전체 영상 재생
3. **플레이리스트 모드**: 대기열의 클립/영상을 순차 재생

---

### 5. 재생 목록 관리 (Playlist Management)

#### 대기열 (Queue)
- **추가 방법**:
  - 홈 화면에서 "Add to Queue" 버튼
  - 아티스트 페이지에서 영상/클립 추가
  - 라이브러리에서 추가

- **관리**:
  - 드래그 앤 드롭으로 순서 변경 (예정)
  - 개별 항목 삭제
  - 전체 대기열 초기화

- **표시 정보**:
  - 썸네일
  - 제목
  - 아티스트명
  - 재생 시간

**위치**: 오른쪽 사이드바 (`RightSidebar` - `frontend/src/App.tsx:901-1094`)

#### 플레이리스트 저장
- **생성**:
  - 현재 대기열을 플레이리스트로 저장
  - 플레이리스트 이름 지정
  - 공개/비공개 설정

- **불러오기**:
  - 저장된 플레이리스트 목록 조회
  - 클릭으로 대기열에 로드

- **저장소**: localStorage + D1 Database

**API**:
- `POST /api/playlists` - 플레이리스트 생성
- `GET /api/playlists` - 목록 조회
- `POST /api/playlists/{id}/items` - 항목 추가

---

### 6. 콘텐츠 탐색 (Content Discovery)

#### 홈 화면
- **최신 영상**: 최근 등록된 8개 영상 (그리드 뷰)
- **최신 클립**: 최근 생성된 8개 클립 (캐러셀)
- **빠른 액션**:
  - 바로 재생
  - 대기열 추가
  - 새 미디어 등록

**화면**: `HomeView` (`frontend/src/App.tsx:1263-1399`)

#### 라이브 방송 (Live Broadcasts)
- **기능**:
  - 등록된 아티스트의 실시간 라이브 스트림 감지
  - 라이브 상태 표시 (🔴 LIVE 배지)
  - 시청자 수 표시
  - 임베디드 플레이어로 바로 시청

- **레이아웃**: 2열 그리드 (데스크톱)

**화면**: `LiveBroadcastView` (`frontend/src/App.tsx:1400-1477`)

#### 곡 데이터베이스 (Song Database)
전체 영상과 클립을 검색 가능한 카탈로그로 제공:

- **뷰 모드**:
  1. **아티스트별 보기**: 아티스트로 그룹화
  2. **곡별 보기**: 곡 제목으로 그룹화

- **테이블 컬럼**:
  - 제목/아티스트
  - 앨범/채널
  - 재생 시간
  - 액션 버튼 (재생, 대기열 추가, 클립 생성)

- **검색**: 아티스트명, 곡명으로 실시간 필터링

**화면**: `SongDatabaseView` (`frontend/src/App.tsx:1685-1791`)

---

## 화면별 상세 가이드

### 1. 홈 (Home)

**네비게이션 ID**: `home`
**코드 위치**: `frontend/src/App.tsx:1263-1399`

#### 레이아웃 구조
```
┌─────────────────────────────────────────┐
│  Latest Videos (최신 영상)               │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │ V1 │ │ V2 │ │ V3 │ │ V4 │  (4x2 Grid)│
│  └────┘ └────┘ └────┘ └────┘           │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │ V5 │ │ V6 │ │ V7 │ │ V8 │           │
│  └────┘ └────┘ └────┘ └────┘           │
├─────────────────────────────────────────┤
│  Latest Clips (최신 클립)                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │ C1 │ │ C2 │ │ C3 │ │ C4 │  (Carousel)│
│  └────┘ └────┘ └────┘ └────┘           │
└─────────────────────────────────────────┘
```

#### 각 카드의 정보
- **썸네일 이미지** (16:9 비율)
- **제목**: 호버 시 전체 제목 표시
- **아티스트명**
- **재생 시간** (MM:SS)
- **호버 액션**:
  - ▶️ 바로 재생
  - ➕ 대기열 추가

#### 사용자 시나리오
1. 사용자가 로그인 후 홈 화면에 접속
2. 최신 콘텐츠 중 관심 있는 영상/클립 발견
3. 썸네일 호버로 액션 버튼 표시
4. 재생 또는 대기열 추가
5. 하단 플레이어에서 재생 시작

---

### 2. 아티스트 목록 (Artist List)

**네비게이션 ID**: `artist_list`
**코드 위치**: `frontend/src/App.tsx:1478-1550`

#### 헤더 영역
```
┌─────────────────────────────────────────┐
│  [All] [By Agency] [By Country]         │
│  🔍 Search artists...        [+ Add New]│
└─────────────────────────────────────────┘
```

#### 필터 모드

##### 1. All Artists (전체 보기)
- 모든 아티스트를 그리드로 표시
- 6열 그리드 (데스크톱), 3열 (태블릿), 2열 (모바일)

##### 2. By Agency (소속사별)
```
SM Entertainment
  ┌────┐ ┌────┐ ┌────┐
  │ A1 │ │ A2 │ │ A3 │
  └────┘ └────┘ └────┘

YG Entertainment
  ┌────┐ ┌────┐
  │ A4 │ │ A5 │
  └────┘ └────┘
```

##### 3. By Country (국가별)
- 한국 (Korea): `country_kr = true`
- 영어권 (English): `country_en = true`
- 일본 (Japan): `country_jp = true`

#### 아티스트 카드 구조
```
┌─────────────┐
│   ┌─────┐   │
│   │     │   │  ← 원형 프로필 이미지 (128x128)
│   │     │   │
│   └─────┘   │
│  Artist Name│  ← 아티스트명
│     ♥ 123   │  ← 즐겨찾기 버튼 + 카운트
└─────────────┘
```

#### 인터랙션
- **클릭**: 아티스트 상세 페이지로 이동
- **♥ 버튼**: 즐겨찾기 토글 (로그인 필요)
- **검색**: 타이핑 즉시 필터링 (대소문자 구분 없음)

---

### 3. 아티스트 상세 (Artist Detail)

**네비게이션 ID**: `artist_detail`
**코드 위치**: `frontend/src/App.tsx:1551-1684`

#### 상단 프로필 섹션
```
┌─────────────────────────────────────────┐
│  ┌─────────┐                            │
│  │         │  Artist Name               │
│  │ Profile │  Agency Name               │
│  │  Image  │  👥 1.2M subscribers       │
│  │         │  🏷️ K-pop, Girl Group      │
│  └─────────┘  ♥ Favorite               │
└─────────────────────────────────────────┘
```

#### 탭 구조
```
┌─────────────────────────────────────────┐
│  [Videos] [Clips]                       │
├─────────────────────────────────────────┤
│  Content based on selected tab          │
└─────────────────────────────────────────┘
```

##### Videos 탭
- 등록된 모든 영상 표시
- 그리드 뷰 (4열)
- 각 카드 정보:
  - 썸네일
  - 제목
  - 재생 시간
  - 등록 날짜
- 액션:
  - ▶️ 재생
  - ✂️ 클립 생성
  - ➕ 대기열 추가

##### Clips 탭
- 생성된 모든 클립 표시
- 리스트 뷰
- 각 항목 정보:
  - 썸네일 (원본 영상)
  - 클립 제목
  - 시간 구간 (00:73 - 01:38)
  - 태그
- 액션:
  - ▶️ 재생
  - ✏️ 편집
  - 🗑️ 삭제

#### 하단 액션 버튼
- **[+ Add Video]**: 이 아티스트에 새 영상 등록

---

### 4. 라이브 방송 (Live Broadcasts)

**네비게이션 ID**: `live`
**코드 위치**: `frontend/src/App.tsx:1400-1477`

#### 라이브 카드 레이아웃
```
┌──────────────────────────────┐
│ 🔴 LIVE  👁️ 12,543 viewers   │
│ ┌──────────────────────────┐ │
│ │                          │ │
│ │   YouTube Live Player    │ │
│ │                          │ │
│ └──────────────────────────┘ │
│ Artist Name                  │
│ Stream Title                 │
└──────────────────────────────┘
```

#### 기능
- **실시간 감지**: 주기적으로 라이브 상태 확인
- **임베디드 재생**: YouTube IFrame으로 즉시 시청
- **상태 표시**:
  - 🔴 LIVE: 현재 방송 중
  - ⚪ Offline: 방송 종료
- **시청자 수**: 포맷팅된 숫자 (예: 12.5K, 1.2M)

#### 빈 상태 (No Live Streams)
```
┌─────────────────────────────────────────┐
│                                         │
│        📺                               │
│   No live broadcasts at the moment      │
│                                         │
└─────────────────────────────────────────┘
```

---

### 5. 곡 데이터베이스 (Song Database / Library)

**네비게이션 ID**: `library`
**코드 위치**: `frontend/src/App.tsx:1685-1791`

#### 헤더 컨트롤
```
┌─────────────────────────────────────────┐
│  [By Artist] [By Song]                  │
│  🔍 Search songs or artists...          │
└─────────────────────────────────────────┘
```

#### By Artist 뷰
```
┌─────────────────────────────────────────┐
│  ▼ Artist A (12 songs)                  │
├─────────────────┬───────────┬──────────┤
│ Title | Artist  │ Album     │ Duration │ Actions │
├─────────────────┼───────────┼──────────┤
│ Song 1          │ Channel   │ 03:45    │ ▶️ ➕ ✂️ │
│ Song 2          │ Channel   │ 02:30    │ ▶️ ➕ ✂️ │
└─────────────────┴───────────┴──────────┘
```

#### By Song 뷰
```
┌─────────────────────────────────────────┐
│  ▼ Song Title X (3 versions)            │
├─────────────────┬───────────┬──────────┤
│ Title | Artist  │ Album     │ Duration │ Actions │
├─────────────────┼───────────┼──────────┤
│ Ver. A | Artist1│ Album 1   │ 03:45    │ ▶️ ➕ ✂️ │
│ Ver. B | Artist2│ Album 2   │ 03:50    │ ▶️ ➕ ✂️ │
└─────────────────┴───────────┴──────────┘
```

#### 테이블 기능
- **Sticky Header**: 스크롤 시 그룹 헤더 고정
- **호버 효과**: 행 hover 시 배경색 변경
- **정렬**: 기본적으로 아티스트명 또는 곡명 알파벳 순
- **검색**: 아티스트명, 곡명, 앨범명에서 검색

#### 액션 버튼
- ▶️ **Play**: 즉시 재생
- ➕ **Add to Queue**: 대기열 추가
- ✂️ **Create Clip**: 클립 에디터로 이동

---

### 6. 미디어 등록 (Register Media)

**네비게이션 ID**: `register_media`
**코드 위치**: `frontend/src/App.tsx:1097-1262`

#### 단계별 프로세스

##### Step 1: 아티스트 선택
```
┌─────────────────────────────────────────┐
│  Select Artist                          │
│  ┌───────────────────────────────────┐  │
│  │ 🔍 Search artists...          ▼  │  │
│  └───────────────────────────────────┘  │
│  Dropdown list:                         │
│  - Artist A                             │
│  - Artist B                             │
│  - Artist C                             │
└─────────────────────────────────────────┘
```

##### Step 2: URL 입력
```
┌─────────────────────────────────────────┐
│  YouTube Video URL                      │
│  ┌───────────────────────────────────┐  │
│  │ https://youtube.com/watch?v=...  │  │
│  └───────────────────────────────────┘  │
│  [Register & Analyze]                   │
└─────────────────────────────────────────┘
```

##### Step 3: 자동 분석
```
┌─────────────────────────────────────────┐
│  ⏳ Fetching video metadata...          │
│  ✅ Video registered successfully        │
│  🤖 Analyzing for clip suggestions...   │
│  ✅ Found 5 potential clips!            │
└─────────────────────────────────────────┘
```

##### Step 4: 클립 에디터로 이동
- 자동으로 추천된 클립 구간들이 표시됨
- 사용자가 선택 또는 수정하여 저장

#### 에러 처리
- ❌ Invalid URL format
- ❌ Video already registered
- ❌ No artist selected
- ❌ Network error

---

### 7. 클립 에디터 (Clip Editor)

**네비게이션 ID**: `clip_editor`
**코드 위치**: `frontend/src/App.tsx:2061-2280`

#### 레이아웃 구조
```
┌─────────────────────────────────────────┐
│  Video Title                            │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │   YouTube Player                  │  │
│  │   (Preview)                       │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  Timeline Slider                        │
│  ├────●──────────────────●───────────┤  │
│  0:00        [Current]        3:45     │
├─────────────────────────────────────────┤
│  Clip Details                           │
│  Start: [00:73] End: [01:38]           │
│  Title: [___________________________]   │
│  Tags:  [chorus, highlight          ]   │
├─────────────────────────────────────────┤
│  AI Recommendations                     │
│  ┌─────────────────────────────────┐   │
│  │ 🎵 Chorus A                     │   │
│  │ 01:13 - 01:38 (Score: 0.92)    │   │
│  │ [Apply]                         │   │
│  ├─────────────────────────────────┤   │
│  │ 🎵 Chorus B                     │   │
│  │ 02:45 - 03:10 (Score: 0.88)    │   │
│  │ [Apply]                         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Run Auto-Recommendation]              │
├─────────────────────────────────────────┤
│  [Cancel]           [Save Clip]         │
└─────────────────────────────────────────┘
```

#### 타임라인 컨트롤
- **이중 슬라이더**: 시작과 종료 지점을 각각 드래그
- **숫자 입력**: 초 단위로 정확한 값 입력
- **실시간 동기화**: 슬라이더와 입력 필드 양방향 연동

#### AI 추천 패널
각 추천 항목은 다음을 표시:
- **라벨**: Intro, Verse, Chorus, Bridge, Outro 등
- **시간 구간**: MM:SS 형식
- **신뢰도 점수**: 0.0 ~ 1.0
- **[Apply] 버튼**: 클릭 시 해당 구간을 자동 적용

#### 유효성 검사
저장 전 다음 항목을 확인:
- ✅ 클립 제목이 비어있지 않음
- ✅ 시작 시간 < 종료 시간
- ✅ 구간이 0초 이상
- ✅ 종료 시간이 영상 길이를 초과하지 않음
- ✅ 중복 클립이 아님

#### 저장 프로세스
1. 입력값 검증
2. API 호출: `POST /api/clips`
3. 성공 시 아티스트 상세 페이지로 리디렉션
4. 실패 시 에러 메시지 표시

---

### 8. 아티스트 추가 (Add Artist)

**네비게이션 ID**: `add_artist`
**코드 위치**: `frontend/src/App.tsx:1792-1986`

#### 2단계 프로세스

##### Step 1: 채널 ID 입력
```
┌─────────────────────────────────────────┐
│  Add New Artist                         │
├─────────────────────────────────────────┤
│  YouTube Channel ID or Handle           │
│  ┌───────────────────────────────────┐  │
│  │ UC1234567890 또는 @username      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Fetch Channel Info]                   │
└─────────────────────────────────────────┘
```

##### Step 2: 정보 확인 및 수정
```
┌─────────────────────────────────────────┐
│  Channel Info                           │
│  ┌─────────┐                            │
│  │ Channel │  Fetched from YouTube      │
│  │  Image  │  👥 1,234,567 subscribers  │
│  └─────────┘                            │
├─────────────────────────────────────────┤
│  Korean Name:  [__________________]     │
│  English Name: [__________________]     │
│  Japanese Name:[__________________]     │
│  Agency:       [__________________]     │
│  Tags:         [K-pop, Girl Group  ]    │
│                                         │
│  Available in:                          │
│  ☑ Korea  ☑ English  ☐ Japan          │
├─────────────────────────────────────────┤
│  [Cancel]              [Add Artist]     │
└─────────────────────────────────────────┘
```

#### 자동 채움 필드
YouTube 채널 조회 후 자동으로 채워지는 정보:
- 채널 제목 → Korean Name (기본값)
- 채널 썸네일 → Profile Image URL
- 구독자 수 → Subscriber Count

#### 수동 입력 필드
- Korean Name (필수)
- English Name (선택)
- Japanese Name (선택)
- Agency/소속사 (선택)
- Tags (쉼표로 구분)
- Country Flags (체크박스)

#### 데이터 저장
1. 로컬 상태 업데이트
2. API 호출: `POST /api/artists`
3. D1 데이터베이스 저장
4. 성공 시 아티스트 목록으로 리디렉션

---

## 컴포넌트 구조

### 네비게이션 컴포넌트

#### 1. Sidebar (Desktop)
**위치**: `frontend/src/App.tsx:799-874`

```
┌─────────────────┐
│  🏠 Home        │
│  👤 Artists     │
│  📚 Library     │
│  📡 Live        │
│  ➕ Add Artist  │
│  ➕ Add Media   │
├─────────────────┤
│  User Profile   │
│  📧 email@...   │
│  [Logout]       │
└─────────────────┘
```

#### 2. MobileNav (Mobile)
**위치**: `frontend/src/App.tsx:875-900`

하단 고정 네비게이션 바:
```
┌────┬────┬────┬────┬────┐
│ 🏠 │ 👤 │ ➕ │ 📚 │ 👤 │
└────┴────┴────┴────┴────┘
```

#### 3. RightSidebar (Queue)
**위치**: `frontend/src/App.tsx:901-1094`

```
┌─────────────────────────┐
│  Queue (12)             │
│  [Clear All]            │
├─────────────────────────┤
│  ┌───┐ Song Title 1     │
│  │ T │ Artist Name      │
│  └───┘ 03:45       [×]  │
├─────────────────────────┤
│  ┌───┐ Song Title 2     │
│  │ T │ Artist Name      │
│  └───┘ 02:30       [×]  │
├─────────────────────────┤
│  Playlists              │
│  [+ New Playlist]       │
│  - My Favorites         │
│  - K-pop Hits           │
│  - Chill Vibes          │
└─────────────────────────┘
```

---

### 재사용 컴포넌트

#### ArtistCard
**위치**: `frontend/src/App.tsx:1063-1096`

프로필 이미지, 아티스트명, 즐겨찾기 버튼을 포함한 카드

**Props**:
```typescript
interface ArtistCardProps {
  artist: Artist;
  onFavorite: (artistId: number) => void;
  isFavorited: boolean;
}
```

#### VideoCard (인라인)
썸네일, 제목, 재생 시간, 액션 버튼을 포함한 카드

**Props**:
```typescript
interface VideoCardProps {
  video: Video;
  onPlay: () => void;
  onAddToQueue: () => void;
  onCreateClip?: () => void;
}
```

---

## 사용자 플로우

### 플로우 1: 첫 방문자가 클립 재생까지

```
1. 홈페이지 접속
   ↓
2. Google 로그인 (또는 게스트로 계속)
   ↓
3. 홈 화면에서 최신 클립 발견
   ↓
4. 클립 카드 호버 → "Play" 버튼 클릭
   ↓
5. 하단 플레이어에서 클립 재생 시작
   ↓
6. 클립 종료 → 자동 루프 또는 다음 트랙
```

### 플로우 2: 새 아티스트 등록부터 클립 생성까지

```
1. 로그인
   ↓
2. "Add Artist" 메뉴 클릭
   ↓
3. YouTube 채널 ID 입력 (@username 또는 UC...)
   ↓
4. 채널 정보 확인 → 아티스트명 등 수정
   ↓
5. "Add Artist" 버튼 클릭
   ↓
6. 아티스트 상세 페이지로 자동 이동
   ↓
7. "Add Video" 버튼 클릭
   ↓
8. YouTube 영상 URL 입력
   ↓
9. 자동으로 메타데이터 추출 및 클립 분석 시작
   ↓
10. 클립 에디터 화면 표시 (AI 추천 포함)
   ↓
11. 추천 중 하나 선택 또는 수동 조정
   ↓
12. 클립 제목/태그 입력
   ↓
13. "Save Clip" 버튼 클릭
   ↓
14. 아티스트 페이지로 돌아가서 생성된 클립 확인
```

### 플로우 3: 플레이리스트 생성 및 공유

```
1. 여러 클립/영상을 대기열에 추가
   ↓
2. 오른쪽 사이드바 "Save as Playlist" 클릭
   ↓
3. 플레이리스트 이름 입력
   ↓
4. 공개/비공개 선택
   ↓
5. 저장 완료
   ↓
6. 플레이리스트 목록에서 언제든지 불러오기
   ↓
7. (공개 플레이리스트인 경우) URL 공유
```

---

## 데이터 모델

### Artist
```typescript
interface Artist {
  id: number;
  name: string;              // 한글명
  display_name?: string;     // 영어명
  japanese_name?: string;    // 일본어명
  youtube_channel_id: string;
  agency?: string;           // 소속사
  tags?: string;             // 쉼표로 구분
  country_kr: boolean;       // 한국 활동
  country_en: boolean;       // 영어권 활동
  country_jp: boolean;       // 일본 활동
  subscriber_count?: number;
  profile_image_url?: string;
  created_at: string;
  created_by: number;        // User ID
}
```

### Video
```typescript
interface Video {
  id: number;
  artist_id: number;
  youtube_video_id: string;
  title: string;
  duration_sec: number;
  thumbnail_url: string;
  channel_id: string;
  channel_title?: string;
  category?: string;         // Music, Entertainment 등
  content_type: 'OFFICIAL_VIDEO' | 'CLIP_SOURCE';
  is_hidden: boolean;
  created_at: string;
  created_by: number;
}
```

### Clip
```typescript
interface Clip {
  id: number;
  video_id: number;
  title: string;
  start_sec: number;
  end_sec: number;
  tags?: string;             // 쉼표로 구분
  created_at: string;
  created_by: number;
}
```

### Playlist
```typescript
interface Playlist {
  id: number;
  name: string;
  description?: string;
  is_public: boolean;
  created_at: string;
  created_by: number;
}

interface PlaylistItem {
  id: number;
  playlist_id: number;
  clip_id?: number;          // 클립이면 clip_id
  video_id?: number;         // 전체 영상이면 video_id
  position: number;          // 순서
}
```

---

## 상태 관리

### 전역 상태 (React State)
**위치**: `frontend/src/App.tsx:245-400`

```typescript
// 인증
const [user, setUser] = useState<User | null>(null);

// 네비게이션
const [view, setView] = useState<ViewType>('home');

// 데이터 컬렉션
const [artists, setArtists] = useState<Artist[]>([]);
const [videos, setVideos] = useState<Video[]>([]);
const [clips, setClips] = useState<Clip[]>([]);
const [favorites, setFavorites] = useState<Set<number>>(new Set());

// 재생 상태
const [playlist, setPlaylist] = useState<MediaItem[]>([]);
const [currentClip, setCurrentClip] = useState<MediaItem | null>(null);
const [isPlaying, setIsPlaying] = useState(false);
const [playerProgress, setPlayerProgress] = useState(0);
const [isLooping, setIsLooping] = useState(false);

// 선택 상태
const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
```

### 로컬 스토리지 (Persistence)
```typescript
// 저장 항목
localStorage.setItem('authToken', token);
localStorage.setItem('user', JSON.stringify(user));
localStorage.setItem('savedPlaylists', JSON.stringify(playlists));
localStorage.setItem('queue', JSON.stringify(playlist));

// 세션 복원
useEffect(() => {
  const token = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('user');
  if (token && savedUser) {
    setUser(JSON.parse(savedUser));
  }
}, []);
```

---

## API 엔드포인트 요약

### 인증 (Authentication)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/users/login` | Google ID 토큰으로 로그인 |
| POST | `/api/users/me/nickname` | 닉네임 변경 |

### 아티스트 (Artists)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/artists` | 전체 아티스트 목록 |
| GET | `/api/artists?mine=true` | 내 즐겨찾기 아티스트 |
| POST | `/api/artists` | 새 아티스트 등록 |
| POST | `/api/artists/preview` | 채널 정보 미리보기 |
| PUT | `/api/artists/{id}/profile` | 아티스트 정보 수정 |
| POST | `/api/users/me/favorites` | 즐겨찾기 토글 |

### 영상 (Videos)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/videos?artistId=123` | 아티스트별 영상 조회 |
| POST | `/api/videos` | YouTube URL로 영상 등록 |
| PATCH | `/api/videos/{id}` | 영상 정보 수정 |
| POST | `/api/videos/clip-suggestions` | 자동 클립 추천 |

### 클립 (Clips)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/clips?videoId=77` | 영상별 클립 조회 |
| POST | `/api/clips` | 새 클립 생성 |
| PUT | `/api/clips/{id}` | 클립 수정 |
| POST | `/api/clips/auto-detect` | AI 클립 분석 |

### 라이브러리 (Library)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/library/media` | 전체 미디어 목록 |
| GET | `/api/library/songs` | 곡 중심 뷰 |
| GET | `/api/public/library` | 공개 라이브러리 (인증 불필요) |
| GET | `/api/public/clips` | 공개 클립 (인증 불필요) |

### 플레이리스트 (Playlists)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/playlists` | 내 플레이리스트 목록 |
| POST | `/api/playlists` | 새 플레이리스트 생성 |
| POST | `/api/playlists/{id}/items` | 플레이리스트에 항목 추가 |
| DELETE | `/api/playlists/{id}/items/{itemId}` | 항목 삭제 |

### 유틸리티 (Utility)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/public/youtube-channel?channelId=UC...` | 채널 정보 조회 |

---

## 키보드 단축키 (예정)

| 키 | 기능 |
|----|------|
| `Space` | 재생/일시정지 |
| `→` | 5초 앞으로 |
| `←` | 5초 뒤로 |
| `↑` | 볼륨 올리기 |
| `↓` | 볼륨 내리기 |
| `I` | 클립 시작점 설정 |
| `O` | 클립 종료점 설정 |
| `L` | 루프 토글 |
| `S` | 셔플 토글 |
| `N` | 다음 트랙 |
| `P` | 이전 트랙 |
| `/` | 검색 포커스 |
| `Esc` | 모달 닫기 |

---

## 모바일 최적화

### 반응형 브레이크포인트
```css
/* Tailwind CSS 기준 */
sm: 640px   /* 모바일 가로 */
md: 768px   /* 태블릿 */
lg: 1024px  /* 데스크톱 */
xl: 1280px  /* 대형 화면 */
```

### 모바일 전용 기능
- **하단 네비게이션 바**: 데스크톱의 사이드바를 하단 5개 아이콘으로 대체
- **스와이프 제스처**: 대기열 항목 좌우 스와이프로 삭제 (예정)
- **터치 최적화**: 버튼 최소 크기 44x44px
- **풀스크린 플레이어**: 모바일에서 플레이어 확장 가능

### 성능 최적화
- **Lazy Loading**: 썸네일 이미지 지연 로딩
- **Virtual Scrolling**: 긴 목록에서 가상 스크롤 (예정)
- **이미지 압축**: WebP 형식 우선 사용
- **코드 스플리팅**: 화면별 동적 임포트 (예정)

---

## 브라우저 호환성

### 지원 브라우저
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### 필수 기능
- JavaScript ES6+
- LocalStorage
- Fetch API
- YouTube IFrame API
- Google OAuth 2.0

---

## 향후 개발 예정 기능

### 단기 (1-2개월)
- [ ] 키보드 단축키 전체 구현
- [ ] 플레이리스트 공유 URL 생성
- [ ] 대기열 드래그 앤 드롭 재정렬
- [ ] 클립 편집 기능 (수정/삭제)
- [ ] 사용자 프로필 페이지

### 중기 (3-6개월)
- [ ] 소셜 기능 (좋아요, 댓글)
- [ ] 인기 클립 랭킹
- [ ] 추천 알고리즘 개선
- [ ] PWA 지원 (오프라인 모드)
- [ ] 다국어 지원 (한국어, 영어, 일본어)

### 장기 (6개월+)
- [ ] 커뮤니티 기능 (팔로우, 피드)
- [ ] 모바일 앱 (React Native)
- [ ] 실시간 협업 플레이리스트
- [ ] 머신러닝 기반 자동 태깅
- [ ] 스트리밍 품질 선택

---

## 문제 해결 (Troubleshooting)

### 일반적인 문제

#### 1. 로그인 실패
**증상**: Google 로그인 버튼 클릭 후 아무 반응 없음

**해결 방법**:
- 브라우저 쿠키 허용 확인
- 팝업 차단 해제
- 시크릿 모드로 시도
- OAuth 클라이언트 ID 확인

#### 2. 영상 재생 안 됨
**증상**: 플레이어가 로딩 중 상태에 멈춤

**해결 방법**:
- YouTube IFrame API 스크립트 로딩 확인
- 영상이 지역 제한되지 않았는지 확인
- 브라우저 콘솔에서 에러 확인
- 페이지 새로고침

#### 3. 클립 저장 실패
**증상**: "Save Clip" 버튼 클릭 후 에러 메시지

**해결 방법**:
- 네트워크 연결 확인
- 시작 시간 < 종료 시간 확인
- 클립 제목 입력 확인
- 중복 클립 여부 확인

#### 4. 대기열이 사라짐
**증상**: 페이지 새로고침 후 대기열 초기화

**해결 방법**:
- localStorage 저장 기능 확인 (현재 미구현)
- 플레이리스트로 저장하여 보존
- 브라우저 개인정보 보호 모드 확인

---

## 지원 및 피드백

### 버그 리포트
GitHub Issues: [프로젝트 저장소 URL]

### 기능 제안
Discussion 탭에서 아이디어 공유

### 문의
- 이메일: [이메일 주소]
- Discord: [커뮤니티 링크]

---

**마지막 업데이트**: 2025-12-01
**문서 버전**: 1.0.0
