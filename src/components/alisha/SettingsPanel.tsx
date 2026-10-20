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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlishaStore, DEFAULT_PERMANENT_MEMORY } from '@/store/alisha-store';
import type { ResponseLanguage, BackgroundId } from '@/lib/alisha/types';
import { LANGUAGE_LABELS, BACKGROUND_LABELS, VOICE_LANGUAGES, BACKGROUND_ORDER, nextBackground, prevBackground } from '@/lib/alisha/types';
import { AVATAR_MODELS } from '@/lib/alisha/avatars';
import { FREE_PROVIDERS, type LLMProvider } from '@/lib/alisha/llm-router';
import { getProviderKeys, setProviderKeys, listRouterModels } from '@/lib/alisha/router-client';
import { shareOrDownload } from '@/lib/alisha/share';
import CloseButton from '@/components/alisha/CloseButton';
import {
  loadVoices, getVoicesForLanguage, speak, stopSpeaking,
} from '@/lib/alisha/speech';
import {
  Loader2, RefreshCw, AlertCircle, Eye, EyeOff, ExternalLink,
  KeyRound, User, Image as ImageIcon, Globe, Brain, MessagesSquare,
  Volume2, Trash2, CheckCircle2, Save, Plus, X,
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
    responseLanguage, background, avatarId, theme,
    speechRate, speechPitch, permanentMemory, voiceLanguage, voiceURI,
    conversation, providerKeys,
    setResponseLanguage, setBackground, setAvatarId, setTheme,
    setProviderKeys, updateProviderKey, removeProviderKey,
    setSpeechRate, setSpeechPitch, setPermanentMemory,
    setVoiceLanguage, setVoiceURI, clearConversation,
  } = useAlishaStore();

  const [activeTab, setActiveTab] = useState<'general' | 'keys'>('general');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [routerModels, setRouterModels] = useState<Array<{ id: string; provider: string; name: string }>>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadVoices().then(() => setVoices(getVoicesForLanguage(voiceLanguage)));
  }, [voiceLanguage, open]);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const list = await listRouterModels();
      setRouterModels(list);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to list models');
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (open && activeTab === 'keys' && routerModels.length === 0 && !loadingModels) {
      void fetchModels();
    }
  }, [open, activeTab]);

  const toggleKeyVisibility = (providerId: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
  };

  const handleSave = () => {
    setProviderKeys(getProviderKeys());
    setSaved(true);
    window.setTimeout(() => {
      setSaved(false);
      onOpenChange(false);
    }, 900);
  };

  // Build active providers list for display
  const activeProviders = FREE_PROVIDERS.filter(p =>
    p.anonymous || providerKeys[p.id]
  );

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
                    <Select value={voiceLanguage} onValueChange={(v) => {
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
              {/* Header — like FreeLLMAPI Keys page */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">مزودو الذكاء الاصطناعي</h2>
                  <p className="text-xs text-white/60">{activeProviders.length} مزود نشط من {FREE_PROVIDERS.length}</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchModels} disabled={loadingModels} className="h-8 text-xs">
                  {loadingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  <span className="ml-1">فحص الكل</span>
                </Button>
              </div>

              {/* Provider list — FreeLLMAPI style */}
              <div className="space-y-3">
                {FREE_PROVIDERS.filter(p => p.id !== 'custom').map((provider) => {
                  const hasKey = Boolean(providerKeys[provider.id]);
                  const isAnonymous = provider.anonymous;
                  const isActive = isAnonymous || hasKey;
                  const keyVisible = visibleKeys.has(provider.id);

                  return (
                    <div key={provider.id}
                      className={`rounded-xl border-2 p-3 transition-all ${
                        isActive ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/5'
                      }`}>
                      {/* Provider header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-white/30'}`} />
                          <span className="text-sm font-semibold">{provider.name}</span>
                          {isAnonymous && <Badge variant="secondary" className="text-[9px] bg-emerald-100 text-emerald-700">مجاني</Badge>}
                          {hasKey && <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-700">مفتاح</Badge>}
                        </div>
                        <div className="text-xs text-white/40">{provider.models.length} نماذج</div>
                      </div>

                      {/* Models */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {provider.models.map((m) => (
                          <span key={m} className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white/70">{m}</span>
                        ))}
                      </div>

                      {/* Key input — for non-anonymous providers */}
                      {!isAnonymous && (
                        <div className="space-y-2">
                          <div className="relative">
                            <input
                              type={keyVisible ? 'text' : 'password'}
                              value={providerKeys[provider.id] || ''}
                              onChange={(e) => {
                                const newKeys = { ...getProviderKeys(), [provider.id]: e.target.value };
                                setProviderKeys(newKeys);
                                updateProviderKey(provider.id, e.target.value);
                              }}
                              placeholder={`أضف مفتاح ${provider.name}...`}
                              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 pr-10 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fuchsia-500"
                              autoComplete="off" spellCheck={false}
                            />
                            <button type="button" onClick={() => toggleKeyVisibility(provider.id)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                              {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {provider.id !== 'pollinations' && provider.id !== 'google' && (
                            <a href={provider.id === 'groq' ? 'https://console.groq.com/keys'
                              : provider.id === 'cerebras' ? 'https://cloud.cerebras.ai/'
                              : provider.id === 'openrouter' ? 'https://openrouter.ai/keys'
                              : provider.id === 'mistral' ? 'https://console.mistral.ai/api-keys/'
                              : provider.id === 'cohere' ? 'https://dashboard.cohere.com/api-keys'
                              : '#'
                            } target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-fuchsia-400 hover:underline inline-flex items-center gap-1">
                              احصل على مفتاح <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Remove key button */}
                      {hasKey && !isAnonymous && (
                        <button type="button" onClick={() => {
                          const newKeys = { ...getProviderKeys() };
                          delete newKeys[provider.id];
                          setProviderKeys(newKeys);
                          removeProviderKey(provider.id);
                          toast.success(`تم حذف مفتاح ${provider.name}`);
                        }} className="text-[10px] text-red-400 hover:text-red-300 mt-1">
                          حذف المفتاح
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Available models from router */}
              {routerModels.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">النماذج المتاحة</Label>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-2 space-y-1">
                    {routerModels.map((m, i) => (
                      <div key={i} className="text-xs flex items-center justify-between rounded p-1.5 bg-white/5">
                        <span className="text-white/80">{m.name}</span>
                        <span className="text-white/40 text-[10px]">{m.provider}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
