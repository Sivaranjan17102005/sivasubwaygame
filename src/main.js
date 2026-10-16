import * as THREE from 'three';
import { Character } from './Character.js';
import { World, LANES } from './world.js';

/**
 * Lightweight Web Audio Synthesizer so the game has crisp arcade sound effects
 * out of the box without requiring external audio files.
 */
class SoundFX {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playTone(freq, endFreq, duration, type = 'sine', gainVal = 0.12) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  coin() { this.playTone(987, 1318, 0.14, 'triangle', 0.14); }
  jump() { this.playTone(220, 580, 0.18, 'sine', 0.12); }
  slide() { this.playTone(340, 120, 0.15, 'triangle', 0.12); }
  lane() { this.playTone(300, 420, 0.08, 'sine', 0.08); }
  crash() { this.playTone(150, 38, 0.38, 'sawtooth', 0.22); }
}

class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.sfx = new SoundFX();

    // Game state
    this.state = 'MENU'; // MENU | PLAYING | GAMEOVER
    this.score = 0;
    this.coins = 0;
    this.bestScore = Number(localStorage.getItem('metro_rush_best') || 0);
    this.baseSpeed = 18;
    this.maxSpeed = 42;
    this.speed = this.baseSpeed;

    // Player movement & physics state
    this.currentLane = 1; // 0 = Left, 1 = Center, 2 = Right
    this.playerX = 0;
    this.playerY = 0;
    this.velocityY = 0;
    this.gravity = -38;
    this.jumpForce = 14.8;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.shakeIntensity = 0;

    this.initScene();
    this.character = new Character(this.scene);

    // OPTIONAL: Uncomment the line below once you place your rigged GLB in public/models/character.glb
    // this.character.loadCustomGLB('/models/character.glb');

    this.world = new World(this.scene);
    this.bindEvents();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1021);
    this.scene.fog = new THREE.FogExp2(0x0b1021, 0.0085);

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      220
    );
    this.camera.position.set(0, 4.3, 6.8);
    this.camera.lookAt(0, 1.5, -6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 1.1);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.6);
    dirLight.position.set(12, 26, 16);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 80;
    const d = 16;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);
  }

  bindEvents() {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 100));

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'PLAYING') {
        if (e.code === 'Space' || e.code === 'Enter') this.startGame();
        return;
      }

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.changeLane(-1);
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.changeLane(1);
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
          this.jump();
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.slide();
          break;
      }
    });

    // Mobile Swipe Controls (triggers immediately once swipe threshold is crossed)
    let touchStartX = 0;
    let touchStartY = 0;
    let swipeHandled = false;

    window.addEventListener('touchstart', (e) => {
      if (this.state !== 'PLAYING') return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      swipeHandled = false;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.state !== 'PLAYING' || swipeHandled) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      const threshold = 28;

      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        if (Math.abs(dx) > Math.abs(dy)) {
          this.changeLane(dx > 0 ? 1 : -1);
        } else {
          if (dy < 0) this.jump();
          else this.slide();
        }
        swipeHandled = true;
      }
    }, { passive: true });

    // Start & Replay Button Handlers
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');

    const handleStartGame = (e) => {
      if (e) {
        e.stopPropagation();
      }
      this.startGame();
    };

    startBtn.addEventListener('click', handleStartGame);
    restartBtn.addEventListener('click', handleStartGame);
    startBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      handleStartGame(e);
    });
    restartBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      handleStartGame(e);
    });
  }

  startGame() {
    this.sfx.init();
    this.world.reset();

    this.state = 'PLAYING';
    this.score = 0;
    this.coins = 0;
    this.speed = this.baseSpeed;
    this.currentLane = 1;
    this.playerX = LANES[1];
    this.playerY = 0;
    this.velocityY = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.character.group.position.set(0, 0, 0);

    document.getElementById('start-overlay').classList.remove('active');
    document.getElementById('gameover-overlay').classList.remove('active');
    this.updateHUD();
  }

  changeLane(dir) {
    const next = this.currentLane + dir;
    if (next >= 0 && next <= 2) {
      this.currentLane = next;
      this.sfx.lane();
    }
  }

  jump() {
    if (this.isGrounded) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
      this.isSliding = false;
      this.sfx.jump();
    }
  }

  slide() {
    if (!this.isGrounded) {
      // Subway Surfers style fast-drop when swiping down in mid-air
      this.velocityY = -28;
    }
    this.isSliding = true;
    this.slideTimer = 0.68;
    this.sfx.slide();
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    this.shakeIntensity = 0.45;
    this.sfx.crash();

    const finalScore = Math.floor(this.score);
    if (finalScore > this.bestScore) {
      this.bestScore = finalScore;
      localStorage.setItem('metro_rush_best', String(this.bestScore));
    }

    document.getElementById('final-score').textContent = finalScore.toLocaleString();
    document.getElementById('final-coins').textContent = this.coins;
    document.getElementById('best-score').textContent = this.bestScore.toLocaleString();
    document.getElementById('gameover-overlay').classList.add('active');
  }

  updateHUD() {
    document.getElementById('score-val').textContent = String(Math.floor(this.score)).padStart(6, '0');
    document.getElementById('coin-val').textContent = this.coins;
    const mult = (this.speed / this.baseSpeed).toFixed(1);
    document.getElementById('speed-val').textContent = `${mult}x`;
  }

  checkCollisionsAndSupport() {
    const playerHalfW = 0.36;
    const playerHalfD = 0.32;
    const playerHeight = this.isSliding ? 0.85 : 1.75;
    const pMinY = this.playerY;
    const pMaxY = this.playerY + playerHeight;

    let supportHeight = 0;

    // 1. Obstacle Collisions & Train Roof Support
    for (const obs of this.world.obstacles) {
      const oz = obs.mesh.position.z;
      const ox = obs.mesh.position.x;

      const overlapX = Math.abs(this.playerX - ox) < playerHalfW + obs.halfWidth;
      const overlapZ = Math.abs(0 - oz) < playerHalfD + obs.halfLength;

      if (overlapX && overlapZ) {
        // Allow landing on top of trains if jumping onto them
        if (obs.type === 'train' && pMinY >= obs.maxY - 0.45 && this.velocityY <= 0) {
          supportHeight = Math.max(supportHeight, obs.maxY);
          continue;
        }

        // Check vertical overlap for collision
        const overlapY = pMaxY > obs.minY && pMinY < obs.maxY;
        if (overlapY) {
          this.triggerGameOver();
          return 0;
        }
      }
    }

    // 2. Coin Pickups
    for (const coin of this.world.coins) {
      if (coin.collected) continue;
      const dx = this.playerX - coin.mesh.position.x;
      const dy = (this.playerY + 0.9) - coin.mesh.position.y;
      const dz = 0 - coin.mesh.position.z;

      if (dx * dx + dy * dy + dz * dz < 1.25) {
        coin.collected = true;
        this.coins += 1;
        this.score += 25;
        this.sfx.coin();
        this.world.spawnCoinBurst(coin.mesh.position);
      }
    }

    return supportHeight;
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'PLAYING') {
      // Progressive speed acceleration
      this.speed = Math.min(this.maxSpeed, this.speed + dt * 0.42);
      this.score += this.speed * dt * 1.5;

      // Smooth horizontal lane interpolation
      const targetX = LANES[this.currentLane];
      const prevX = this.playerX;
      this.playerX = THREE.MathUtils.lerp(this.playerX, targetX, dt * 14);
      const laneVelocity = (this.playerX - prevX) / Math.max(dt, 0.001);

      // Slide timer
      if (this.isSliding) {
        this.slideTimer -= dt;
        if (this.slideTimer <= 0) this.isSliding = false;
      }

      // Update world and check support height (ground = 0, or train roof = 2.8)
      this.world.update(dt, this.speed);
      const groundHeight = this.checkCollisionsAndSupport();

      // Vertical Jump & Gravity Physics
      this.playerY += this.velocityY * dt;
      if (this.playerY > groundHeight) {
        this.velocityY += this.gravity * dt;
        this.isGrounded = false;
      } else {
        this.playerY = groundHeight;
        this.velocityY = 0;
        this.isGrounded = true;
      }

      // Sync 3D character transform & animation
      this.character.group.position.set(this.playerX, this.playerY, 0);
      this.character.update(dt, this.speed, this.isGrounded, this.isSliding, laneVelocity);

      // Third-person chase camera with subtle tracking & speed FOV effect
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.playerX * 0.65, dt * 6);
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 4.3 + this.playerY * 0.5, dt * 6);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 62 + (this.speed - this.baseSpeed) * 0.4, dt * 4);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.playerX * 0.35, 1.4 + this.playerY * 0.4, -7);

      this.updateHUD();
    } else if (this.state === 'MENU') {
      // Idle preview animation on start screen
      this.character.update(dt, 14, true, false, 0);
    }

    // Camera impact shake on crash
    if (this.shakeIntensity > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 1.5);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

new Game();