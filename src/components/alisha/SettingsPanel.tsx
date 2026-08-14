'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlishaStore, DEFAULT_PERMANENT_MEMORY } from '@/store/alisha-store';
import type {
  GeminiModel,
  ResponseLanguage,
  BackgroundId,
} from '@/lib/alisha/types';
import {
  LANGUAGE_LABELS,
  BACKGROUND_LABELS,
  VOICE_LANGUAGES,
} from '@/lib/alisha/types';
import {
  listGeminiModels,
  setApiKey as persistApiKey,
  isUsingBakedKey,
} from '@/lib/alisha/gemini-client';
import {
  loadVoices,
  getVoicesForLanguage,
  speak,
  stopSpeaking,
} from '@/lib/alisha/speech';
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  User,
  Image as ImageIcon,
  Globe,
  Brain,
  MessagesSquare,
  Volume2,
  Trash2,
  CheckCircle2,
  Save,
} from 'lucide-react';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BACKGROUNDS: { id: BackgroundId; image: string; accent: string }[] = [
  { id: 'aurora', image: '/backgrounds/aurora.webp', accent: 'بحيرة الشفق' },
  { id: 'sunset', image: '/backgrounds/sakura.webp', accent: 'حديقة الساكورا' },
  { id: 'midnight', image: '/backgrounds/moonlit.webp', accent: 'سطح ضوء القمر' },
  { id: 'sakura', image: '/backgrounds/cloudroom.webp', accent: 'غرفة السحاب' },
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
    responseLanguage,
    background,
    model,
    speechRate,
    speechPitch,
    apiKey,
    permanentMemory,
    voiceLanguage,
    voiceURI,
    conversation,
    setResponseLanguage,
    setBackground,
    setModel,
    setSpeechRate,
    setSpeechPitch,
    setApiKey,
    setPermanentMemory,
    setVoiceLanguage,
    setVoiceURI,
    clearConversation,
    reset,
  } = useAlishaStore();

  // ---- Models ----
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [modelsError, setModelsError] = useState<string>('');

  // ---- API key UI ----
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  // ---- TTS voices ----
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewingVoice, setPreviewingVoice] = useState(false);

  // Sync local input when the store value changes externally
  useEffect(() => {
    if (apiKeyInput !== apiKey) {
      // This effect synchronizes an external persisted store into the input field.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApiKeyInput(apiKey);
    }
  }, [apiKey]);

  // Load voices on mount and when voiceLanguage changes
  useEffect(() => {
    loadVoices().then(() => {
      setVoices(getVoicesForLanguage(voiceLanguage));
    });
  }, [voiceLanguage, open]);

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const list = await listGeminiModels(apiKeyInput.trim() || undefined);
      setModels(list);
      toast.success(`الاتصال يعمل — ${list.length} نماذج متاحة`);
    } catch (err: any) {
      toast.error(err?.message || 'تعذر الاتصال بخادم Gemini');
    } finally {
      setTestingConnection(false);
    }
  };

  const fetchModels = async () => {
    setLoadingModels(true);
    setModelsError('');
    try {
      const list = await listGeminiModels(apiKeyInput.trim() || undefined);
      setModels(list);
      // If the user's currently selected model isn't in the available list
      // (e.g. they had a deprecated model from an older session), auto-switch
      // to the first available model (which is always gemini-flash-latest
      // because we sort it first).
      const stillAvailable = list.some((m) => m.name === model);
      if (!stillAvailable && list.length > 0) {
        setModel(list[0].name);
      }
    } catch (err: any) {
      setModelsError(err?.message || 'Unknown error');
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (open && models.length === 0 && !loadingModels && !modelsError) {
      // Fetching here intentionally updates loading/error state from an external API.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchModels();
    }
  }, [open, models.length, loadingModels, modelsError]);

  const handleApiKeyChange = (value: string) => {
    setApiKeyInput(value);
    setApiKey(value);
    persistApiKey(value);
    // Clear cached models when key changes
    setModels([]);
    setModelsError('');
  };

  // The effective key status for display
  const usingBaked = isUsingBakedKey() && !apiKey;
  const hasKey = Boolean(apiKey) || usingBaked;
  const keySourceLabel = apiKey ? 'مفتاح محلي مخصص' : usingBaked ? 'مفتاح Vercel الخادمي السري' : 'لا يوجد مفتاح متاح';

  const handleSave = () => {
    // Zustand persist writes changes immediately; this explicit action gives
    // the user a clear confirmation and flushes the current API key value.
    persistApiKey(apiKeyInput.trim());
    setApiKey(apiKeyInput.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-4 border-l border-white/20 bg-[#241b35]/95 p-0 text-white shadow-2xl backdrop-blur-2xl"
      >
        <SheetHeader className="border-b border-white/10 bg-gradient-to-br from-fuchsia-500/20 via-violet-500/10 to-transparent px-5 pb-4 pt-6">
          <SheetTitle className="text-2xl font-bold tracking-tight text-white">إعدادات اليشيا</SheetTitle>
              <SheetDescription>
            خصّص المشهد والصوت والذاكرة، ثم اضغط حفظ التغييرات لتأكيدها.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-5 pb-5">
          <Accordion
            type="multiple"
            defaultValue={['keys', 'language']}
            className="w-full settings-accordion"
          >
            {/* ============ Section 1: API Keys & Models ============ */}
            <AccordionItem value="keys">
              <AccordionTrigger className="text-base font-semibold">
                <span className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  المفاتيح والموديلات
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <span className="text-xs text-white/70">مصدر المفتاح المستخدم فعلياً</span>
                  <Badge variant={hasKey ? 'secondary' : 'destructive'} className="text-[10px]">{keySourceLabel}</Badge>
                </div>

                {/* API key status badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  {hasKey ? (
                    <Badge variant="secondary" className="text-xs gap-1 bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" />
                      {usingBaked ? 'يستخدم مفتاح المستودع' : 'مفتاح مخصص'}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      لا يوجد مفتاح
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">مفتاح Gemini API</Label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      احصل على مفتاح <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    اختياري — يُستخدم مفتاح المستودع تلقائياً. اتركه فارغاً لاستخدام مفتاح المستودع.
                  </p>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="اتركه فارغاً لاستخدام مفتاح المستودع"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showApiKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Model selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium">موديل Gemini</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchModels}
                        disabled={loadingModels}
                        className="h-7 px-2"
                      >
                        {loadingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        <span className="ml-1 text-xs">تحديث</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void testConnection()}
                        disabled={testingConnection}
                        className="h-7 px-2 border-emerald-300/30"
                      >
                        {testingConnection ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span className="ml-1 text-xs">اختبار</span>
                      </Button>
                    </div>
                  </div>
                  {modelsError ? (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>{modelsError}</div>
                    </div>
                  ) : null}
                  <Select
                    value={models.some((m) => m.name === model) ? model : (models[0]?.name || 'gemini-flash-latest')}
                    onValueChange={setModel}
                    disabled={loadingModels && models.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر موديلاً">
                        {model || 'اختر موديلاً'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {models.length === 0 && !loadingModels ? (
                        <SelectItem value={model || 'gemini-flash-latest'}>
                          {model || 'gemini-flash-latest'}
                        </SelectItem>
                      ) : (
                        models.map((m) => (
                          <SelectItem key={m.name} value={m.name}>
                            <div className="flex flex-col">
                              <span>{m.displayName}</span>
                              <span className="text-xs text-muted-foreground">{m.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {models.length > 0
                      ? `${models.length} موديل متاح لهذا المفتاح`
                      : 'جارٍ تحميل الموديلات…'}
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============ Section 2: Avatar ============ */}
            <AccordionItem value="avatar">
              <AccordionTrigger className="text-base font-semibold">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  الأفاتار
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  النموذج الحالي: <span className="font-medium">Kei (Cubism 4)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rounded-lg border-2 border-primary p-3 bg-muted/30 text-left"
                  >
                    <div className="text-sm font-medium">Kei</div>
                    <div className="text-xs text-muted-foreground">مفعّل</div>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-lg border-2 border-muted p-3 text-left opacity-50 cursor-not-allowed"
                  >
                    <div className="text-sm font-medium">+ موديل جديد</div>
                    <div className="text-xs text-muted-foreground">قريباً</div>
                  </button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============ Section 3: Background ============ */}
            <AccordionItem value="background">
              <AccordionTrigger className="text-base font-semibold">
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  الخلفية
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBackground(bg.id)}
                      className={`group relative h-24 overflow-hidden rounded-xl border-2 transition-all ${
                        background === bg.id
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-transparent hover:border-muted-foreground/30'
                      }`}
                    >
                      <div
                        className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url(${bg.image})` }}
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-5 text-xs font-semibold text-white">
                        {BACKGROUND_LABELS[bg.id]} · {bg.accent}
                      </span>
                      {background === bg.id && (
                        <span className="absolute top-1 right-2 text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============ Section 4: Language & Voice ============ */}
            <AccordionItem value="language">
              <AccordionTrigger className="text-base font-semibold">
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  اللغة والصوت
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {/* Response language */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">لغة الرد</Label>
                  <p className="text-xs text-muted-foreground">
                    سترد اليشيا بهذه اللغة بغض النظر عن لغة الإدخال.
                  </p>
                  <Select
                    value={responseLanguage}
                    onValueChange={(v) => {
                      const next = v as ResponseLanguage;
                      setResponseLanguage(next);
                      setVoiceLanguage(voiceLocaleForResponse(next));
                      setVoiceURI('');
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LANGUAGE_LABELS) as ResponseLanguage[]).map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {LANGUAGE_LABELS[lang]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Voice language */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" />
                    لغة الصوت (TTS)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    لغة الصوت هي لغة الرد أيضاً؛ عند تغييرها تتغير لغة Gemini تلقائياً.
                  </p>
                  <Select
                    value={voiceLanguage}
                    onValueChange={(v) => {
                      setVoiceLanguage(v);
                      setResponseLanguage(responseLanguageForVoice(v));
                      setVoiceURI('');
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_LANGUAGES.map((vl) => (
                        <SelectItem key={vl.value} value={vl.value}>
                          {vl.native} — {vl.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Specific voice */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">الصوت المحدد</Label>
                  <p className="text-xs text-muted-foreground">
                    اختر صوتاً محدداً من الأصوات المتاحة للغة المختارة.
                  </p>
                  {voices.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic p-2 border rounded-md bg-muted/30">
                      لا توجد أصوات متاحة لهذه اللغة في متصفحك.
                    </div>
                  ) : (
                    <Select
                      value={voiceURI || '__auto__'}
                      onValueChange={(v) => setVoiceURI(v === '__auto__' ? '' : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">تلقائي (حسب اللغة)</SelectItem>
                        {voices.map((v) => (
                          <SelectItem key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-fuchsia-300/30 bg-white/5"
                  onClick={() => {
                    if (previewingVoice) {
                      stopSpeaking();
                      setPreviewingVoice(false);
                      return;
                    }
                    setPreviewingVoice(true);
                    speak({
                      text: responseLanguage === 'ja' ? 'こんにちは、私はアリーシャです。' : responseLanguage === 'en' ? 'Hello, I am Alisha.' : 'مرحباً، أنا اليشيا.',
                      language: responseLanguage,
                      voiceLanguage,
                      voiceURI,
                      rate: speechRate,
                      pitch: speechPitch,
                      onEnd: () => setPreviewingVoice(false),
                      onError: () => setPreviewingVoice(false),
                    });
                  }}
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  {previewingVoice ? 'إيقاف العينة' : 'تشغيل عينة الصوت'}
                </Button>

                {/* Speech rate */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">سرعة الكلام</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {speechRate.toFixed(2)}×
                    </span>
                  </div>
                  <Slider
                    value={[speechRate]}
                    onValueChange={(v) => setSpeechRate(v[0])}
                    min={0.5}
                    max={2.0}
                    step={0.05}
                  />
                </div>

                {/* Speech pitch */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">طبقة الصوت</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {speechPitch.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[speechPitch]}
                    onValueChange={(v) => setSpeechPitch(v[0])}
                    min={0.0}
                    max={2.0}
                    step={0.05}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============ Section 5: Current Conversation Memory ============ */}
            <AccordionItem value="conversation">
              <AccordionTrigger className="text-base font-semibold">
                <span className="flex items-center gap-2">
                  <MessagesSquare className="w-4 h-4" />
                  ذاكرة المحادثة الحالية
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {conversation.length === 0
                      ? 'لا توجد رسائل بعد.'
                      : `${conversation.length} رسالة في هذه الجلسة`}
                  </p>
                  {conversation.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('مسح كل رسائل هذه الجلسة؟')) {
                          clearConversation();
                        }
                      }}
                      className="h-7 text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      مسح
                    </Button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/30 p-2 space-y-2">
                  {conversation.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      ابدأ محادثة جديدة لتظهر الرسائل هنا.
                    </p>
                  ) : (
                    conversation.map((m) => (
                      <div
                        key={m.id}
                        className={`text-xs rounded-md p-2 ${
                          m.role === 'user'
                            ? 'bg-blue-100 dark:bg-blue-900/30 ml-4'
                            : 'bg-purple-100 dark:bg-purple-900/30 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-[10px] opacity-70">
                            {m.role === 'user' ? 'غيلان' : 'اليشيا'}
                          </span>
                          <span className="text-[9px] opacity-50">
                            {new Date(m.ts).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ============ Section 6: Permanent Memory ============ */}
            <AccordionItem value="permanent">
              <AccordionTrigger className="text-base font-semibold">
                <span className="flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  الذاكرة الدائمة
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  هذه التعليمات تُحقن في كل طلب إلى Gemini ولا تُنسى أبداً، حتى لو بدأت محادثة جديدة.
                  مثلاً: اسم المستخدم، اسم اليشيا، تعليمات دائمة.
                </p>
                <Textarea
                  value={permanentMemory}
                  onChange={(e) => setPermanentMemory(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                  placeholder="اكتب التعليمات الدائمة هنا…"
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPermanentMemory(DEFAULT_PERMANENT_MEMORY)}
                    className="text-xs"
                  >
                    استعادة الافتراضي
                  </Button>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {permanentMemory.length} حرف
                  </span>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="sticky bottom-0 z-10 mt-6 space-y-2 border-t border-white/10 bg-[#241b35]/95 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
            <Button onClick={handleSave} className="w-full bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-fuchsia-900/30 hover:from-fuchsia-400 hover:to-violet-500">
              {saved ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              {saved ? 'تم حفظ التغييرات' : 'حفظ التغييرات'}
            </Button>
          </div>

          {/* Reset all */}
          <div className="mt-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    'إعادة ضبط كل الإعدادات إلى الافتراضي؟ لا يمكن التراجع.'
                  )
                ) {
                  reset();
                }
              }}
              className="w-full text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              إعادة ضبط كل الإعدادات
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
