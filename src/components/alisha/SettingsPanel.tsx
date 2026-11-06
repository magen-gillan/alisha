'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useAlishaStore, DEFAULT_PERMANENT_MEMORY } from '@/store/alisha-store';
import type { ResponseLanguage, BackgroundId } from '@/lib/alisha/types';
import { LANGUAGE_LABELS, BACKGROUND_LABELS, VOICE_LANGUAGES, BACKGROUND_ORDER, nextBackground, prevBackground } from '@/lib/alisha/types';
import { AVATAR_MODELS } from '@/lib/alisha/avatars';
import { clearLegacyProviderKeys, listRouterProviders, type RouterProviderStatus } from '@/lib/alisha/router-client';
import { shareOrDownload } from '@/lib/alisha/share';
import CloseButton from '@/components/alisha/CloseButton';
import {
  loadVoices, getVoicesForLanguage, safeVoiceLocale, speak, stopSpeaking,
} from '@/lib/alisha/speech';
import {
  Loader2, RefreshCw, ChevronsUpDown,
  User, Image as ImageIcon, Globe, Brain, MessagesSquare,
  Volume2, Trash2, CheckCircle2, Save,
} from 'lucide-react';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BACKGROUNDS: { id: BackgroundId; image: string }[] = [
  { id: 'aurora', image: '/backgrounds/aurora.webp' },
  { id: 'sunset', image: '/backgrounds/sakura.webp' },
  { id: 'midnight', image: '/backgrounds/moonlit.webp' },
  { id: 'sakura', image: '/backgrounds/cloudroom.webp' },
];

const responseLanguageForVoice = (locale: string): ResponseLanguage => {
  if (locale.toLowerCase().startsWith('ja')) return 'ja';
  if (locale.toLowerCase().startsWith('en')) return 'en';
  return 'ar';
};

const voiceLocaleForResponse = (language: ResponseLanguage): string => {
  if (language === 'ja') return 'ja-JP';
  if (language === 'en') return 'en-US';
  return 'ar-SA';
};

