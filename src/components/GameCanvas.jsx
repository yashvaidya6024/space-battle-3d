
import { useEffect, useRef } from "react";
export default function GameCanvas() {
  const canvasRef = useRef(null);
  const controls = useRef({
    left: false,
    right: false,
    shoot: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let animationId;
    let lastTime = 0;
    let lastShot = 0;
    let score = 0;

    const game = {
      width: 0,
      height: 0,
      running: true,
    };

    const player = {
      x: 0,
      y: 0,
      width: 42,
      height: 58,
      speed: 360,
    };

    let bullets = [];
    let stars = [];

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      game.width = rect.width;
      game.height = rect.height;

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      player.x = Math.max(
        player.width / 2,
        Math.min(game.width - player.width / 2, player.x || game.width / 2)
      );

      player.y = game.height - 100;

      stars = Array.from({ length: 100 }, () => ({
        x: Math.random() * game.width,
        y: Math.random() * game.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 45 + 20,
      }));
    }

    function drawPlayer() {
      ctx.save();
      ctx.translate(player.x, player.y);

      // Engine flame
      ctx.fillStyle = "#29d9ff";
      ctx.shadowColor = "#29d9ff";
      ctx.shadowBlur = 18;

      ctx.beginPath();
      ctx.moveTo(-9, 23);
      ctx.lineTo(0, 44 + Math.random() * 10);
      ctx.lineTo(9, 23);
      ctx.fill();

      // Wings
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#2876cc";

      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-24, 21);
      ctx.lineTo(-9, 15);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(24, 21);
      ctx.lineTo(9, 15);
      ctx.fill();

      // Main body
      ctx.fillStyle = "#dff8ff";
      ctx.shadowColor = "#46dfff";

      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(15, 20);
      ctx.lineTo(0, 14);
      ctx.lineTo(-15, 20);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = "#13dfff";
      ctx.beginPath();
      ctx.ellipse(0, -5, 5, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawBullets() {
      bullets.forEach((bullet) => {
        ctx.save();
        ctx.fillStyle = "#5dfcff";
        ctx.shadowColor = "#5dfcff";
        ctx.shadowBlur = 18;

        ctx.fillRect(bullet.x - 2, bullet.y, 4, 16);

        ctx.restore();
      });
    }

    function updateBullets(delta) {
      bullets.forEach((bullet) => {
        bullet.y -= 600 * delta;
      });

      bullets = bullets.filter((bullet) => bullet.y > -20);
    }

    function shoot(time) {
      if (controls.current.shoot && time - lastShot > 220) {
        bullets.push({
          x: player.x,
          y: player.y - 30,
        });

        lastShot = time;
      }
    }

    function updateStars(delta) {
      stars.forEach((star) => {
        star.y += star.speed * delta;

        if (star.y > game.height) {
          star.y = 0;
          star.x = Math.random() * game.width;
        }

        ctx.fillStyle = "rgba(210,235,255,0.8)";
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });
    }

    function draw(time) {
      if (!game.running) return;

      const delta = Math.min((time - lastTime) / 1000, 0.04);
      lastTime = time;

      ctx.clearRect(0, 0, game.width, game.height);

      updateStars(delta);

      // Player movement
      if (controls.current.left) {
        player.x -= player.speed * delta;
      }

      if (controls.current.right) {
        player.x += player.speed * delta;
      }

      player.x = Math.max(
        player.width / 2,
        Math.min(game.width - player.width / 2, player.x)
      );

      shoot(time);
      updateBullets(delta);

      drawBullets();
      drawPlayer();

      animationId = requestAnimationFrame(draw);
    }

    function handleKeyDown(event) {
      const key = event.key.toLowerCase();

      if (["arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
      }

      if (key === "arrowleft" || key === "a") {
        controls.current.left = true;
      }

      if (key === "arrowright" || key === "d") {
        controls.current.right = true;
      }

      if (key === " ") {
        controls.current.shoot = true;
      }
    }

    function handleKeyUp(event) {
      const key = event.key.toLowerCase();

      if (key === "arrowleft" || key === "a") {
        controls.current.left = false;
      }

      if (key === "arrowright" || key === "d") {
        controls.current.right = false;
      }

      if (key === " ") {
        controls.current.shoot = false;
      }
    }

    function stopControls() {
      controls.current.left = false;
      controls.current.right = false;
      controls.current.shoot = false;
    }

    resize();

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", stopControls);

    animationId = requestAnimationFrame(draw);

    return () => {
      game.running = false;
      cancelAnimationFrame(animationId);

      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", stopControls);
    };
  }, []);

  function hold(control, value) {
    controls.current[control] = value;
  }

  return (
    <div className="canvas-wrapper">
      <canvas ref={canvasRef} className="game-canvas" />

      <div className="touch-controls">
        <div className="movement-controls">
          <button
            onPointerDown={() => hold("left", true)}
            onPointerUp={() => hold("left", false)}
            onPointerLeave={() => hold("left", false)}
            onPointerCancel={() => hold("left", false)}
          >
            ◀
          </button>

          <button
            onPointerDown={() => hold("right", true)}
            onPointerUp={() => hold("right", false)}
            onPointerLeave={() => hold("right", false)}
            onPointerCancel={() => hold("right", false)}
          >
            ▶
          </button>
        </div>

        <button
          className="fire-button"
          onPointerDown={() => hold("shoot", true)}
          onPointerUp={() => hold("shoot", false)}
          onPointerLeave={() => hold("shoot", false)}
          onPointerCancel={() => hold("shoot", false)}
        >
          FIRE
        </button>
      </div>
    </div>
  );
}