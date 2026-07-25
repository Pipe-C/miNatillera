import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SavingsIllustration from '../components/SavingsIllustration'

export default function Landing() {
  const navigate = useNavigate()
  const revealRefs = useRef([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    revealRefs.current.forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  function addRevealRef(el) {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center relative overflow-hidden">

      {/* Hero section */}
      <section className="flex flex-col items-center justify-center min-h-[85vh] px-6 w-full max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20 w-full">

          {/* Text column */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-6 flex-1">
            <span
              className="animate-fade-up editorial-serif text-accent text-xl tracking-wide"
              style={{ animationDelay: '0ms' }}
            >
              miNatillera
            </span>

            <h1
              className="animate-fade-up tracking-tight leading-[1.05]"
              style={{ animationDelay: '80ms', fontSize: 'clamp(2.4rem, 6vw, 4rem)' }}
            >
              <span className="font-bold">Ahorro </span>
              <span className="editorial-serif text-accent font-normal">en grupo</span>
              <br />
              <span className="font-light text-text-secondary">sin complicaciones.</span>
            </h1>

            <p
              className="animate-fade-up text-base md:text-lg max-w-lg leading-relaxed"
              style={{ animationDelay: '160ms', color: 'var(--color-text-secondary)' }}
            >
              Crea una natillera digital, invita a tu grupo y visualiza el progreso hacia la meta — transparente y en tiempo real.
            </p>

            <div className="animate-fade-up" style={{ animationDelay: '240ms' }}>
              <button
                onClick={() => navigate('/home')}
                className="mt-4 px-10 py-4 bg-accent text-base font-semibold rounded-lg text-white transition-all duration-150 hover:bg-accent-hover hover:shadow-[0_6px_24px_rgba(124,92,252,0.3)] active:scale-[0.97]"
              >
                Ingresar a la demo
              </button>
            </div>
          </div>

          {/* Illustration */}
          <div
            className="animate-fade-up flex-shrink-0 w-52 sm:w-60 md:w-72"
            style={{ animationDelay: '200ms' }}
          >
            <SavingsIllustration className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* Value proposition blocks — scroll reveal */}
      <section className="w-full max-w-4xl mx-auto px-6 pb-32 flex flex-col gap-24">

        <div ref={addRevealRef} className="reveal flex flex-col gap-3">
          <span className="micro-label">Cómo funciona</span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight text-text-primary">
            Tres pasos.<br />
            <span className="text-text-secondary font-light">Nada más.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
            <ValueBlock number="01" title="Creá el grupo" description="Definí el nombre, la meta y la fecha. Invitá a tu grupo con un código de 8 caracteres." />
            <ValueBlock number="02" title="Registrá aportes" description="El gestor registra cada aporte. Todos ven el progreso en tiempo real." />
            <ValueBlock number="03" title="Alcanzá la meta" description="Visualización clara del avance. Sin planillas, sin confusión." />
          </div>
        </div>

        <div ref={addRevealRef} className="reveal reveal-delay-1 flex flex-col gap-3">
          <span className="micro-label">Por qué existe</span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight text-text-primary">
            Las natilleras son <span className="editorial-serif text-accent font-normal">tradición.</span><br />
            <span className="text-text-secondary font-light">La transparencia no siempre.</span>
          </h2>
          <p className="text-sm md:text-base max-w-xl leading-relaxed mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            miNatillera le pone herramientas digitales a una práctica comunitaria que funciona mejor con visibilidad y confianza.
          </p>
        </div>

        <div ref={addRevealRef} className="reveal reveal-delay-2 flex flex-col gap-3">
          <span className="micro-label">Sin fricción</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
            <MiniStat value="0" label="cuentas por crear" />
            <MiniStat value="8" label="caracteres para unirse" />
            <MiniStat value="∞" label="miembros por grupo" suffix="" />
            <MiniStat value="$0" label="costo" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pb-8 text-xs text-text-muted">
        Código Facilito 2026 - Kiro AI Hackathon
      </footer>
    </div>
  )
}

function ValueBlock({ number, title, description }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-mono text-accent opacity-60">{number}</span>
      <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
    </div>
  )
}

function MiniStat({ value, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl md:text-3xl font-bold tracking-tight mono" style={{ color: 'var(--color-text-primary)' }}>{value}</span>
      <span className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
    </div>
  )
}
