import { generateRandomColor, hexToRgba } from './color.utils';

export function BackgroundCircleAnimation(canvas: HTMLCanvasElement) {
  /*--------------------
  Config
  --------------------*/
  const ctx = canvas.getContext('2d')!;
  let winW = canvas.width = window.innerWidth;
  let winH = canvas.height = window.innerHeight;
  let Circles: Circle[] = [];
  const maxCircles = 7;
  let isDragged = false;

  /*--------------------
    Coloring
    --------------------*/
  function rotateColor(position?: number) {
    const angle = 360 - position!;
    ctx.filter = `hue-rotate(${angle}deg)`;
  }

  /*--------------------
  Circle Class
  --------------------*/
  class Circle {
    radius: number;
    position: { x: number; y: number; };
    direction: { x: number; y: number; };
    activePos: { x: number; y: number; };
    color: CanvasGradient | null = null;
    colors: { color1: string; color2: string };

    constructor(options?: any) {

      Object.assign(this, options);

      this.radius = Math.trunc(100 + Math.random() * 200);
      this.position = {
        x: Math.random() * winW,
        y: Math.random() * winH
      };
      this.direction = {
        x: -1 + Math.random() * 2,
        y: -1 + Math.random() * 2
      };
      this.activePos = {
        x: this.position.x,
        y: this.position.y
      };
      this.colors = {
        color1: generateRandomColor('rgba', 0.85)!,
        color2: hexToRgba('#fff', 0)
      };

    }

    private generateColorBg(x: number, y: number, r: number, colors?: { color1: string; color2: string }) {
      const bg = ctx.createRadialGradient(x - r / 3, y - r / 7, 0, x, y, r);
      bg.addColorStop(0.5, colors?.color1!);
      bg.addColorStop(1, colors?.color2!);
      return bg;
    }

    public draw() {
      this.color = this.generateColorBg(this.activePos.x, this.activePos.y, this.radius, this.colors);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.activePos.x, this.activePos.y, this.radius, 0, 2 * Math.PI);
      ctx.globalCompositeOperation = 'lighten'; // 'source-over';
      ctx.fill();
    }

    public update() {
      this.activePos.x += this.direction.x;
      this.activePos.y += this.direction.y;
      if (this.activePos.x < 0 || this.activePos.x > winW) {
        this.direction.x *= -1;
      }
      if (this.activePos.y < 0 || this.activePos.y > winH) {
        this.direction.y *= -1;
      }
      rotateColor(this.activePos.y);
    }
  }

  /*--------------------
  Init
  --------------------*/
  function init() {
    winW = canvas.width;
    winH = canvas.height;

    Circles = [];
    for (let i = 0; i < maxCircles; i++) {
      Circles.push(new Circle());
    }
  }

  /*--------------------
  Animate
  --------------------*/
  function animate() {
    ctx.clearRect(0, 0, winW, winH);
    window.requestAnimationFrame(animate);
    Circles.forEach(circle => {
      circle.update();
      circle.draw();
    });
  }

  /*--------------------
    Event Listener
    --------------------*/
  window.addEventListener('touchstart', () => {
    isDragged = true;
  });

  window.addEventListener('touchmove', (e) => {
    if (isDragged) {
      let angle = 30;
      Circles.forEach((circle, i) => {
        if (i === 2 || i === 4 || i === 5 || i === 6) {
          circle.radius = Math.trunc(30 + Math.random() * 75);
          circle.activePos = {
            x: e.touches[0].clientX + 10,
            y: e.touches[0].clientY + 10
          };
        }
      });
      rotateColor(++angle);
    }
  });

  window.addEventListener('touchend', (e) => {
    if (isDragged) {
      Circles.forEach((circle, i) => {
        if (i === 2 || i === 4 || i === 5 || i === 6) {
          circle.activePos = {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY,
          };
          circle.radius = Math.trunc(100 + Math.random() * 200);
        }
        if (circle.activePos.x < 0 || circle.activePos.x > winW) {
          circle.direction.x *= -1;
        } else {
          circle.direction.x = - 1 + Math.random() * 2;
        }
        if (circle.activePos.y < 0 || circle.activePos.y > winH) {
          circle.direction.y *= -1;
        } else {
          circle.direction.y = -1 + Math.random() * 2;
        }
      });
      isDragged = false;
    }
  });

  window.addEventListener('resize', () => {
    init();
  });

  /*--------------------
    Execute
    --------------------*/
  init();
  animate();

}
