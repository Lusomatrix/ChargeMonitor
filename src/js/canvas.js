/**
 * CANVAS — Particle Background Animation
 * 
 * Creates animated particle effect on canvas background
 */

export function initializeCanvas() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) {
    console.warn('⚠️ Canvas element not found');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  const particles = [];
  const particleCount = 50;
  
  // Resize canvas
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  // Create particle object
  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 1,
      velocityX: (Math.random() - 0.5) * 1,
      velocityY: (Math.random() - 0.5) * 1,
      opacity: Math.random() * 0.5 + 0.2,
      color: Math.random() > 0.5 ? '#4fc3f7' : '#06b6d4'
    };
  }
  
  // Initialize particles
  for (let i = 0; i < particleCount; i++) {
    particles.push(createParticle());
  }
  
  // Animation loop
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(particle => {
      // Update position
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      
      // Bounce off edges
      if (particle.x < 0 || particle.x > canvas.width) {
        particle.velocityX *= -1;
      }
      if (particle.y < 0 || particle.y > canvas.height) {
        particle.velocityY *= -1;
      }
      
      // Draw particle
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = particle.opacity;
      ctx.fill();
    });
    
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  animate();
  
  console.log('✓ Canvas particles initialized');
}
