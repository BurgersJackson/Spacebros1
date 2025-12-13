import pygame
import math
import random

# --- Configuration ---
WIDTH, HEIGHT = 1280, 720
FPS = 60
ZOOM = 0.6

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GREEN = (0, 255, 0)
RED = (255, 50, 50)
CYAN = (0, 255, 255)
YELLOW = (255, 255, 0)
MAGENTA = (255, 0, 255)
DARK_GREEN = (0, 100, 0)
DARK_GREY = (40, 40, 40)
COLOR_ENEMY = RED
COLOR_PLAYER = CYAN

# --- Upgrade Data ---
UPGRADE_DATA = [
    {"id": "turret_damage", "name": "Turret Damage", "tiers": ["+20% Dmg", "+40% Total", "+70% Total"]},
    {"id": "turret_fire_rate", "name": "Fire Rate", "tiers": ["+15% Speed", "+30% Total", "+50% Total"]},
    {"id": "multi_shot", "name": "Multi-Shot", "tiers": ["Double Shot", "Triple Shot", "Quad Shot"]},
    {"id": "hull_strength", "name": "Hull Strength", "tiers": ["+25 HP", "+50 HP", "+75 HP"]},
    {"id": "speed", "name": "Engine Speed", "tiers": ["+15% Speed", "+30% Speed", "+50% Speed"]},
    {"id": "xp_magnet", "name": "XP Magnet", "tiers": ["2x Range", "4x Range", "8x Range"]},
    {"id": "shield_regen", "name": "Shield Regen", "tiers": ["Slow Regen", "Medium Regen", "Fast Regen"]},
]

# --- Helper Functions ---
def draw_text(surface, text, size, x, y, color=WHITE, align="center"):
    font = pygame.font.SysFont("Courier New", size, bold=True)
    text_surface = font.render(text, True, color)
    rect = text_surface.get_rect()
    if align == "center":
        rect.center = (x, y)
    elif align == "left":
        rect.topleft = (x, y)
    elif align == "right":
        rect.topright = (x, y)
    surface.blit(text_surface, rect)

def world_to_screen(pos, camera_pos):
    # Transform world coordinates to screen coordinates based on camera and zoom
    screen_x = (pos.x - camera_pos.x) * ZOOM + WIDTH / 2
    screen_y = (pos.y - camera_pos.y) * ZOOM + HEIGHT / 2
    return int(screen_x), int(screen_y)

# --- Game Classes ---

class Entity:
    def __init__(self, x, y, radius=10):
        self.pos = pygame.math.Vector2(x, y)
        self.vel = pygame.math.Vector2(0, 0)
        self.radius = radius
        self.angle = 0
        self.dead = False
        self.color = WHITE

    def update(self):
        self.pos += self.vel

    def draw(self, surface, camera_pos):
        # Basic draw implementation, overridden by subclasses
        center = world_to_screen(self.pos, camera_pos)
        pygame.draw.circle(surface, self.color, center, int(self.radius * ZOOM))

class Particle(Entity):
    def __init__(self, x, y, color, life=30):
        super().__init__(x, y, 2)
        self.vel = pygame.math.Vector2(random.uniform(-2, 2), random.uniform(-2, 2))
        self.life = life
        self.max_life = life
        self.color = color

    def update(self):
        super().update()
        self.life -= 1
        if self.life <= 0:
            self.dead = True

    def draw(self, surface, camera_pos):
        if self.dead: return
        center = world_to_screen(self.pos, camera_pos)
        alpha = int((self.life / self.max_life) * 255)
        # Pygame doesn't support alpha on direct draw calls easily without a surface
        # We'll just draw small rects
        if 0 <= center[0] <= WIDTH and 0 <= center[1] <= HEIGHT:
            pygame.draw.circle(surface, self.color, center, 2)