export default function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const {
    responseLanguage, background, avatarId, theme, providerId, model,
    speechRate, speechPitch, permanentMemory, voiceLanguage, voiceURI,
    conversation,
    setResponseLanguage, setBackground, setAvatarId, setTheme,
    setProviderId, setModel,
    setSpeechRate, setSpeechPitch, setPermanentMemory,
    setVoiceLanguage, setVoiceURI, clearConversation,
  } = useAlishaStore();

  const [activeTab, setActiveTab] = useState<'general' | 'keys'>('general');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<RouterProviderStatus[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [checkingProviderId, setCheckingProviderId] = useState('');
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const allowedVoiceLanguage = safeVoiceLocale(voiceLanguage, responseLanguage);

  useEffect(() => {
    loadVoices().then(() => setVoices(getVoicesForLanguage(allowedVoiceLanguage)));
  }, [allowedVoiceLanguage, open]);

  useEffect(() => { clearLegacyProviderKeys(); }, []);

  const fetchModels = async (force = false, onlyProviderId?: string) => {
    if (onlyProviderId) setCheckingProviderId(onlyProviderId);
    else setLoadingModels(true);
    try {
      const list = await listRouterProviders({ providerId: onlyProviderId, force });
      setProviderStatuses((current) => {
        if (!onlyProviderId) return list;
        const merged = new Map(current.map((provider) => [provider.id, provider]));
        for (const provider of list) merged.set(provider.id, provider);
        return [...merged.values()];
      });
      setProvidersLoaded(true);

      const currentSettings = useAlishaStore.getState();
      const isUsable = (provider: RouterProviderStatus) => provider.models.length > 0
        && ['valid', 'partial', 'available'].includes(provider.status);
      const selected = list.find((provider) => provider.id === currentSettings.providerId && isUsable(provider))
        || list.find(isUsable);
      if (selected && selected.models.length > 0 && ['valid', 'partial', 'available'].includes(selected.status)) {
        if (selected.id !== currentSettings.providerId) {
          setProviderId(selected.id);
          setModel(selected.models[0]?.id || '');
        } else if (!selected.models.some((item) => item.id === currentSettings.model) && selected.models[0]) {
          setModel(selected.models[0].id);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'تعذر فحص مزودي النماذج.');
    } finally {
      if (onlyProviderId) setCheckingProviderId('');
      else setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (open && activeTab === 'keys' && !providersLoaded && !loadingModels) {
      const timer = window.setTimeout(() => { void fetchModels(); }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, activeTab, providersLoaded, loadingModels]);

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => {
      setSaved(false);
      onOpenChange(false);
    }, 900);
  };

  const activeProviders = providerStatuses.filter((provider) => provider.models.length > 0
    && ['valid', 'partial', 'available'].includes(provider.status));
  const selectedProvider = providerStatuses.find((provider) => provider.id === providerId);
  const selectedModel = selectedProvider?.models.find((item) => item.id === model);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-4 border-l border-white/20 bg-[#241b35]/95 p-0 text-white shadow-2xl backdrop-blur-2xl"
      >
        <SheetHeader className="border-b border-white/10 bg-gradient-to-br from-fuchsia-500/20 via-violet-500/10 to-transparent px-5 pb-4 pt-6 relative">
          <SheetTitle className="text-2xl font-bold tracking-tight text-white">Alisha Settings</SheetTitle>
          <SheetDescription className="sr-only">Alisha settings panel</SheetDescription>
          <CloseButton onClick={() => onOpenChange(false)} ariaLabel="Close settings" className="absolute top-3 left-3 z-30" />
        </SheetHeader>

        <ScrollArea className="flex-1 px-5 pb-5">
          {/* Tab buttons — FreeLLMAPI style */}
          <div className="flex gap-2 mb-4 sticky top-0 bg-[#241b35]/95 backdrop-blur-xl py-2 z-10">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'general'
                  ? 'bg-fuchsia-500/20 border-2 border-fuchsia-500/50 text-white'
                  : 'border-2 border-white/10 text-white/60 hover:text-white hover:border-white/30'
              }`}
            >
              عام
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('keys')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'keys'
                  ? 'bg-fuchsia-500/20 border-2 border-fuchsia-500/50 text-white'
                  : 'border-2 border-white/10 text-white/60 hover:text-white hover:border-white/30'
              }`}
            >
              المفاتيح
            </button>
          </div>

          {activeTab === 'general' && (
            <Accordion type="multiple" defaultValue={['avatar', 'language']} className="w-full settings-accordion">
              {/* Avatar */}
              <AccordionItem value="avatar">
                <AccordionTrigger className="text-base font-semibold">
                  <span className="flex items-center gap-2"><User className="w-4 h-4" /> الأفاتار</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    {AVATAR_MODELS.map((m) => (
                      <button key={m.id} type="button" onClick={() => setAvatarId(m.id)}
                        className={`group relative overflow-hidden rounded-lg border-2 p-0 text-left transition-all ${
                          avatarId === m.id ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/30' : 'border-white/10 hover:border-white/30'
                        }`}>
                        {m.thumbnailUrl ? (
                          <div className="aspect-square w-full bg-black/30 overflow-hidden">
                            <img src={m.thumbnailUrl} alt={m.name} className="h-full w-full object-cover object-top transition-transform group-hover:scale-105" />
                          </div>
                        ) : (
                          <div className="aspect-square w-full bg-muted/30 flex items-center justify-center text-3xl">{m.emoji}</div>
                        )}
                        <div className="px-2 py-1.5 bg-black/40">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-white truncate">{m.name}</span>
                            {avatarId === m.id && <CheckCircle2 className="w-3.5 h-3.5 text-fuchsia-500 shrink-0" />}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Background */}
              <AccordionItem value="background">
                <AccordionTrigger className="text-base font-semibold">
                  <span className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> الخلفية</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    {BACKGROUNDS.map((bg) => (
                      <button key={bg.id} type="button" onClick={() => setBackground(bg.id)}
                        className={`group relative h-24 overflow-hidden rounded-xl border-2 transition-all ${
                          background === bg.id ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/30' : 'border-transparent hover:border-white/30'
                        }`}>
                        <div className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                          style={{ backgroundImage: `url(${bg.image})` }} />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-5 text-xs font-semibold text-white">
                          {BACKGROUND_LABELS[bg.id]}
                        </span>
                        {background === bg.id && <span className="absolute top-1 right-2 text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Language & Voice */}
              <AccordionItem value="language">
                <AccordionTrigger className="text-base font-semibold">
                  <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> اللغة والصوت</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">لغة الرد</Label>
                    <Select value={responseLanguage} onValueChange={(v) => {
                      const next = v as ResponseLanguage;
                      setResponseLanguage(next);
                      setVoiceLanguage(voiceLocaleForResponse(next));
                      setVoiceURI('');
                    }}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LANGUAGE_LABELS) as ResponseLanguage[]).map((lang) => (
                          <SelectItem key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> لغة الصوت (TTS)</Label>
                    <Select value={allowedVoiceLanguage} onValueChange={(v) => {
                      setVoiceLanguage(v);
                      setResponseLanguage(responseLanguageForVoice(v));
                      setVoiceURI('');
                    }}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VOICE_LANGUAGES.map((vl) => (
                          <SelectItem key={vl.value} value={vl.value}>{vl.native} — {vl.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {voices.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">الصوت المحدد</Label>
                      <Select value={voiceURI || '__auto__'} onValueChange={(v) => setVoiceURI(v === '__auto__' ? '' : v)}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__auto__">تلقائي (حسب اللغة)</SelectItem>
                          {voices.map((v) => (
                            <SelectItem key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full border-fuchsia-300/30 bg-white/5" onClick={() => {
                    if (previewingVoice) { stopSpeaking(); setPreviewingVoice(false); return; }
                    setPreviewingVoice(true);
                    speak({
                      text: responseLanguage === 'ja' ? 'こんにちは' : responseLanguage === 'en' ? 'Hello, I am Alisha.' : 'مرحباً، أنا Alisha.',
                      language: responseLanguage, voiceLanguage, voiceURI, rate: speechRate, pitch: speechPitch,
                      onEnd: () => setPreviewingVoice(false), onError: () => setPreviewingVoice(false),
                    });
                  }}>
                    <Volume2 className="mr-2 h-4 w-4" />
                    {previewingVoice ? 'إيقاف العينة' : 'تشغيل عينة الصوت'}
                  </Button>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">سرعة الكلام</Label>
                      <span className="text-xs text-white/60 tabular-nums">{speechRate.toFixed(2)}×</span>
                    </div>
                    <Slider value={[speechRate]} onValueChange={(v) => setSpeechRate(v[0])} min={0.5} max={2.0} step={0.05} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">طبقة الصوت</Label>
                      <span className="text-xs text-white/60 tabular-nums">{speechPitch.toFixed(2)}</span>
                    </div>
                    <Slider value={[speechPitch]} onValueChange={(v) => setSpeechPitch(v[0])} min={0.0} max={2.0} step={0.05} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Conversation */}
              <AccordionItem value="conversation">
                <AccordionTrigger className="text-base font-semibold">
                  <span className="flex items-center gap-2"><MessagesSquare className="w-4 h-4" /> المحادثة</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-white/60">{conversation.length} رسالة</p>
                    {conversation.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm('مسح كل الرسائل؟')) clearConversation(); }} className="h-7 text-xs text-destructive">
                        <Trash2 className="w-3 h-3 mr-1" /> مسح
                      </Button>
                    )}
                    {conversation.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => void shareOrDownload(conversation, responseLanguage)} className="h-7 text-xs">
                        مشاركة
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Permanent Memory */}
              <AccordionItem value="permanent">
                <AccordionTrigger className="text-base font-semibold">
                  <span className="flex items-center gap-2"><Brain className="w-4 h-4" /> الذاكرة الدائمة</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <Textarea value={permanentMemory} onChange={(e) => setPermanentMemory(e.target.value)} rows={10}
                    className="font-mono text-xs" placeholder="" />
                  <Button variant="outline" size="sm" onClick={() => setPermanentMemory(DEFAULT_PERMANENT_MEMORY)} className="text-xs">
                    استعادة الافتراضي
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {activeTab === 'keys' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">المزود والنموذج</h2>
                  <p className="text-xs text-white/60">{activeProviders.length} مزود يعمل من {providerStatuses.length} مهيأ</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void fetchModels(true)} disabled={loadingModels} className="h-8 text-xs">
                  {loadingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  <span className="ml-1">تحديث حالة النماذج</span>
                </Button>
              </div>

              <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-white/70">
                مفاتيح API محفوظة على الخادم ولا تظهر في الصفحة. الموديلات المعروضة اجتازت طلب دردشة قصيرًا على المفتاح المرتبط بها؛ اختيار المزود والنموذج محفوظ على هذا الجهاز. عند تغيير المفتاح يجب إعادة اختبار الموديلات.
              </p>

              {providerStatuses.length === 0 && !loadingModels ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  لا توجد مزودات مهيأة على الخادم حتى الآن. حدّث الصفحة بعد إضافة مفاتيح الخادم.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">نوع المزود</Label>
                    <Select value={providerId} onValueChange={(id) => {
                      const nextProvider = providerStatuses.find((item) => item.id === id);
                      setProviderId(id);
                      setModel(nextProvider?.models[0]?.id || '');
                    }}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="اختر المزود" /></SelectTrigger>
                      <SelectContent>
                        {providerStatuses.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id} disabled={provider.models.length === 0}>
                            {provider.name} · {provider.models.length} نموذج مجتاز
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProvider && selectedProvider.models.length === 0 && (
                    <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100/90">
                      لم ينجح أي نموذج لهذا المزود في اختبار دردشة فعلي، لذلك لن يظهر في قائمة الاختيار. قد يكون السبب رصيدًا غير متاح أو حدّ طلبات أو عدم دعم النموذج.
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">نموذج الدردشة</Label>
                    <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={modelPickerOpen} className="w-full justify-between border-white/15 bg-black/20 text-white">
                          <span className="truncate">{selectedModel?.name || selectedModel?.id || 'اختر نموذجًا'}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
                        <Command>
                          <CommandInput placeholder="ابحث عن نموذج..." />
                          <CommandList className="max-h-64">
                            <CommandEmpty>لا توجد نماذج مطابقة.</CommandEmpty>
                            <CommandGroup>
                              {(selectedProvider?.models || []).map((item) => (
                                <CommandItem key={item.id} value={`${item.name} ${item.id}`} onSelect={() => {
                                  setModel(item.id);
                                  setModelPickerOpen(false);
                                }}>
                                  <span className="flex-1 truncate">{item.name}</span>
                                  <span className="ml-2 max-w-[45%] truncate text-[10px] text-muted-foreground">{item.id}</span>
                                  {item.id === model && <CheckCircle2 className="ml-2 h-4 w-4 text-fuchsia-400" />}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {selectedProvider && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className={`h-2 w-2 rounded-full ${selectedProvider.models.length ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {selectedProvider.status === 'valid' ? 'الموديلات المختبرة متاحة' : selectedProvider.status === 'partial' ? 'بعض المفاتيح لديها موديلات مختبرة' : selectedProvider.status === 'available' ? 'متاح دون مفتاح' : selectedProvider.status === 'invalid' ? 'المفتاح مرفوض' : selectedProvider.status === 'no-tested-models' ? 'لا يوجد موديل اجتاز اختبار الدردشة' : 'تعذر الاتصال'}
                        </div>
                        <p className="mt-1 text-xs text-white/55">
                          {selectedProvider.keyCount > 0 ? `${selectedProvider.verifiedKeyCount} من ${selectedProvider.keyCount} مفاتيح لديها موديلات مختبرة` : 'خدمة مجهولة الهوية'} · {selectedProvider.models.length} نموذجًا مجتازًا
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void fetchModels(true, providerId)} disabled={checkingProviderId === providerId} className="shrink-0 text-xs">
                        {checkingProviderId === providerId ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        <span className="ml-1">تحديث حالة المفتاح</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">حالة المزودات</Label>
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-2">
                  {providerStatuses.map((provider) => (
                    <div key={provider.id} className="flex items-center justify-between gap-2 rounded p-2 text-xs hover:bg-white/5">
                      <span className="flex min-w-0 items-center gap-2 truncate">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${provider.models.length ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className="truncate">{provider.name}</span>
                      </span>
                      <span className="shrink-0 text-white/50">
                        {provider.keyCount ? `${provider.verifiedKeyCount}/${provider.keyCount} · ` : ''}{provider.models.length} مجتاز
                      </span>
                    </div>
                  ))}
                  {loadingModels && <div className="p-2 text-xs text-white/50">جارٍ فحص المزودات...</div>}
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="sticky bottom-0 z-10 mt-6 space-y-2 border-t border-white/10 bg-[#241b35]/95 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
            <Button onClick={handleSave} className="w-full bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-fuchsia-900/30 hover:from-fuchsia-400 hover:to-violet-500">
              {saved ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              {saved ? 'تم حفظ التغييرات' : 'حفظ التغييرات'}
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
