import type { VideoResponse } from "../types/media";

interface MergeResult {
  videos: VideoResponse[];
  songVideos: VideoResponse[];
  existed: boolean;
}

const normaliseDuration = (duration: VideoResponse["durationSec"]): number | null => {
  if (duration === null || duration === undefined) return null;
  const parsed = Number(duration);
  return Number.isFinite(parsed) ? parsed : null;
};

const normaliseThumbnail = (thumbnail: VideoResponse["thumbnailUrl"]): string | null => {
  if (!thumbnail) return null;
  const trimmed = String(thumbnail).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const mergeArtists = (existing: VideoResponse["artists"], incoming: VideoResponse["artists"]): VideoResponse["artists"] => {
  const seen = new Set<string>();
  const combined = [...incoming, ...existing];
  return combined.filter((artist) => {
    const id = artist?.id;
    const key = id === null || id === undefined ? "" : String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const shouldIncludeInSongCatalog = (video: VideoResponse): boolean => {
  return video.category !== "live";
};

export const mergeVideoIntoCollections = (
  state: { videos: VideoResponse[]; songVideos: VideoResponse[] },
  registeredVideo: VideoResponse
): MergeResult => {
  const normalisedVideo: VideoResponse = {
    ...registeredVideo,
    durationSec: normaliseDuration(registeredVideo.durationSec),
    thumbnailUrl: normaliseThumbnail(registeredVideo.thumbnailUrl),
    artists: registeredVideo.artists ?? []
  };

  const videos = state.videos.slice();
  const songVideos = state.songVideos.slice();
  const existingIndex = videos.findIndex((video) => video.id === normalisedVideo.id);
  const existed = existingIndex !== -1;

  if (existed) {
    const merged = {
      ...videos[existingIndex],
      ...normalisedVideo,
      artists: mergeArtists(videos[existingIndex].artists ?? [], normalisedVideo.artists ?? [])
    };
    videos[existingIndex] = merged;
  } else {
    videos.push(normalisedVideo);
  }

  const songIndex = songVideos.findIndex((video) => video.id === normalisedVideo.id);
  const includeInSongs = shouldIncludeInSongCatalog(normalisedVideo);

  if (includeInSongs) {
    const mergedSong = songIndex !== -1
      ? { ...songVideos[songIndex], ...normalisedVideo, artists: mergeArtists(songVideos[songIndex].artists ?? [], normalisedVideo.artists ?? []) }
      : normalisedVideo;

    if (songIndex !== -1) {
      songVideos[songIndex] = mergedSong;
    } else {
      songVideos.push(mergedSong);
    }
  } else if (songIndex !== -1) {
    songVideos.splice(songIndex, 1);
  }

  return { videos, songVideos, existed };
};