class Coin(Entity):
    def __init__(self, x, y, value):
        super().__init__(x, y, 8)
        self.value = value
        self.magnetized = False
        self.color = YELLOW if value < 5 else MAGENTA

    def update(self, player):
        dist = self.pos.distance_to(player.pos)
        if dist < player.magnet_radius:
            self.magnetized = True
        
        if self.magnetized:
            direction = (player.pos - self.pos)
            if direction.length() > 0:
                direction = direction.normalize()
            speed = 12 + (1000 / max(10, dist))
            self.vel = direction * speed
        else:
            self.vel *= 0.95
        
        super().update()

    def draw(self, surface, camera_pos):
        center = world_to_screen(self.pos, camera_pos)
        # Draw a diamond shape
        r = self.radius * ZOOM
        points = [
            (center[0], center[1] - r),
            (center[0] + r, center[1]),
            (center[0], center[1] + r),
            (center[0] - r, center[1])
        ]
        pygame.draw.polygon(surface, self.color, points)
        pygame.draw.polygon(surface, WHITE, points, 1)

class Bullet(Entity):
    def __init__(self, x, y, angle, is_enemy, damage=1):
        super().__init__(x, y, 4)
        self.angle = angle
        speed = 15 if not is_enemy else 10
        self.vel = pygame.math.Vector2(math.cos(angle), math.sin(angle)) * speed
        self.is_enemy = is_enemy
        self.damage = damage
        self.life = 100
        self.color = COLOR_ENEMY if is_enemy else COLOR_PLAYER

    def update(self):
        super().update()
        self.life -= 1
        if self.life <= 0:
            self.dead = True

class Asteroid(Entity):
    def __init__(self, x, y, radius):
        super().__init__(x, y, radius)
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(0.1, 0.5)
        self.vel = pygame.math.Vector2(math.cos(angle), math.sin(angle)) * speed
        self.vertices = []
        points = random.randint(8, 14)
        for i in range(points):
            a = (i / points) * math.pi * 2
            r = radius * random.uniform(0.8, 1.2)
            self.vertices.append((math.cos(a) * r, math.sin(a) * r))

    def draw(self, surface, camera_pos):
        center = world_to_screen(self.pos, camera_pos)
        # Check if on screen
        if not (-self.radius*ZOOM < center[0] < WIDTH + self.radius*ZOOM and 
                -self.radius*ZOOM < center[1] < HEIGHT + self.radius*ZOOM):
            return

        screen_verts = []
        for vx, vy in self.vertices:
            sx = center[0] + vx * ZOOM
            sy = center[1] + vy * ZOOM
            screen_verts.append((sx, sy))
        
        pygame.draw.polygon(surface, DARK_GREEN, screen_verts, 2)

