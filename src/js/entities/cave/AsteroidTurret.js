import { SIM_STEP_MS } from '../../core/constants.js';
import { CaveWallTurret } from './CaveWallTurret.js';

export class AsteroidTurret extends CaveWallTurret {
    constructor(asteroid, offset, mode, opts) {
        super(asteroid.pos.x + offset.x, asteroid.pos.y + offset.y, mode, opts);
        this.asteroid = asteroid;
        this.offset = offset;
        this.radius = 49; // 25% smaller than 66
    }

    update(deltaTime = SIM_STEP_MS) {
        if (this.dead || !this.asteroid || this.asteroid.dead) {
            this.dead = true;
            return;
        }
        // Follow asteroid position and rotation
        const cos = Math.cos(this.asteroid.angle);
        const sin = Math.sin(this.asteroid.angle);
        this.pos.x = this.asteroid.pos.x + cos * this.offset.x - sin * this.offset.y;
        this.pos.y = this.asteroid.pos.y + sin * this.offset.x + cos * this.offset.y;

        // Call parent update for turret targeting logic
        super.update(deltaTime);
    }
}
