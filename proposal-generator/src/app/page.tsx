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

const COLORS = ['#7c3aed', '#8b5cf6', '#a78bfa', '#6d28d9', '#5b21b6', '#4c1d95', '#c084fc', '#9333ea']

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [canvasSize, setCanvasSize] = useState({ w: 960, h: 600 })
  const gameRef = useRef<{
    ball: Ball
    paddle: Paddle
    bricks: Brick[]
    particles: Particle[]
    animId: number
    score: number
    lives: number
    mouseX: number
    W: number
    H: number
  }>({
    ball: { x: 480, y: 500, vx: 4, vy: -5, radius: 8 },
    paddle: { x: 400, width: 120, height: 14 },
    bricks: [],
    particles: [],
    animId: 0,
    score: 0,
    lives: 3,
    mouseX: 480,
    W: 960,
    H: 600,
  })

  // Responsive canvas sizing
  useEffect(() => {
    function updateSize() {
      const w = window.innerWidth
      const h = window.innerHeight
      // Use full width, leave room for header/footer (about 120px)
      const canvasW = Math.min(w - 32, 1400)
      const canvasH = Math.min(h - 140, 700)
      setCanvasSize({ w: canvasW, h: canvasH })
      gameRef.current.W = canvasW
      gameRef.current.H = canvasH
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const createBricks = useCallback((): Brick[] => {
    const W = gameRef.current.W
    const H = gameRef.current.H
    const bricks: Brick[] = []
    const rows = 7
    const padding = 4
    // Calculate cols to fill width
    const brickH = Math.max(18, Math.min(24, H / 25))
    const cols = Math.floor((W - 40) / 70)
    const brickW = (W - 40 - (cols - 1) * padding) / cols
    const offsetX = 20
    const offsetY = 50

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const maxHits = r < 2 ? 3 : r < 4 ? 2 : 1
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
    for (let i = 0; i < 8; i++) {
      g.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        size: Math.random() * 4 + 1,
        color,
        life: 1,
      })
    }
  }, [])

  const startGame = useCallback(() => {
    const g = gameRef.current
    const W = g.W
    const H = g.H
    g.ball = { x: W / 2, y: H - 80, vx: 4 * (Math.random() > 0.5 ? 1 : -1), vy: -5, radius: 8 }
    g.paddle = { x: W / 2 - 60, width: 120, height: 14 }
    g.bricks = createBricks()
    g.particles = []
    g.score = 0
    g.lives = 3
    g.mouseX = W / 2
    setScore(0)
    setLives(3)
    setGameState('playing')
  }, [createBricks])

  const resetBall = useCallback(() => {
    const g = gameRef.current
    g.ball = {
      x: g.paddle.x + g.paddle.width / 2,
      y: g.H - 80,
      vx: 4 * (Math.random() > 0.5 ? 1 : -1),
      vy: -5,
      radius: 8,
    }
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
      g.mouseX = ((e.clientX - rect.left) / rect.width) * g.W
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      g.mouseX = ((e.touches[0].clientX - rect.left) / rect.width) * g.W
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })

    function gameLoop() {
      const g = gameRef.current
      const W = g.W
      const H = g.H
      const ball = g.ball
      const paddle = g.paddle

      // Move paddle toward mouse
      const targetX = g.mouseX - paddle.width / 2
      paddle.x += (targetX - paddle.x) * 0.15
      paddle.x = Math.max(0, Math.min(W - paddle.width, paddle.x))

      // Move ball
      ball.x += ball.vx
      ball.y += ball.vy

      // Wall collisions
      if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= W) {
        ball.vx *= -1
        ball.x = Math.max(ball.radius, Math.min(W - ball.radius, ball.x))
      }
      if (ball.y - ball.radius <= 0) {
        ball.vy *= -1
        ball.y = ball.radius
      }

      // Paddle collision
      const paddleTop = H - 40 - paddle.height
      if (
        ball.vy > 0 &&
        ball.y + ball.radius >= paddleTop &&
        ball.y + ball.radius <= paddleTop + paddle.height + 4 &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.width
      ) {
        ball.vy *= -1
        ball.y = paddleTop - ball.radius
        const hitPos = (ball.x - paddle.x) / paddle.width - 0.5
        ball.vx = hitPos * 10
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
        const maxSpeed = 9
        if (speed > maxSpeed) {
          ball.vx = (ball.vx / speed) * maxSpeed
          ball.vy = (ball.vy / speed) * maxSpeed
        }
      }

      // Ball lost
      if (ball.y + ball.radius > H) {
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
        p.life -= 0.025
        if (p.life <= 0) g.particles.splice(i, 1)
      }

      // Draw
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)

      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#0f0f1a')
      grad.addColorStop(1, '#1a1025')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // Subtle grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.02)'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += 60) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }
      for (let y = 0; y < H; y += 60) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      // Bricks
      for (const b of g.bricks) {
        const alpha = b.hits === 0 ? 'ff' : b.hits === 1 ? 'bb' : '77'
        ctx.fillStyle = b.color + alpha
        ctx.beginPath()
        ctx.roundRect(b.x, b.y, b.width, b.height, 4)
        ctx.fill()
        if (b.maxHits > 1 && b.hits < b.maxHits) {
          ctx.strokeStyle = 'rgba(255,255,255,0.2)'
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

      // Paddle glow
      ctx.shadowColor = '#7c3aed'
      ctx.shadowBlur = 15
      const paddleGrad = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0)
      paddleGrad.addColorStop(0, '#7c3aed')
      paddleGrad.addColorStop(0.5, '#a78bfa')
      paddleGrad.addColorStop(1, '#7c3aed')
      ctx.fillStyle = paddleGrad
      ctx.beginPath()
      ctx.roundRect(paddle.x, paddleTop, paddle.width, paddle.height, 7)
      ctx.fill()
      ctx.shadowBlur = 0

      // Ball with glow
      ctx.shadowColor = '#a78bfa'
      ctx.shadowBlur = 16
      ctx.fillStyle = '#e0e7ff'
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // HUD
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '14px system-ui, sans-serif'
      ctx.fillText(`Score: ${g.score}`, 16, 28)
      const livesText = `Lives: ${'* '.repeat(g.lives).trim()}`
      const livesWidth = ctx.measureText(livesText).width
      ctx.fillText(livesText, W - livesWidth - 16, 28)

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
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-4" ref={containerRef}>
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-white/90 tracking-tight">Block Breaker</h1>
        {highScore > 0 && (
          <p className="text-sm text-purple-300/50 mt-1">High Score: {highScore}</p>
        )}
      </div>

      <div className="relative w-full flex justify-center">
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          className="rounded-2xl border border-white/10 shadow-2xl shadow-purple-900/30"
          style={{ width: canvasSize.w, height: canvasSize.h, maxWidth: '100%' }}
        />

        {gameState !== 'playing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl backdrop-blur-sm">
            <div className="text-center px-8">
              {gameState === 'won' && (
                <>
                  <p className="text-4xl font-bold text-purple-300 mb-2">You Win!</p>
                  <p className="text-lg text-purple-200/70 mb-6">Score: {score}</p>
                </>
              )}
              {gameState === 'lost' && (
                <>
                  <p className="text-4xl font-bold text-purple-300 mb-2">Game Over</p>
                  <p className="text-lg text-purple-200/70 mb-6">Score: {score}</p>
                </>
              )}
              {gameState === 'idle' && (
                <p className="text-purple-200/40 text-sm mb-6">Move your mouse or finger to control the paddle</p>
              )}
              <button
                onClick={startGame}
                className="px-10 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-lg rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-purple-600/30 cursor-pointer"
              >
                {gameState === 'idle' ? 'Start Game' : 'Play Again'}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-white/15 mt-6">Nothing to see here.</p>
    </div>
  )
}