class Enemy(Entity):
    def __init__(self, x, y, type='roamer'):
        super().__init__(x, y, 20)
        self.type = type
        self.hp = 2
        self.max_hp = 2
        self.shoot_timer = random.randint(60, 120)
        self.speed = 3.0
        
        if type == 'elite':
            self.hp = 8
            self.max_hp = 8
            self.radius = 25
            self.color = MAGENTA
        elif type == 'hunter':
            self.hp = 5
            self.max_hp = 5
            self.speed = 4.5
            self.color = RED
        else:
            self.color = RED

    def update(self, player, bullets_list):
        if self.dead: return
        
        dist = self.pos.distance_to(player.pos)
        
        # AI Movement
        desired_vel = pygame.math.Vector2(0, 0)
        if dist < 800:
            if self.type == 'roamer':
                if dist > 400:
                    desired_vel = (player.pos - self.pos).normalize() * self.speed
                else:
                    # Orbit
                    angle = math.atan2(player.pos.y - self.pos.y, player.pos.x - self.pos.x) + 0.05
                    desired_vel = pygame.math.Vector2(math.cos(angle), math.sin(angle)) * self.speed
            elif self.type == 'hunter':
                desired_vel = (player.pos - self.pos).normalize() * self.speed
            elif self.type == 'elite':
                if dist < 300: # Retreat
                    desired_vel = (self.pos - player.pos).normalize() * self.speed
                else:
                    desired_vel = (player.pos - self.pos).normalize() * self.speed

        # Soft collision avoidance (separation)
        self.vel = self.vel * 0.95 + desired_vel * 0.05
        self.pos += self.vel
        self.angle = math.atan2(player.pos.y - self.pos.y, player.pos.x - self.pos.x)

        # Shooting
        if dist < 600:
            self.shoot_timer -= 1
            if self.shoot_timer <= 0:
                self.shoot_timer = 120 if self.type == 'roamer' else 60
                bullets_list.append(Bullet(self.pos.x, self.pos.y, self.angle, True))
                if self.type == 'elite':
                    bullets_list.append(Bullet(self.pos.x, self.pos.y, self.angle + 0.2, True))
                    bullets_list.append(Bullet(self.pos.x, self.pos.y, self.angle - 0.2, True))

    def draw(self, surface, camera_pos):
        center = world_to_screen(self.pos, camera_pos)
        if not (0 <= center[0] <= WIDTH and 0 <= center[1] <= HEIGHT): return

        # Draw Triangle Ship
        angle = self.angle
        tip = (center[0] + math.cos(angle) * self.radius * ZOOM, center[1] + math.sin(angle) * self.radius * ZOOM)
        left = (center[0] + math.cos(angle + 2.5) * self.radius * ZOOM, center[1] + math.sin(angle + 2.5) * self.radius * ZOOM)
        right = (center[0] + math.cos(angle - 2.5) * self.radius * ZOOM, center[1] + math.sin(angle - 2.5) * self.radius * ZOOM)
        
        pygame.draw.polygon(surface, self.color, [tip, left, right])
        pygame.draw.polygon(surface, WHITE, [tip, left, right], 1)

        # Health bar
        if self.hp < self.max_hp:
            bar_w = 40
            bar_h = 4
            pct = self.hp / self.max_hp
            pygame.draw.rect(surface, RED, (center[0] - bar_w/2, center[1] - 30, bar_w, bar_h))
            pygame.draw.rect(surface, GREEN, (center[0] - bar_w/2, center[1] - 30, bar_w * pct, bar_h))

