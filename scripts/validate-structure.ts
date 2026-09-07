import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface Violation {
	file: string;
	rule: string;
	message: string;
	suggestion?: string;
}

const SRC_ROOT = path.resolve(process.cwd(), "src");

// Allowed top-level entries in src/
const ALLOWED_SRC_ROOT_DIRS = new Set(["app", "features", "shared", "store", "assets"]);
const ALLOWED_SRC_ROOT_FILES = new Set(["index.css", "vite-env.d.ts"]);

// Naming regex patterns
const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z0-9]+$/;
const CAMEL_CASE_REGEX = /^[a-z][a-zA-Z0-9]*$/;
const KEBAB_OR_LOWER_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isPascalCase(str: string): boolean {
	return PASCAL_CASE_REGEX.test(str);
}

function isCamelCase(str: string): boolean {
	return CAMEL_CASE_REGEX.test(str);
}

function getFilesToCheck(): string[] {
	const args = process.argv.slice(2);
	const checkStagedOnly = args.includes("--staged") || args.includes("--pre-commit") || args.includes("--new-only");

	if (checkStagedOnly) {
		try {
			// Check staged files (added, copied, modified)
			const stagedOutput = execSync("git diff --cached --name-only --diff-filter=ACM", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "ignore"],
			});
			// Also check untracked newly created files
			const untrackedOutput = execSync("git ls-files --others --exclude-standard", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "ignore"],
			});

			const combinedFiles = Array.from(
				new Set([
					...stagedOutput.split("\n").map((f) => f.trim()),
					...untrackedOutput.split("\n").map((f) => f.trim()),
				]),
			).filter((f) => f.length > 0 && f.startsWith("src/"));

			if (combinedFiles.length > 0) {
				console.log(`[validate-structure] Checking ${combinedFiles.length} new/staged file(s) in src/`);
				return combinedFiles.map((f) => path.resolve(process.cwd(), f));
			}

			console.log("[validate-structure] No staged or new files in src/ found via git. Checking all files in src/.");
		} catch {
			// Git not initialized or error, fallback to checking all files
		}
	}

	// Default: scan all files in src/
	return getAllFilesInDir(SRC_ROOT);
}

function getAllFilesInDir(dir: string): string[] {
	const results: string[] = [];
	if (!fs.existsSync(dir)) return results;

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...getAllFilesInDir(fullPath));
		} else {
			results.push(fullPath);
		}
	}
	return results;
}

