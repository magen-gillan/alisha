'use client';

import type { BackgroundId } from '@/lib/alisha/types';

interface BackgroundLayerProps {
  background: BackgroundId;
}

/**
 * Renders one of 4 animated gradient backgrounds behind the avatar.
 * Pure CSS — no images required, lightweight, GPU-accelerated.
 */
export default function BackgroundLayer({ background }: BackgroundLayerProps) {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {background === 'aurora' && <AuroraBg />}
      {background === 'sunset' && <SunsetBg />}
      {background === 'midnight' && <MidnightBg />}
      {background === 'sakura' && <SakuraBg />}
    </div>
  );
}

/* ---------- Aurora — cool greens & teals drifting ---------- */
function AuroraBg() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900">
      <div
        className="absolute -top-1/3 -left-1/4 w-[80%] h-[80%] rounded-full blur-3xl opacity-50 animate-aurora-1"
        style={{
          background:
            'radial-gradient(circle at center, rgba(16,185,129,0.7), transparent 60%)',
        }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 w-[80%] h-[80%] rounded-full blur-3xl opacity-50 animate-aurora-2"
        style={{
          background:
            'radial-gradient(circle at center, rgba(45,212,191,0.7), transparent 60%)',
        }}
      />
      <div
        className="absolute top-1/4 right-1/3 w-[50%] h-[50%] rounded-full blur-3xl opacity-40 animate-aurora-3"
        style={{
          background:
            'radial-gradient(circle at center, rgba(34,211,238,0.6), transparent 60%)',
        }}
      />
      {/* Starfield */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 20px 30px, white, transparent), radial-gradient(1px 1px at 60px 70px, white, transparent), radial-gradient(1px 1px at 120px 50px, white, transparent), radial-gradient(1px 1px at 200px 90px, white, transparent), radial-gradient(1px 1px at 250px 30px, white, transparent), radial-gradient(1px 1px at 90px 120px, white, transparent)',
          backgroundSize: '300px 200px',
        }}
      />
    </div>
  );
}

/* ---------- Sunset — warm oranges & pinks ---------- */
function SunsetBg() {
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-orange-300 via-rose-400 to-purple-700">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full blur-3xl opacity-70 animate-sunset-pulse"
        style={{
          background:
            'radial-gradient(circle at center, rgba(251,191,36,0.9), transparent 70%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3 opacity-60"
        style={{
          background:
            'linear-gradient(to top, rgba(76,29,149,0.8), transparent)',
        }}
      />
      {/* Sun */}
      <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-yellow-200 blur-md opacity-90 animate-sunset-pulse" />
    </div>
  );
}

/* ---------- Midnight — deep blues & purples with stars ---------- */
function MidnightBg() {
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-slate-950 to-black">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 25px 35px, white, transparent), radial-gradient(1px 1px at 75px 80px, white, transparent), radial-gradient(1px 1px at 130px 50px, white, transparent), radial-gradient(2px 2px at 220px 100px, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 280px 30px, white, transparent), radial-gradient(1px 1px at 100px 140px, white, transparent), radial-gradient(1px 1px at 350px 80px, white, transparent)',
          backgroundSize: '400px 300px',
        }}
      />
      {/* Moon */}
      <div className="absolute top-10 right-10 w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-300 shadow-[0_0_40px_10px_rgba(226,232,240,0.3)]" />
      <div
        className="absolute top-1/3 left-1/4 w-[60%] h-[60%] rounded-full blur-3xl opacity-30 animate-aurora-3"
        style={{
          background:
            'radial-gradient(circle at center, rgba(99,102,241,0.6), transparent 60%)',
        }}
      />
    </div>
  );
}

/* ---------- Sakura — soft pink with falling petals ---------- */
function SakuraBg() {
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-pink-100 via-rose-200 to-pink-300">
      {/* Soft bokeh circles */}
      <div
        className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full blur-2xl opacity-60 animate-aurora-1"
        style={{ background: 'radial-gradient(circle, rgba(251,207,232,0.9), transparent)' }}
      />
      <div
        className="absolute bottom-1/4 right-1/3 w-40 h-40 rounded-full blur-2xl opacity-60 animate-aurora-2"
        style={{ background: 'radial-gradient(circle, rgba(244,114,182,0.7), transparent)' }}
      />
      {/* Petals */}
      {Array.from({ length: 18 }).map((_, i) => (
        <div
          key={i}
          className="absolute text-pink-400 animate-petal-fall"
          style={{
            left: `${(i * 5.5) % 100}%`,
            top: `-${(i % 5) * 10}%`,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${8 + (i % 4) * 2}s`,
            fontSize: `${10 + (i % 3) * 4}px`,
          }}
        >
          ❀
        </div>
      ))}
    </div>
  );
}
