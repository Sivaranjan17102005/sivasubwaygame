import * as THREE from 'three';

export const LANE_WIDTH = 2.8;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];

export class World {
  constructor(scene) {
    this.scene = scene;
    this.trackSegments = [];
    this.obstacles = [];
    this.coins = [];
    this.particles = [];
    this.spawnTimer = 0;

    this.initSharedAssets();
    this.buildInitialTrack();
  }

  initSharedAssets() {
    this.coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16);
    this.coinGeo.rotateX(Math.PI / 2);
    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.35,
      metalness: 0.8,
      roughness: 0.2,
    });

    this.hazardRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
    this.hazardWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    this.steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
    this.trainBodyColors = [0x2563eb, 0x059669, 0x7c3aed, 0xd97706];
  }

  buildInitialTrack() {
    this.segmentLength = 20;
    this.numSegments = 11;

    for (let i = 0; i < this.numSegments; i++) {
      const seg = this.createTrackSegment();
      seg.position.z = -i * this.segmentLength;
      this.scene.add(seg);
      this.trackSegments.push(seg);
    }
  }

  createTrackSegment() {
    const group = new THREE.Group();

    // Gravel roadbed
    const bed = new THREE.Mesh(
      new THREE.PlaneGeometry(14, this.segmentLength),
      new THREE.MeshStandardMaterial({ color: 0x1e2433, roughness: 0.95 })
    );
    bed.rotation.x = -Math.PI / 2;
    bed.receiveShadow = true;
    group.add(bed);

    // Side platforms / walls
    const wallGeo = new THREE.BoxGeometry(2.5, 3.2, this.segmentLength);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });

    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-7.2, 1.6, 0);
    leftWall.receiveShadow = true;

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(7.2, 1.6, 0);
    rightWall.receiveShadow = true;
    group.add(leftWall, rightWall);

    // Neon accent strip along walls
    const neonGeo = new THREE.BoxGeometry(0.08, 0.12, this.segmentLength);
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const leftNeon = new THREE.Mesh(neonGeo, neonMat);
    leftNeon.position.set(-5.9, 1.8, 0);
    const rightNeon = new THREE.Mesh(neonGeo, neonMat);
    rightNeon.position.set(5.9, 1.8, 0);
    group.add(leftNeon, rightNeon);

    // 3 Lanes of Steel Rails + Wooden Ties
    const railGeo = new THREE.BoxGeometry(0.08, 0.1, this.segmentLength);
    const tieGeo = new THREE.BoxGeometry(1.8, 0.05, 0.28);
    const tieMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.9 });

    LANES.forEach((laneX) => {
      const leftRail = new THREE.Mesh(railGeo, this.steelMat);
      leftRail.position.set(laneX - 0.55, 0.05, 0);
      const rightRail = new THREE.Mesh(railGeo, this.steelMat);
      rightRail.position.set(laneX + 0.55, 0.05, 0);
      group.add(leftRail, rightRail);

      for (let z = -this.segmentLength / 2 + 1; z < this.segmentLength / 2; z += 1.6) {
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(laneX, 0.025, z);
        tie.receiveShadow = true;
        group.add(tie);
      }
    });

    // Background urban buildings on sides
    const bldgColors = [0x1e1b4b, 0x172554, 0x0f172a];
    [-11, 11].forEach((xPos) => {
      const h = 8 + Math.random() * 14;
      const bldg = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, h, this.segmentLength - 2),
        new THREE.MeshStandardMaterial({
          color: bldgColors[Math.floor(Math.random() * bldgColors.length)],
          roughness: 0.9,
        })
      );
      bldg.position.set(xPos, h / 2, 0);
      group.add(bldg);
    });

    return group;
  }

  /**
   * Builds a Low Jump Barrier (Player must JUMP over)
   */
  createLowBarrier(laneIndex) {
    const group = new THREE.Group();
    const x = LANES[laneIndex];

    const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.05, 8);
    const leftPost = new THREE.Mesh(postGeo, this.steelMat);
    leftPost.position.set(-0.95, 0.52, 0);
    const rightPost = new THREE.Mesh(postGeo, this.steelMat);
    rightPost.position.set(0.95, 0.52, 0);

    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.38, 0.16),
      this.hazardRedMat
    );
    plank.position.set(0, 0.78, 0);
    plank.castShadow = true;

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.14, 0.18),
      this.hazardWhiteMat
    );
    stripe.position.set(0, 0.78, 0);

    group.add(leftPost, rightPost, plank, stripe);
    group.position.set(x, 0, -165);
    this.scene.add(group);

    return {
      mesh: group,
      type: 'low_barrier',
      lane: laneIndex,
      halfWidth: 1.0,
      halfLength: 0.25,
      minY: 0,
      maxY: 1.05,
      movingSpeed: 0,
    };
  }

  /**
   * Builds a High Overhead Barrier (Player must SLIDE under)
   */
  createHighBarrier(laneIndex) {
    const group = new THREE.Group();
    const x = LANES[laneIndex];

    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8);
    const leftPost = new THREE.Mesh(postGeo, this.steelMat);
    leftPost.position.set(-1.05, 1.25, 0);
    const rightPost = new THREE.Mesh(postGeo, this.steelMat);
    rightPost.position.set(1.05, 1.25, 0);

    // Overhead block from y = 1.15 to y = 2.45 (leaves 1.15m clearance underneath for sliding)
    const upperBoard = new THREE.Mesh(
      new THREE.BoxGeometry(2.25, 1.25, 0.22),
      this.hazardRedMat
    );
    upperBoard.position.set(0, 1.8, 0);
    upperBoard.castShadow = true;

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.28, 0.24),
      this.hazardWhiteMat
    );
    stripe.position.set(0, 1.8, 0);

    group.add(leftPost, rightPost, upperBoard, stripe);
    group.position.set(x, 0, -165);
    this.scene.add(group);

    return {
      mesh: group,
      type: 'high_barrier',
      lane: laneIndex,
      halfWidth: 1.0,
      halfLength: 0.25,
      minY: 1.12, // Safe below 1.12m (sliding sets player height to 0.85m)
      maxY: 2.5,
      movingSpeed: 0,
    };
  }

  /**
   * Builds a 3D Subway Train Car (Stationary or Moving Oncoming)
   * Players can also land and run on the train roof if jumping from sufficient height!
   */
  createTrain(laneIndex, isMoving = false) {
    const group = new THREE.Group();
    const x = LANES[laneIndex];
    const length = 14;
    const height = 2.65;
    const width = 2.25;

    const color = this.trainBodyColors[Math.floor(Math.random() * this.trainBodyColors.length)];
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), bodyMat);
    body.position.y = height / 2 + 0.1;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Silver roof & stripe
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.2, 0.12, length - 0.4),
      this.steelMat
    );
    roof.position.y = height + 0.15;
    group.add(roof);

    // Glowing windshield & headlights on front (+Z facing player)
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.4, 0.75, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xbae6fd })
    );
    windshield.position.set(0, 1.9, length / 2 + 0.02);
    group.add(windshield);

    const lightGeo = new THREE.BoxGeometry(0.32, 0.2, 0.1);
    const lightMat = new THREE.MeshBasicMaterial({ color: isMoving ? 0xfef08a : 0xf87171 });
    [-0.7, 0.7].forEach((lx) => {
      const headlight = new THREE.Mesh(lightGeo, lightMat);
      headlight.position.set(lx, 0.75, length / 2 + 0.03);
      group.add(headlight);
    });

    group.position.set(x, 0, -175);
    this.scene.add(group);

    return {
      mesh: group,
      type: 'train',
      lane: laneIndex,
      halfWidth: 1.08,
      halfLength: length / 2,
      minY: 0,
      maxY: height + 0.15,
      movingSpeed: isMoving ? 10 : 0,
    };
  }

  spawnCoin(laneIndex, y, z) {
    const mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
    mesh.position.set(LANES[laneIndex], y, z);
    this.scene.add(mesh);
    this.coins.push({ mesh, collected: false });
  }

  spawnCoinBurst(position) {
    for (let i = 0; i < 10; i++) {
      const spark = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        this.coinMat
      );
      spark.position.copy(position);
      this.scene.add(spark);
      this.particles.push({
        mesh: spark,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 6
        ),
        life: 0.45,
      });
    }
  }

  /**
   * Spawns a balanced wave of obstacles and coins across the 3 lanes
   * ensuring at least one valid path is always passable.
   */
  spawnWave(currentSpeed) {
    const laneIndices = [0, 1, 2].sort(() => Math.random() - 0.5);
    const openLane = laneIndices[0]; // Guaranteed passable or coin lane
    const hazardLanes = [laneIndices[1], laneIndices[2]];

    // Spawn line of coins in the open lane
    for (let i = 0; i < 5; i++) {
      this.spawnCoin(openLane, 0.75, -160 - i * 2.5);
    }

    // Populate hazard lanes
    hazardLanes.forEach((lane, idx) => {
      if (idx === 1 && Math.random() < 0.25) return; // Sometimes leave 2 lanes open

      const roll = Math.random();
      if (roll < 0.35) {
        const obs = this.createLowBarrier(lane);
        this.obstacles.push(obs);
        // Parabolic coin arc over the jump barrier!
        this.spawnCoin(lane, 1.6, -162);
        this.spawnCoin(lane, 2.2, -165);
        this.spawnCoin(lane, 1.6, -168);
      } else if (roll < 0.65) {
        const obs = this.createHighBarrier(lane);
        this.obstacles.push(obs);
        // Low coins under the slide barrier
        this.spawnCoin(lane, 0.55, -163);
        this.spawnCoin(lane, 0.55, -165);
        this.spawnCoin(lane, 0.55, -167);
      } else {
        const isMoving = currentSpeed > 20 && Math.random() < 0.45;
        const train = this.createTrain(lane, isMoving);
        this.obstacles.push(train);
        // Coins along the roof of stationary trains
        if (!isMoving) {
          for (let c = -4; c <= 4; c += 2.5) {
            this.spawnCoin(lane, 3.35, -175 + c);
          }
        }
      }
    });
  }

  update(dt, speed) {
    // 1. Recycle endless track segments
    this.trackSegments.forEach((seg) => {
      seg.position.z += speed * dt;
      if (seg.position.z > this.segmentLength) {
        seg.position.z -= this.numSegments * this.segmentLength;
      }
    });

    // 2. Spawn waves periodically based on distance traveled
    this.spawnTimer += speed * dt;
    if (this.spawnTimer >= 26) {
      this.spawnTimer = 0;
      this.spawnWave(speed);
    }

    // 3. Move & clean up obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.mesh.position.z += (speed + obs.movingSpeed) * dt;
      if (obs.mesh.position.z > 20) {
        this.scene.remove(obs.mesh);
        this.obstacles.splice(i, 1);
      }
    }

    // 4. Spin & clean up coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.mesh.position.z += speed * dt;
      coin.mesh.rotation.y += dt * 4.5;
      if (coin.mesh.position.z > 12 || coin.collected) {
        this.scene.remove(coin.mesh);
        this.coins.splice(i, 1);
      }
    }

    // 5. Update coin pickup particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(Math.max(0, p.life * 2));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  reset() {
    this.obstacles.forEach((o) => this.scene.remove(o.mesh));
    this.coins.forEach((c) => this.scene.remove(c.mesh));
    this.particles.forEach((p) => this.scene.remove(p.mesh));
    this.obstacles = [];
    this.coins = [];
    this.particles = [];
    this.spawnTimer = 0;
  }
}