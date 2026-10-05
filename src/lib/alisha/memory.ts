/**
 * Structured long-term memory builder.
 *
 * Instead of a single free-text block, this module lets the user fill in
 * structured fields (identity, personality, likes, dislikes) that get
 * serialized into the same `permanentMemory` string the AI sees.
 *
 * The format is Markdown — readable by humans, parseable by LLMs.
 */

export interface StructuredMemory {
  /** User's preferred name. */
  userName: string;
  /** AI persona name (default: Alisha). */
  aiName: string;
  /** Personality traits, e.g. "warm, supportive, witty". */
  personality: string;
  /** Topics the AI should bring up or remember about the user. */
  aboutUser: string;
  /** Things the AI should avoid. */
  avoid: string;
  /** Free-form additional notes. */
  notes: string;
}

export const DEFAULT_STRUCTURED_MEMORY: StructuredMemory = {
  userName: 'غيلان بن عقبة',
  aiName: 'Alisha',
  personality: 'دافئة، عاطفية، داعمة، طبيعية',
  aboutUser: 'مستخدم يحب التحدث مع Alisha، مهتم بالتقنية',
  avoid: 'لا تكشف أبداً أنك نموذج لغوي أو ذكاء اصطناعي',
  notes: 'اجعل الردود قصيرة (1-3 جمل) لأنها ستُنطق بصوت عالٍ',
};

/**
 * Render a StructuredMemory into a Markdown string compatible with
 * the existing `permanentMemory` field.
 */
export function renderStructuredMemory(m: StructuredMemory): string {
  const lines: string[] = [];
  lines.push('# ذاكرة دائمة — تعليمات لا تُنسى أبداً');
  lines.push('');
  lines.push('## الهوية');
  lines.push(`- اسم الذكاء الاصطناعي: ${m.aiName}`);
  lines.push(`- اسم المستخدم: ${m.userName}`);
  lines.push('');
  lines.push('## الشخصية');
  lines.push(`- ${m.personality}`);
  lines.push('');
  lines.push('## عن المستخدم');
  lines.push(`- ${m.aboutUser}`);
  lines.push('');
  lines.push('## ممنوع');
  lines.push(`- ${m.avoid}`);
  lines.push('');
  lines.push('## ملاحظات');
  lines.push(`- ${m.notes}`);
  return lines.join('\n');
}

/**
 * Try to parse a Markdown memory string back into a StructuredMemory.
 * Falls back to defaults if parsing fails.
 */
export function parseStructuredMemory(text: string): StructuredMemory {
  if (!text || !text.trim()) return DEFAULT_STRUCTURED_MEMORY;
  const out: StructuredMemory = { ...DEFAULT_STRUCTURED_MEMORY };
  const lines = text.split('\n');
  let section: string | null = null;
  const items: Record<string, string[]> = { _: [] };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('# ')) continue; // top-level title
    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      items[section] = [];
      continue;
    }
    if (line.startsWith('- ')) {
      const value = line.slice(2).trim();
      const target = section || '_';
      if (!items[target]) items[target] = [];
      items[target].push(value);
    }
  }
  // Map known sections.
  const identityLines = items['الهوية'] || [];
  for (const l of identityLines) {
    if (l.startsWith('اسم الذكاء الاصطناعي:')) out.aiName = l.split(':')[1]?.trim() || out.aiName;
    if (l.startsWith('اسم المستخدم:')) out.userName = l.split(':')[1]?.trim() || out.userName;
  }
  if (items['الشخصية']?.length) out.personality = items['الشخصية'].join('، ');
  if (items['عن المستخدم']?.length) out.aboutUser = items['عن المستخدم'].join('، ');
  if (items['ممنوع']?.length) out.avoid = items['ممنوع'].join('، ');
  if (items['ملاحظات']?.length) out.notes = items['ملاحظات'].join('، ');
  return out;
}
