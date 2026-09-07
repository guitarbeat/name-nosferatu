import fs from 'fs';

let content = fs.readFileSync('src/app/index.tsx', 'utf-8');

// Just forcefully remove ALL react hook imports and insert one correct block at the top
content = content.replace(/import\s+{([^}]*)}\s*from\s+["']react["'];?/g, "");
content = content.replace(/import\s+{([^}]*)}\s*from\s+["']@\/shared\/components["'];?/g, "");

content = `
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ErrorBoundary, ErrorComponent, Iridescence, Loading, Modal, OfflineIndicator, RouteFallback, Section, StaggeredMenu } from "@/shared/components";
import { useAppStoreInitialization } from "@/store";
` + content;

fs.writeFileSync('src/app/index.tsx', content);
