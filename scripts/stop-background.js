const { execSync } = require('child_process');
const fs = require('fs');

console.log("Reading config.json...");
let config;
try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch(e) {
    console.error("Could not read config.json", e.message);
    process.exit(1);
}

let count = 0;

// 1. Read active_pids.json (created by processManager.js)
const PID_FILE = './active_pids.json';
if (fs.existsSync(PID_FILE)) {
    console.log("Checking active_pids.json for known processes...");
    const active = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
    for (const id in active) {
        const pid = active[id];
        try {
            console.log(`Killing known process ${id} (PID: ${pid})...`);
            execSync(`taskkill /pid ${pid} /T /F`, {stdio: 'ignore'});
            console.log(`-> Successfully killed PID ${pid} and its children.`);
            count++;
        } catch (e) {
            console.log(`-> Process PID ${pid} might already be dead.`);
        }
    }
    // Delete the file since we killed them all
    try {
        fs.unlinkSync(PID_FILE);
    } catch (e) {}
}

// 2. Scan for any orphaned node/cmd processes matching our projects
// Get folder names from project paths to identify processes
const targetKeywords = config.projects.map(p => {
    const parts = p.path.split(/[\\/]/);
    // return the last non-empty part (the folder name)
    return parts.filter(part => part.trim().length > 0).pop().toLowerCase();
});

console.log(`\nScanning system for stray processes containing keywords: ${targetKeywords.join(', ')}`);

try {
    const output = execSync('wmic process get processid,commandline').toString();
    const lines = output.split('\n');
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        // Extract command line and PID
        const match = line.trim().match(/^(.*?)\s+(\d+)$/);
        if (match) {
            const cmdLine = match[1].toLowerCase();
            const pid = match[2];
            
            // Skip our own cleanup script process
            if (cmdLine.includes('stop-background.js') || cmdLine.includes('wmic')) continue;

            // Check if it's a node, cmd or npm process
            if (!cmdLine.includes('node.exe') && !cmdLine.includes('cmd.exe') && !cmdLine.includes('npm.cmd')) {
                continue;
            }

            const isTarget = targetKeywords.some(keyword => cmdLine.includes(keyword));
            
            if (isTarget) {
                console.log(`Found stray target PID: ${pid} (${cmdLine.substring(0, 80)}...)`);
                try {
                    execSync(`taskkill /pid ${pid} /T /F`, {stdio: 'ignore'});
                    console.log(`-> Successfully killed PID ${pid}`);
                    count++;
                } catch (err) {
                    console.log(`-> Failed to kill PID ${pid}`);
                }
            }
        }
    }
} catch (error) {
    console.error("An error occurred during scanning:", error.message);
}

console.log(`\nCleanup complete. Stopped ${count} managed processes.`);
