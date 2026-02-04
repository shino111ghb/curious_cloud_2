/**
 * 物理シミュレーションエンジン（軽量版）
 * カード同士の衝突と反発を処理
 * オンデマンド方式：動きがある時だけ処理
 */

class PhysicsSimulation {
  constructor(containerWidth, containerHeight) {
    this.containerWidth = containerWidth;
    this.containerHeight = containerHeight;
    this.bodies = [];
    this.running = false;
    this.animationId = null;
    this.lastTime = 0;
    this.activeCount = 0;  // 動いているボディの数

    // 物理パラメータ
    this.friction = 0.90;
    this.repulsionStrength = 600;
    this.maxSpeed = 350;
    this.minSpeedThreshold = 1;
  }

  addBody(element, x, y, radius) {
    const body = {
      element,
      x,
      y,
      vx: 0,
      vy: 0,
      radius,
      isDragging: false,
      isActive: false
    };
    this.bodies.push(body);
    return body;
  }

  removeBody(element) {
    const index = this.bodies.findIndex(b => b.element === element);
    if (index !== -1) {
      this.bodies.splice(index, 1);
    }
  }

  clear() {
    this._stopLoop();
    this.bodies = [];
    this.activeCount = 0;
  }

  updateContainerSize(width, height) {
    this.containerWidth = width;
    this.containerHeight = height;
  }

  /**
   * ボディに速度を設定してシミュレーション開始
   */
  setVelocity(element, vx, vy) {
    const body = this.bodies.find(b => b.element === element);
    if (body) {
      body.vx = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, vx));
      body.vy = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, vy));
      this._activateBody(body);
      this._startLoop();
    }
  }

  setPosition(element, x, y) {
    const body = this.bodies.find(b => b.element === element);
    if (body) {
      body.x = x;
      body.y = y;
      // ドラッグ中なら周囲のボディをチェック
      if (body.isDragging) {
        this._checkCollisionsFor(body);
      }
    }
  }

  setDragging(element, isDragging) {
    const body = this.bodies.find(b => b.element === element);
    if (body) {
      body.isDragging = isDragging;
      if (isDragging) {
        body.vx = 0;
        body.vy = 0;
      }
    }
  }

  _activateBody(body) {
    if (!body.isActive) {
      body.isActive = true;
      body.element.classList.add('physics-active');
      this.activeCount++;
    }
  }

  _deactivateBody(body) {
    if (body.isActive) {
      body.isActive = false;
      body.element.classList.remove('physics-active');
      this.activeCount--;
    }
  }

  /**
   * ドラッグ中のボディとの衝突チェック
   */
  _checkCollisionsFor(draggedBody) {
    for (const body of this.bodies) {
      if (body === draggedBody || body.isDragging) continue;

      const dx = body.x - draggedBody.x;
      const dy = body.y - draggedBody.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = body.radius + draggedBody.radius + 5;

      if (distance < minDistance && distance > 0) {
        // 衝突！押し出す
        const overlap = minDistance - distance;
        const nx = dx / distance;
        const ny = dy / distance;
        const pushForce = overlap * 8;

        body.vx += nx * pushForce;
        body.vy += ny * pushForce;
        this._activateBody(body);
        this._startLoop();
      }
    }
  }

  _startLoop() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this._loop();
  }

  _stopLoop() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  _loop() {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this._update(dt);

    // アクティブなボディがなければループ停止
    if (this.activeCount === 0) {
      this._stopLoop();
      return;
    }

    this.animationId = requestAnimationFrame(() => this._loop());
  }

  _update(dt) {
    // アクティブなボディ同士の衝突
    this._applyRepulsion();

    for (const body of this.bodies) {
      if (!body.isActive || body.isDragging) continue;

      // 壁との反発
      this._applyBoundaryFor(body);

      // 速度を位置に適用
      body.x += body.vx * dt;
      body.y += body.vy * dt;

      // 摩擦
      body.vx *= this.friction;
      body.vy *= this.friction;

      // 速度が小さければ停止
      const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
      if (speed < this.minSpeedThreshold) {
        body.vx = 0;
        body.vy = 0;
        this._deactivateBody(body);
      }

      // DOM更新
      const left = body.x - body.radius;
      const top = body.y - body.radius;
      body.element.style.left = `${left}px`;
      body.element.style.top = `${top}px`;
    }
  }

  _applyRepulsion() {
    const activeBodies = this.bodies.filter(b => b.isActive && !b.isDragging);

    for (let i = 0; i < activeBodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const a = activeBodies[i];
        const b = this.bodies[j];
        if (b.isDragging) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = a.radius + b.radius + 5;

        if (distance < minDistance && distance > 0) {
          const overlap = minDistance - distance;
          const force = overlap * 5;
          const nx = dx / distance;
          const ny = dy / distance;

          a.vx -= nx * force;
          a.vy -= ny * force;
          b.vx += nx * force;
          b.vy += ny * force;
          this._activateBody(b);
        }
      }
    }
  }

  _applyBoundaryFor(body) {
    const padding = 20;
    const bounce = 0.5;

    if (body.x - body.radius < padding) {
      body.x = padding + body.radius;
      body.vx = Math.abs(body.vx) * bounce;
    }
    if (body.x + body.radius > this.containerWidth - padding) {
      body.x = this.containerWidth - padding - body.radius;
      body.vx = -Math.abs(body.vx) * bounce;
    }
    if (body.y - body.radius < padding) {
      body.y = padding + body.radius;
      body.vy = Math.abs(body.vy) * bounce;
    }
    if (body.y + body.radius > this.containerHeight - padding) {
      body.y = this.containerHeight - padding - body.radius;
      body.vy = -Math.abs(body.vy) * bounce;
    }
  }

  getBody(element) {
    return this.bodies.find(b => b.element === element);
  }

  // 互換性のため
  start() {}
  stop() { this._stopLoop(); }
}

window.PhysicsSimulation = PhysicsSimulation;
