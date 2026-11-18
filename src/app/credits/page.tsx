import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Credits — Alisha',
  description: 'الاعتمادات وتراخيص المحتوى في مشروع Alisha.',
};

/**
 * Credits / attributions page.
 *
 * Required by the CC BY 4.0 license of the 3D model used for the avatar:
 * "Galaxia anime girl" by Tatenashi must be credited with a link to the
 * license, and modifications must be indicated. This page is linked from
 * the settings panel ("الاعتمادات").
 */
export default function CreditsPage() {
  return (
    <main
      dir="rtl"
      lang="ar"
      className="min-h-screen bg-[#1a1228] text-white"
    >
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight">الاعتمادات</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">
          كل المحتوى المستخدم في تطبيق Alisha مع ذكر مصدره وترخيصه.
        </p>

        {/* 3D model — CC BY 4.0 attribution (legal requirement) */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-[#241b35]/80 p-5 shadow-lg">
          <h2 className="text-lg font-semibold">الشخصية ثلاثية الأبعاد</h2>
          <p className="mt-3 text-sm leading-7 text-white/85">
            «Galaxia anime girl» بواسطة{' '}
            <a
              href="https://sketchfab.com/tatenashi"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-fuchsia-300 underline decoration-fuchsia-400/40 underline-offset-2 hover:text-fuchsia-200"
            >
              Tatenashi
            </a>{' '}
            — مرخّص بموجب{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-fuchsia-300 underline decoration-fuchsia-400/40 underline-offset-2 hover:text-fuchsia-200"
            >
              CC BY 4.0
            </a>
            .
          </p>
          <p className="mt-2 text-sm leading-7 text-white/85" dir="ltr" lang="en">
            &quot;Galaxia anime girl&quot; by Tatenashi — licensed under CC BY
            4.0 (
            <a
              href="https://sketchfab.com/3d-models/galaxia-anime-girl-485f95459fa747fdbe42c87203e1a156"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fuchsia-300 underline decoration-fuchsia-400/40 underline-offset-2 hover:text-fuchsia-200"
            >
              source model on Sketchfab
            </a>
            ).
          </p>
          <p className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-6 text-white/65">
            نسخة معدّلة: أُعيد ضغط الخامات إلى WebP بعرض 2048px وحُوّلت الخامات
            إلى تظليل كرتوني ثلاثي الدرجات مع إضاءة حواف، وتضاف الحركات برمجيًا
            في <span dir="ltr">src/components/alisha/Avatar3D.tsx</span>. هذه
            التعديلات لا تعني تأييد المُنشئ الأصلي.
          </p>
        </section>

        {/* Avatar app libraries */}
        <section className="mt-5 rounded-2xl border border-white/10 bg-[#241b35]/80 p-5 shadow-lg">
          <h2 className="text-lg font-semibold">التقنيات</h2>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm leading-7 text-white/85">
            <li>
              <a
                href="https://nextjs.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-300 hover:text-fuchsia-200"
              >
                Next.js
              </a>{' '}
              +{' '}
              <a
                href="https://react.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-300 hover:text-fuchsia-200"
              >
                React
              </a>{' '}
              — إطار التطبيق.
            </li>
            <li>
              <a
                href="https://threejs.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-300 hover:text-fuchsia-200"
              >
                Three.js
              </a>{' '}
              — عرض وتحريك الشخصية ثلاثية الأبعاد.
            </li>
            <li>
              <a
                href="https://pixijs.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-300 hover:text-fuchsia-200"
              >
                PixiJS
              </a>{' '}
              +{' '}
              <a
                href="https://github.com/pixijs/live2d-display"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-300 hover:text-fuchsia-200"
              >
                pixi-live2d-display
              </a>{' '}
              — أفاتارات Live2D البديلة.
            </li>
          </ul>
        </section>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:border-fuchsia-400/50 hover:text-white"
          >
            <span aria-hidden="true">→</span>
            العودة إلى المحادثة
          </Link>
        </div>
      </div>
    </main>
  );
}