class Player(Entity):
    def __init__(self):
        super().__init__(0, 0, 25)
        self.angle = -math.pi / 2
        self.max_hp = 100
        self.hp = self.max_hp
        self.xp = 0
        self.level = 1
        self.next_level_xp = 100
        self.magnet_radius = 150
        
        # Stats
        self.speed_mult = 1.0
        self.damage_mult = 1.0
        self.fire_rate_mult = 1.0
        self.multi_shot = 1
        self.shield_regen = 0
        
        self.fire_delay = 0
        self.inventory = {} # Stores upgrade tiers

    def update(self, keys, mouse_pos, camera_pos):
        # Rotation
        mouse_world_x = (mouse_pos[0] - WIDTH/2) / ZOOM + camera_pos.x
        mouse_world_y = (mouse_pos[1] - HEIGHT/2) / ZOOM + camera_pos.y
        self.angle = math.atan2(mouse_world_y - self.pos.y, mouse_world_x - self.pos.x)

        # Movement
        thrust = 0.2 * self.speed_mult
        accel = pygame.math.Vector2(0, 0)
        if keys[pygame.K_w]:
            accel.y -= thrust
        if keys[pygame.K_s]:
            accel.y += thrust
        if keys[pygame.K_a]:
            accel.x -= thrust
        if keys[pygame.K_d]:
            accel.x += thrust
        
        self.vel += accel
        self.vel *= 0.98 # Friction
        self.pos += self.vel

        # Cooldowns
        if self.fire_delay > 0:
            self.fire_delay -= 1
            
        # Passive Regen
        if self.shield_regen > 0 and self.hp < self.max_hp:
            if random.random() < (0.001 * self.shield_regen):
                self.hp += 1

    def shoot(self, bullets_list):
        if self.fire_delay <= 0:
            damage = 2 * self.damage_mult
            base_delay = 15 / self.fire_rate_mult
            self.fire_delay = base_delay
            
            # Multi-shot logic
            shots = self.multi_shot
            spread = 0.1
            start_angle = self.angle - (spread * (shots-1))/2
            
            for i in range(shots):
                a = start_angle + i * spread
                # Offset spawn slightly
                bx = self.pos.x + math.cos(a) * 20
                by = self.pos.y + math.sin(a) * 20
                bullets_list.append(Bullet(bx, by, a, False, damage))

    def draw(self, surface, camera_pos):
        center = world_to_screen(self.pos, camera_pos)
        
        # Draw Ship
        angle = self.angle
        tip = (center[0] + math.cos(angle) * 30 * ZOOM, center[1] + math.sin(angle) * 30 * ZOOM)
        left = (center[0] + math.cos(angle + 2.3) * 25 * ZOOM, center[1] + math.sin(angle + 2.3) * 25 * ZOOM)
        right = (center[0] + math.cos(angle - 2.3) * 25 * ZOOM, center[1] + math.sin(angle - 2.3) * 25 * ZOOM)
        back = (center[0] + math.cos(angle + math.pi) * 10 * ZOOM, center[1] + math.sin(angle + math.pi) * 10 * ZOOM)

        pygame.draw.polygon(surface, DARK_GREY, [tip, left, back, right])
        pygame.draw.polygon(surface, CYAN, [tip, left, back, right], 2)
        
        # Engine flame if moving
        if self.vel.length() > 0.5:
            flame_tip = (center[0] + math.cos(angle + math.pi) * (20 + random.randint(0, 10)) * ZOOM, 
                         center[1] + math.sin(angle + math.pi) * (20 + random.randint(0, 10)) * ZOOM)
            pygame.draw.line(surface, CYAN, back, flame_tip, 4)

    def add_xp(self, amount):
        self.xp += amount
        if self.xp >= self.next_level_xp:
            self.xp -= self.next_level_xp
            self.level += 1
            self.next_level_xp = int(self.next_level_xp * 1.2)
            return True # Level Up
        return False

    def apply_upgrade(self, upgrade_id):
        current_tier = self.inventory.get(upgrade_id, 0)
        self.inventory[upgrade_id] = current_tier + 1
        
        if upgrade_id == "turret_damage":
            self.damage_mult += 0.2
        elif upgrade_id == "turret_fire_rate":
            self.fire_rate_mult += 0.15
        elif upgrade_id == "multi_shot":
            self.multi_shot += 1
        elif upgrade_id == "hull_strength":
            self.max_hp += 25
            self.hp += 25
        elif upgrade_id == "speed":
            self.speed_mult += 0.15
        elif upgrade_id == "xp_magnet":
            self.magnet_radius *= 2
        elif upgrade_id == "shield_regen":
            self.shield_regen += 1

# --- Main Game Class ---

