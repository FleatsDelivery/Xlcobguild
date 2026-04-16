const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/tmull/OneDrive/Documents/CORN_FIELD/GITHUB REPO/Xlcobguild/src/app/components/leaderboard-page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const banner = `
            {/* Ranking Priority - Explicitly stated as requested */}
            <div className="flex items-center gap-3 bg-card/60 backdrop-blur-md border border-harvest/10 rounded-2xl p-4 mb-2 shadow-sm">
               <div className="w-8 h-8 rounded-lg bg-harvest/10 flex items-center justify-center border border-harvest/20">
                  <Info className="w-4 h-4 text-harvest" />
               </div>
               <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em] leading-relaxed">
                  Ranking Priority: <span className="text-foreground">Rank Score</span>
                  <span className="mx-3 opacity-30">/</span>
                  <span className="text-foreground">MVP Count</span>
                  <span className="mx-3 opacity-30">/</span>
                  <span className="text-foreground">Guild Capacity</span>
               </div>
            </div>`;

const target = '<div className="space-y-6">';
if (content.includes(target)) {
    content = content.replace(target, target + banner);
    fs.writeFileSync(filePath, content);
    console.log('Successfully added ranking banner.');
} else {
    console.error('Target not found!');
    process.exit(1);
}
