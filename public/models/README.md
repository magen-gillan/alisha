# نماذج الأفاتار ثلاثي الأبعاد (3D Avatar Models)

ضع ملف الأفاتار ثلاثي الأبعاد هنا باسم:

```
public/models/alisha-3d.glb
```

## الموديل الحالي: Galaxia anime girl

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
