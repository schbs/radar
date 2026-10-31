"use client";
// Consola de Radar (dirección A de docs/brand.md): consulta arriba, estado de costo, lista de ecos filtrable por score
// y la ficha del negocio elegido con el porqué del puntaje, lo medido, la traza de etapas y el borrador. En español (/)
// y en inglés (/en): los textos están en src/i18n/textos.ts y las señales se rearman por clave (src/i18n/detalles.ts).
import { useId, useRef, useState } from "react";
import type { Borrador } from "@/borrador/borrador";
import { leadsACsv } from "@/exportar/csv";
import { conSenalesEn, detalleDe, motivoDe, saltoDe } from "@/i18n/detalles";
import { TEXTOS, type Idioma, type Textos } from "@/i18n/textos";
import type { Corrida, Modo } from "@/lib/corrida";
import type { Lead } from "@/pipeline/tipos";

type Consulta = { rubro: string; ciudad: string; maximo: number };
type EstadoBorrador = { cargando: true } | { borrador: Borrador; aviso?: string } | { error: string };

const VALORES_FILTRO = [0, 30, 50] as const;

export function Consola({ idioma, modo, inicial, consultaInicial }: { idioma: Idioma; modo: Modo; inicial: Corrida | null; consultaInicial: Consulta }) {
  const t = TEXTOS[idioma];
  const usd = (n: number, decimales = 3) => `USD ${n.toLocaleString(t.locale, { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`;
  const hostDe = (web?: string | null) => (web ? new URL(web).hostname.replace(/^www\./, "") : t.sinWeb);

  const [corrida, setCorrida] = useState<Corrida | null>(inicial);
  const [consulta, setConsulta] = useState<Consulta>(consultaInicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minimo, setMinimo] = useState(0);
  const [elegido, setElegido] = useState<string | null>(inicial?.leads[0]?.placeId ?? null);
  const [borradores, setBorradores] = useState<Record<string, EstadoBorrador>>({});
  const [estadoExport, setEstadoExport] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const fichaRef = useRef<HTMLHeadingElement>(null);

  const visibles = (corrida?.leads ?? []).filter((l) => (l.score?.total ?? 0) >= minimo);
  const lead = corrida?.leads.find((l) => l.placeId === elegido) ?? null;

  async function barrer() {
    setCargando(true);
    setError(null);
    setEstadoExport(null);
    try {
      const r = await fetch("/api/corrida", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(consulta) });
      if (!r.ok) throw new Error(r.status === 429 ? t.errorOcupado : t.errorCorrida);
      const datos = (await r.json()) as Corrida;
      setCorrida(datos);
      setElegido(datos.leads[0]?.placeId ?? null);
      setBorradores({});
      setVuelta((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.errorCorrida);
    } finally {
      setCargando(false);
    }
  }

  function elegir(placeId: string) {
    setElegido(placeId);
    // En el celular la ficha queda abajo de la lista: se la acerca y se le pasa el foco.
    requestAnimationFrame(() => {
      if (!window.matchMedia("(min-width: 64rem)").matches) fichaRef.current?.scrollIntoView({ block: "start" });
      fichaRef.current?.focus({ preventScroll: true });
    });
  }

  async function armarBorrador(l: Lead) {
    setBorradores((b) => ({ ...b, [l.placeId]: { cargando: true } }));
    try {
      const r = await fetch(`/api/borrador?idioma=${idioma}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sinTraza(conSenalesEn(l, idioma))) });
      const datos = (await r.json()) as { borrador?: Borrador; aviso?: string };
      setBorradores((b) => ({ ...b, [l.placeId]: datos.borrador ? { borrador: datos.borrador, aviso: datos.aviso } : { error: t.ficha.errorBorrador } }));
    } catch {
      setBorradores((b) => ({ ...b, [l.placeId]: { error: t.ficha.errorBorrador } }));
    }
  }

  function descargarCsv() {
    const blob = new Blob([leadsACsv(visibles)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `radar-${(corrida?.consulta.rubro ?? "leads").replace(/\W+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setEstadoExport(t.csvListo(visibles.length));
  }

  async function pasarAHubspot() {
    setEstadoExport(t.hubspotMandando);
    try {
      const r = await fetch("/api/hubspot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(visibles.slice(0, 20).map(sinTraza)) });
      const datos = (await r.json()) as { simulado?: boolean; empresas?: unknown[]; resultados?: { error?: string }[] };
      if (!r.ok) throw new Error();
      if (datos.simulado) setEstadoExport(t.hubspotSimulado(datos.empresas?.length ?? 0));
      else setEstadoExport(t.hubspotReal(datos.resultados?.filter((x) => !x.error).length ?? 0, datos.resultados?.filter((x) => x.error).length ?? 0));
    } catch {
      setEstadoExport(t.hubspotError);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="reticula border-b border-reticula">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-5 sm:px-6">
          <Pantalla leads={corrida?.leads ?? []} vuelta={vuelta} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm text-ambar">{t.marca}</p>
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{t.titulo}</h1>
            <p className="mt-1 max-w-2xl text-texto-suave">{t.bajada}</p>
          </div>
          <a href={t.otroIdioma.href} hrefLang={t.otroIdioma.lang} lang={t.otroIdioma.lang} className="inline-flex min-h-11 shrink-0 items-center self-start rounded-sm border border-borde px-3 font-mono text-sm hover:border-ambar">
            {t.otroIdioma.texto}
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 sm:px-6">
        <p className="mt-4 inline-flex items-center gap-2 rounded-sm border border-borde px-2 py-1 font-mono text-sm">
          <span aria-hidden="true" className={modo === "demo" ? "text-ambar" : "text-verde"}>
            ●
          </span>
          {modo === "demo" ? t.modoDemo : t.modoReal}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void barrer();
          }}
          className="mt-4 grid gap-3 border border-reticula bg-panel p-4 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end"
        >
          <Campo etiqueta={t.rubro} valor={consulta.rubro} alCambiar={(rubro) => setConsulta({ ...consulta, rubro })} />
          <Campo etiqueta={t.ciudad} valor={consulta.ciudad} alCambiar={(ciudad) => setConsulta({ ...consulta, ciudad })} />
          <label className="grid gap-1 text-sm">
            <span className="font-mono text-texto-suave">{t.maximo}</span>
            <select value={consulta.maximo} onChange={(e) => setConsulta({ ...consulta, maximo: Number(e.target.value) })} className="min-h-11 rounded-sm border border-borde bg-tinta px-2 text-base">
              {[5, 10, 12, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {t.negocios(n)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={cargando} className="min-h-11 rounded-sm bg-ambar px-5 font-mono font-semibold text-tinta hover:bg-ambar-claro disabled:opacity-70">
            {cargando ? t.barriendo : t.barrer}
          </button>
        </form>

        <div aria-live="polite" className="mt-3 min-h-6 text-sm">
          {error ? (
            <p className="text-rojo">
              <span aria-hidden="true">✕ </span>
              {error}
            </p>
          ) : corrida?.avisoDemo ? (
            <p className="text-texto-suave">{t.avisoDemo(consultaInicial.rubro, consultaInicial.ciudad)}</p>
          ) : null}
        </div>

        {corrida ? (
          <>
            <EstadoCosto corrida={corrida} t={t} usd={usd} />

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <section aria-labelledby="titulo-ecos">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 id="titulo-ecos" className="font-mono text-lg font-semibold">
                    {t.ecos}{" "}
                    <span className="text-texto-suave">
                      ({visibles.length} {t.de} {corrida.leads.length})
                    </span>
                  </h2>
                  <fieldset className="flex gap-1">
                    <legend className="sr-only">{t.filtrar}</legend>
                    {VALORES_FILTRO.map((valor, i) => (
                      <label key={valor} className="cursor-pointer rounded-sm border border-borde px-3 py-2 font-mono text-sm has-checked:border-ambar has-checked:bg-ambar-tenue has-checked:text-ambar-claro has-focus-visible:outline-2 has-focus-visible:outline-ambar">
                        <input type="radio" name="filtro" value={valor} checked={minimo === valor} onChange={() => setMinimo(valor)} className="sr-only" />
                        {t.filtros[i]}
                      </label>
                    ))}
                  </fieldset>
                </div>

                <div className="mt-3 overflow-x-auto border border-reticula">
                  <table className="w-full border-collapse text-left">
                    <caption className="sr-only">{t.tabla}</caption>
                    <thead className="bg-panel font-mono text-sm text-texto-suave">
                      <tr>
                        <th scope="col" className="w-24 px-3 py-2 font-normal">
                          {t.score}
                        </th>
                        <th scope="col" className="px-3 py-2 font-normal">
                          {t.negocio}
                        </th>
                        <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell">
                          {t.motivo}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((l) => (
                        <tr key={l.placeId} className={`border-t border-reticula ${l.placeId === elegido ? "bg-panel-alto" : ""}`}>
                          <td className="px-3 py-2 align-top">
                            <span className="font-mono text-lg text-ambar tabular-nums">{l.score?.total ?? "–"}</span>
                            <span aria-hidden="true" className="mt-1 block h-1 bg-reticula">
                              <span className="barra block h-1 bg-ambar" style={{ "--valor": (l.score?.total ?? 0) / 100 } as React.CSSProperties} />
                            </span>
                          </td>
                          <td className="px-3 py-2 align-top">
                            <button type="button" onClick={() => elegir(l.placeId)} aria-pressed={l.placeId === elegido} className="min-h-11 text-left font-medium underline-offset-4 hover:underline">
                              {l.nombre}
                            </button>
                            <span className="block font-mono text-sm text-texto-suave">{hostDe(l.web)}</span>
                          </td>
                          <td className="hidden px-3 py-2 align-top text-texto-suave md:table-cell">{motivoDe(l, idioma)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visibles.length === 0 ? <p className="p-4 text-texto-suave">{t.ningunoFiltro}</p> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={descargarCsv} disabled={!visibles.length} className="min-h-11 rounded-sm border border-ambar px-4 font-mono text-sm text-ambar hover:bg-ambar-tenue disabled:opacity-70">
                    {t.exportarCsv(visibles.length)}
                  </button>
                  <button type="button" onClick={pasarAHubspot} disabled={!visibles.length} className="min-h-11 rounded-sm border border-borde px-4 font-mono text-sm hover:border-ambar disabled:opacity-70">
                    {t.hubspot}
                  </button>
                </div>
                <p aria-live="polite" className="mt-2 min-h-6 text-sm text-texto-suave">
                  {estadoExport}
                </p>
              </section>

              <section aria-labelledby="titulo-ficha" className="lg:self-start">
                {lead ? (
                  <Ficha lead={lead} idioma={idioma} t={t} usd={usd} hostDe={hostDe} refTitulo={fichaRef} estado={borradores[lead.placeId]} alArmar={() => armarBorrador(lead)} />
                ) : (
                  <h2 id="titulo-ficha" ref={fichaRef} tabIndex={-1} className="font-mono text-lg">
                    {t.elegi}
                  </h2>
                )}
              </section>
            </div>
          </>
        ) : (
          <p className="mt-6 text-texto-suave">{t.vacio}</p>
        )}
      </main>

      <footer className="border-t border-reticula">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-texto-suave sm:px-6">
          <p>{t.pie}</p>
          <p className="mt-1">{t.autor}</p>
        </div>
      </footer>
    </div>
  );
}

/** Lo que el servidor necesita de un lead para el borrador o HubSpot (sin la traza ni lo medido en crudo). */
const sinTraza = (l: Lead) => ({ placeId: l.placeId, nombre: l.nombre, rubro: l.rubro, direccion: l.direccion, web: l.web, resenas: l.resenas, senales: l.senales, score: l.score });

function Campo({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: string; alCambiar: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-mono text-texto-suave">{etiqueta}</span>
      <input value={valor} onChange={(e) => alCambiar(e.target.value)} required minLength={2} maxLength={40} className="min-h-11 rounded-sm border border-borde bg-tinta px-3 text-base" />
    </label>
  );
}

function EstadoCosto({ corrida, t, usd }: { corrida: Corrida; t: Textos; usd: (n: number, d?: number) => string }) {
  const { costo, resumen } = corrida;
  const titulo = useId();
  const tiempo = resumen.ms < 1000 ? `${resumen.ms} ms` : `${(resumen.ms / 1000).toLocaleString(t.locale, { maximumFractionDigits: 1 })} s`;
  return (
    <section aria-labelledby={titulo} className="mt-2 border border-reticula bg-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={titulo} className="font-mono text-lg font-semibold">
          {t.costo.titulo}
        </h2>
        <p className="font-mono text-sm text-texto-suave">{t.costo.resumen(corrida.consulta.rubro, corrida.consulta.ciudad, resumen.leads, resumen.conSenales, tiempo)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 font-mono sm:grid-cols-4">
        <Dato termino={t.costo.total} valor={usd(costo.total)} />
        <Dato termino={t.costo.porNegocio} valor={usd(costo.porLead, 4)} />
        <Dato termino={t.costo.cache} valor={String(resumen.desdeCache)} />
        <Dato termino={t.costo.salteadas} valor={String(resumen.saltadas)} />
      </dl>
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-2 font-mono text-sm text-ambar">{t.costo.detalle}</summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-md text-left font-mono text-sm tabular-nums">
            <thead className="text-texto-suave">
              <tr>
                <th scope="col" className="py-1 pr-3 font-normal">
                  {t.costo.etapa}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-normal">
                  {t.costo.llamadas}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-normal">
                  {t.costo.precio}
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  {t.costo.subtotal}
                </th>
              </tr>
            </thead>
            <tbody>
              {costo.lineas.map((l) => (
                <tr key={l.etapa} className="border-t border-reticula">
                  <td className="py-1 pr-3">{l.etapa === "text_search" ? `${l.etapa} (${t.costo.soloIds})` : l.etapa}</td>
                  <td className="py-1 pr-3 text-right">{l.llamadas}</td>
                  <td className="py-1 pr-3 text-right">{usd(l.precio)}</td>
                  <td className="py-1 text-right">{usd(l.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-texto-suave">
          {corrida.modo === "demo" ? t.costo.notaDemo : ""}
          {t.costo.nota}
        </p>
      </details>
    </section>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div>
      <dt className="text-sm text-texto-suave">{termino}</dt>
      <dd className="text-lg text-ambar tabular-nums">{valor}</dd>
    </div>
  );
}

function Ficha({
  lead,
  idioma,
  t,
  usd,
  hostDe,
  refTitulo,
  estado,
  alArmar,
}: {
  lead: Lead;
  idioma: Idioma;
  t: Textos;
  usd: (n: number, d?: number) => string;
  hostDe: (web?: string | null) => string;
  refTitulo: React.RefObject<HTMLHeadingElement | null>;
  estado?: EstadoBorrador;
  alArmar: () => void;
}) {
  const ps = lead.pagespeed;
  const num = (n: number, d: number) => n.toLocaleString(t.locale, { minimumFractionDigits: d, maximumFractionDigits: d });
  return (
    <div className="border border-reticula bg-panel p-4">
      <p className="font-mono text-sm text-texto-suave">{t.ficha.titulo}</p>
      <h2 id="titulo-ficha" ref={refTitulo} tabIndex={-1} className="mt-1 scroll-mt-4 font-mono text-xl font-semibold">
        {lead.nombre}
      </h2>
      <p className="mt-1 text-texto-suave">{lead.direccion}</p>
      <p className="mt-1 font-mono text-sm">
        {hostDe(lead.web)} · {lead.resenas ?? 0} {t.ficha.resenas}
        {lead.rating ? ` · ${num(lead.rating, 1)} ★` : ""}
      </p>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="font-mono text-4xl font-semibold text-ambar tabular-nums">{lead.score?.total ?? "–"}</span>
        <span className="text-texto-suave">{t.ficha.deCien}</span>
      </div>

      <h3 className="mt-4 font-mono text-sm text-texto-suave">{t.ficha.porQue}</h3>
      <ul className="mt-2 grid gap-2">
        {(lead.score?.componentes ?? []).map((c) => (
          <li key={c.clave} className="grid grid-cols-[3.5rem_1fr] gap-2">
            <span className="font-mono text-ambar tabular-nums">+{c.puntos}</span>
            <span>
              {detalleDe(c, lead, idioma)}
              <span aria-hidden="true" className="mt-1 block h-0.5 bg-reticula">
                <span className="barra block h-0.5 bg-ambar" style={{ "--valor": c.puntos / 45 } as React.CSSProperties} />
              </span>
            </span>
          </li>
        ))}
      </ul>

      {ps ? (
        <>
          <h3 className="mt-4 font-mono text-sm text-texto-suave">{t.ficha.pagespeed}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
            <Dato termino={t.ficha.rendimiento} valor={ps.rendimiento == null ? "–" : `${ps.rendimiento}/100`} />
            <Dato termino="LCP" valor={ps.lcpSegundos == null ? "–" : `${num(ps.lcpSegundos, 1)} s`} />
            <Dato termino="CLS" valor={ps.cls == null ? "–" : num(ps.cls, 2)} />
            <Dato termino="TBT" valor={ps.tbtMs == null ? "–" : `${Math.round(ps.tbtMs)} ms`} />
          </dl>
        </>
      ) : null}

      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer py-2 font-mono text-sm text-ambar">{t.ficha.traza}</summary>
        <ol className="grid gap-1 font-mono text-sm">
          {lead.traza.map((p) => (
            <li key={p.etapa} className="flex justify-between gap-3 border-t border-reticula py-1">
              <span>{p.etapa}</span>
              <span className="text-right text-texto-suave">{p.saltada ? `${t.ficha.salteada}: ${saltoDe(p.motivo, idioma)}` : p.error ? `${t.ficha.error}: ${p.error}` : `${p.desdeCache ? t.ficha.cache : `${p.ms} ms`} · ${usd(p.costo)}`}</span>
            </li>
          ))}
        </ol>
      </details>

      <div className="mt-4 border-t border-reticula pt-4">
        <h3 className="font-mono text-sm text-texto-suave">{t.ficha.borrador}</h3>
        {!estado || "error" in estado ? (
          <>
            {estado && "error" in estado ? (
              <p className="mt-2 text-rojo">
                <span aria-hidden="true">✕ </span>
                {estado.error}
              </p>
            ) : null}
            <button type="button" onClick={alArmar} disabled={!lead.senales?.length} className="mt-2 min-h-11 rounded-sm bg-ambar px-4 font-mono text-sm font-semibold text-tinta hover:bg-ambar-claro disabled:opacity-70">
              {t.ficha.armar}
            </button>
            {!lead.senales?.length ? <p className="mt-2 text-sm text-texto-suave">{t.ficha.sinSenales}</p> : null}
          </>
        ) : "cargando" in estado ? (
          <p className="mt-2 text-texto-suave" role="status">
            {t.ficha.armando}
          </p>
        ) : (
          <BorradorVista borrador={estado.borrador} aviso={estado.aviso} t={t} />
        )}
      </div>
    </div>
  );
}

function BorradorVista({ borrador, aviso, t }: { borrador: Borrador; aviso?: string; t: Textos }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `${borrador.asunto}\n\n${borrador.lineas.join("\n")}\n\n${borrador.cta}`;
  return (
    <div className="mt-2" role="status">
      <p className="inline-flex items-center gap-2 rounded-sm border border-ambar px-2 py-1 font-mono text-sm text-ambar">
        <span aria-hidden="true">✎</span>
        {borrador.estado}
      </p>
      {aviso ? <p className="mt-2 text-sm text-texto-suave">{aviso}</p> : null}
      <div className="mt-3 border-l-2 border-ambar pl-3">
        <p className="font-semibold">{borrador.asunto}</p>
        {borrador.lineas.map((l) => (
          <p key={l} className="mt-2">
            {l}
          </p>
        ))}
        <p className="mt-2 text-texto-suave">{borrador.cta}</p>
      </div>
      <p className="mt-2 font-mono text-sm text-texto-suave">
        {t.ficha.cita}: {borrador.metricas_citadas.join(", ")} · {borrador.modelo}
      </p>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(texto).catch(() => undefined);
          setCopiado(true);
        }}
        className="mt-2 min-h-11 rounded-sm border border-borde px-4 font-mono text-sm hover:border-ambar"
      >
        {copiado ? t.ficha.copiado : t.ficha.copiar}
      </button>
    </div>
  );
}

/** Pantalla del radar: cada negocio es un eco; cuanto más score, más cerca del centro y más brillante. */
function Pantalla({ leads, vuelta }: { leads: Lead[]; vuelta: number }) {
  return (
    <svg viewBox="0 0 100 100" className="size-20 shrink-0 sm:size-24" aria-hidden="true">
      <circle cx="50" cy="50" r="48" className="fill-tinta stroke-reticula" strokeWidth="1" />
      <circle cx="50" cy="50" r="32" className="fill-none stroke-reticula" strokeWidth="1" />
      <circle cx="50" cy="50" r="16" className="fill-none stroke-reticula" strokeWidth="1" />
      <path d="M50 2 V98 M2 50 H98" className="stroke-reticula" strokeWidth="1" />
      <g key={vuelta} className="barrido">
        <path d="M50 50 L50 2 A48 48 0 0 1 84 16 Z" className="fill-ambar" opacity="0.35" />
      </g>
      {leads.map((l, i) => {
        const s = l.score?.total ?? 0;
        const angulo = (i / Math.max(1, leads.length)) * Math.PI * 2;
        const r = 44 - (s / 100) * 34;
        return <circle key={l.placeId} cx={50 + Math.sin(angulo) * r} cy={50 - Math.cos(angulo) * r} r={1.5 + s / 40} className="fill-ambar" opacity={0.35 + s / 160} />;
      })}
    </svg>
  );
}
