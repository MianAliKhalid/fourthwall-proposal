'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
}

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

interface Paddle {
  x: number
  width: number
  height: number
}

interface Brick {
  x: number
  y: number
  width: number
  height: number
  color: string
  hits: number
  maxHits: number
}

const COLORS = ['#7c3aed', '#8b5cf6', '#a78bfa', '#6d28d9', '#5b21b6', '#4c1d95']
const CANVAS_WIDTH = 480
const CANVAS_HEIGHT = 640

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [lives, setLives] = useState(3)
  const gameRef = useRef<{
    ball: Ball
    paddle: Paddle
    bricks: Brick[]
    particles: Particle[]
    animId: number
    score: number
    lives: number
    mouseX: number
  }>({
    ball: { x: 240, y: 500, vx: 3, vy: -4, radius: 6 },
    paddle: { x: 200, width: 80, height: 12 },
    bricks: [],
    particles: [],
    animId: 0,
    score: 0,
    lives: 3,
    mouseX: 240,
  })

  const createBricks = useCallback((): Brick[] => {
    const bricks: Brick[] = []
    const rows = 6
    const cols = 8
    const brickW = 50
    const brickH = 20
    const padding = 4
    const offsetX = (CANVAS_WIDTH - cols * (brickW + padding)) / 2
    const offsetY = 60

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const maxHits = r < 2 ? 2 : 1
        bricks.push({
          x: offsetX + c * (brickW + padding),
          y: offsetY + r * (brickH + padding),
          width: brickW,
          height: brickH,
          color: COLORS[r % COLORS.length],
          hits: 0,
          maxHits,
        })
      }
    }
    return bricks
  }, [])

  const spawnParticles = useCallback((x: number, y: number, color: string) => {
    const g = gameRef.current
    for (let i = 0; i < 6; i++) {
      g.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        size: Math.random() * 3 + 1,
        color,
        life: 1,
      })
    }
  }, [])

  const startGame = useCallback(() => {
    const g = gameRef.current
    g.ball = { x: 240, y: 500, vx: 3 * (Math.random() > 0.5 ? 1 : -1), vy: -4, radius: 6 }
    g.paddle = { x: 200, width: 80, height: 12 }
    g.bricks = createBricks()
    g.particles = []
    g.score = 0
    g.lives = 3
    setScore(0)
    setLives(3)
    setGameState('playing')
  }, [createBricks])

  const resetBall = useCallback(() => {
    const g = gameRef.current
    g.ball = { x: g.paddle.x + g.paddle.width / 2, y: 500, vx: 3 * (Math.random() > 0.5 ? 1 : -1), vy: -4, radius: 6 }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('breakout_high')
    if (saved) setHighScore(parseInt(saved, 10))
  }, [])

  useEffect(() => {
    if (gameState !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const g = gameRef.current

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      g.mouseX = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      g.mouseX = ((e.touches[0].clientX - rect.left) / rect.width) * CANVAS_WIDTH
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })

    function gameLoop() {
      const g = gameRef.current
      const ball = g.ball
      const paddle = g.paddle

      // Move paddle toward mouse
      const targetX = g.mouseX - paddle.width / 2
      paddle.x += (targetX - paddle.x) * 0.15
      paddle.x = Math.max(0, Math.min(CANVAS_WIDTH - paddle.width, paddle.x))

      // Move ball
      ball.x += ball.vx
      ball.y += ball.vy

      // Wall collisions
      if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= CANVAS_WIDTH) {
        ball.vx *= -1
        ball.x = Math.max(ball.radius, Math.min(CANVAS_WIDTH - ball.radius, ball.x))
      }
      if (ball.y - ball.radius <= 0) {
        ball.vy *= -1
        ball.y = ball.radius
      }

      // Paddle collision
      if (
        ball.vy > 0 &&
        ball.y + ball.radius >= CANVAS_HEIGHT - 30 - paddle.height &&
        ball.y + ball.radius <= CANVAS_HEIGHT - 30 &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.width
      ) {
        ball.vy *= -1
        ball.y = CANVAS_HEIGHT - 30 - paddle.height - ball.radius
        // Add spin based on where the ball hits the paddle
        const hitPos = (ball.x - paddle.x) / paddle.width - 0.5
        ball.vx = hitPos * 8
        // Speed up slightly
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
        const maxSpeed = 8
        if (speed > maxSpeed) {
          ball.vx = (ball.vx / speed) * maxSpeed
          ball.vy = (ball.vy / speed) * maxSpeed
        }
      }

      // Ball lost
      if (ball.y + ball.radius > CANVAS_HEIGHT) {
        g.lives--
        setLives(g.lives)
        if (g.lives <= 0) {
          setGameState('lost')
          if (g.score > highScore) {
            setHighScore(g.score)
            localStorage.setItem('breakout_high', g.score.toString())
          }
          return
        }
        resetBall()
      }

      // Brick collisions
      for (let i = g.bricks.length - 1; i >= 0; i--) {
        const b = g.bricks[i]
        if (
          ball.x + ball.radius > b.x &&
          ball.x - ball.radius < b.x + b.width &&
          ball.y + ball.radius > b.y &&
          ball.y - ball.radius < b.y + b.height
        ) {
          ball.vy *= -1
          b.hits++
          if (b.hits >= b.maxHits) {
            g.bricks.splice(i, 1)
            g.score += b.maxHits * 10
            setScore(g.score)
            spawnParticles(b.x + b.width / 2, b.y + b.height / 2, b.color)
          }
          break
        }
      }

      // Win check
      if (g.bricks.length === 0) {
        setGameState('won')
        if (g.score > highScore) {
          setHighScore(g.score)
          localStorage.setItem('breakout_high', g.score.toString())
        }
        return
      }

      // Update particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.03
        if (p.life <= 0) g.particles.splice(i, 1)
      }

      // Draw
      if (!ctx) return
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
      grad.addColorStop(0, '#0f0f1a')
      grad.addColorStop(1, '#1a1025')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Bricks
      for (const b of g.bricks) {
        ctx.fillStyle = b.hits > 0 ? b.color + '99' : b.color
        ctx.beginPath()
        ctx.roundRect(b.x, b.y, b.width, b.height, 4)
        ctx.fill()
        if (b.maxHits > 1 && b.hits === 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Particles
      for (const p of g.particles) {
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Paddle
      const paddleGrad = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0)
      paddleGrad.addColorStop(0, '#7c3aed')
      paddleGrad.addColorStop(1, '#a78bfa')
      ctx.fillStyle = paddleGrad
      ctx.beginPath()
      ctx.roundRect(paddle.x, CANVAS_HEIGHT - 30 - paddle.height, paddle.width, paddle.height, 6)
      ctx.fill()

      // Ball
      ctx.fillStyle = '#e0e7ff'
      ctx.shadowColor = '#a78bfa'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // HUD
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '13px system-ui, sans-serif'
      ctx.fillText(`Score: ${g.score}`, 12, 24)
      ctx.fillText(`Lives: ${'*'.repeat(g.lives)}`, CANVAS_WIDTH - 80, 24)

      g.animId = requestAnimationFrame(gameLoop)
    }

    g.animId = requestAnimationFrame(gameLoop)

    return () => {
      cancelAnimationFrame(g.animId)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('touchmove', handleTouchMove)
    }
  }, [gameState, highScore, resetBall, spawnParticles])

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white/90 tracking-tight">Block Breaker</h1>
        {highScore > 0 && (
          <p className="text-sm text-purple-300/60 mt-1">High Score: {highScore}</p>
        )}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-2xl border border-white/10 shadow-2xl shadow-purple-900/30 max-w-full"
          style={{ maxWidth: '480px', width: '100%', aspectRatio: '480/640' }}
        />

        {gameState !== 'playing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl backdrop-blur-sm">
            <div className="text-center px-8">
              {gameState === 'won' && (
                <>
                  <p className="text-3xl font-bold text-purple-300 mb-2">You Win!</p>
                  <p className="text-purple-200/70 mb-6">Score: {score}</p>
                </>
              )}
              {gameState === 'lost' && (
                <>
                  <p className="text-3xl font-bold text-purple-300 mb-2">Game Over</p>
                  <p className="text-purple-200/70 mb-6">Score: {score}</p>
                </>
              )}
              {gameState === 'idle' && (
                <p className="text-purple-200/50 text-sm mb-6">Move your mouse or finger to control the paddle</p>
              )}
              <button
                onClick={startGame}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-purple-600/30 cursor-pointer"
              >
                {gameState === 'idle' ? 'Start Game' : 'Play Again'}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-white/20 mt-8">Nothing to see here.</p>
    </div>
  )
}
