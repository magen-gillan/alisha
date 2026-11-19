# نماذج الأفاتار ثلاثي الأبعاد (3D Avatar Models)

كل أفاتار 3D يُسجّل في `src/lib/alisha/avatars.ts` (الحقل `kind: '3d'` مع
`motion` = بروفايل الحركة الخاص به)، وملفه هنا باسم `<id>.glb`:

| الملف | الأفاتار | الحجم | الهيكل | الحركة |
|---|---|---|---|---|
| `alisha-3d.glb` | Alisha 3D (Galaxia) | 1.7MB | 135 عظمة VRM | إجرائية كاملة |
| `zaria.glb` | Zaria 3D | 1.9MB | 127 عظمة VRM | إجرائية كاملة (27 زنبرك شعر) |
| `akeno.glb` | Akeno 3D | 3.5MB | 55 عظمة Mixamo | إجرائية (محوّلة من unitypackage) |
| `wanwan.glb` | Wanwan 3D | 1.2MB | 123 عظمة Bip001 | أنيميشنات مدمجة (city_idle / city_action) عبر AnimationMixer |
| `layla.glb` | Layla 3D | 0.3MB | بلا هيكل | حركة صلبة: دوران/خطوات/نبض تنفس |
| `girl.glb` | Girl 3D | 1.7MB | بلا هيكل | حركة صلبة |
| `casual.glb` | Casual 3D | 6.1MB | بلا هيكل | حركة صلبة |

الصور المصغرة لمنتقي الأفاتار في `thumbs/<id>.png` (تولّدت بعارض Three.js محلي).

## تحذير التراخيص (مهم)

- **Galaxia / Zaria / Just-a-Girl / Casual**: تحميلات Sketchfab مجانية —
  ترخيصها **CC BY 4.0**: النشر يتطلب ذكر المصمم ورابط الترخيص في صفحة
  Credits (Galaxia موثّقة هناك؛ أضف البقية قبل أي نشر علني).
- **Layla و Wanwan (Mobile Legends)**: ملكية فكرية لشركة **Moonton** —
  **ممنوع النشر العلني أو الاستخدام التجاري**، استخدام شخصي غير ربحي فقط.
  تُستخدم هنا بقرار مالك المشروع وعلى مسؤوليته.
- **Akeno (High School DxD)**: شخصية أنمي محفوظة الحقوق + نموذج معمول
  من مجتمع المعجبين — استخدام شخصي فقط، لا تنشر.

## الموديل الأصلي: Galaxia anime girl

- المصدر: [Sketchfab — "Galaxia anime girl" by Tatenashi](https://sketchfab.com/3d-models/galaxia-anime-girl-485f95459fa747fdbe42c87203e1a156)
- الترخيص: **CC BY 4.0** — يُشترط ذكر التصنيف في صفحة Credits:
  `"Galaxia anime girl" by Tatenashi, CC BY 4.0`
- المواصفات بعد الضغط: 156 عقدة / 135 عظمة، 12 شبكة، 15 صورة WebP (حد 2048px)،
  الحجم النهائي ≈ 1.7MB (الأصل 8.9MB).
- لا توجد Morph Targets ولا Animations — الحركة كلها إجرائية في
  `src/components/alisha/Avatar3D.tsx` (تنفس، تأرجح شعر وتنورة، رمح نظر،
  حركة كلام بالرأس والرقبة مع أحداث `alisha:tts-boundary`).

## وضع العرض الحالي: ليف أفاتار (بمنظور ثنائي الأبعاد)

- الكاميرا ثابتة: لا سحب ولا دوران ولا تكبير من المستخدم.
- العظام المستخدمة بالاسم (مطابقة للملف): `J_Bip_C_Head_040`,
  `J_Bip_C_Neck_039`, `J_Bip_C_Chest_033`, `J_Bip_C_UpperChest_034`,
  `J_Adj_L/R_FaceEye_041/042`, وعظام التأرجح `HairJoint-*` و`J_Sec_*_Skirt*`.
- وضعية اليدان تُخفض تلقائياً من T-Pose إلى A-Pose عند التحميل.

## إعادة الضغط من FBX/GLB

```bash
bunx @gltf-transform/cli optimize <source>.glb public/models/alisha-3d.glb \
  --compress false --simplify false --texture-compress webp --texture-size 2048
```

ملاحظة حقوق: نماذج Mobile Legends ملكية فكرية لشركة Moonton — استخدمها
للتعلم والاستخدام الشخصي غير الربحي فقط، ولا ترفعها إلى مستودع عام.
موديل Galaxia المرخص CC BY 4.0 آمن للنشر مع ذكر التصنيف.
