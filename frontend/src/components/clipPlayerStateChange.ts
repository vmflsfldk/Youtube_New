interface ClipPlayerEventTarget {
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
}

interface ClipStateChangeEvent {
  data: number;
  target: ClipPlayerEventTarget;
}

interface HandleStateChangeOptions {
  startSec?: number;
  endSec?: number;
  shouldLoop: boolean;
  onEnded?: () => void;
}

export const createHandleStateChangeHandler = ({
  startSec = 0,
  endSec,
  shouldLoop,
  onEnded
}: HandleStateChangeOptions) => {
  return (event: ClipStateChangeEvent): void => {
    const isEndedState = event.data === 0 || event.data === (globalThis as any)?.window?.YT?.PlayerState?.ENDED;

    if (!isEndedState) {
      return;
    }

    if (shouldLoop) {
      const targetStart = Number.isFinite(startSec) ? startSec : 0;
      event.target.seekTo?.(targetStart, true);
      // When looping a bounded clip, ensure playback resumes even if the IFrame pauses
      if (typeof endSec === "number" && endSec > targetStart) {
        event.target.playVideo?.();
      }
      return;
    }

    onEnded?.();
  };
};
