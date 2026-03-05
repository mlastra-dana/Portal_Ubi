export default function Home() {
  return (
    <main>
      <section className="bg-primary">
        <div className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-content items-center gap-8 px-4 py-8 md:grid-cols-2 md:px-6 md:py-10">
          <div className="flex justify-center md:justify-start">
            <img src="/ubii-pos-hero.svg" alt="Terminal Ubii" className="h-auto w-full max-w-[420px]" />
          </div>

          <div className="max-w-2xl text-white">
            <h1 className="text-4xl font-bold leading-tight md:text-6xl">Tenemos la solucion de pago para tu negocio</h1>
            <p className="mt-8 text-xl leading-relaxed text-white/95 md:text-[2rem] md:leading-[1.45]">
              Ofrecemos variedad de soluciones de pago, administracion y servicio postventa de calidad a distintos tipos de
              comercios, ademas de realizar desarrollos a la medida que el cliente necesita.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
