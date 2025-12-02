-- YouTube API 응답 캐싱을 위한 테이블
-- 일일 10,000회 할당량 관리를 위해 API 응답을 캐시

CREATE TABLE IF NOT EXISTS youtube_api_cache (
    cache_key TEXT PRIMARY KEY,
    cache_type TEXT NOT NULL,
    response_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expires_at TEXT NOT NULL
);

-- 만료된 캐시를 빠르게 찾기 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_youtube_api_cache_expires_at ON youtube_api_cache(expires_at);

-- 캐시 타입별 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_youtube_api_cache_type ON youtube_api_cache(cache_type);
