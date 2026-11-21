// YouTube-Shorts style pieces: vertical 9:16 cards and the full-screen vertical player.
import { LinkedText } from "@/components/LinkedText";
import { attachSource } from "@/lib/hls-attach";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdSlot, useAdsAllowed } from "@/components/AdSlot";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ChevronLeft, ChevronRight, Home, Pause, Play, Share2, Volume2, VolumeX, X } from "lucide-react";
import type { PostT } from "@/lib/posts";
import { PostThumb, setCapturePaused, withAutoplay } from "@/components/PostView";
import { parseVideoSource } from "@/lib/video-source";

export function ShortsMark({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground ${className}`}><Play className="h-2.5 w-2.5 fill-current" />Shorts</span>;
}

export function ShortTile({ post, className = "w-40 sm:w-48" }: { post: PostT; className?: string }) {
  const title = post.title || post.text.slice(0, 80) || "Short";
  return (
    <Link to="/post/$id" params={{ id: post.id }} className={`group relative block shrink-0 overflow-hidden rounded-xl bg-black ${className}`}>
      <PostThumb post={post} fill className="aspect-[9/16] w-full transition-transform group-hover:scale-[1.03]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-10">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">{title}</h3>
      </div>
    </Link>
  );
}

/** YouTube-style Shorts shelf: a small fixed grid (4 on phones, 6 on big screens), never a sideways scroller.
 *  "View all" opens the full vertical Shorts grid. */
export function ShortsShelf({ posts }: { posts: PostT[] }) {
  if (!posts.length) return null;
  return (
    <section className="py-3">
      <div className="flex items-center justify-between px-4">
        <h2 className="flex items-center gap-2 text-lg font-bold"><ShortsMark />Shorts</h2>
        <Link to="/" search={{ c: "Shorts" }} className="rounded-full px-3 py-1 text-sm font-semibold text-primary hover:bg-accent">View all</Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 px-2 sm:grid-cols-4 sm:px-4 lg:grid-cols-6">
        {posts.slice(0, 6).map((p, i) => <ShortTile key={p.id} post={p} className={`w-full ${i >= 4 ? "hidden lg:block" : ""}`} />)}
      </div>
    </section>
  );
}

/** Full Shorts section for the "All" tab: every Short, YouTube-style 9:16 grid with a heading. */
export function ShortsGrid({ posts }: { posts: PostT[] }) {
  if (!posts.length) return null;
  return (
    <section className="py-3">
      <h2 className="flex items-center gap-2 px-4 text-lg font-bold"><ShortsMark />Shorts</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 px-2 pb-6 sm:grid-cols-3 sm:px-4 lg:grid-cols-5 xl:grid-cols-6">
        {posts.map((p) => <ShortTile key={p.id} post={p} className="w-full" />)}
      </div>
    </section>
  );
}

/** Full-screen player: one video at a time, switched with Next / Previous buttons (no vertical feed). */
type Slide = PostT | { ad: string };
const isAd = (x: Slide): x is { ad: string } => "ad" in x;

export function ShortsPlayer({ shorts: posts, startId, onShare }: { shorts: PostT[]; startId: string; onShare: (p: PostT) => void }) {
    const start = Math.max(0, posts.findIndex((p) => p.id === startId));
  const adsOn = useAdsAllowed("shorts");
  const { settings } = useAuth();
  const every = Math.max(1, settings?.adShortsEvery ?? 5);
  // Ad slides only go after the opened Short, so the starting position never shifts when ads switch on.
  const [cycles, setCycles] = useState(1);
  const base = useMemo<Slide[]>(() => {
    if (!adsOn) return posts;
    const out: Slide[] = [];
    posts.forEach((p, i) => { out.push(p); if (i >= start && (i - start + 1) % every === 0 && i < posts.length - 1) out.push({ ad: `ad-${i}` }); });
    return out;
  }, [posts, adsOn, every, start]);
  // Endless feed like YouTube: the list repeats as the viewer nears the end.
  const shorts = useMemo(() => {
    const out: { s: Slide; key: string }[] = [];
    for (let c = 0; c < cycles; c++) base.forEach((x) => out.push({ s: x, key: `${isAd(x) ? x.ad : x.id}-${c}` }));
    return out;
  }, [base, cycles]);
  const [active, setActive] = useState(start);
  useEffect(() => { if (base.length && active >= shorts.length - 3) setCycles((c) => c + 1); }, [active, shorts.length, base.length]);
  const [muted, setMuted] = useState(false);
  const navigate = useNavigate();
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    setCapturePaused(true); // stop background thumbnail work while watching
    return () => { document.body.style.overflow = ""; setCapturePaused(false); };
  }, []);
  // One video on screen at a time; Next / Previous buttons (and left/right keys) switch videos. No vertical swipe or scroll.
  const goTo = (i: number) => setActive(Math.min(shorts.length - 1, Math.max(0, i)));
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") { e.preventDefault(); goTo(activeRef.current + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); goTo(activeRef.current - 1); } if (e.key === "Escape") navigate({ to: "/" }); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const cur = shorts[active];
  const navBtn = "grid h-14 w-14 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-30";

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black">
      {cur && (isAd(cur.s) ? (
        <div key={cur.key} className="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-black">
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-neutral-950">
            <div className="w-full max-w-md px-2"><AdSlot kind="shorts" label={false} className="w-full" /></div>
            <span className="absolute left-3 top-16 z-10 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[11px] font-bold text-black">Ad · Sponsored</span>
          </div>
        </div>
      ) : (
        <div key={cur.key} className="relative flex h-dvh w-full items-center justify-center overflow-hidden">
          <ShortSlide key={cur.key} post={cur.s} active warm={false} muted={muted} setMuted={setMuted} onShare={() => onShare(cur.s as PostT)} />
        </div>
      ))}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link to="/" aria-label="Back to videos" className="flex h-11 items-center gap-1 rounded-full bg-black/50 pl-2 pr-4 text-sm font-semibold text-white hover:bg-black/70"><ArrowLeft className="h-6 w-6" />Back</Link>
          <Link to="/" aria-label="Home" className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"><Home className="h-5 w-5" /></Link>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white">{muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}</button>
          <Link to="/" aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"><X className="h-6 w-6" /></Link>
        </div>
      </div>

      <button disabled={active === 0} onClick={() => goTo(active - 1)} aria-label="Previous video" className={`absolute left-2 top-1/2 z-20 -translate-y-1/2 sm:left-6 ${navBtn}`}><ChevronLeft className="h-8 w-8" /></button>
      <button disabled={active >= shorts.length - 1} onClick={() => goTo(active + 1)} aria-label="Next video" className={`absolute right-2 top-1/2 z-20 -translate-y-1/2 sm:right-6 ${navBtn}`}><ChevronRight className="h-8 w-8" /></button>
    </div>
  );
}

function ShortSlide({ post, active, warm, muted, setMuted, onShare }: { post: PostT; active: boolean; warm: boolean; muted: boolean; setMuted: (m: boolean) => void; onShare: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [shown, setShown] = useState(false);
  const [more, setMore] = useState(false);
  const src = parseVideoSource(post.videoUrl);

  useEffect(() => {
    const v = ref.current; if (!v || src.embed) return;
    v.preload = "auto";
    // Show the very first frame (0:00), never the uploaded thumbnail.
    const first = () => { if (v.paused) { try { v.currentTime = 0.001; } catch { /* not seekable yet */ } } };
    v.addEventListener("loadedmetadata", first, { once: true });
    const detach = attachSource(v, post.videoUrl);
    // Free the phone's video decoder the moment this Short leaves the screen.
    return () => { detach(); v.pause(); v.removeAttribute("src"); v.load(); };
  }, [post.videoUrl, src.embed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = ref.current; if (!v) return;
    if (!active) { v.pause(); setShown(false); try { v.currentTime = 0; } catch { /* ignore */ } return; }
    try { if (v.currentTime > 0.5) v.currentTime = 0; } catch { /* ignore */ }
    setPaused(false);
    v.muted = muted;
    let gone = false;
    const start = () => {
      if (gone) return;
      if (!v.currentSrc && !v.src) return; // source not set yet — "canplay" will call us again
      // Only one video may ever play: stop every other one first.
      document.querySelectorAll("video").forEach((o) => { if (o !== v && !o.paused) o.pause(); });
      v.play().catch((e: unknown) => {
        if (gone || (e as Error)?.name === "AbortError") return;
        v.muted = true; setMuted(true);
        v.play().catch(() => { if (!gone) setPaused(true); });
      });
    };
    start();
    v.addEventListener("canplay", start, { once: true });
    return () => { gone = true; v.removeEventListener("canplay", start); };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);

  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); } };
  const rail = "flex flex-col items-center gap-1 text-xs font-medium text-white";
  const btn = "grid h-12 w-12 place-items-center rounded-full bg-white/15 hover:bg-white/25";

  return (
    <div className="relative h-full w-full overflow-hidden">
      {src.embed ? (
        active ? <iframe src={withAutoplay(src.embed)} title={post.title || "Short"} className="absolute inset-0 h-full w-full border-0" allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share" referrerPolicy="strict-origin-when-cross-origin" />
          : <PostThumb post={post} className="absolute inset-0 h-full w-full" />
      ) : (
        <>
          <video ref={ref} playsInline loop preload="auto" poster="" draggable={false} muted={muted}
            onClick={toggle} onPlaying={() => setShown(true)} className="absolute inset-0 h-full w-full object-contain" />
          {/* TikTok: Studio thumbnails are for cards only; the player shows the video itself. */}
        </>
      )}
      {paused && !src.embed && <button onClick={toggle} aria-label="Play" className="absolute inset-0 grid place-items-center"><span className="grid h-20 w-20 place-items-center rounded-full bg-black/50 text-white"><Play className="ml-1 h-10 w-10 fill-current" /></span></button>}

      <div className="absolute bottom-24 right-2 flex flex-col items-center gap-4 sm:bottom-6">
        <button onClick={onShare} className={rail}><span className={btn}><Share2 className="h-6 w-6" /></span>Share</button>
        {!src.embed && <button onClick={toggle} className={rail}><span className={btn}>{paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}</span>{paused ? "Play" : "Pause"}</button>}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pr-20 pt-16">
        <div className="pointer-events-auto flex items-center gap-2">
          <img src="/icon.svg" alt="" className="h-8 w-8 rounded-full bg-white/20 p-1" />
          <span className="text-sm font-semibold text-white">@LoopgramChannel</span>
        </div>
        <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setMore((m) => !m); }} onClick={() => setMore((m) => !m)} className="pointer-events-auto mt-2 block cursor-pointer text-left text-sm text-white">
          <span className="font-semibold">{post.title || "Short"}</span>
          {post.text && <span className={`mt-1 block whitespace-pre-line text-white/85 ${more ? "max-h-[40vh] overflow-y-auto" : "line-clamp-2"}`}><LinkedText text={post.text} /></span>}
        </div>
      </div>
    </div>
  );
}
