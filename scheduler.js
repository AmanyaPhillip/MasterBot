const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const processManager = require('./processManager');
const config = require('./config.json');

const SCHEDULE_FILE = path.join(__dirname, 'schedules.json');

class Scheduler {
    constructor() {
        this.schedules = this.loadSchedules();
        this.jobs = {}; // { projectId: cronJob }
    }

    loadSchedules() {
        if (fs.existsSync(SCHEDULE_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
            } catch (e) {
                console.error('Error loading schedules:', e);
                return {};
            }
        }
        return {};
    }

    saveSchedules() {
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(this.schedules, null, 2));
    }

    resumeAll(bot) {
        console.log('Resuming all schedules...');
        for (const projectId in this.schedules) {
            const freq = this.schedules[projectId];
            this.scheduleJob(projectId, freq, bot);
        }
    }

    scheduleJob(projectId, freq, bot) {
        // Stop existing job if any
        if (this.jobs[projectId]) {
            this.jobs[projectId].stop();
        }

        const project = config.projects.find(p => p.id === projectId);
        if (!project) return;

        let cronExp = '0 6 * * *'; // Default Daily 6am

        switch (freq) {
            case 'daily': cronExp = '0 6 * * *'; break;
            case 'weekly': cronExp = '0 6 * * 1'; break; // Monday 6am
            case 'monthly': cronExp = '0 6 1 * *'; break; // 1st of month 6am
            case 'biweekly': cronExp = '0 6 * * 1'; break; // Every Monday, handled via logic below
        }

        const job = cron.schedule(cronExp, () => {
            if (freq === 'biweekly') {
                // Biweekly logic: check if this is even week since some epoch
                const now = new Date();
                const weekNum = Math.floor(now.getTime() / (1000 * 60 * 60 * 24 * 7));
                if (weekNum % 2 !== 0) {
                    console.log(`Skipping biweekly job for ${project.name} (odd week)`);
                    return;
                }
            }

            console.log(`[SCHEDULE] Running scheduled start for ${project.name}`);
            processManager.startProcess(project, bot, config.adminId);
        }, {
            scheduled: true,
            timezone: "America/New_York"
        });

        this.jobs[projectId] = job;
        this.schedules[projectId] = freq;
        this.saveSchedules();
    }

    removeSchedule(projectId) {
        if (this.jobs[projectId]) {
            this.jobs[projectId].stop();
            delete this.jobs[projectId];
        }
        delete this.schedules[projectId];
        this.saveSchedules();
    }

    getSchedule(projectId) {
        return this.schedules[projectId];
    }
}

module.exports = new Scheduler();
