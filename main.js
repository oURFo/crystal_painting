/**
 * 點畫 - Dot Draw
 * Main Application Logic
 */

import { GameEngine } from './engine.js';

// --- 模擬關卡數據 ---
const LEVELS = [
    { id: 1, title: '心之光', image: 'assets/level1.png', points: 100 },
    { id: 2, title: '天鵝之舞', image: 'assets/level2.png', points: 150 },
    { id: 3, title: '鑽石永恆', image: 'assets/level3.png', points: 200 },
    { id: 4, title: '即將揭曉', image: null, locked: true },
];

class App {
    constructor() {
        this.screens = {
            lobby: document.getElementById('lobby'),
            levelSelect: document.getElementById('level-select'),
            game: document.getElementById('game-main')
        };
        
        this.sidebar = document.getElementById('sidebar');
        this.levelSlider = document.getElementById('level-slider');
        this.currentScreen = 'lobby';
        this.engine = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderLevels();
    }

    bindEvents() {
        // 大廳事件
        document.getElementById('start-game').addEventListener('click', () => this.switchScreen('levelSelect'));
        document.getElementById('open-sidebar').addEventListener('click', () => this.toggleSidebar(true));
        document.getElementById('close-sidebar').addEventListener('click', () => this.toggleSidebar(false));
        
        // 關卡選擇事件
        document.getElementById('back-to-lobby').addEventListener('click', () => this.switchScreen('lobby'));
        
        // 遊戲事件
        document.getElementById('exit-game').addEventListener('click', () => {
            if(confirm('確定要離開遊戲嗎？')) {
                if (this.engine) this.engine.isRunning = false;
                this.switchScreen('levelSelect');
            }
        });

        // 側邊欄點擊背景關閉
        document.addEventListener('click', (e) => {
            if (this.sidebar.classList.contains('open') && 
                !this.sidebar.contains(e.target) && 
                !document.getElementById('open-sidebar').contains(e.target)) {
                this.toggleSidebar(false);
            }
        });
    }

    toggleSidebar(open) {
        this.sidebar.classList.toggle('open', open);
    }

    switchScreen(screenName) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.screens[screenName].classList.add('active');
        this.currentScreen = screenName;
    }

    renderLevels() {
        this.levelSlider.innerHTML = '';
        LEVELS.forEach(level => {
            const card = document.createElement('div');
            card.className = `level-card ${level.locked ? 'locked' : ''}`;
            card.innerHTML = `
                <span class="level-num">${level.id.toString().padStart(2, '0')}</span>
                ${level.image ? `<img src="${level.image}" class="level-thumb" alt="${level.title}">` : '<div class="locked-icon">🔒</div>'}
                <h4 class="level-title">${level.title}</h4>
            `;
            
            if (!level.locked) {
                card.addEventListener('click', () => this.startLevel(level));
            }
            this.levelSlider.appendChild(card);
        });
    }

    async startLevel(level) {
        console.log('Starting level:', level.title);
        this.switchScreen('game');
        
        if (!this.engine) {
            const canvas = document.getElementById('game-canvas');
            this.engine = new GameEngine(canvas);
        }
        
        await this.engine.loadLevel(level);
        this.startTimer();
    }

    startTimer() {
        let seconds = 0;
        const timerEl = document.getElementById('game-timer');
        if (this.gameTimer) clearInterval(this.gameTimer);
        this.gameTimer = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
        }, 1000);
    }
}

// 啟動應用
window.addEventListener('DOMContentLoaded', () => {
    new App();
});