class Game:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Neon Space Python")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("Courier New", 20)
        
        self.reset_game()
        self.state = "MENU" # MENU, PLAYING, PAUSED, LEVEL_UP, GAME_OVER
        self.upgrade_choices = []

    def reset_game(self):
        self.player = Player()
        self.bullets = []
        self.enemies = []
        self.asteroids = []
        self.particles = []
        self.coins = []
        self.camera_pos = pygame.math.Vector2(0, 0)
        self.score = 0
        
        # Generate initial map
        for _ in range(50):
            self.spawn_asteroid(random_pos=True)
        
        for _ in range(5):
            self.spawn_enemy(random_pos=True)

    def spawn_asteroid(self, random_pos=False):
        if random_pos:
            x = random.uniform(-2000, 2000)
            y = random.uniform(-2000, 2000)
        else:
            # Spawn relative to player
            angle = random.uniform(0, math.pi * 2)
            dist = random.uniform(1000, 2000)
            x = self.player.pos.x + math.cos(angle) * dist
            y = self.player.pos.y + math.sin(angle) * dist
        
        radius = random.randint(30, 80)
        self.asteroids.append(Asteroid(x, y, radius))

    def spawn_enemy(self, random_pos=False):
        if random_pos:
            x = random.uniform(-2000, 2000)
            y = random.uniform(-2000, 2000)
        else:
            angle = random.uniform(0, math.pi * 2)
            dist = random.uniform(1000, 1500)
            x = self.player.pos.x + math.cos(angle) * dist
            y = self.player.pos.y + math.sin(angle) * dist
            
        # Difficulty scaling
        roll = random.random()
        etype = 'roamer'
        if self.player.level > 3 and roll < 0.3: etype = 'elite'
        if self.player.level > 5 and roll < 0.1: etype = 'hunter'
        
        self.enemies.append(Enemy(x, y, etype))

    def spawn_particles(self, x, y, color, count=10):
        for _ in range(count):
            self.particles.append(Particle(x, y, color))

    def handle_input(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    if self.state == "PLAYING":
                        self.state = "PAUSED"
                    elif self.state == "PAUSED":
                        self.state = "PLAYING"
                
                if self.state == "MENU" or self.state == "GAME_OVER":
                    if event.key == pygame.K_RETURN:
                        self.reset_game()
                        self.state = "PLAYING"

            if event.type == pygame.MOUSEBUTTONDOWN:
                if self.state == "PLAYING":
                    if event.button == 1: # Left click
                        self.player.shoot(self.bullets)
                elif self.state == "LEVEL_UP":
                    if event.button == 1:
                        mx, my = pygame.mouse.get_pos()
                        # Check card clicks
                        start_x = WIDTH // 2 - 320
                        for i, upgrade in enumerate(self.upgrade_choices):
                            rect = pygame.Rect(start_x + i * 220, HEIGHT // 2 - 150, 200, 300)
                            if rect.collidepoint(mx, my):
                                self.player.apply_upgrade(upgrade['id'])
                                self.state = "PLAYING"
                                break

        return True

    def update(self):
        if self.state != "PLAYING": return

        keys = pygame.key.get_pressed()
        mouse_pos = pygame.mouse.get_pos()
        
        self.player.update(keys, mouse_pos, self.camera_pos)
        
        # Camera follow with smooth lerp
        target_cam_x = self.player.pos.x
        target_cam_y = self.player.pos.y
        self.camera_pos.x += (target_cam_x - self.camera_pos.x) * 0.1
        self.camera_pos.y += (target_cam_y - self.camera_pos.y) * 0.1

        # Update Entities
        for b in self.bullets: b.update()
        for e in self.enemies: e.update(self.player, self.bullets)
        for a in self.asteroids: a.update()
        for p in self.particles: p.update()
        for c in self.coins: c.update(self.player)

        # Cleanup dead entities
        self.bullets = [b for b in self.bullets if not b.dead]
        self.enemies = [e for e in self.enemies if not e.dead]
        self.particles = [p for p in self.particles if not p.dead]
        self.coins = [c for c in self.coins if not c.magnetized or c.pos.distance_to(self.player.pos) > 20]

        # Spawning logic
        if len(self.asteroids) < 50:
            self.spawn_asteroid()
        if len(self.enemies) < 5 + self.player.level:
            if random.random() < 0.02:
                self.spawn_enemy()

        # Collisions
        self.check_collisions()

    def check_collisions(self):
        # Bullet vs Enemies/Asteroids
        for b in self.bullets:
            if b.dead: continue
            
            # Vs Asteroids
            for a in self.asteroids:
                if b.pos.distance_to(a.pos) < a.radius + b.radius:
                    b.dead = True
                    self.spawn_particles(b.pos.x, b.pos.y, WHITE, 5)
                    break
            
            if b.dead: continue

            if not b.is_enemy:
                # Vs Enemies
                for e in self.enemies:
                    if b.pos.distance_to(e.pos) < e.radius + b.radius:
                        b.dead = True
                        e.hp -= b.damage
                        self.spawn_particles(b.pos.x, b.pos.y, RED, 5)
                        if e.hp <= 0:
                            e.dead = True
                            self.score += 100
                            self.spawn_particles(e.pos.x, e.pos.y, RED, 15)
                            # Drop coins
                            val = 1
                            if e.type == 'elite': val = 5
                            if e.type == 'hunter': val = 3
                            for _ in range(val):
                                self.coins.append(Coin(e.pos.x + random.randint(-10,10), e.pos.y + random.randint(-10,10), 1))
                        break
            else:
                # Vs Player
                if b.pos.distance_to(self.player.pos) < self.player.radius + b.radius:
                    b.dead = True
                    self.player.hp -= b.damage
                    self.spawn_particles(self.player.pos.x, self.player.pos.y, CYAN, 5)
                    if self.player.hp <= 0:
                        self.state = "GAME_OVER"

        # Player vs Coins
        for c in self.coins:
            if c.pos.distance_to(self.player.pos) < self.player.radius + c.radius:
                # Collected
                # We handle removal in update loop cleanup, just add logic here
                # Actually, cleanup removes if close, so we just add stats here
                # But update loop removes if magnetized and close.
                # Let's force remove here to be safe or rely on distance check in cleanup
                pass 
        
        # Re-iterate for collection logic to be precise
        for i in range(len(self.coins)-1, -1, -1):
            c = self.coins[i]
            if c.pos.distance_to(self.player.pos) < self.player.radius + c.radius:
                self.score += c.value * 10
                if self.player.add_xp(c.value):
                    self.trigger_level_up()
                self.coins.pop(i)

        # Player vs Asteroids (Bump)
        for a in self.asteroids:
            dist = self.player.pos.distance_to(a.pos)
            min_dist = self.player.radius + a.radius
            if dist < min_dist:
                push = (self.player.pos - a.pos).normalize() * (min_dist - dist)
                self.player.pos += push
                self.player.vel *= 0.5
                self.player.hp -= 1
                if self.player.hp <= 0: self.state = "GAME_OVER"

    def trigger_level_up(self):
        self.state = "LEVEL_UP"
        # Pick 3 random upgrades
        available = [u for u in UPGRADE_DATA if self.player.inventory.get(u['id'], 0) < 3]
        if len(available) > 3:
            self.upgrade_choices = random.sample(available, 3)
        else:
            self.upgrade_choices = available

    def draw(self):
        self.screen.fill(BLACK)

        # Draw Starfield (Parallax)
        for i in range(100):
            # Deterministic stars based on index
            sx = (i * 137) % WIDTH
            sy = (i * 243) % HEIGHT
            # Apply parallax
            px = (sx - self.camera_pos.x * 0.2) % WIDTH
            py = (sy - self.camera_pos.y * 0.2) % HEIGHT
            self.screen.set_at((int(px), int(py)), (100, 100, 100))

        if self.state == "MENU":
            draw_text(self.screen, "NEON SPACE", 80, WIDTH//2, HEIGHT//2 - 50, CYAN)
            draw_text(self.screen, "Press ENTER to Start", 30, WIDTH//2, HEIGHT//2 + 50, WHITE)
            draw_text(self.screen, "WASD to Move, Mouse to Aim/Shoot", 20, WIDTH//2, HEIGHT//2 + 100, GREEN)
        
        elif self.state == "PLAYING" or self.state == "PAUSED" or self.state == "LEVEL_UP" or self.state == "GAME_OVER":
            # Draw World
            for a in self.asteroids: a.draw(self.screen, self.camera_pos)
            for c in self.coins: c.draw(self.screen, self.camera_pos)
            for p in self.particles: p.draw(self.screen, self.camera_pos)
            for e in self.enemies: e.draw(self.screen, self.camera_pos)
            self.player.draw(self.screen, self.camera_pos)
            for b in self.bullets: b.draw(self.screen, self.camera_pos)

            # HUD
            # Health Bar
            pygame.draw.rect(self.screen, DARK_GREY, (20, 20, 200, 20))
            hp_pct = max(0, self.player.hp / self.player.max_hp)
            pygame.draw.rect(self.screen, GREEN if hp_pct > 0.3 else RED, (20, 20, 200 * hp_pct, 20))
            pygame.draw.rect(self.screen, WHITE, (20, 20, 200, 20), 2)
            draw_text(self.screen, f"HP: {int(self.player.hp)}", 16, 120, 30, WHITE)

            # XP Bar
            pygame.draw.rect(self.screen, DARK_GREY, (0, 0, WIDTH, 5))
            xp_pct = self.player.xp / self.player.next_level_xp
            pygame.draw.rect(self.screen, YELLOW, (0, 0, WIDTH * xp_pct, 5))

            # Score & Level
            draw_text(self.screen, f"SCORE: {self.score}", 24, 20, 60, WHITE, align="left")
            draw_text(self.screen, f"LVL: {self.player.level}", 24, WIDTH - 20, 60, WHITE, align="right")

            # Minimap
            map_size = 150
            map_x = WIDTH - map_size - 20
            map_y = HEIGHT - map_size - 20
            pygame.draw.rect(self.screen, (0, 20, 0), (map_x, map_y, map_size, map_size))
            pygame.draw.rect(self.screen, GREEN, (map_x, map_y, map_size, map_size), 2)
            
            # Minimap dots
            map_scale = map_size / 4000 # Radar range
            
            def draw_on_map(pos, color):
                dx = (pos.x - self.player.pos.x) * map_scale
                dy = (pos.y - self.player.pos.y) * map_scale
                if abs(dx) < map_size/2 and abs(dy) < map_size/2:
                    pygame.draw.circle(self.screen, color, (int(map_x + map_size/2 + dx), int(map_y + map_size/2 + dy)), 2)

            draw_on_map(self.player.pos, CYAN)
            for e in self.enemies: draw_on_map(e.pos, RED)
            for a in self.asteroids: draw_on_map(a.pos, DARK_GREEN)
            for c in self.coins: draw_on_map(c.pos, YELLOW)

            if self.state == "PAUSED":
                s = pygame.Surface((WIDTH, HEIGHT))
                s.set_alpha(128)
                s.fill(BLACK)
                self.screen.blit(s, (0,0))
                draw_text(self.screen, "PAUSED", 60, WIDTH//2, HEIGHT//2, WHITE)

            if self.state == "GAME_OVER":
                s = pygame.Surface((WIDTH, HEIGHT))
                s.set_alpha(200)
                s.fill((50, 0, 0))
                self.screen.blit(s, (0,0))
                draw_text(self.screen, "SYSTEM FAILURE", 80, WIDTH//2, HEIGHT//2 - 50, RED)
                draw_text(self.screen, f"Final Score: {self.score}", 40, WIDTH//2, HEIGHT//2 + 20, WHITE)
                draw_text(self.screen, "Press ENTER to Reboot", 30, WIDTH//2, HEIGHT//2 + 80, WHITE)

            if self.state == "LEVEL_UP":
                s = pygame.Surface((WIDTH, HEIGHT))
                s.set_alpha(220)
                s.fill((0, 20, 0))
                self.screen.blit(s, (0,0))
                draw_text(self.screen, "SYSTEM UPGRADE", 60, WIDTH//2, 100, GREEN)
                
                start_x = WIDTH // 2 - 320
                mx, my = pygame.mouse.get_pos()
                
                for i, upgrade in enumerate(self.upgrade_choices):
                    x = start_x + i * 220
                    y = HEIGHT // 2 - 150
                    w, h = 200, 300
                    
                    rect = pygame.Rect(x, y, w, h)
                    color = (0, 60, 0)
                    border = GREEN
                    
                    if rect.collidepoint(mx, my):
                        color = (0, 100, 0)
                        border = YELLOW
                        
                    pygame.draw.rect(self.screen, color, rect)
                    pygame.draw.rect(self.screen, border, rect, 3)
                    
                    draw_text(self.screen, upgrade['name'], 20, x + w//2, y + 30, border)
                    
                    tier = self.player.inventory.get(upgrade['id'], 0)
                    if tier < 3:
                        desc = upgrade['tiers'][tier]
                        draw_text(self.screen, desc, 18, x + w//2, y + 100, WHITE)
                        draw_text(self.screen, f"Tier {tier+1}", 16, x + w//2, y + 250, CYAN)

        pygame.display.flip()

    def run(self):
        running = True
        while running:
            self.clock.tick(FPS)
            running = self.handle_input()
            self.update()
            self.draw()
        pygame.quit()

if __name__ == "__main__":
    game = Game()
    game.run()