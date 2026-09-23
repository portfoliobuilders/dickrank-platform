'use client';

import { useEffect, useRef, useState } from 'react';
import type { QualityOption } from '@/lib/types';

interface VideoPlayerProps {
  src: string;
  poster?: string | null;
  qualities?: QualityOption[] | null;
  userId: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${minutes}:${String(remain).padStart(2, '0')}`;
}

export function VideoPlayer({ src, poster, qualities, userId }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [quality, setQuality] = useState(qualities?.[qualities.length - 1]?.label ?? '');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    setCurrentSrc(src);
    setQuality(qualities?.[qualities.length - 1]?.label ?? '');
  }, [src, qualities]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setError('Playback could not start.'));
    } else {
      video.pause();
    }
  }

  function changeQuality(label: string) {
    const next = qualities?.find((option) => option.label === label);
    const video = videoRef.current;
    if (!next || !video) return;
    const time = video.currentTime;
    const wasPlaying = !video.paused;
    setQuality(label);
    setCurrentSrc(next.url);
    requestAnimationFrame(() => {
      const node = videoRef.current;
      if (!node) return;
      node.currentTime = time;
      if (wasPlaying) void node.play().catch(() => setError('Playback could not start.'));
    });
  }

  return (
    <div
      className="overflow-hidden rounded-2xl bg-black"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="relative">
        <video
          ref={videoRef}
          src={currentSrc}
          poster={poster ?? undefined}
          playsInline
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          draggable={false}
          className="aspect-video w-full bg-black"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
          onVolumeChange={() => setVolume(videoRef.current?.volume ?? 1)}
          onError={() => setError('This video could not be loaded.')}
          onContextMenu={(event) => event.preventDefault()}
        />
        <div className="pointer-events-none absolute bottom-16 right-3 rounded bg-black/50 px-2 py-1 text-xs text-white/80">
          ID {userId}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 bg-zinc-950 px-3 py-2 text-sm">
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-md bg-zinc-800 px-3 py-1.5 hover:bg-zinc-700"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <span className="tabular-nums text-zinc-300">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <input
          aria-label="Seek"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (videoRef.current) videoRef.current.currentTime = next;
            setCurrentTime(next);
          }}
          className="min-w-24 flex-1"
        />
        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (videoRef.current) videoRef.current.volume = next;
            setVolume(next);
          }}
          className="w-20"
        />
        {qualities && qualities.length > 1 ? (
          <label className="flex items-center gap-2 text-zinc-300">
            Quality
            <select
              aria-label="Quality"
              value={quality}
              onChange={(event) => changeQuality(event.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1"
            >
              {qualities.map((option) => (
                <option key={option.label} value={option.label}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className="rounded-md bg-zinc-800 px-3 py-1.5 hover:bg-zinc-700"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void video.parentElement?.requestFullscreen();
          }}
        >
          Full screen
        </button>
      </div>
      {error ? <p className="px-3 py-2 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
