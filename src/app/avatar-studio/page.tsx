'use client';

import { useEffect, useState, lazy, Suspense, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Upload, Eye, Maximize2, Minimize2, RotateCcw, ImagePlus, Trash2 } from 'lucide-react';
import { AVATAR_MODELS, type AvatarId } from '@/lib/alisha/avatars';
import {
  loadAvatarStudioDraft,
  saveAvatarStudioDraft,
  type AvatarCalibration,
  type AvatarStudioDraft,
} from '@/lib/alisha/avatar-studio-draft';

const Live2DAvatar = lazy(() => import('@/components/alisha/Live2DAvatar'));
import { Button } from '@/components/ui/button';

const DEFAULT_CALIBRATION: AvatarCalibration = { scale: 1, xOffset: 0, yOffset: 0 };

export default function AvatarStudioPage() {
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId>('kei');
  const [scale, setScale] = useState(1);
  const [xOffset, setXOffset] = useState(0);
  const [yOffset, setYOffset] = useState(0);
  const [bgColor, setBgColor] = useState('#241b35');
  const [showGrid, setShowGrid] = useState(false);
  const [draft, setDraft] = useState<AvatarStudioDraft>({ calibrations: {}, thumbnails: {} });
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDraft(loadAvatarStudioDraft()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const selectAvatar = (id: AvatarId) => {
    const saved = draft.calibrations[id] || DEFAULT_CALIBRATION;
    setScale(saved.scale);
    setXOffset(saved.xOffset);
    setYOffset(saved.yOffset);
    setSelectedAvatar(id);
    setNotice('');
  };

  const saveCalibration = () => {
    const next: AvatarStudioDraft = {
      ...draft,
      calibrations: {
        ...draft.calibrations,
        [selectedAvatar]: { scale, xOffset, yOffset },
      },
    };
    if (saveAvatarStudioDraft(next)) {
      setDraft(next);
      setNotice(`حُفظ ضبط ${AVATAR_MODELS.find((avatar) => avatar.id === selectedAvatar)?.name} مؤقتًا على هذا الجهاز.`);
    } else {
      setNotice('تعذر الحفظ المحلي. قد تكون مساحة تخزين المتصفح ممتلئة.');
    }
  };

  const resetCurrent = () => {
    setScale(DEFAULT_CALIBRATION.scale);
    setXOffset(DEFAULT_CALIBRATION.xOffset);
    setYOffset(DEFAULT_CALIBRATION.yOffset);
  };

  const uploadThumbnail = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice('اختر ملف صورة.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setNotice('حجم الصورة أكبر من 12MB؛ اختر صورة أصغر.');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('تعذر تجهيز الصورة.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const data = canvas.toDataURL('image/webp', 0.82);
      const next = { ...draft, thumbnails: { ...draft.thumbnails, [selectedAvatar]: data } };
      if (!saveAvatarStudioDraft(next)) throw new Error('تعذر الحفظ المحلي؛ مساحة المتصفح قد تكون ممتلئة.');
      setDraft(next);
      setNotice(`حُفظت أيقونة ${selectedAvatar} مؤقتًا على هذا الجهاز.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذر تحميل الصورة.');
    }
  };

  const removeThumbnail = () => {
    const thumbnails = { ...draft.thumbnails };
    delete thumbnails[selectedAvatar];
    const next = { ...draft, thumbnails };
    saveAvatarStudioDraft(next);
    setDraft(next);
    setNotice('أزيلت الأيقونة المؤقتة.');
  };

  const downloadThumbnail = () => {
    const data = draft.thumbnails[selectedAvatar];
    if (!data) return;
    const anchor = document.createElement('a');
    anchor.href = data;
    anchor.download = `${selectedAvatar}-gallery.webp`;
    anchor.click();
  };

  const exportDraft = () => {
    const config = {
      calibrations: draft.calibrations,
      selectedAvatar,
      currentCalibration: { scale, xOffset, yOffset },
      createdAt: new Date().toISOString(),
      note: 'Temporary local avatar-studio draft; review before promoting to repository defaults.',
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'alisha-avatar-calibration-draft.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const currentThumbnail = draft.thumbnails[selectedAvatar];

  return (
    <div className="h-[100dvh] min-h-0 overflow-hidden bg-[#1a1428] text-white flex flex-col">
      <header className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 border-b border-white/10 bg-[#1a1428]">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="العودة للمحادثة"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <h1 className="text-base sm:text-lg font-bold">استوديو الأفاتارات — ضبط مؤقت</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowGrid(!showGrid)} className="text-xs border-white/20">
          <Eye className="w-3 h-3 mr-1" />{showGrid ? 'إخفاء الشبكة' : 'إظهار الشبكة'}
        </Button>
      </header>

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <section className="relative min-h-0 h-[54dvh] shrink-0 lg:h-auto lg:flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-4">
          <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
          {showGrid && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />}
          <div
            className="relative z-10"
            style={{
              width: 'min(92vw, 52dvh, 672px)',
              height: 'min(92vw, 52dvh, 672px)',
              transform: `translate(${xOffset}px, ${yOffset}px) scale(${scale})`,
              transition: 'transform 0.12s ease-out',
            }}
          >
            <Suspense fallback={<div className="flex items-center justify-center w-full h-full text-white/50">جارٍ التحميل…</div>}>
              <Live2DAvatar background="aurora" speaking={false} listening={false} thinking={false} avatarId={selectedAvatar} />
            </Suspense>
          </div>
          {currentThumbnail && <img src={currentThumbnail} alt="معاينة أيقونة المعرض" className="absolute z-20 top-3 left-3 w-14 h-14 rounded-lg border border-white/30 object-cover shadow-lg" />}
        </section>

        <aside className="min-h-0 flex-1 lg:flex-none lg:w-[22rem] overflow-y-auto overscroll-contain border-t lg:border-t-0 lg:border-l border-white/10 bg-[#241b35]/70 p-3 sm:p-4 space-y-4">
          <section>
            <h2 className="text-sm font-semibold mb-2">اختيار الأفاتار</h2>
            <div className="grid grid-cols-2 gap-2">
              {AVATAR_MODELS.map((avatar) => {
                const thumbnail = draft.thumbnails[avatar.id] || avatar.thumbnailUrl;
                return (
                  <button key={avatar.id} type="button" onClick={() => selectAvatar(avatar.id)} className={`rounded-lg border-2 p-2 transition-all ${selectedAvatar === avatar.id ? 'border-fuchsia-500 bg-fuchsia-500/10' : 'border-white/10 hover:border-white/30'}`}>
                    {thumbnail ? <img src={thumbnail} alt={avatar.name} className="w-full aspect-square rounded-md object-cover mb-1" /> : <div className="w-full aspect-square rounded-md mb-1 bg-white/5 flex items-center justify-center text-3xl">{avatar.emoji || '◉'}</div>}
                    <div className="text-xs font-medium truncate">{avatar.name}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-1"><label className="text-xs font-medium">الحجم</label><span className="text-xs text-white/60 tabular-nums">{scale.toFixed(2)}×</span></div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="تصغير" onClick={() => setScale((value) => Math.max(0.3, value - 0.1))} className="w-8 h-8 shrink-0 rounded-md bg-white/10 flex items-center justify-center"><Minimize2 className="w-3 h-3" /></button>
              <input aria-label="حجم الأفاتار" type="range" min={0.3} max={2} step={0.05} value={scale} onChange={(event) => setScale(Number(event.target.value))} className="flex-1 accent-fuchsia-500" />
              <button type="button" aria-label="تكبير" onClick={() => setScale((value) => Math.min(2, value + 0.1))} className="w-8 h-8 shrink-0 rounded-md bg-white/10 flex items-center justify-center"><Maximize2 className="w-3 h-3" /></button>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-1"><label className="text-xs font-medium">الإزاحة الأفقية (X)</label><span className="text-xs text-white/60">{xOffset}px</span></div>
            <input aria-label="إزاحة أفقية" type="range" min={-240} max={240} step={2} value={xOffset} onChange={(event) => setXOffset(Number(event.target.value))} className="w-full accent-fuchsia-500" />
            <div className="flex items-center justify-between mb-1 mt-2"><label className="text-xs font-medium">الإزاحة العمودية (Y)</label><span className="text-xs text-white/60">{yOffset}px</span></div>
            <input aria-label="إزاحة عمودية" type="range" min={-240} max={240} step={2} value={yOffset} onChange={(event) => setYOffset(Number(event.target.value))} className="w-full accent-fuchsia-500" />
          </section>

          <section>
            <label className="text-xs font-medium block mb-2">أيقونة المعرض المؤقتة — {selectedAvatar}</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void uploadThumbnail(event.target.files?.[0]); event.currentTarget.value = ''; }} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="text-xs border-white/20"><ImagePlus className="w-3 h-3 mr-1" />اختيار صورة</Button>
              {currentThumbnail ? <Button variant="outline" size="sm" onClick={removeThumbnail} className="text-xs border-white/20"><Trash2 className="w-3 h-3 mr-1" />إزالة</Button> : <span />}
              {currentThumbnail && <Button variant="outline" size="sm" onClick={downloadThumbnail} className="col-span-2 text-xs border-white/20"><Download className="w-3 h-3 mr-1" />تنزيل الصورة WebP للاعتماد لاحقًا</Button>}
            </div>
            <p className="mt-2 text-[11px] text-white/50">تُحفظ الصورة مؤقتًا في هذا المتصفح، وتُضغط إلى WebP بحد أقصى 512px. لا تُرفع إلى GitHub تلقائيًا.</p>
          </section>

          <section className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
            <Button size="sm" onClick={saveCalibration} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-xs"><Upload className="w-3 h-3 mr-1" />حفظ مؤقت</Button>
            <Button variant="outline" size="sm" onClick={resetCurrent} className="border-white/20 text-xs"><RotateCcw className="w-3 h-3 mr-1" />إعادة ضبط</Button>
            <Button variant="outline" size="sm" onClick={exportDraft} className="col-span-2 border-white/20 text-xs"><Download className="w-3 h-3 mr-1" />تصدير معايرات كل الأفاتارات</Button>
          </section>
          {notice && <p role="status" className="text-xs text-emerald-200">{notice}</p>}
          <p className="text-[11px] leading-relaxed text-amber-100/70">المعايرات والأيقونات تجريبية ومحلية على جهازك. بعد اكتمال الاختبار، أرسل ملف الإعدادات والصور المنزّلة لنراجعها ونحوّل القيم والصور المعتمدة إلى ملفات المستودع.</p>
        </aside>
      </main>
    </div>
  );
}
