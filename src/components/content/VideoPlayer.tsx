"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaQuality } from "@/types";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const clock = `${minutes}:${String(secs).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : clock;
}

export function VideoPlayer({
  src,
  poster,
  userId,
  qualities,
}: {
  src: string;
  poster?: string | null;
  userId: string;
  qualities?: MediaQuality[] | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [failed, setFailed] = useState(false);
  const options = qualities?.length ? qualities : [{ label: "Auto", src }];
  const [quality, setQuality] = useState(options[0]?.src ?? src);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrent(video.currentTime);
    const onMeta = () => setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function onSeek(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrent(value);
  }

  function onVolume(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }

  function pickQuality(nextSrc: string) {
    const video = videoRef.current;
    if (!video || nextSrc === quality) return;
    const time = video.currentTime;
    const wasPlaying = !video.paused;
    const resume = () => {
      video.currentTime = time;
      if (wasPlaying) void video.play();
      video.removeEventListener("loadedmetadata", resume);
    };
    video.addEventListener("loadedmetadata", resume);
    setQuality(nextSrc);
    video.src = nextSrc;
  }

  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await container.requestFullscreen();
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl bg-black"
      onContextMenu={(event) => event.preventDefault()}
    >
      <video
        ref={videoRef}
        src={quality}
        poster={poster ?? undefined}
        className="aspect-video w-full bg-black"
        playsInline
        controls={false}
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        disableRemotePlayback
        draggable={false}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
        onError={() => setFailed(true)}
        onClick={togglePlay}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 flex rotate-[-18deg] flex-wrap content-center justify-center gap-x-16 gap-y-10 opacity-25">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} className="text-sm font-medium text-white">
              {userId}
            </span>
          ))}
        </div>
        <span className="absolute bottom-16 right-3 rounded bg-black/50 px-2 py-1 text-xs text-white">{userId}</span>
      </div>
      {failed ? (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-zinc-300">
          This video could not be played.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 bg-zinc-950/90 px-3 py-2 text-sm">
        <button type="button" className="rounded-full px-3 py-1 hover:bg-white/10" onClick={togglePlay}>
          {playing ? "Pause" : "Play"}
        </button>
        <span className="tabular-nums text-zinc-300">
          {formatTime(current)} / {formatTime(duration)}
        </span>
        <input
          aria-label="Seek"
          className="min-w-24 flex-1 accent-rose-400"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <button
          type="button"
          className="rounded-full px-3 py-1 hover:bg-white/10"
          onClick={() => onVolume(muted ? 1 : 0)}
        >
          {muted ? "Unmute" : "Mute"}
        </button>
        <input
          aria-label="Volume"
          className="w-20 accent-rose-400"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
        {options.length > 1 ? (
          <label className="flex items-center gap-2 text-zinc-300">
            Quality
            <select
              aria-label="Quality"
              className="rounded-md bg-zinc-800 px-2 py-1 text-white"
              value={quality}
              onChange={(event) => pickQuality(event.target.value)}
            >
              {options.map((option) => (
                <option key={option.label} value={option.src}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" className="rounded-full px-3 py-1 hover:bg-white/10" onClick={() => void toggleFullscreen()}>
          Full screen
        </button>
      </div>
    </div>
  );
}
