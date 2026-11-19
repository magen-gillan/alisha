import type { AvatarId } from '@/lib/alisha/avatars';
import type { Emotion } from '@/lib/alisha/emotion';
import type { ResponseLanguage } from '@/lib/alisha/types';

export interface AvatarTapAnimation {
  id: string;
  label: string;
  emotion: Emotion;
  durationMs: number;
  phrase: Record<ResponseLanguage, string>;
  live2d: {
    angleX: number;
    angleY: number;
    bodyAngleX: number;
    mouthForm: number;
    eyeScale: number;
  };
  threeD: {
    yaw: number;
    bob: number;
    headTilt: number;
    armLift: number;
    wave: number;
  };
}

const BASE_ANIMATIONS: Omit<AvatarTapAnimation, 'id' | 'phrase'>[] = [
  { label: 'ترحيب لطيف', emotion: 'happy', durationMs: 1500, live2d: { angleX: 8, angleY: -4, bodyAngleX: 3, mouthForm: 0.7, eyeScale: 1.0 }, threeD: { yaw: 0.05, bob: 0.025, headTilt: -0.08, armLift: 0.12, wave: 0.7 } },
  { label: 'غمزة مرحة', emotion: 'happy', durationMs: 1200, live2d: { angleX: -5, angleY: 2, bodyAngleX: -2, mouthForm: 0.5, eyeScale: 0.22 }, threeD: { yaw: -0.04, bob: 0.01, headTilt: 0.12, armLift: 0.04, wave: 0.15 } },
  { label: 'دهشة مضيئة', emotion: 'surprised', durationMs: 1400, live2d: { angleX: 0, angleY: -7, bodyAngleX: 0, mouthForm: 0.1, eyeScale: 1.2 }, threeD: { yaw: 0, bob: 0.035, headTilt: -0.16, armLift: 0.24, wave: 0.25 } },
  { label: 'إيماءة موافقة', emotion: 'happy', durationMs: 1300, live2d: { angleX: 3, angleY: 8, bodyAngleX: 2, mouthForm: 0.4, eyeScale: 0.95 }, threeD: { yaw: 0.02, bob: 0.03, headTilt: 0.2, armLift: 0.06, wave: 0.1 } },
  { label: 'نظرة جانبية', emotion: 'neutral', durationMs: 1700, live2d: { angleX: 16, angleY: 0, bodyAngleX: 7, mouthForm: 0.05, eyeScale: 0.9 }, threeD: { yaw: 0.22, bob: 0, headTilt: 0.02, armLift: 0.02, wave: 0 } },
  { label: 'خجل دافئ', emotion: 'happy', durationMs: 1800, live2d: { angleX: -7, angleY: 5, bodyAngleX: -4, mouthForm: 0.3, eyeScale: 0.78 }, threeD: { yaw: -0.08, bob: 0.02, headTilt: 0.18, armLift: 0.14, wave: 0.05 } },
  { label: 'سؤال فضولي', emotion: 'surprised', durationMs: 1600, live2d: { angleX: -10, angleY: -4, bodyAngleX: -5, mouthForm: -0.1, eyeScale: 1.1 }, threeD: { yaw: -0.12, bob: 0.018, headTilt: -0.2, armLift: 0.18, wave: 0.35 } },
  { label: 'إشارة قلب', emotion: 'happy', durationMs: 1900, live2d: { angleX: 5, angleY: -2, bodyAngleX: 3, mouthForm: 0.9, eyeScale: 0.88 }, threeD: { yaw: 0.06, bob: 0.022, headTilt: -0.06, armLift: 0.22, wave: 0.45 } },
  { label: 'تنبيه رقيق', emotion: 'sad', durationMs: 1500, live2d: { angleX: 0, angleY: 6, bodyAngleX: 0, mouthForm: -0.25, eyeScale: 0.72 }, threeD: { yaw: 0, bob: -0.018, headTilt: 0.13, armLift: 0.1, wave: 0.08 } },
  { label: 'وداع قصير', emotion: 'happy', durationMs: 2100, live2d: { angleX: 9, angleY: 0, bodyAngleX: 5, mouthForm: 0.6, eyeScale: 0.96 }, threeD: { yaw: 0.14, bob: 0.02, headTilt: -0.04, armLift: 0.3, wave: 1.0 } },
];

