'use client';

import { useState, useRef, lazy, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Upload, Eye, Maximize2, Minimize2 } from 'lucide-react';
import { AVATAR_MODELS, type AvatarId } from '@/lib/alisha/avatars';

const Live2DAvatar = lazy(() => import('@/components/alisha/Live2DAvatar'));
import { Button } from '@/components/ui/button';

export default function AvatarStudioPage() {
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId>('kei');
  const [scale, setScale] = useState(1.0);
  const [xOffset, setXOffset] = useState(0);
  const [yOffset, setYOffset] = useState(0);
  const [bgColor, setBgColor] = useState('#241b35');
  const [showGrid, setShowGrid] = useState(false);

  return (
    <div className="min-h-screen bg-[#1a1428] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold">Avatar Studio</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            className="text-xs border-white/20"
          >
            <Eye className="w-3 h-3 mr-1" />
            {showGrid ? 'إخفاء الشبكة' : 'إظهار الشبكة'}
          </Button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Avatar preview — large, centered */}
        <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
          {/* Background color picker */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: bgColor }}
          />

          {/* Grid overlay */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
              }}
            />
          )}

          {/* Avatar container — adjustable */}
          <div
            className="relative"
            style={{
              width: '400px',
              height: '400px',
              transform: `translate(${xOffset}px, ${yOffset}px) scale(${scale})`,
              transition: 'transform 0.2s ease-out',
            }}
          >
            <Suspense fallback={<div className="flex items-center justify-center w-full h-full text-white/50">Loading...</div>}>
              <Live2DAvatar
                background="aurora"
                speaking={false}
                listening={false}
                thinking={false}
                avatarId={selectedAvatar}
              />
            </Suspense>
          </div>
        </div>

        {/* Side panel — controls */}
        <div className="w-full lg:w-80 p-4 space-y-4 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#241b35]/50 overflow-y-auto">
          {/* Avatar picker */}
          <div>
            <h2 className="text-sm font-semibold mb-2">اختيار الأفاتار</h2>
            <div className="grid grid-cols-2 gap-2">
              {AVATAR_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedAvatar(m.id)}
                  className={`rounded-lg border-2 p-2 transition-all ${
                    selectedAvatar === m.id
                      ? 'border-fuchsia-500 bg-fuchsia-500/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  {m.thumbnailUrl && (
                    <img
                      src={m.thumbnailUrl}
                      alt={m.name}
                      className="w-full aspect-square rounded-md object-cover mb-1"
                    />
                  )}
                  <div className="text-xs font-medium truncate">{m.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Scale control */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">الحجم</label>
              <span className="text-xs text-white/60 tabular-nums">{scale.toFixed(2)}x</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale(s => Math.max(0.3, s - 0.1))}
                className="w-8 h-8 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
              <input
                type="range"
                min={0.3}
                max={2.0}
                step={0.05}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-fuchsia-500"
              />
              <button
                onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
                className="w-8 h-8 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* X offset */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">إزاحة أفقية (X)</label>
              <span className="text-xs text-white/60 tabular-nums">{xOffset}px</span>
            </div>
            <input
              type="range"
              min={-200}
              max={200}
              step={5}
              value={xOffset}
              onChange={(e) => setXOffset(parseInt(e.target.value))}
              className="w-full accent-fuchsia-500"
            />
          </div>

          {/* Y offset */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">إزاحة عمودية (Y)</label>
              <span className="text-xs text-white/60 tabular-nums">{yOffset}px</span>
            </div>
            <input
              type="range"
              min={-200}
              max={200}
              step={5}
              value={yOffset}
              onChange={(e) => setYOffset(parseInt(e.target.value))}
              className="w-full accent-fuchsia-500"
            />
          </div>

          {/* Background color */}
          <div>
            <label className="text-xs font-medium block mb-1">لون الخلفية</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-10 h-10 rounded-md border border-white/20 bg-transparent cursor-pointer"
              />
              <span className="text-xs text-white/60">{bgColor}</span>
            </div>
          </div>

          {/* Export config */}
          <div className="pt-4 border-t border-white/10">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-fuchsia-400/30 text-xs"
              onClick={() => {
                const config = {
                  avatarId: selectedAvatar,
                  scale,
                  xOffset,
                  yOffset,
                  bgColor,
                  timestamp: new Date().toISOString(),
                };
                const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `avatar-config-${selectedAvatar}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-3 h-3 mr-2" />
              تصدير الإعدادات
            </Button>
          </div>

          {/* Info */}
          <div className="pt-4 border-t border-white/10 text-xs text-white/50 space-y-1">
            <p>• هذه صفحة عرض يدوية للأفاتار</p>
            <p>• عدّل المقاس والإزاحة حتى يظهر بشكل مثالي</p>
            <p>• صدّر الإعدادات وأرسلها لي لتطبيقها على المشروع</p>
          </div>
        </div>
      </div>
    </div>
  );
}
