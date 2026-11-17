
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

// ========================================
// GAME ENGINE
// ========================================

function CombatWorld({
  controls,
  paused,
  onScoreChange,
  onHealthChange,
  onGameOver,
  onPowerupChange,
  onShieldChange,
  onBossUpdate,
  onVictory,
  onEnemyDefeated,
  onBossDefeated,
  difficulty,
  resetKey,
  soundEnabled,
}) {
  const { scene } = useThree();

  const player = useRef(null);
  const shieldMesh = useRef(null);

  const bullets = useRef([]);
  const enemyBullets = useRef([]);
  const enemies = useRef([]);
  const pickups = useRef([]);
  const explosions = useRef([]);

  const boss = useRef(null);
  const audioContext = useRef(null);

  const game = useRef({
    score: 0,
    health: 3,
    shotTimer: 0,
    enemyTimer: 0,
    rapidTimer: 0,
    shieldTimer: 0,
    shieldCooldown: 0,
    damageCooldown: 0,
    bossSpawned: false,
    ended: false,
    previousShieldInput: false,
    bossIndex: 0,
  });

  const resources = useMemo(() => ({
    laserGeometry: new THREE.CylinderGeometry(0.055, 0.055, 1.6, 8),
    laserMaterial: new THREE.MeshBasicMaterial({
      color: "#54faff",
      toneMapped: false,
    }),

    enemyGeometry: new THREE.ConeGeometry(0.8, 2.1, 8),
    wingGeometry: new THREE.BoxGeometry(1.4, 0.12, 0.85),

    normalMaterial: new THREE.MeshStandardMaterial({
      color: "#e83d62",
      emissive: "#8e102e",
      emissiveIntensity: 1.1,
      metalness: 0.65,
      roughness: 0.25,
    }),

    fastMaterial: new THREE.MeshStandardMaterial({
      color: "#28dfff",
      emissive: "#0878aa",
      emissiveIntensity: 1.5,
    }),

    heavyMaterial: new THREE.MeshStandardMaterial({
      color: "#ff9b35",
      emissive: "#a33b00",
      emissiveIntensity: 1.2,
    }),

    bulletGeometry: new THREE.SphereGeometry(0.17, 10, 10),
    enemyBulletMaterial: new THREE.MeshBasicMaterial({
      color: "#ff315c",
      toneMapped: false,
    }),

    explosionGeometry: new THREE.SphereGeometry(0.12, 8, 8),
    explosionMaterial: new THREE.MeshBasicMaterial({
      color: "#ffb13b",
      toneMapped: false,
    }),

    healthGeometry: new THREE.SphereGeometry(0.55, 16, 16),
    healthMaterial: new THREE.MeshStandardMaterial({
      color: "#40ff91",
      emissive: "#00aa50",
      emissiveIntensity: 1.8,
    }),

    rapidMaterial: new THREE.MeshStandardMaterial({
      color: "#ffe45c",
      emissive: "#cc8b00",
      emissiveIntensity: 2,
    }),

    pickupRingGeometry: new THREE.TorusGeometry(0.8, 0.07, 8, 24),

    bossGeometry: new THREE.BoxGeometry(3.5, 1.1, 3.2),
    bossWingGeometry: new THREE.BoxGeometry(5.8, 0.25, 1.4),

    bossMaterial: new THREE.MeshStandardMaterial({
      color: "#8e1cff",
      emissive: "#5200aa",
      emissiveIntensity: 1.8,
      metalness: 0.7,
      roughness: 0.2,
    }),

    shieldGeometry: new THREE.SphereGeometry(1.8, 24, 24),
    shieldMaterial: new THREE.MeshBasicMaterial({
      color: "#35d9ff",
      wireframe: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  }), []);

  // ========================================
  // SOUND EFFECTS
  // ========================================

  function playSound(type) {
    if (!soundEnabled) return;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      if (!audioContext.current) {
        audioContext.current = new AudioContextClass();
      }

      const ctx = audioContext.current;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      const settings = {
        laser: [700, 350, 0.07],
        hit: [180, 65, 0.2],
        explosion: [130, 35, 0.3],
        pickup: [500, 1100, 0.2],
        shield: [350, 800, 0.25],
        boss: [220, 70, 0.4],
      };

      const [startFrequency, endFrequency, duration] =
        settings[type] || settings.laser;

      oscillator.type = type === "explosion" ? "sawtooth" : "sine";

      oscillator.frequency.setValueAtTime(startFrequency, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        ctx.currentTime + duration
      );

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    } catch {
      // Audio is optional; gameplay continues if unavailable.
    }
  }

  // ========================================
  // RESET AND CLEANUP
  // ========================================

  useEffect(() => {
    game.current = {
      score: 0,
      health: 3,
      shotTimer: 0,
      enemyTimer: 0,
      rapidTimer: 0,
      shieldTimer: 0,
      shieldCooldown: 0,
      damageCooldown: 0,
      bossSpawned: false,
      ended: false,
      previousShieldInput: false,
      bossIndex: 0,
    };

    onScoreChange(0);
    onHealthChange(3);
    onGameOver(false);
    onPowerupChange("");
    onShieldChange(false);

    if (player.current) {
      player.current.position.set(0, 0, 0);
    }

    const removeObjects = (items, getObject) => {
      items.forEach((item) => {
        const object = getObject(item);
        scene.remove(object);
      });
      items.length = 0;
    };

    return () => {
      removeObjects(bullets.current, (item) => item);
      removeObjects(enemyBullets.current, (item) => item.mesh);
      removeObjects(enemies.current, (item) => item.mesh);
      removeObjects(pickups.current, (item) => item.mesh);

      explosions.current.forEach((item) => {
        item.particles.forEach((particle) => scene.remove(particle));
      });
      explosions.current = [];

      if (boss.current) {
        scene.remove(boss.current.mesh);
        boss.current = null;
      }

      if (audioContext.current) {
        audioContext.current.close().catch(() => {});
        audioContext.current = null;
      }
    };
  }, [
    resetKey,
    scene,
    onScoreChange,
    onHealthChange,
    onGameOver,
    onPowerupChange,
    onShieldChange,
  ]);

  // ========================================
  // EXPLOSIONS
  // ========================================

  function createExplosion(position, color) {
    const particles = [];

    for (let i = 0; i < 12; i++) {
      const material = color
        ? new THREE.MeshBasicMaterial({ color, toneMapped: false })
        : resources.explosionMaterial;

      const particle = new THREE.Mesh(
        resources.explosionGeometry,
        material
      );

      particle.position.copy(position);

      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );

      scene.add(particle);
      particles.push(particle);
    }

    explosions.current.push({
      particles,
      age: 0,
    });
  }

  // ========================================
  // PLAYER DAMAGE
  // ========================================

  function damagePlayer() {
    const state = game.current;

    if (
      state.shieldTimer > 0 ||
      state.damageCooldown > 0 ||
      state.ended
    ) {
      return;
    }

    state.health -= 1;
    state.damageCooldown = 0.8;

    onHealthChange(Math.max(0, state.health));
    playSound("hit");

    if (state.health <= 0) {
      state.ended = true;
      onGameOver(true);
    }
  }

  // ========================================
  // ENEMY SPAWNING
  // ========================================

  function spawnEnemy() {
    const difficultyScale = difficulty === "easy" ? 0.82 : difficulty === "hard" ? 1.28 : 1;
    const mesh = new THREE.Group();
    const score = game.current.score;
    const chance = Math.random();

    let type = "normal";
    let material = resources.normalMaterial;
    let speed = 10 + Math.random() * 4;
    let health = 1;

    if (score >= 500 && chance < 0.25) {
      type = "heavy";
      material = resources.heavyMaterial;
      speed = 7 + Math.random() * 3;
      health = 3;
    } else if (score >= 200 && chance < 0.55) {
      type = "fast";
      material = resources.fastMaterial;
      speed = 18 + Math.random() * 4;
    }

    const body = new THREE.Mesh(
      resources.enemyGeometry,
      material
    );

    body.rotation.x = -Math.PI / 2;

    if (type === "heavy") {
      body.scale.set(1.5, 1.3, 1.5);
    }

    mesh.add(body);

    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(
        resources.wingGeometry,
        material
      );

      wing.position.set(side * 0.85, 0, 0.25);
      mesh.add(wing);
    });

    mesh.position.set(
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 8,
      -65
    );

    scene.add(mesh);

    enemies.current.push({
      mesh,
      type,
      speed: speed * difficultyScale,
      health: difficulty === "hard" && type === "heavy" ? health + 1 : health,
      shotTimer: 0,
    });
  }

  // ========================================
  // ENEMY PROJECTILES
  // ========================================

  function fireEnemyBullet(position, direction) {
    const mesh = new THREE.Mesh(
      resources.bulletGeometry,
      resources.enemyBulletMaterial
    );

    mesh.position.copy(position);

    const projectileScale = difficulty === "easy" ? 0.85 : difficulty === "hard" ? 1.2 : 1;
    const velocity = direction.clone().normalize().multiplyScalar(22 * projectileScale);

    scene.add(mesh);

    enemyBullets.current.push({
      mesh,
      velocity,
    });
  }

  // ========================================
  // BOSS
  // ========================================

  function spawnBoss() {
    const index = game.current.bossIndex;
    const bossDefinitions = [
      { name: "THE DESTROYER", health: 18, color: "#ff405d", core: "#ffe45c", scale: 1.25 },
      { name: "THE PHANTOM", health: 26, color: "#28dfff", core: "#ffffff", scale: 1.15 },
      { name: "GALACTIC OVERLORD", health: 38, color: "#a34bff", core: "#ff315c", scale: 1.45 },
    ];
    const definition = bossDefinitions[index];
    if (!definition || game.current.bossSpawned) return;

    game.current.bossSpawned = true;
    const mesh = new THREE.Group();
    const bossMaterial = new THREE.MeshStandardMaterial({
      color: definition.color,
      emissive: definition.color,
      emissiveIntensity: 1.35,
      metalness: 0.7,
      roughness: 0.22,
    });

    const body = new THREE.Mesh(resources.bossGeometry, bossMaterial);
    mesh.add(body);

    const wings = new THREE.Mesh(resources.bossWingGeometry, bossMaterial);
    wings.position.z = 0.5;
    mesh.add(wings);

    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(index === 2 ? 0.9 : 0.65, 20, 20),
      new THREE.MeshBasicMaterial({ color: definition.core, toneMapped: false })
    );
    cockpit.position.set(0, 0.6, -0.7);
    mesh.add(cockpit);

    if (index >= 1) {
      [-1, 1].forEach((side) => {
        const cannon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.32, 1.8, 12),
          bossMaterial
        );
        cannon.rotation.x = Math.PI / 2;
        cannon.position.set(side * 2.1, -0.15, 0.4);
        mesh.add(cannon);
      });
    }

    if (index === 2) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(4.1, 0.12, 12, 64),
        new THREE.MeshBasicMaterial({ color: "#d58aff", toneMapped: false })
      );
      ring.position.z = 0.5;
      mesh.add(ring);
    }

    mesh.position.set(0, 0, -35);
    mesh.scale.setScalar(definition.scale);
    scene.add(mesh);

    boss.current = {
      mesh,
      index,
      name: definition.name,
      health: Math.round(definition.health * (difficulty === "easy" ? 0.8 : difficulty === "hard" ? 1.4 : 1)),
      maxHealth: Math.round(definition.health * (difficulty === "easy" ? 0.8 : difficulty === "hard" ? 1.4 : 1)),
      attackTimer: 0,
      material: bossMaterial,
    };

    onBossUpdate({
      name: definition.name,
      health: Math.round(definition.health * (difficulty === "easy" ? 0.8 : difficulty === "hard" ? 1.4 : 1)),
      maxHealth: Math.round(definition.health * (difficulty === "easy" ? 0.8 : difficulty === "hard" ? 1.4 : 1)),
    });
    onPowerupChange(`${definition.name} APPROACHING`);
    playSound("boss");
  }

  // ========================================
  // POWER-UPS
  // ========================================

  function spawnPickup(position) {
    const type = Math.random() < 0.5 ? "health" : "rapid";
    const mesh = new THREE.Group();

    const material =
      type === "health"
        ? resources.healthMaterial
        : resources.rapidMaterial;

    const sphere = new THREE.Mesh(
      resources.healthGeometry,
      material
    );

    const ring = new THREE.Mesh(
      resources.pickupRingGeometry,
      material
    );

    ring.rotation.x = Math.PI / 2;

    mesh.add(sphere, ring);
    mesh.position.copy(position);
    mesh.position.z += 1;

    scene.add(mesh);

    pickups.current.push({
      mesh,
      type,
      age: 0,
    });
  }

  // ========================================
  // PLAYER LASERS
  // ========================================

  function fireLaser(position, offset) {
    const laser = new THREE.Mesh(
      resources.laserGeometry,
      resources.laserMaterial
    );

    laser.rotation.x = Math.PI / 2;
    laser.position.copy(position);
    laser.position.x += offset;
    laser.position.z -= 1.5;

    scene.add(laser);
    bullets.current.push(laser);
  }

  // ========================================
  // GAME LOOP
  // ========================================

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.04);
    const ship = player.current;
    const data = game.current;

    if (!ship || data.ended || paused) return;

    const clock = state.clock.elapsedTime;

    // PLAYER MOVEMENT

    const movementSpeed = 12;

    if (controls.current.left) ship.position.x -= movementSpeed * dt;
    if (controls.current.right) ship.position.x += movementSpeed * dt;
    if (controls.current.up) ship.position.y += movementSpeed * dt;
    if (controls.current.down) ship.position.y -= movementSpeed * dt;

    ship.position.x = THREE.MathUtils.clamp(ship.position.x, -12, 12);
    ship.position.y = THREE.MathUtils.clamp(ship.position.y, -5, 7);

    const targetBank = controls.current.left
      ? 0.3
      : controls.current.right
        ? -0.3
        : 0;

    ship.rotation.z = THREE.MathUtils.damp(
      ship.rotation.z,
      targetBank,
      5,
      dt
    );

    // SHIELD SYSTEM: press E to activate for 3 seconds.
    // Cooldown: 8 seconds.

    const shieldPressed = Boolean(controls.current.shield);

    if (shieldPressed && !data.previousShieldInput) {
      if (data.shieldCooldown <= 0) {
        data.shieldTimer = 3;
        data.shieldCooldown = 8;

        onShieldChange(true);
        onPowerupChange("SHIELD ACTIVATED");
        playSound("shield");
      } else {
        onPowerupChange("SHIELD RECHARGING");
      }
    }

    data.previousShieldInput = shieldPressed;

    if (data.shieldTimer > 0) {
      data.shieldTimer -= dt;

      if (data.shieldTimer <= 0) {
        data.shieldTimer = 0;
        onShieldChange(false);
        onPowerupChange("");
      }
    }

    if (data.shieldCooldown > 0) {
      data.shieldCooldown -= dt;
    }

    if (shieldMesh.current) {
      shieldMesh.current.visible = data.shieldTimer > 0;
      shieldMesh.current.rotation.y += dt * 1.5;
      shieldMesh.current.scale.setScalar(
        1 + Math.sin(clock * 8) * 0.035
      );
    }

    if (data.damageCooldown > 0) {
      data.damageCooldown -= dt;
    }

    // RAPID FIRE POWER-UP

    if (data.rapidTimer > 0) {
      data.rapidTimer -= dt;

      if (data.rapidTimer <= 0) {
        data.rapidTimer = 0;
        onPowerupChange("");
      }
    }

    // PLAYER SHOOTING

    data.shotTimer += dt;

    const fireInterval = data.rapidTimer > 0 ? 0.07 : 0.18;

    if (controls.current.shoot && data.shotTimer >= fireInterval) {
      const weaponLevel = data.score >= 3000 ? 3 : data.score >= 1500 ? 2 : 1;
      const offsets =
        weaponLevel === 3
          ? [-0.65, -0.32, 0, 0.32, 0.65]
          : weaponLevel === 2
            ? [-0.48, 0, 0.48]
            : [-0.38, 0.38];

      offsets.forEach((offset) => fireLaser(ship.position, offset));
      data.shotTimer = 0;
      playSound("laser");
    }

    // PLAYER LASER MOVEMENT

    for (let i = bullets.current.length - 1; i >= 0; i--) {
      const bullet = bullets.current[i];

      bullet.position.z -= 65 * dt;

      if (bullet.position.z < -100) {
        scene.remove(bullet);
        bullets.current.splice(i, 1);
      }
    }

    // DIFFICULTY

    const scoreDifficulty = Math.min(data.score / 2500, 1.5);

    const spawnInterval = Math.max(
      0.65,
      (1.8 - scoreDifficulty * 0.65) * (difficulty === "easy" ? 1.2 : difficulty === "hard" ? 0.78 : 1)
    );

    data.enemyTimer += dt;

    if (data.enemyTimer >= spawnInterval) {
      spawnEnemy();
      data.enemyTimer = 0;
    }

    // THREE BOSS ENCOUNTERS: one threshold per mission.

    const bossThresholds = [1000, 2500, 4000];
    const nextBossThreshold = bossThresholds[data.bossIndex];

    if (
      nextBossThreshold !== undefined &&
      data.score >= nextBossThreshold &&
      !data.bossSpawned
    ) {
      spawnBoss();
    }

    // ENEMY MOVEMENT AND SHOOTING

    for (let i = enemies.current.length - 1; i >= 0; i--) {
      const enemy = enemies.current[i];
      const mesh = enemy.mesh;

      mesh.position.x +=
        (ship.position.x - mesh.position.x) * 0.8 * dt;

      mesh.position.y +=
        (ship.position.y - mesh.position.y) * 0.8 * dt;

      mesh.position.z += enemy.speed * (1 + scoreDifficulty * 0.3) * dt;

      mesh.rotation.z = Math.sin(clock * 3 + i) * 0.12;

      enemy.shotTimer += dt;

      if (enemy.shotTimer >= (enemy.type === "fast" ? 1.8 : 2.6)) {
        const direction = new THREE.Vector3(
          ship.position.x - mesh.position.x,
          ship.position.y - mesh.position.y,
          ship.position.z - mesh.position.z
        );

        fireEnemyBullet(mesh.position, direction);
        enemy.shotTimer = 0;
      }

      // Enemy reaches player's depth

      if (mesh.position.z >= -1.5) {
        const close =
          Math.abs(mesh.position.x - ship.position.x) < 2.2 &&
          Math.abs(mesh.position.y - ship.position.y) < 2.2;

        if (close) {
          createExplosion(mesh.position);
          damagePlayer();
        }

        scene.remove(mesh);
        enemies.current.splice(i, 1);
        continue;
      }

      // PLAYER LASER COLLISIONS

      let destroyed = false;

      for (let j = bullets.current.length - 1; j >= 0; j--) {
        const bullet = bullets.current[j];

        if (
          bullet.position.distanceTo(mesh.position) <
          (enemy.type === "heavy" ? 2.2 : 1.8)
        ) {
          enemy.health -= 1;

          scene.remove(bullet);
          bullets.current.splice(j, 1);

          if (enemy.health <= 0) {
            createExplosion(
              mesh.position,
              enemy.type === "fast" ? "#36eaff" : undefined
            );

            if (Math.random() < 0.3) {
              spawnPickup(mesh.position);
            }

            scene.remove(mesh);
            enemies.current.splice(i, 1);

            data.score += enemy.type === "heavy" ? 200 : 100;
            onScoreChange(data.score);
            onEnemyDefeated();
            playSound("explosion");

            destroyed = true;
            break;
          }
        }
      }

      if (destroyed) continue;
    }

    // ENEMY PROJECTILE COLLISIONS

    for (let i = enemyBullets.current.length - 1; i >= 0; i--) {
      const bullet = enemyBullets.current[i];

      bullet.mesh.position.addScaledVector(bullet.velocity, dt);

      if (bullet.mesh.position.distanceTo(ship.position) < 1.3) {
        if (data.shieldTimer > 0) {
          createExplosion(bullet.mesh.position, "#35d9ff");
        } else {
          createExplosion(bullet.mesh.position, "#ff315c");
          damagePlayer();
        }

        scene.remove(bullet.mesh);
        enemyBullets.current.splice(i, 1);
        continue;
      }

      if (bullet.mesh.position.z > 15) {
        scene.remove(bullet.mesh);
        enemyBullets.current.splice(i, 1);
      }
    }

    // BOSS MOVEMENT AND ATTACKS

    if (boss.current) {
      const currentBoss = boss.current;
      const mesh = currentBoss.mesh;

      const bossIndex = currentBoss.index;
      const movementRate = bossIndex === 1 ? 1.45 : bossIndex === 2 ? 1.05 : 0.75;
      mesh.position.x = Math.sin(clock * movementRate) * (bossIndex === 2 ? 9 : 7);
      mesh.position.y = Math.sin(clock * (movementRate + 0.5)) * (bossIndex === 2 ? 2.8 : 1.8);
      mesh.rotation.z = Math.sin(clock * movementRate) * 0.12;

      currentBoss.attackTimer += dt;
      const baseAttackInterval = bossIndex === 1 ? 1.05 : bossIndex === 2 ? 0.85 : 1.5;
      const attackInterval = baseAttackInterval * (difficulty === "easy" ? 1.25 : difficulty === "hard" ? 0.72 : 1);

      if (currentBoss.attackTimer >= attackInterval) {
        if (bossIndex === 0) {
          [-0.45, 0, 0.45].forEach((spread) => {
            fireEnemyBullet(mesh.position, new THREE.Vector3(spread, -0.04, 1));
          });
        } else if (bossIndex === 1) {
          const aim = new THREE.Vector3(
            ship.position.x - mesh.position.x,
            ship.position.y - mesh.position.y,
            ship.position.z - mesh.position.z
          );
          [-0.22, 0, 0.22].forEach((spread) => {
            fireEnemyBullet(
              mesh.position,
              aim.clone().add(new THREE.Vector3(spread, 0, 0))
            );
          });
        } else {
          for (let shot = 0; shot < 8; shot++) {
            const angle = (Math.PI * 2 * shot) / 8;
            fireEnemyBullet(
              mesh.position,
              new THREE.Vector3(Math.sin(angle), Math.cos(angle) * 0.55, 1)
            );
          }
          const aimed = new THREE.Vector3(
            ship.position.x - mesh.position.x,
            ship.position.y - mesh.position.y,
            ship.position.z - mesh.position.z
          );
          fireEnemyBullet(mesh.position, aimed);
        }

        currentBoss.attackTimer = 0;
      }

      // Boss takes damage from lasers

      for (let i = bullets.current.length - 1; i >= 0; i--) {
        const bullet = bullets.current[i];

        if (bullet.position.distanceTo(mesh.position) < 4.5) {
          currentBoss.health -= 1;
          onBossUpdate({
            name: currentBoss.name,
            health: currentBoss.health,
            maxHealth: currentBoss.maxHealth,
          });

          scene.remove(bullet);
          bullets.current.splice(i, 1);

          if (currentBoss.health <= 0) {
            createExplosion(mesh.position, "#b34cff");
            spawnPickup(mesh.position);

            scene.remove(mesh);
            currentBoss.material.dispose();
            boss.current = null;
            onBossUpdate(null);

            data.score += 1000;
            onScoreChange(data.score);
            data.bossIndex += 1;
            data.bossSpawned = false;
            onBossDefeated();

            if (data.bossIndex >= 3) {
              data.ended = true;
              onPowerupChange("GALAXY SAVED");
              onVictory();
            } else {
              onPowerupChange(`BOSS ${data.bossIndex} DEFEATED - NEXT BOSS INCOMING`);
            }

            playSound("explosion");
          }

          break;
        }
      }
    }

    // POWER-UP MOVEMENT AND COLLECTION

    for (let i = pickups.current.length - 1; i >= 0; i--) {
      const pickup = pickups.current[i];

      pickup.age += dt;
      pickup.mesh.rotation.y += dt * 2;
      pickup.mesh.position.z += 10 * dt;

      const close =
        Math.abs(pickup.mesh.position.x - ship.position.x) < 2 &&
        Math.abs(pickup.mesh.position.y - ship.position.y) < 2 &&
        Math.abs(pickup.mesh.position.z - ship.position.z) < 2;

      if (close) {
        if (pickup.type === "health") {
          if (data.health < 3) {
            data.health += 1;
            onHealthChange(data.health);
            onPowerupChange("HEALTH RESTORED");
          } else {
            onPowerupChange("HEALTH FULL");
          }
        } else {
          data.rapidTimer = 8;
          onPowerupChange("RAPID FIRE");
        }

        scene.remove(pickup.mesh);
        pickups.current.splice(i, 1);
        playSound("pickup");
        continue;
      }

      if (pickup.mesh.position.z > 5 || pickup.age > 12) {
        scene.remove(pickup.mesh);
        pickups.current.splice(i, 1);
      }
    }

    // EXPLOSION ANIMATION

    for (let i = explosions.current.length - 1; i >= 0; i--) {
      const explosion = explosions.current[i];

      explosion.age += dt;

      explosion.particles.forEach((particle) => {
        particle.position.addScaledVector(
          particle.userData.velocity,
          dt
        );

        particle.scale.multiplyScalar(0.97);
      });

      if (explosion.age > 0.65) {
        explosion.particles.forEach((particle) => {
          scene.remove(particle);
        });

        explosions.current.splice(i, 1);
      }
    }
  });

  // ========================================
  // 3D SCENE
  // ========================================

  return (
    <>
      {/* PLAYER SHIP */}

      <group ref={player}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.65, 2.8, 10]} />
          <meshStandardMaterial
            color="#EEEEEE"
            metalness={0.8}
            roughness={0.25}
          />
        </mesh>

        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.9, -0.1, 0.35]}
          >
            <boxGeometry args={[1.5, 0.16, 1.1]} />
            <meshStandardMaterial color="#167D8D" metalness={0.55} roughness={0.3} />
          </mesh>
        ))}

        <mesh position={[0, 0.35, -0.35]}>
          <sphereGeometry args={[0.32, 24, 24]} />
          <meshPhysicalMaterial
            color="#B9E4E8"
            emissive="#167D8D"
            emissiveIntensity={1.4}
            roughness={0.1}
            clearcoat={1}
          />
        </mesh>

        {[-0.38, 0.38].map((x) => (
          <mesh
            key={x}
            position={[x, -0.05, 0.9]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.16, 0.23, 0.65, 16]} />
            <meshStandardMaterial color="#071B2B" metalness={0.7} roughness={0.25} />
          </mesh>
        ))}

        <mesh position={[0, -0.08, 1.45]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial color="#B9E4E8" toneMapped={false} />
        </mesh>

        {/* SHIELD VISUAL */}

        <mesh
          ref={shieldMesh}
          visible={false}
          geometry={resources.shieldGeometry}
          material={resources.shieldMaterial}
        />
      </group>

      {/* GALAXY */}

      <color attach="background" args={["#030716"]} />
      <fog attach="fog" args={["#030716", 45, 160]} />

      <ambientLight intensity={1} />
      <directionalLight position={[5, 10, 5]} intensity={2} />

      <pointLight
        position={[0, 3, 4]}
        intensity={30}
        color="#238aff"
      />

      <Stars
        radius={150}
        depth={100}
        count={5000}
        factor={4}
        fade
        speed={1}
      />

      <CameraFollow player={player} />
    </>
  );
}