function validateFile(filePath: string): Violation[] {
	const violations: Violation[] = [];
	const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");

	if (!relPath.startsWith("src/")) {
		return violations;
	}

	const parts = relPath.split("/").slice(1); // strip 'src/'
	const fileName = parts[parts.length - 1];
	const topDir = parts.length > 1 ? parts[0] : null;

	// 1. Root-level src/ files
	if (parts.length === 1) {
		if (!ALLOWED_SRC_ROOT_FILES.has(fileName)) {
			violations.push({
				file: relPath,
				rule: "root-files",
				message: `Root src/ file '${fileName}' is not permitted. Only ${Array.from(ALLOWED_SRC_ROOT_FILES).join(", ")} are allowed at src/ root.`,
				suggestion: "Move this file into src/app/, src/features/, src/shared/, or src/store/.",
			});
		}
		return violations;
	}

	// 2. Strict Layering: Top directory check
	if (topDir && !ALLOWED_SRC_ROOT_DIRS.has(topDir)) {
		violations.push({
			file: relPath,
			rule: "layering",
			message: `Directory 'src/${topDir}/' violates strict layering. Only ${Array.from(ALLOWED_SRC_ROOT_DIRS).map((d) => `src/${d}/`).join(", ")} are allowed.`,
			suggestion: `Move '${relPath}' into an approved layer (src/app, src/features, src/shared, src/store, or src/assets).`,
		});
		return violations;
	}

	// 3. Layer-specific rules
	if (topDir === "features") {
		// Features must be inside a feature folder: src/features/<feature-name>/...
		if (parts.length === 2) {
			violations.push({
				file: relPath,
				rule: "feature-containment",
				message: `File '${fileName}' placed directly in 'src/features/'. Every feature must reside in a subfolder (e.g. src/features/<feature>/).`,
				suggestion: "Create a feature directory such as src/features/tournament/ or src/features/dashboard/.",
			});
		} else {
			const featureName = parts[1];
			if (!KEBAB_OR_LOWER_REGEX.test(featureName)) {
				violations.push({
					file: relPath,
					rule: "feature-naming",
					message: `Feature folder '${featureName}' should be lowercase or kebab-case (e.g., 'tournament', 'dashboard').`,
				});
			}
		}
	}

	if (topDir === "assets") {
		// Assets (svg, png, jpg, etc.)
		return violations;
	}

	// 4. File extension and naming checks for code files (.ts, .tsx)
	if (fileName.endsWith(".d.ts")) {
		// Declaration files (e.g. vite-env.d.ts)
		return violations;
	}

	const isTestFile = fileName.endsWith(".test.ts") || fileName.endsWith(".test.tsx");
	const ext = path.extname(fileName);

	if (ext !== ".ts" && ext !== ".tsx" && ext !== ".css" && ext !== ".json") {
		violations.push({
			file: relPath,
			rule: "file-type",
			message: `Unexpected file extension '${ext}' in '${relPath}'.`,
		});
		return violations;
	}

	// Extract base name without test suffix or extension
	let baseName = fileName;
	if (isTestFile) {
		baseName = fileName.replace(/\.test\.(tsx|ts)$/, "");
	} else if (fileName.endsWith(".tsx")) {
		baseName = fileName.replace(/\.tsx$/, "");
	} else if (fileName.endsWith(".ts")) {
		baseName = fileName.replace(/\.ts$/, "");
	}

	// 5. Naming patterns for TSX (React Components) vs TS (Utilities/Hooks/Store)
	if (fileName.endsWith(".tsx")) {
		// .tsx files must be PascalCase components, except 'main.tsx'
		if (fileName === "main.tsx") {
			if (relPath !== "src/app/main.tsx") {
				violations.push({
					file: relPath,
					rule: "entry-point",
					message: `'main.tsx' should only reside in 'src/app/'.`,
				});
			}
		} else if (isTestFile && baseName.startsWith("use") && isPascalCase(baseName.slice(3))) {
			// Hook tests like useIndexedDB.test.tsx are allowed
		} else if (!isPascalCase(baseName)) {
			violations.push({
				file: relPath,
				rule: "component-naming",
				message: `React component file '${fileName}' must use PascalCase (e.g. 'TournamentArena.tsx' or 'MyComponent.tsx'). Found: '${baseName}'.`,
				suggestion: `Rename '${fileName}' to PascalCase.`,
			});
		}
	} else if (fileName.endsWith(".ts")) {
		// .ts files (utilities, hooks, stores, types, engines)
		// Should be camelCase (e.g. 'tournamentEngine.ts', 'hooks.ts', 'storage.ts', 'indexedDB.ts')
		// Or index.ts
		if (baseName !== "index" && !isCamelCase(baseName)) {
			violations.push({
				file: relPath,
				rule: "utility-naming",
				message: `TypeScript module '${fileName}' must use camelCase (e.g. 'tournamentEngine.ts', 'uiUtils.ts', 'hooks.ts'). Found: '${baseName}'.`,
				suggestion: `Rename '${fileName}' to camelCase.`,
			});
		}
	}

	return violations;
}

function main() {
	console.log("🔍 [validate-structure] Validating file structure and naming conventions...");

	const files = getFilesToCheck();
	let allViolations: Violation[] = [];

	for (const file of files) {
		const violations = validateFile(file);
		allViolations.push(...violations);
	}

	if (allViolations.length === 0) {
		console.log(`✅ [validate-structure] All ${files.length} file(s) follow project structure and naming conventions cleanly.`);
		process.exit(0);
	}

	console.error(`\n❌ [validate-structure] Found ${allViolations.length} convention violation(s):\n`);

	for (const v of allViolations) {
		console.error(`  • [${v.rule.toUpperCase()}] ${v.file}`);
		console.error(`    Problem: ${v.message}`);
		if (v.suggestion) {
			console.error(`    Fix:     ${v.suggestion}`);
		}
		console.error("");
	}

	console.error("Please fix the above violations before committing or merging.\n");
	process.exit(1);
}

main();
