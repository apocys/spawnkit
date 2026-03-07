/**
 * office-worker/game-loop.js — requestAnimationFrame game loop
 * Ported from pixel-agents gameLoop.ts. Drives update + render at 60fps.
 */
(function () {
  'use strict';
  var MAX_DT = window.OfficeTypes.MAX_DELTA_TIME;

  /**
   * Start the game loop.
   * @param {HTMLCanvasElement} canvas
   * @param {{ update: function(number), render: function(CanvasRenderingContext2D) }} callbacks
   * @returns {function} stop function
   */
  function startGameLoop(canvas, callbacks) {
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    var lastTime = 0;
    var rafId = 0;
    var stopped = false;

    function frame(time) {
      if (stopped) return;
      var dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, MAX_DT);
      lastTime = time;

      callbacks.update(dt);

      ctx.imageSmoothingEnabled = false;
      callbacks.render(ctx);

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return function () {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
  }

  window.GameLoop = { start: startGameLoop };
})();