// ========================================
// CAMERA
// ========================================

function CameraFollow({ player }) {
  const target = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const ship = player.current;
    if (!ship) return;

    const desired = new THREE.Vector3(
      ship.position.x * 0.45,
      ship.position.y + 2.8,
      ship.position.z + 8
    );

    state.camera.position.lerp(
      desired,
      1 - Math.exp(-4 * delta)
    );

    target.current.set(
      ship.position.x * 0.4,
      ship.position.y + 0.1,
      ship.position.z - 12
    );

    state.camera.lookAt(target.current);
  });

  return null;
}

// ========================================
// MAIN SCENE
// ========================================

export default function SpaceScene({
  onScoreChange,
  onHealthChange,
  onGameOver,
  onVictory,
  onEnemyDefeated,
  onBossDefeated,
  difficulty = "normal",
  resetKey,
}) {
  const controls = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
    shoot: false,
    shield: false,
  });

  const [powerupLabel, setPowerupLabel] = useState("");
  const [paused, setPaused] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bossInfo, setBossInfo] = useState(null);

  useEffect(() => {
    setPaused(false);
    setShieldActive(false);
    setPowerupLabel("");
    setBossInfo(null);
  }, [resetKey]);

  useEffect(() => {
    function keyDown(event) {
      const key = event.key.toLowerCase();

      if (
        ["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)
      ) {
        event.preventDefault();
      }

      if (key === "arrowleft" || key === "a") controls.current.left = true;
      if (key === "arrowright" || key === "d") controls.current.right = true;
      if (key === "arrowup" || key === "w") controls.current.up = true;
      if (key === "arrowdown" || key === "s") controls.current.down = true;
      if (key === " ") controls.current.shoot = true;

      if (key === "e") controls.current.shield = true;

      if (key === "p" && !event.repeat) {
        setPaused((value) => !value);
      }
    }

    function keyUp(event) {
      const key = event.key.toLowerCase();

      if (key === "arrowleft" || key === "a") controls.current.left = false;
      if (key === "arrowright" || key === "d") controls.current.right = false;
      if (key === "arrowup" || key === "w") controls.current.up = false;
      if (key === "arrowdown" || key === "s") controls.current.down = false;
      if (key === " ") controls.current.shoot = false;
      if (key === "e") controls.current.shield = false;
    }

    function stopAll() {
      controls.current = {
        left: false,
        right: false,
        up: false,
        down: false,
        shoot: false,
        shield: false,
      };
    }

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", stopAll);

    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", stopAll);
    };
  }, []);

  function buttonProps(control) {
    return {
      onPointerDown: (event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        controls.current[control] = true;
      },
      onPointerUp: () => {
        controls.current[control] = false;
      },
      onPointerCancel: () => {
        controls.current[control] = false;
      },
      onLostPointerCapture: () => {
        controls.current[control] = false;
      },
    };
  }

  return (
    <div className="three-game">
      <Canvas
        camera={{
          position: [0, 2.8, 8],
          fov: 60,
          near: 0.1,
          far: 250,
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
      >
        <CombatWorld
          controls={controls}
          paused={paused}
          onScoreChange={onScoreChange}
          onHealthChange={onHealthChange}
          onGameOver={onGameOver}
          onPowerupChange={setPowerupLabel}
          onShieldChange={setShieldActive}
          onBossUpdate={setBossInfo}
          onVictory={onVictory}
          onEnemyDefeated={onEnemyDefeated}
          onBossDefeated={onBossDefeated}
          difficulty={difficulty}
          resetKey={resetKey}
          soundEnabled={soundEnabled}
        />
      </Canvas>

      {bossInfo && (
        <div className="boss-hud">
          <div className="boss-hud-title">
            <span>BOSS ENCOUNTER</span>
            <strong>{bossInfo.name}</strong>
          </div>
          <div className="boss-health-track">
            <div
              className="boss-health-fill"
              style={{
                width: `${Math.max(0, (bossInfo.health / bossInfo.maxHealth) * 100)}%`,
              }}
            />
          </div>
          <div className="boss-health-numbers">
            <span>ARMOR</span>
            <span>{bossInfo.health} / {bossInfo.maxHealth}</span>
          </div>
        </div>
      )}

      {/* GAME CONTROLS */}

      <button
        className="pause-button"
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? "RESUME" : "PAUSE"}
      </button>

      <button
        className="sound-button"
        onClick={() => setSoundEnabled((value) => !value)}
      >
        SOUND: {soundEnabled ? "ON" : "OFF"}
      </button>

      {shieldActive && (
        <div className="shield-notice">
          SHIELD ACTIVE
        </div>
      )}

      {powerupLabel && (
        <div className="powerup-notice">
          {powerupLabel}
        </div>
      )}

      {paused && (
        <div className="pause-overlay">
          <div className="pause-card">
            <h1>PAUSED</h1>
            <p>Your mission is temporarily stopped.</p>
            <button onClick={() => setPaused(false)}>
              RESUME MISSION
            </button>
          </div>
        </div>
      )}

      <div className="combat-hint">
        WASD: MOVE | SPACE: SHOOT | E: SHIELD | P: PAUSE
      </div>

      {/* MOBILE CONTROLS */}

      <div className="touch-controls">
        <div className="movement-controls">
          <button {...buttonProps("left")}>◀</button>
          <button {...buttonProps("right")}>▶</button>
        </div>

        <div className="movement-controls">
          <button {...buttonProps("up")}>▲</button>
          <button {...buttonProps("down")}>▼</button>
        </div>

        <div className="action-controls">
          <button
            className="shield-button"
            {...buttonProps("shield")}
          >
            SHIELD
          </button>

          <button
            className="fire-button"
            {...buttonProps("shoot")}
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
}
