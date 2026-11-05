import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="not-found panel">
      <p className="eyebrow">RUTA NO ENCONTRADA</p>
      <h1>Este modulo no existe</h1>
      <p>Vuelve al laboratorio operativo.</p>
      <Link className="button primary" to="/">
        <ArrowLeft size={16} /> Ir al laboratorio
      </Link>
    </section>
  );
}
