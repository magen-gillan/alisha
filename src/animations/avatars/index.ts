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
  zaria3d: {
    ar: ['لمستك رقيقة كالزهرة.', 'غمزة خفيفة بيننا.', 'يا للروعة، فاجأتني!', 'أوافقك من كل قلبي.', 'عيوني تنساب نحو الأفق.', 'شعري يخجل من الريح.', 'اسألني بما يميل قلبك.', 'زهرة صغيرة أهديك إياها.', 'أنا هنا، بهدوء وأمان.', 'أودعك ببصمة وردة.'],
    en: ['Your touch is soft as a flower.', 'A light wink between us.', 'How lovely, you surprised me!', 'I agree with all my heart.', 'My gaze drifts to the horizon.', 'Even my hair is shy in the wind.', 'Ask me what your heart leans toward.', 'A little flower, just for you.', 'I am here, calm and safe.', 'I leave you a rose petal as farewell.'],
    ja: ['あなたのタッチは花みたいに優しいね。', '私たちだけの軽いウインク。', 'なんて素敵、驚かせたね！', '心から賛成するよ。', '視線は地平線へ漂うの。', '風に髪も少し照れてるね。', '心が向くままに聞いて。', 'あなたに小花を贈るよ。', '静かに、ここにいるから。', 'バラの花びらを置いていくね。'],
  },
  akeno3d: {
    ar: ['آه، لمستك وصلت بسرعة.', 'غمزتي؟ أحسنت الملاحظة.', 'يا لك من مثير للاهتمام.', 'رأيك… مناسب جدًا.', 'أراقبك من زاوية عيني.', 'هذا محرج… بشكل لطيف.', 'سؤالك؟ أنا مستعدة.', 'برق صغير أهديك إياه.', 'لا تخف، أنا أراقبك.', 'سأنتظرك بابتسامة غامضة.'],
    en: ['My, your touch arrived quickly.', 'My wink? Well noticed.', 'How very interesting of you.', 'Your opinion… suits me fine.', 'I am watching from the corner of my eye.', 'That is embarrassing… in a nice way.', 'Your question? I am ready.', 'A little lightning, just for you.', 'Do not fear, I am watching over you.', 'I will wait with a mysterious smile.'],
    ja: ['あら、タッチが早く届いたわね。', '私のウインク？よく気づいたわ。', 'あなたって面白いわね。', 'あなたの意見…とても気に入ったわ。', '視線の端で見てるのよ。', 'ちょっと恥ずかしいわ…いい意味で。', '質問は？準備できてるわよ。', 'あなたに小さな雷を。', '怖がらないで、見守ってるから。', '謎めいた笑みで待ってるわ。'],
  },
  wanwan3d: {
    ar: ['مرحبًا! لمستك سريعة كالريح!', 'رأيت غمزتي، أليس كذلك؟', 'واو! ما الذي حدث؟', 'بالطبع، نعم!', 'عيوني تطارد كل حركة.', 'أوه… هذا محرج!', 'اسألني، أنا جاهزة للقتال!', 'قلب نمر صغير لك!', 'لا تقلق، أنا حذرة دائمًا.', 'سأقفز حتى تعود!'],
    en: ['Hey! Your touch is quick as wind!', 'You saw my wink, did you not?', 'Whoa! What happened?', 'Of course, yes!', 'My eyes chase every move.', 'Oh… that is embarrassing!', 'Ask me, I am ready for action!', 'A little tiger heart for you!', 'Do not worry, I am always careful.', 'I will bounce around until you return!'],
    ja: ['やあ！タッチが風みたいに速い！', '私のウインク、見たよね？', 'うわっ！何が起きたの？', 'もちろん、イエス！', '目は全部の動きを追いかけるよ。', 'うわ…ちょっと恥ずかしい！', '聞いて、もう準備万端！', 'あなたにトラのハート！', '心配しないで、いつも慎重だよ。', '戻るまで跳ね回ってるから！'],
  },
  layla3d: {
    ar: ['لمستك على المدى القصير!', 'غمزة من القنّاصة!', 'هدف مذهل، فاجأتني!', 'مصيبتي معك تمامًا.', 'أراقب الأفق بمنظاري.', 'أوه… احمرّ وجهي!', 'اطلب دعمًا وسأجيب!', 'طاقة شمسية لك!', 'غطيّك، أنا هنا.', 'سأرسل الوميض الأخير، وداعًا!'],
    en: ['Your touch, at close range!', 'A wink from the sniper!', 'Great shot, you surprised me!', 'My aim agrees with you.', 'I watch the horizon through my scope.', 'Oh… I am blushing!', 'Call for support and I will answer!', 'Some solar energy for you!', 'I will cover you, I am here.', 'Sending the last flash, see you!'],
    ja: ['近距離からのタッチだね！', 'スナイパーのウインク！', 'すごい、驚かせたね！', '私の照準は君に賛成。', 'スコープで地平線を見てるよ。', 'うわ…顔が赤くなった！', 'サポート求めて、すぐ来るよ！', 'あなたに太陽のエネルギー！', 'カバーするから、ここにいるよ。', '最後のフラッシュを送るね、また！'],
  },
  girl3d: {
    ar: ['تيم تيم! لمستك وصلت.', 'غمزة صغيرة مخبأة.', 'أوه أوه! ما هذا؟', 'أوافقك تمامًا تمامًا!', 'أبحث عن شيء جميل هناك.', 'أهه… خجلت الآن!', 'سؤال؟ أنا أحب الأسئلة!', 'فيونكة قلب لك!', 'أنا بخير، لا تقلق.', 'ألوّح ألوّح، إلى اللقاء!'],
    en: ['Ta-da! Your touch arrived.', 'A tiny hidden wink.', 'Oh-oh! What was that?', 'I totally, totally agree!', 'I am looking for something pretty there.', 'Eep… I am shy now!', 'A question? I love questions!', 'A ribbon heart for you!', 'I am fine, do not worry.', 'Wave wave, see you soon!'],
    ja: ['じゃーん！タッチが届いたよ。', 'ちっちゃな隠しウインク。', 'おっおっ！何これ？', 'ぜんぜんぜん赞成！', 'あそこで素敵なものを探してるの。', 'あわわ…今照れた！', '質問？質問大好き！', 'あなたにリボンのハート！', '大丈夫、心配しないで。', '手を振る振る、またね！'],
  },
  casual3d: {
    ar: ['يا هلا، شعرت بلمستك.', 'غمزة عفوية مني.', 'حصري! ماذا كان ذلك؟', 'أوافقك بلا تفكير.', 'أشاهد المكان من هنا.', 'هيه… رخا قليلًا!', 'جرّبني بسؤال صعب.', 'إيماءة سلام لك.', 'كل شيء تمام، ألقى بالك.', 'أشوفك بعدين، أرتاح شوي!'],
    en: ['Hey there, I felt your touch.', 'A casual wink from me.', 'Exclusive! What was that?', 'I agree without thinking twice.', 'I am checking the place from here.', 'Whoa… easy there!', 'Try me with a hard question.', 'A chill sign for you.', 'Everything is fine, see you around.', 'Catch you later, taking a breather!'],
    ja: ['やあ、タッチ感じたよ。', '気ままなウインクね。', 'レア！今の何？', '迷わず賛成するよ。', 'ここから場内チェック中。', 'わっ…ちょっとまって！', '難しい質問で試して。', 'あなたにピースサイン。', '全部大丈夫、またね。', 'じゃあ後で、ちょっと休むね！'],
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
