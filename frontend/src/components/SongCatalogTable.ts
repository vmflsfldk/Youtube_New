interface ClipRow {
  id: number;
  title: string;
  videoId: number;
  videoTitle: string | null;
  originalComposer: string | null;
  videoOriginalComposer: string | null;
  artistDisplayName: string | null;
  artistName: string | null;
}

interface VideoRow {
  id: number;
  title: string;
  originalComposer: string | null;
  artistDisplayName: string | null;
  artistName: string | null;
  contentType: string | null;
  category: string | null;
}

interface SongRow {
  id: number;
  title: string;
  originalComposer: string | null;
  artistDisplayName: string | null;
  artistName: string | null;
  contentType: string | null;
  category: string | null;
}

export interface CatalogRecord {
  id: number;
  artist: string;
  composer: string;
  songTitle: string;
  clipTitle: string;
  artistValue: string;
  composerValue: string;
  songValue: string;
  clipValue: string;
}

const normaliseName = (preferred?: string | null, fallback?: string | null): string => {
  const primary = preferred?.trim();
  const secondary = fallback?.trim();
  return primary && primary.length > 0
    ? primary
    : secondary && secondary.length > 0
      ? secondary
      : "표기되지 않은 아티스트";
};

const normaliseComposer = (clipComposer?: string | null, videoComposer?: string | null): string => {
  const composer = clipComposer?.trim() || videoComposer?.trim();
  return composer && composer.length > 0 ? composer : "표기되지 않은 원곡자";
};

const shouldIncludeSong = (song: SongRow): boolean => {
  return song.contentType === "OFFICIAL" && song.category !== "live";
};

const shouldIncludeVideoAsSong = (video: VideoRow, clipVideoIds: Set<number>): boolean => {
  return video.contentType === "OFFICIAL" && video.category !== "live" && !clipVideoIds.has(video.id);
};

export const buildCatalogRecords = (
  clips: ClipRow[],
  videos: VideoRow[],
  songs: SongRow[]
): CatalogRecord[] => {
  const records: CatalogRecord[] = [];
  const clipVideoIds = new Set<number>();

  clips.forEach((clip) => {
    clipVideoIds.add(clip.videoId);
    const matchedVideo = videos.find((video) => video.id === clip.videoId);
    const artist = normaliseName(clip.artistDisplayName, clip.artistName);
    const composer = normaliseComposer(clip.originalComposer, clip.videoOriginalComposer);
    records.push({
      id: clip.id,
      artist,
      composer,
      songTitle: clip.title ?? matchedVideo?.title ?? "",
      clipTitle: matchedVideo?.title ?? clip.title ?? "",
      artistValue: artist.toLowerCase(),
      composerValue: composer.toLowerCase(),
      songValue: (clip.title ?? matchedVideo?.title ?? "").toLowerCase(),
      clipValue: (matchedVideo?.title ?? clip.title ?? "").toLowerCase()
    });
  });

  songs
    .filter(shouldIncludeSong)
    .forEach((song) => {
      const artist = normaliseName(song.artistDisplayName, song.artistName);
      const composer = normaliseComposer(song.originalComposer, null);
      records.push({
        id: -song.id,
        artist,
        composer,
        songTitle: song.title,
        clipTitle: song.title,
        artistValue: artist.toLowerCase(),
        composerValue: composer.toLowerCase(),
        songValue: song.title.toLowerCase(),
        clipValue: song.title.toLowerCase()
      });
    });

  videos
    .filter((video) => shouldIncludeVideoAsSong(video, clipVideoIds))
    .forEach((video) => {
      const artist = normaliseName(video.artistDisplayName, video.artistName);
      const composer = normaliseComposer(video.originalComposer, null);
      records.push({
        id: -video.id,
        artist,
        composer,
        songTitle: video.title,
        clipTitle: video.title,
        artistValue: artist.toLowerCase(),
        composerValue: composer.toLowerCase(),
        songValue: video.title.toLowerCase(),
        clipValue: video.title.toLowerCase()
      });
    });

  return records;
};

interface FilterOptions {
  field: "song" | "artist" | "composer";
  query: string;
}

export const filterCatalogRecords = (records: CatalogRecord[], { field, query }: FilterOptions): CatalogRecord[] => {
  const trimmed = query.trim();
  if (!trimmed) {
    return records;
  }
  const lowerQuery = trimmed.toLowerCase();

  return records.filter((record) => {
    switch (field) {
      case "song":
        return record.songValue.includes(lowerQuery) || record.clipValue.includes(lowerQuery);
      case "artist":
        return record.artistValue.includes(lowerQuery);
      case "composer":
        return record.composerValue.includes(lowerQuery);
      default:
        return true;
    }
  });
};

interface SortOptions {
  key: "artist" | "song";
  direction: "asc" | "desc";
}

export const sortCatalogRecords = (records: CatalogRecord[], { key, direction }: SortOptions): CatalogRecord[] => {
  const accessor = key === "artist" ? (record: CatalogRecord) => record.artistValue : (record: CatalogRecord) => record.songValue;
  const modifier = direction === "asc" ? 1 : -1;

  return [...records].sort((a, b) => accessor(a).localeCompare(accessor(b)) * modifier);
};
