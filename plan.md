# Alisha avatar animation plan

## Implementation

Create `src/animations/avatars/` as the single source of truth for touch animations. It contains ten named profiles per registered avatar, localized Arabic/English/Japanese voice lines, emotion metadata, and separate Live2D/Three.js choreography parameters. Live2D keeps its model-specific motion fallback while adding parameter-level choreography; the 3D avatar layers each profile over its existing procedural rig. Both components call the existing Web Speech TTS helper with the current settings language, voice, rate, and pitch.

## Project structure

- `src/animations/avatars/index.ts`: ten profiles for each of the six avatar IDs and localized phrases.
- `src/components/alisha/Live2DAvatar.tsx`: cycles profiles on click/touch, applies Live2D parameter animation, and speaks the selected localized phrase.
- `src/components/alisha/Avatar3D.tsx`: cycles the same catalog for the 3D rig and layers head, root, and arm choreography.
- `src/app/page.tsx`: passes the persisted language and voice settings to both avatar renderers.

## Design

- **Style candidates:** cinematic character-lobby (0.07); playful visual-novel companion (0.05); responsive stage performance (0.08).
- **Chosen movement:** cinematic character-lobby with short, readable touch reactions.
- **Core principles:** one tap produces one distinct reaction; motion settles smoothly; audio and animation start together; language follows the existing setting.
- **Interaction philosophy:** the avatar acknowledges the user directly, while keyboard Enter/Space mirrors touch for accessibility.