const VOICES: Record<AvatarId, { ar: string[]; en: string[]; ja: string[] }> = {
  kei: {
    ar: ['هل كان هذا أنت؟ شعرت بلمستك.', 'أوه! رأيت غمزتك.', 'يا للدهشة، ماذا حدث؟', 'هل توافقني الرأي؟', 'لماذا تنظر إلى هناك؟', 'هذا محرج قليلًا...', 'هل لديك سؤال لي؟', 'هذه ابتسامة لك.', 'هل كل شيء بخير؟', 'إلى اللقاء، عد قريبًا.'],
    en: ['Was that you? I felt your touch.', 'Oh! Did you just wink?', 'Wow, what happened?', 'Do you agree with me?', 'Why are you looking there?', 'That is a little embarrassing...', 'Do you have a question for me?', 'This smile is for you.', 'Is everything alright?', 'Goodbye, come back soon.'],
    ja: ['今のはあなた？触れたのを感じたよ。', 'あっ、ウインクした？', 'わあ、何が起きたの？', '私に賛成してくれる？', 'どうしてそっちを見ているの？', 'ちょっと恥ずかしいな…', '私に質問があるの？', 'この笑顔はあなたのため。', '大丈夫？', 'またすぐ来てね。'],
  },
  jane: {
    ar: ['لمستك وصلتني يا صديقي.', 'هل رأيت تلك الغمزة؟', 'هذا مفاجئ جدًا!', 'أظن أننا متفقان.', 'عيناي تتبعان فضولك.', 'أشعر بالخجل الآن.', 'ما السؤال الذي يدور في بالك؟', 'أهديك هذه الإشارة.', 'أشعر ببعض القلق عليك.', 'سأنتظرك في المرة القادمة.'],
    en: ['Your touch reached me, friend.', 'Did you see that wink?', 'That was quite a surprise!', 'I think we agree.', 'My eyes follow your curiosity.', 'I am blushing now.', 'What question is on your mind?', 'This little sign is for you.', 'I am a little worried about you.', 'I will wait for your next visit.'],
    ja: ['あなたのタッチ、届いたよ。', '今のウインク、見えた？', 'とても驚いたわ！', '私たちは気が合うみたい。', 'あなたの好奇心を目で追ってるの。', '今、少し照れているわ。', 'どんな質問を考えているの？', 'このサインをあなたに。', 'あなたのことが少し心配。', '次に来るのを待っているわ。'],
  },
  icegirl: {
    ar: ['لمستك باردة ولطيفة.', 'ها! هل أرسلت لك غمزة جليدية؟', 'تجمدت من الدهشة!', 'إشارة ثلجية بالموافقة.', 'أراقب الأفق البعيد.', 'حتى الجليد يخجل أحيانًا.', 'اسألني، فالثلج يسمع.', 'قلب من بلور لك.', 'لا تقلق، أنا هنا.', 'سأترك لك ندفة قبل الرحيل.'],
    en: ['Your touch is cool and gentle.', 'Ha! Did I send you an icy wink?', 'I froze in surprise!', 'A frosty sign of agreement.', 'I am watching the distant horizon.', 'Even ice gets shy sometimes.', 'Ask me; the snow is listening.', 'A crystal heart for you.', 'Do not worry, I am here.', 'I will leave you a snowflake.'],
    ja: ['あなたのタッチは冷たくて優しいね。', 'えっ、氷のウインクが見えた？', '驚いて凍っちゃった！', '雪の同意サインだよ。', '遠い地平線を見ているの。', '氷だって照れることがあるよ。', '聞いて。雪は耳を澄ましているよ。', 'あなたにクリスタルのハート。', '心配しないで、ここにいるよ。', '帰る前に雪の結晶を置いていくね。'],
  },
  ganyu: {
    ar: ['أشعر بلمستك بين السحب.', 'هل كانت غمزة التنين لطيفة؟', 'يا للعجب، ارتفعت السحب!', 'إيماءة مني تعني نعم.', 'نظرتي تحلق بعيدًا.', 'أشعر بالخجل كالزهرة.', 'قل سؤالك وسأصغي.', 'قلب سماوي لك.', 'سأحميك، لا تقلق.', 'حلّق بسلام حتى نلتقي.'],
    en: ['I feel your touch among the clouds.', 'Was the dragon wink gentle?', 'Oh my, the clouds rose!', 'My nod means yes.', 'My gaze is flying far away.', 'I feel shy like a flower.', 'Ask your question and I will listen.', 'A celestial heart for you.', 'I will protect you, do not worry.', 'Fly safely until we meet again.'],
    ja: ['雲の中であなたのタッチを感じたよ。', '龍のウインクは優しかった？', 'まあ、雲が舞い上がった！', 'このうなずきは「はい」の印。', '視線が遠くへ飛んでいくね。', '花のように恥ずかしいな。', '質問して。ちゃんと聞くよ。', 'あなたに空のハートを。', '心配しないで、守るから。', 'また会うまで、どうか元気で。'],
  },
  miara: {
    ar: ['نعم، شعرت بلمستك بوضوح.', 'تلك الغمزة كانت سرية.', 'لحظة مسرحية مذهلة!', 'إيماءة موافقة بكل أناقة.', 'أراك تراقب المشهد.', 'أشعر بالدفء والارتباك.', 'أخبرني بما تفكر فيه.', 'هذه التحية لك وحدك.', 'أنا بخير، ابق قريبًا.', 'كان ظهورًا جميلًا، أليس كذلك؟'],
    en: ['Yes, I clearly felt your touch.', 'That wink was our little secret.', 'What a dramatic moment!', 'An elegant nod of agreement.', 'I see you watching the scene.', 'I feel warm and flustered.', 'Tell me what you are thinking.', 'This greeting is just for you.', 'I am alright; stay close.', 'That was a beautiful entrance, was it not?'],
    ja: ['うん、あなたのタッチをはっきり感じたよ。', 'あのウインクは二人の秘密ね。', 'なんてドラマチックな瞬間！', '優雅な同意のうなずきよ。', 'この舞台を見ているのね。', '温かくて、少し慌てているわ。', '何を考えているか教えて。', 'この挨拶はあなたのためだけ。', '私は大丈夫、そばにいてね。', '素敵な登場だったでしょう？'],
  },
  alisha3d: {
    ar: ['هل كان هذا أنت؟ شعرت باللمسة.', 'ها هي غمزتي الخاصة.', 'واو، لقد فاجأتني!', 'نعم، أتفق معك.', 'إلى أين تذهب عيناك؟', 'أشعر بالخجل قليلًا.', 'هل تريد أن تسألني شيئًا؟', 'هذه إشارة قلب لك.', 'لا تقلق، أنا بجانبك.', 'سألوّح لك حتى تعود.'],
    en: ['Was that you? I felt the touch.', 'Here is my special wink.', 'Wow, you surprised me!', 'Yes, I agree with you.', 'Where are your eyes going?', 'I am feeling a little shy.', 'Would you like to ask me something?', 'A heart sign just for you.', 'Do not worry, I am beside you.', 'I will wave until you return.'],
    ja: ['今のはあなた？タッチを感じたよ。', '特別なウインクを送るね。', 'わあ、驚かせたね！', 'うん、あなたに賛成。', '視線はどこへ行くの？', '少し恥ずかしい気分だよ。', '何か私に聞きたい？', 'あなたにハートのサイン。', '心配しないで、そばにいるよ。', '戻るまで手を振っているね。'],
  },
};

export const AVATAR_TAP_ANIMATIONS: Record<AvatarId, AvatarTapAnimation[]> = Object.fromEntries(
  (Object.keys(VOICES) as AvatarId[]).map((avatarId) => [
    avatarId,
    BASE_ANIMATIONS.map((animation, index) => ({
      ...animation,
      id: `${avatarId}-tap-${String(index + 1).padStart(2, '0')}`,
      phrase: {
        ar: VOICES[avatarId].ar[index],
        en: VOICES[avatarId].en[index],
        ja: VOICES[avatarId].ja[index],
      },
    })),
  ]),
) as Record<AvatarId, AvatarTapAnimation[]>;

export function getAvatarTapAnimation(avatarId: AvatarId, index: number): AvatarTapAnimation {
  const animations = AVATAR_TAP_ANIMATIONS[avatarId] ?? AVATAR_TAP_ANIMATIONS.alisha3d;
  return animations[((index % animations.length) + animations.length) % animations.length];
}

export function getTapPhrase(animation: AvatarTapAnimation, language: ResponseLanguage): string {
  return animation.phrase[language] ?? animation.phrase.en;
}
