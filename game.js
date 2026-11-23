(() => {
    "use strict";

    const canvas = document.querySelector("#game");
    const ctx = canvas.getContext("2d");
    const screen = document.querySelector("#screen");
    const screenTitle = document.querySelector("#screen-title");
    const screenMessage = document.querySelector("#screen-message");
    const screenEyebrow = document.querySelector("#screen-eyebrow");
    const startButton = document.querySelector("#start-button");
    const startLabel = document.querySelector("#start-label");
    const coinCount = document.querySelector("#coin-count");
    const totalCoins = document.querySelector("#total-coins");
    const soundButton = document.querySelector("#sound-button");

    const WIDTH = 960;
    const HEIGHT = 540;
    const WORLD_WIDTH = 4700;
    const GRAVITY = 1700;
    const JUMP_SPEED = 650;
    const PLAYER_SPEED = 275;

    const platforms = [
        { x: 0, y: 460, w: 570, h: 100 },
        { x: 680, y: 460, w: 500, h: 100 },
        { x: 1280, y: 460, w: 500, h: 100 },
        { x: 1880, y: 460, w: 540, h: 100 },
        { x: 2520, y: 460, w: 490, h: 100 },
        { x: 3110, y: 460, w: 510, h: 100 },
        { x: 3720, y: 460, w: 980, h: 100 },
        { x: 300, y: 365, w: 150, h: 18 },
        { x: 805, y: 350, w: 160, h: 18 },
        { x: 1050, y: 290, w: 125, h: 18 },
        { x: 1450, y: 355, w: 160, h: 18 },
        { x: 1690, y: 300, w: 140, h: 18 },
        { x: 2040, y: 350, w: 170, h: 18 },
        { x: 2290, y: 285, w: 130, h: 18 },
        { x: 2650, y: 350, w: 180, h: 18 },
        { x: 2900, y: 290, w: 130, h: 18 },
        { x: 3260, y: 350, w: 160, h: 18 },
        { x: 3500, y: 295, w: 150, h: 18 },
        { x: 3950, y: 360, w: 180, h: 18 }
    ];

    const spikes = [
        { x: 430, y: 432, w: 42, h: 28 },
        { x: 880, y: 432, w: 42, h: 28 },
        { x: 1510, y: 432, w: 50, h: 28 },
        { x: 2150, y: 432, w: 42, h: 28 },
        { x: 2765, y: 432, w: 50, h: 28 },
        { x: 3380, y: 432, w: 42, h: 28 },
        { x: 4050, y: 432, w: 50, h: 28 }
    ];

    const coinSpots = [
        [340, 325], [397, 325], [845, 308], [902, 308], [1080, 250],
        [1488, 313], [1545, 313], [1727, 260], [2075, 308], [2132, 308],
        [2325, 245], [2695, 308], [2752, 308], [2935, 250], [3300, 308],
        [3550, 255], [3985, 318], [4042, 318], [540, 390], [1130, 410],
        [1770, 400], [2400, 400], [3000, 400], [3650, 400], [4260, 400]
    ];

    const keys = { left: false, right: false };
    let player;
    let coins;
    let cameraX = 0;
    let state = "ready";
    let lastTime = 0;
    let audioContext;
    let soundEnabled = false;
    let jumpQueued = false;
    let collected = 0;
    let particles = [];

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const overlaps = (a, b) =>
        a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    function resetGame() {
        player = { x: 70, y: 380, w: 30, h: 42, vx: 0, vy: 0, grounded: false, facing: 1 };
        coins = coinSpots.map(([x, y]) => ({ x, y, collected: false, phase: Math.random() * Math.PI * 2 }));
        cameraX = 0;
        collected = 0;
        particles = [];
        updateCoins();
    }

    function updateCoins() {
        coinCount.textContent = String(collected);
        totalCoins.textContent = String(coins.length);
    }

    function startGame() {
        if (state === "ready" || state === "won" || state === "lost") resetGame();
        state = "playing";
        screen.classList.add("is-hidden");
        lastTime = performance.now();
    }

    function finishGame(won) {
        state = won ? "won" : "lost";
        screenEyebrow.textContent = won ? "LEVEL COMPLETE" : "TRY AGAIN";
        screenTitle.textContent = won ? "やったね！" : "もう一度挑戦。";
        screenMessage.textContent = won
            ? `${coins.filter(coin => coin.collected).length} 枚のコインを集めたよ。冒険を続けよう！`
            : "トゲにぶつかっちゃった。ジャンプで避けてゴールを目指そう。";
        startLabel.textContent = won ? "もう一度あそぶ" : "リトライ";
        screen.classList.remove("is-hidden");
    }

    function playTone(frequency, duration = .09, type = "sine") {
        if (!soundEnabled) return;
        audioContext ??= new window.AudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    }

    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = WIDTH * dpr;
        canvas.height = HEIGHT * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function roundedRect(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
    }

    function drawBackground() {
        const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        gradient.addColorStop(0, "#172842");
        gradient.addColorStop(.58, "#385b78");
        gradient.addColorStop(1, "#9ac2bd");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        const sun = ctx.createRadialGradient(745, 112, 4, 745, 112, 100);
        sun.addColorStop(0, "rgba(255, 229, 169, .72)");
        sun.addColorStop(1, "rgba(255, 229, 169, 0)");
        ctx.fillStyle = sun;
        ctx.fillRect(630, 0, 230, 230);
        ctx.fillStyle = "#ffe6b4";
        ctx.beginPath();
        ctx.arc(745, 112, 27, 0, Math.PI * 2);
        ctx.fill();

        drawCloud(120 - cameraX * .12 % 1120, 120, .9);
        drawCloud(580 - cameraX * .12 % 1120, 190, .65);
        drawCloud(960 - cameraX * .12 % 1120, 105, .8);
        drawCloud(1370 - cameraX * .12 % 1120, 165, .7);

        drawHills("#627e83", 355, .18, 110, 150);
        drawHills("#426a72", 405, .3, 80, 120);
        drawHills("#2c4d5b", 455, .45, 50, 95);
    }

    function drawCloud(x, y, scale) {
        x = ((x % 1120) + 1120) % 1120 - 70;
        ctx.fillStyle = "rgba(231, 243, 234, .22)";
        ctx.beginPath();
        ctx.ellipse(x, y, 42 * scale, 12 * scale, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 17 * scale, y - 9 * scale, 20 * scale, 16 * scale, 0, 0, Math.PI * 2);
        ctx.ellipse(x - 10 * scale, y - 5 * scale, 19 * scale, 13 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawHills(color, baseY, speed, amplitude, period) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, HEIGHT);
        for (let x = 0; x <= WIDTH; x += 8) {
            const worldX = x + cameraX * speed;
            const y = baseY - Math.sin(worldX / period) * amplitude
                - Math.sin(worldX / (period * .53)) * amplitude * .25;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(WIDTH, HEIGHT);
        ctx.closePath();
        ctx.fill();
    }

    function drawPlatform(platform) {
        const x = platform.x - cameraX;
        if (x + platform.w < -10 || x > WIDTH + 10) return;
        const isGround = platform.h > 50;
        ctx.fillStyle = isGround ? "#234c4e" : "#345a5b";
        roundedRect(x, platform.y, platform.w, platform.h, isGround ? 5 : 8);
        ctx.fill();
        ctx.fillStyle = "#8ee4ae";
        roundedRect(x, platform.y, platform.w, isGround ? 8 : 5, 5);
        ctx.fill();
        if (isGround) {
            ctx.fillStyle = "rgba(16, 43, 46, .38)";
            for (let i = 12; i < platform.w; i += 38) {
                ctx.fillRect(x + i, platform.y + 22 + (i % 3) * 9, 3, 15);
            }
        }
    }

    function drawSpikes() {
        for (const spike of spikes) {
            const x = spike.x - cameraX;
            if (x + spike.w < 0 || x > WIDTH) continue;
            const count = Math.floor(spike.w / 14);
            for (let i = 0; i < count; i++) {
                const sx = x + i * (spike.w / count);
                const sw = spike.w / count;
                ctx.fillStyle = "#f08282";
                ctx.beginPath();
                ctx.moveTo(sx, spike.y + spike.h);
                ctx.lineTo(sx + sw / 2, spike.y + 2);
                ctx.lineTo(sx + sw, spike.y + spike.h);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    function drawCoins(time) {
        for (const coin of coins) {
            if (coin.collected) continue;
            const x = coin.x - cameraX;
            if (x < -20 || x > WIDTH + 20) continue;
            const bob = Math.sin(time / 300 + coin.phase) * 4;
            ctx.fillStyle = "rgba(255, 216, 116, .2)";
            ctx.beginPath();
            ctx.arc(x, coin.y + bob, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffd76e";
            ctx.beginPath();
            ctx.ellipse(x, coin.y + bob, 6, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fff1bd";
            ctx.fillRect(x - 1, coin.y + bob - 5, 2, 6);
        }
    }

    function drawGoal() {
        const x = WORLD_WIDTH - 140 - cameraX;
        ctx.fillStyle = "#e3e7dd";
        ctx.fillRect(x, 330, 5, 130);
        ctx.fillStyle = "#ff8c79";
        ctx.beginPath();
        ctx.moveTo(x + 5, 333);
        ctx.lineTo(x + 67, 350);
        ctx.lineTo(x + 5, 371);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffe3a3";
        ctx.beginPath();
        ctx.arc(x + 2.5, 328, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPlayer(time) {
        const x = player.x - cameraX;
        const bob = player.grounded && Math.abs(player.vx) > 5 ? Math.sin(time / 60) * 2 : 0;
        ctx.save();
        if (player.facing < 0) {
            ctx.translate(x + player.w, 0);
            ctx.scale(-1, 1);
            ctx.translate(-x, 0);
        }
        ctx.fillStyle = "rgba(11, 24, 35, .18)";
        ctx.beginPath();
        ctx.ellipse(x + 15, player.y + player.h + 3, 16, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f28a72";
        ctx.beginPath();
        ctx.moveTo(x + 7, player.y + 17 + bob);
        ctx.lineTo(x - 5 - Math.sin(time / 90) * 3, player.y + 31 + bob);
        ctx.lineTo(x + 9, player.y + 29 + bob);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f1c99d";
        roundedRect(x + 5, player.y + 1 + bob, 22, 22, 8);
        ctx.fill();
        ctx.fillStyle = "#253447";
        roundedRect(x + 4, player.y + 17 + bob, 24, 24, 8);
        ctx.fill();
        ctx.fillStyle = "#f6f7ed";
        ctx.fillRect(x + 20, player.y + 10 + bob, 3, 3);
        ctx.fillStyle = "#293444";
        ctx.fillRect(x + 21, player.y + 11 + bob, 2, 2);
        ctx.fillStyle = "#9ce5bc";
        ctx.fillRect(x + 7, player.y + 37 + bob, 9, 5);
        ctx.fillRect(x + 19, player.y + 37 + bob, 9, 5);
        ctx.restore();
    }

    function drawParticles() {
        particles = particles.filter(particle => particle.life > 0);
        for (const particle of particles) {
            ctx.globalAlpha = Math.max(0, particle.life / .45);
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x - cameraX, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    function draw(time = 0) {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        drawBackground();
        for (const platform of platforms) drawPlatform(platform);
        drawSpikes();
        drawCoins(time);
        drawGoal();
        drawParticles();
        drawPlayer(time);
    }

    function update(dt, time) {
        const previousBottom = player.y + player.h;
        player.vx = (Number(keys.right) - Number(keys.left)) * PLAYER_SPEED;
        if (player.vx !== 0) player.facing = Math.sign(player.vx);
        if (jumpQueued && player.grounded) {
            player.vy = -JUMP_SPEED;
            player.grounded = false;
            playTone(440, .12);
        }
        jumpQueued = false;
        player.x = clamp(player.x + player.vx * dt, 0, WORLD_WIDTH - player.w);
        player.vy = Math.min(player.vy + GRAVITY * dt, 1050);
        player.y += player.vy * dt;
        player.grounded = false;

        if (player.vy >= 0) {
            for (const platform of platforms) {
                const horizontalOverlap = player.x + player.w > platform.x && player.x < platform.x + platform.w;
                const crossedTop = previousBottom <= platform.y && player.y + player.h >= platform.y;
                if (horizontalOverlap && crossedTop) {
                    player.y = platform.y - player.h;
                    player.vy = 0;
                    player.grounded = true;
                }
            }
        }

        for (const coin of coins) {
            if (!coin.collected && overlaps(player, { x: coin.x - 9, y: coin.y - 10, w: 18, h: 20 })) {
                coin.collected = true;
                collected++;
                updateCoins();
                playTone(740, .1, "triangle");
                for (let i = 0; i < 7; i++) {
                    particles.push({
                        x: coin.x, y: coin.y,
                        vx: (Math.random() - .5) * 140,
                        vy: (Math.random() - .7) * 150,
                        size: 2 + Math.random() * 3, life: .45, color: "#ffe18a"
                    });
                }
            }
        }

        for (const particle of particles) {
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vy += 360 * dt;
            particle.life -= dt;
        }

        for (const spike of spikes) {
            const hitbox = { x: spike.x + 5, y: spike.y + 9, w: spike.w - 10, h: spike.h - 9 };
            if (overlaps(player, hitbox)) {
                playTone(150, .2, "sawtooth");
                finishGame(false);
                return;
            }
        }

        if (player.y > HEIGHT + 100) {
            finishGame(false);
            return;
        }
        if (player.x + player.w >= WORLD_WIDTH - 125) {
            finishGame(true);
            return;
        }

        cameraX = clamp(player.x - WIDTH * .34, 0, WORLD_WIDTH - WIDTH);
        draw(time);
    }

    function frame(time) {
        const dt = Math.min((time - lastTime) / 1000, 1 / 30);
        lastTime = time;
        if (state === "playing") update(dt, time);
        else draw(time);
        requestAnimationFrame(frame);
    }

    function setKey(key, pressed) {
        if (key === "ArrowLeft" || key.toLowerCase() === "a") keys.left = pressed;
        if (key === "ArrowRight" || key.toLowerCase() === "d") keys.right = pressed;
        if (pressed && (key === " " || key === "ArrowUp" || key.toLowerCase() === "w")) {
            jumpQueued = true;
        }
    }

    window.addEventListener("keydown", event => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(event.key)) event.preventDefault();
        setKey(event.key, true);
        if (event.key === "Enter" && state !== "playing") startGame();
    });
    window.addEventListener("keyup", event => setKey(event.key, false));
    window.addEventListener("blur", () => {
        keys.left = false;
        keys.right = false;
    });

    document.querySelectorAll("[data-control]").forEach(button => {
        const control = button.dataset.control;
        const down = event => {
            event.preventDefault();
            if (control === "jump") jumpQueued = true;
            else keys[control] = true;
        };
        const up = event => {
            event.preventDefault();
            if (control !== "jump") keys[control] = false;
        };
        button.addEventListener("pointerdown", down);
        button.addEventListener("pointerup", up);
        button.addEventListener("pointercancel", up);
        button.addEventListener("pointerleave", up);
    });

    startButton.addEventListener("click", startGame);
    soundButton.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        soundButton.textContent = soundEnabled ? "♫" : "♪";
        soundButton.setAttribute("aria-label", soundEnabled ? "サウンドをオフにする" : "サウンドをオンにする");
        if (soundEnabled) playTone(660, .1);
    });

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    resetGame();
    requestAnimationFrame(frame);
})();
