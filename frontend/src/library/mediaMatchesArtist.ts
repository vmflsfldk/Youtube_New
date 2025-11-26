import type { VideoResponse } from "../types/media";

type WithArtists = Partial<Pick<VideoResponse, "artistId" | "primaryArtistId" | "artists">> & {
  artists?: { id?: number | string | null }[] | null;
};

type ArtistId = string | number | null | undefined;

const normaliseId = (value: ArtistId): string | null => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str;
};

export const mediaMatchesArtist = (media: WithArtists, artistId: ArtistId): boolean => {
  const targetId = normaliseId(artistId);
  if (targetId === null) {
    return true;
  }

  const artistCandidates: (string | null)[] = [
    normaliseId(media.artistId),
    normaliseId(media.primaryArtistId),
    ...(Array.isArray(media.artists)
      ? media.artists.map((artist) => normaliseId(artist?.id ?? null))
      : [])
  ];

  return artistCandidates.some((id) => id === targetId);
};
