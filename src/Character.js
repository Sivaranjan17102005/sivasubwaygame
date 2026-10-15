import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Character {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // State & Animation variables
    this.runTime = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.laneTilt = 0;

    // Optional GLB AnimationMixer support
    this.customModelLoaded = false;
    this.mixer = null;
    this.actions = {};
    this.activeAction = null;

    this.buildProceduralCharacter();
  }

  /**
   * Builds a stylized 3D character featuring expressive facial geometry
   * and a multi-layered messy black hairstyle.
   */
  buildProceduralCharacter() {
    this.visualRoot = new THREE.Group();
    this.group.add(this.visualRoot);

    // Shared Materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd99b78,
      roughness: 0.65,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x121318, // Jet black with subtle charcoal highlight
      roughness: 0.55,
      metalness: 0.08,
    });
    const hoodieMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48, // Vibrant crimson street hoodie
      roughness: 0.6,
    });
    const shirtTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.5,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark slate cargo pants
      roughness: 0.75,
    });
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.5,
    });
    const soleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
    });

    // 1. TORSO & HOODIE
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.y = 0.78;
    this.visualRoot.add(this.torsoPivot);

    const torsoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.62, 0.3),
      hoodieMat
    );
    torsoMesh.position.y = 0.31;
    torsoMesh.castShadow = true;
    this.torsoPivot.add(torsoMesh);

    // Hoodie bottom hem
    const hemMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.53, 0.08, 0.31),
      shirtTrimMat
    );
    hemMesh.position.y = 0.04;
    this.torsoPivot.add(hemMesh);

    // Hoodie collar/hood bunched at neck
    const hoodBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.16, 0.22),
      hoodieMat
    );
    hoodBack.position.set(0, 0.62, 0.1);
    hoodBack.rotation.x = 0.3;
    this.torsoPivot.add(hoodBack);

    // 2. HEAD & FACIAL FEATURES (Facing -Z down the track, also visible when looking back)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.72, 0);
    this.torsoPivot.add(this.headGroup);

    // Neck
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.1, 0.14, 10),
      skinMat
    );
    neck.position.y = 0.03;
    this.headGroup.add(neck);

    // Main Head Block (slightly rounded feel via stacked proportions)
    const cranium = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      skinMat
    );
    cranium.position.y = 0.26;
    cranium.castShadow = true;
    this.headGroup.add(cranium);

    // Ears
    const earGeo = new THREE.BoxGeometry(0.06, 0.12, 0.08);
    const leftEar = new THREE.Mesh(earGeo, skinMat);
    leftEar.position.set(-0.23, 0.25, 0);
    const rightEar = new THREE.Mesh(earGeo, skinMat);
    rightEar.position.set(0.23, 0.25, 0);
    this.headGroup.add(leftEar, rightEar);

    // Facial Features (Placed on the -Z front face of the character)
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const browMat = new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.6 });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x7f1d1d });

    // Eyes
    const scleraGeo = new THREE.BoxGeometry(0.09, 0.065, 0.02);
    const pupilGeo = new THREE.BoxGeometry(0.045, 0.05, 0.025);
    const browGeo = new THREE.BoxGeometry(0.11, 0.028, 0.03);

    [-1, 1].forEach((side) => {
      const eyeX = side * 0.095;
      const sclera = new THREE.Mesh(scleraGeo, eyeWhiteMat);
      sclera.position.set(eyeX, 0.27, -0.21);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(eyeX, 0.27, -0.215);

      const brow = new THREE.Mesh(browGeo, browMat);
      brow.position.set(eyeX, 0.33, -0.215);
      brow.rotation.z = side * -0.12; // Confident, focused brow angle

      this.headGroup.add(sclera, pupil, brow);
    });

    // Nose bridge
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.085, 0.06),
      skinMat
    );
    nose.position.set(0, 0.23, -0.22);
    this.headGroup.add(nose);

    // Determined smirk/mouth
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.025, 0.02),
      mouthMat
    );
    mouth.position.set(0.01, 0.15, -0.212);
    mouth.rotation.z = 0.08;
    this.headGroup.add(mouth);

    // 3. MESSY BLACK HAIRSTYLE (Multi-layered tousled spikes & locks)
    this.hairGroup = new THREE.Group();
    this.headGroup.add(this.hairGroup);

    // Base hair cap covering top, sides, and back of head
    const hairCapTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.14, 0.46),
      hairMat
    );
    hairCapTop.position.set(0, 0.45, 0.01);
    this.hairGroup.add(hairCapTop);

    const hairBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.34, 0.14),
      hairMat
    );
    hairBack.position.set(0, 0.32, 0.18);
    this.hairGroup.add(hairBack);

    // Tousled / messy spikes & swept bangs (cones and angled boxes)
    const spikeConfigs = [
      // Crown & top messy spikes
      { pos: [0.0, 0.56, -0.05], rot: [-0.4, 0.1, 0.15], scale: [0.14, 0.22, 0.16] },
      { pos: [-0.13, 0.55, 0.02], rot: [-0.2, 0.3, 0.45], scale: [0.14, 0.21, 0.15] },
      { pos: [0.14, 0.54, 0.03], rot: [-0.25, -0.2, -0.4], scale: [0.14, 0.2, 0.15] },
      { pos: [-0.06, 0.57, 0.12], rot: [0.35, 0.1, 0.25], scale: [0.15, 0.22, 0.16] },
      { pos: [0.08, 0.56, 0.14], rot: [0.4, -0.15, -0.25], scale: [0.15, 0.21, 0.16] },
      // Back kicked-out messy tufts (highly visible to third-person camera!)
      { pos: [0.0, 0.44, 0.26], rot: [0.85, 0.0, 0.0], scale: [0.16, 0.24, 0.14] },
      { pos: [-0.15, 0.42, 0.24], rot: [0.75, 0.3, 0.4], scale: [0.15, 0.22, 0.14] },
      { pos: [0.15, 0.42, 0.24], rot: [0.75, -0.3, -0.4], scale: [0.15, 0.22, 0.14] },
      { pos: [-0.09, 0.31, 0.26], rot: [1.05, 0.15, 0.2], scale: [0.14, 0.2, 0.12] },
      { pos: [0.1, 0.3, 0.26], rot: [1.05, -0.15, -0.2], scale: [0.14, 0.2, 0.12] },
      { pos: [0.0, 0.23, 0.25], rot: [1.15, 0.0, 0.1], scale: [0.14, 0.18, 0.12] },
      // Side tousled flares
      { pos: [-0.24, 0.4, 0.04], rot: [0.1, 0.0, 0.75], scale: [0.12, 0.2, 0.15] },
      { pos: [0.24, 0.4, 0.04], rot: [0.1, 0.0, -0.75], scale: [0.12, 0.2, 0.15] },
      { pos: [-0.23, 0.34, 0.15], rot: [0.4, 0.2, 0.65], scale: [0.12, 0.18, 0.14] },
      { pos: [0.23, 0.34, 0.15], rot: [0.4, -0.2, -0.65], scale: [0.12, 0.18, 0.14] },
      // Front messy fringe / bangs sweeping across forehead
      { pos: [-0.12, 0.42, -0.22], rot: [-0.65, 0.2, 0.35], scale: [0.12, 0.19, 0.12] },
      { pos: [0.02, 0.41, -0.23], rot: [-0.7, -0.1, -0.2], scale: [0.13, 0.2, 0.12] },
      { pos: [0.14, 0.43, -0.21], rot: [-0.6, -0.2, -0.4], scale: [0.11, 0.17, 0.11] },
    ];

    const spikeGeo = new THREE.ConeGeometry(0.5, 1.0, 5);
    spikeConfigs.forEach((cfg) => {
      const tuft = new THREE.Mesh(spikeGeo, hairMat);
      tuft.position.set(...cfg.pos);
      tuft.rotation.set(...cfg.rot);
      tuft.scale.set(...cfg.scale);
      tuft.castShadow = true;
      this.hairGroup.add(tuft);
    });

    // 4. ARTICULATED ARMS
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.34, 0.56, 0);
    this.torsoPivot.add(this.leftArmPivot);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.34, 0.56, 0);
    this.torsoPivot.add(this.rightArmPivot);

    [this.leftArmPivot, this.rightArmPivot].forEach((armPivot) => {
      const sleeve = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.36, 0.16),
        hoodieMat
      );
      sleeve.position.y = -0.16;
      sleeve.castShadow = true;

      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.14, 0.13),
        skinMat
      );
      hand.position.y = -0.4;

      armPivot.add(sleeve, hand);
    });

    // 5. ARTICULATED LEGS & SNEAKERS
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.14, 0.78, 0);
    this.visualRoot.add(this.leftLegPivot);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.14, 0.78, 0);
    this.visualRoot.add(this.rightLegPivot);

    [this.leftLegPivot, this.rightLegPivot].forEach((legPivot) => {
      const legMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.62, 0.22),
        pantsMat
      );
      legMesh.position.y = -0.31;
      legMesh.castShadow = true;

      const shoeUpper = new THREE.Mesh(
        new THREE.BoxGeometry(0.21, 0.12, 0.32),
        shoeMat
      );
      shoeUpper.position.set(0, -0.66, -0.04);

      const shoeSole = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.05, 0.34),
        soleMat
      );
      shoeSole.position.set(0, -0.74, -0.04);

      legPivot.add(legMesh, shoeUpper, shoeSole);
    });
  }

  /**
   * Optional helper to replace the procedural character with a rigged .glb model.
   * Call `character.loadCustomGLB('/models/my_character.glb')` from main.js.
   */
  loadCustomGLB(url) {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        // Hide procedural mesh
        this.visualRoot.visible = false;

        const model = gltf.scene;
        model.scale.set(1.1, 1.1, 1.1);
        model.rotation.y = Math.PI; // Face -Z down the tracks
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this.group.add(model);

        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            this.actions[clip.name.toLowerCase()] = this.mixer.clipAction(clip);
          });
          this.playClip('run');
        }
        this.customModelLoaded = true;
      },
      undefined,
      (err) => {
        console.warn('Custom GLB not found or failed to load, using procedural character:', err);
      }
    );
  }

  playClip(name) {
    if (!this.mixer) return;
    const nextAction = this.actions[name];
    if (nextAction && nextAction !== this.activeAction) {
      if (this.activeAction) this.activeAction.fadeOut(0.15);
      nextAction.reset().fadeIn(0.15).play();
      this.activeAction = nextAction;
    }
  }

  /**
   * Updates character limb animations based on speed and state
   */
  update(dt, speed, isGrounded, isSliding, laneVelocity) {
    if (this.customModelLoaded && this.mixer) {
      this.mixer.update(dt);
      if (isSliding) this.playClip('slide');
      else if (!isGrounded) this.playClip('jump');
      else this.playClip('run');
      return;
    }

    // Bank/Lean body into lane switches
    this.laneTilt = THREE.MathUtils.lerp(this.laneTilt, -laneVelocity * 0.045, dt * 12);
    this.visualRoot.rotation.z = this.laneTilt;

    if (isSliding) {
      // Parkour baseball-slide posture (low hitbox)
      this.visualRoot.position.y = THREE.MathUtils.lerp(this.visualRoot.position.y, -0.42, dt * 18);
      this.torsoPivot.rotation.x = THREE.MathUtils.lerp(this.torsoPivot.rotation.x, -1.05, dt * 18);
      this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, 0.75, dt * 18);

      this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 1.35, dt * 18);
      this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, 0.4, dt * 18);
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, 0.8, dt * 18);
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, 0.8, dt * 18);
    } else if (!isGrounded) {
      // Mid-air Jump posture
      this.visualRoot.position.y = THREE.MathUtils.lerp(this.visualRoot.position.y, 0, dt * 15);
      this.torsoPivot.rotation.x = THREE.MathUtils.lerp(this.torsoPivot.rotation.x, 0.18, dt * 12);
      this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, -0.1, dt * 12);

      this.leftLegPivot.rotation.x = THREE.MathUtils.lerp(this.leftLegPivot.rotation.x, 0.65, dt * 14);
      this.rightLegPivot.rotation.x = THREE.MathUtils.lerp(this.rightLegPivot.rotation.x, -0.45, dt * 14);
      this.leftArmPivot.rotation.x = THREE.MathUtils.lerp(this.leftArmPivot.rotation.x, -2.2, dt * 12);
      this.rightArmPivot.rotation.x = THREE.MathUtils.lerp(this.rightArmPivot.rotation.x, -2.2, dt * 12);
    } else {
      // Energetic Sprint Cycle
      this.runTime += dt * speed * 0.85;
      const swing = Math.sin(this.runTime);
      const bounce = Math.abs(Math.cos(this.runTime)) * 0.09;

      this.visualRoot.position.y = bounce;
      this.torsoPivot.rotation.x = THREE.MathUtils.lerp(this.torsoPivot.rotation.x, 0.16, dt * 14);
      this.torsoPivot.rotation.y = swing * 0.12;
      this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, -0.1, dt * 14);

      this.leftLegPivot.rotation.x = swing * 0.95;
      this.rightLegPivot.rotation.x = -swing * 0.95;

      this.leftArmPivot.rotation.x = -swing * 0.85;
      this.rightArmPivot.rotation.x = swing * 0.85;
    }
  }
}