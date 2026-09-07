import fs from 'fs';

let content = fs.readFileSync('src/app/index.tsx', 'utf-8');

// STORAGE_KEYS comes from @/shared/lib/constants
content = content.replace('import { STORAGE_KEYS } from "@/shared/lib/storage";', 'import { STORAGE_KEYS } from "@/shared/lib/constants";');

// useAppStoreInitialization doesn't seem to exist in hooks? Let's check where it comes from or just remove it if we added it manually.
// It seems I added it manually: "import { usePreloadImages, useAppStoreInitialization } from "@/shared/hooks";"
// Wait, looking at the tsc errors:
// src/app/index.tsx(1347,2): error TS2304: Cannot find name 'useAppStoreInitialization'.
// I'll check where it exists in the tree.
