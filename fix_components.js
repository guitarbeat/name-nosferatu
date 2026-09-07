const fs = require('fs');
let code = fs.readFileSync('src/features/dashboard/components.tsx', 'utf-8');

// Remove local component imports
code = code.replace(/^import\s+.*?\s+from\s+['"]\.\/(AdminDashboard|Charts|Common|DashboardPanels|PersonalResults|RankingAdjustment)['"];?$/gm, '');

fs.writeFileSync('src/features/dashboard/components.tsx', code);
