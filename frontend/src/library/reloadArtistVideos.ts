import type { VideoResponse } from "../types/media";

export interface ReloadArtistVideosOptions {
  artistId: string | number | null | undefined;
  fetchVideos: (artistId: number, signal?: AbortSignal) => Promise<VideoResponse[]>;
  setVideos: (updater: VideoResponse[] | ((prev: VideoResponse[]) => VideoResponse[])) => void;
  setHiddenVideoIds: (updater: number[] | ((prev: number[]) => number[])) => void;
  setSelectedVideo: (updater: number | null | ((prev: number | null) => number | null)) => void;
  setArtistVideosLoading: (updater: boolean | ((prev: boolean) => boolean)) => void;
  compareVideos: (a: VideoResponse, b: VideoResponse) => number;
  onError: (error: unknown) => void;
}

export const createReloadArtistVideos = ({
  artistId,
  fetchVideos,
  setVideos,
  setHiddenVideoIds,
  setSelectedVideo,
  setArtistVideosLoading,
  compareVideos,
  onError
}: ReloadArtistVideosOptions) => {
  return async (): Promise<void> => {
    const parsedArtistId = Number(artistId);

    if (!artistId || Number.isNaN(parsedArtistId)) {
      setSelectedVideo(() => null);
      setArtistVideosLoading(() => false);
      return;
    }

    const controller = new AbortController();
    try {
      setArtistVideosLoading(() => true);
      const videos = await fetchVideos(parsedArtistId, controller.signal);
      const sorted = [...videos].sort(compareVideos);

      setVideos((previous) => {
        const remaining = previous.filter((video) => video.artistId !== parsedArtistId);
        return [...remaining, ...sorted];
      });

      setHiddenVideoIds((previous) => previous.filter((id) => !sorted.some((video) => video.id === id)));
      setArtistVideosLoading(() => false);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setArtistVideosLoading(() => false);
      onError(error);
    }
  };
};
