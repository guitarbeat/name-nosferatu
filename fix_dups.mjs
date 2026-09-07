import fs from 'fs';

let content = fs.readFileSync('src/app/index.tsx', 'utf-8');

// Strip all duplicate import definitions
content = content.replace(/import { useCallback, useEffect, useMemo, useRef, useState } from "react";/g, '');
content = content.replace(/import { useCallback, useEffect, useState } from "react";/g, '');
content = content.replace(/import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";/g, '');
content = content.replace(/import { ErrorBoundary, ErrorComponent, Iridescence, Loading, Modal, Section } from "@\\/shared\\/components";/g, '');
content = content.replace(/import { CheckCircle, Info, XCircle } from "lucide-react";/g, '');

content = `import { ErrorBoundary, ErrorComponent, Iridescence, Loading, Modal, Section } from "@/shared/components";
import { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from "react";
` + content;

fs.writeFileSync('src/app/index.tsx', content);
