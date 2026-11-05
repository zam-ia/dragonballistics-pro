import { ExternalLink, FileWarning, GitBranch, ShieldCheck } from 'lucide-react';

const references = [
  {
    name: 'remcostoeten/Gunbound',
    url: 'https://github.com/remcostoeten/Gunbound',
    stack: 'TypeScript · React · motor de juego',
    license: 'MIT',
    decision: 'Inspiracion permitida con atribucion; no se incorporo codigo.',
    useful: 'Separacion reciente de fisica, colision, terreno y viento.',
  },
  {
    name: 'SanjoSolutions/gunbound-aimbot',
    url: 'https://github.com/SanjoSolutions/gunbound-aimbot',
    stack: 'Python · PyQt5 · Windows',
    license: 'Unlicense',
    decision: 'Solo conceptos matematicos; se excluyen memoria, captura y control.',
    useful: 'Entradas/salidas de calculo y ventana transparente como referencia historica.',
  },
  {
    name: 'RxFaX/Aimbot-DragonBound',
    url: 'https://github.com/RxFaX/Aimbot-DragonBound',
    stack: 'JavaScript · extension Manifest V2',
    license: 'Sin licencia publicada',
    decision: 'No reutilizable; se reviso unicamente su estructura conceptual.',
    useful: 'Estructura historica de entradas de movil, posicion, viento y salida de potencia.',
  },
  {
    name: 'fsbertelli/gunbound-advanced-aimbot',
    url: 'https://github.com/fsbertelli/gunbound-advanced-aimbot',
    stack: 'Python · OpenCV · scikit-learn · PyQt5',
    license: 'Sin licencia publicada',
    decision: 'No reutilizable; varias afirmaciones requieren validacion independiente.',
    useful: 'Separacion conceptual entre balistica, deteccion, ML, configuracion y HUD.',
  },
  {
    name: 'wZVanG/dragonbound-helper',
    url: 'https://github.com/wZVanG/dragonbound-helper',
    stack: 'JavaScript · Chrome Manifest V2',
    license: 'Sin licencia publicada',
    decision: 'No reutilizable y dependiente de una API historica descontinuada.',
    useful: 'Densidad de controles, organizacion de mapas y lectura visual de valores.',
  },
];

export default function ResearchPage() {
  return (
    <div className="research-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">FASE 0 · TRAZABILIDAD</p>
          <h1>Investigacion de referencias</h1>
          <p>
            Revision realizada el 5 de noviembre de 2026. El detalle tecnico, commits y decisiones
            estan en <code>docs/research/repository-analysis.md</code>.
          </p>
        </div>
        <div className="phase-badge">
          <GitBranch size={17} aria-hidden="true" />
          <span>
            <strong>5 repositorios revisados</strong>2 licencias claras · 3 restringidos
          </span>
        </div>
      </header>

      <section className="research-summary panel">
        <ShieldCheck size={22} aria-hidden="true" />
        <div>
          <strong>Decision de arquitectura</strong>
          <p>
            DragonBallistics Pro implementara su propio motor determinista. Ninguno de estos
            repositorios es dependencia de ejecucion y no se copia codigo sin licencia.
          </p>
        </div>
      </section>

      <section className="reference-grid" aria-label="Repositorios revisados">
        {references.map((reference) => (
          <article className="reference-card panel" key={reference.name}>
            <div className="reference-topline">
              <span className={reference.license.includes('Sin') ? 'license warning' : 'license'}>
                {reference.license.includes('Sin') ? (
                  <FileWarning size={14} />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {reference.license}
              </span>
              <a
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir ${reference.name}`}
              >
                <ExternalLink size={16} />
              </a>
            </div>
            <h2>{reference.name}</h2>
            <p className="stack-label">{reference.stack}</p>
            <dl>
              <div>
                <dt>APORTE</dt>
                <dd>{reference.useful}</dd>
              </div>
              <div>
                <dt>DECISION</dt>
                <dd>{reference.decision}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}
