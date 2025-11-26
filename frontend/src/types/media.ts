export interface ArtistSummary {
  id: number | string;
  name?: string | null;
  displayName?: string | null;
  youtubeChannelId?: string | null;
  youtubeChannelTitle?: string | null;
  profileImageUrl?: string | null;
  isPrimary?: boolean;
}

export interface VideoResponse {
  id: number;
  artistId: number | string | null;
  primaryArtistId?: number | string | null;
  youtubeVideoId?: string | null;
  title: string;
  durationSec?: number | string | null;
  thumbnailUrl?: string | null;
  contentType?: string | null;
  category?: string | null;
  originalComposer?: string | null;
  artists: ArtistSummary[];
  createdAt?: string;
  updatedAt?: string;
}
