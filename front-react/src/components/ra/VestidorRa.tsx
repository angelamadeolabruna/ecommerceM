import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  ImagePlus,
  Loader2,
  RefreshCw,
  Ruler,
  ScanLine,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { api, ApiError, type RespuestaSesionRa } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/Button.js';
import { Badge } from '@/components/ui/Badge.js';
import { Input } from '@/components/ui/Input.js';

const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

export interface PrendaVestidorRa {
  id_ptc: number;
  codigo: string;
  nombre: string;
  imagen: string | null;
  talla: string;
  color: string;
  modelo_3d_url: string | null;
}

interface Props {
  abierto: boolean;
  prenda: PrendaVestidorRa | null;
  onCerrar: () => void;
  onReservar: (prenda: PrendaVestidorRa) => void;
}

type EstadoCamara = 'idle' | 'solicitando' | 'activa' | 'denegada' | 'no_disponible';

interface Anclas {
  ancho: number;
  alto: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

interface PuntosCuerpo {
  cx: number;
  cy: number;
  anchoHombrosPx: number;
  hombroI: { x: number; y: number };
  hombroD: { x: number; y: number };
  nariz: { x: number; y: number };
  cintura: { x: number; y: number };
}

interface ObjetoPrenda {
  fuente: CanvasImageSource;
  anchoNatural: number;
  altoNatural: number;
}

function cargarVision(): Promise<any> {
  const win = window as unknown as Record<string, any>;
  if (win.vision) return Promise.resolve(win.vision);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${VISION_CDN}/vision_bundle.js`;
    script.async = true;
    script.onload = () => resolve((window as unknown as Record<string, any>).vision);
    script.onerror = () => reject(new Error('No se pudo cargar el motor de detección de cuerpo.'));
    document.head.appendChild(script);
  });
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen de la prenda.'));
    img.src = url;
  });
}

export function recortarFondo(img: HTMLImageElement, tolerancia: number): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);

  const imagen = ctx.getImageData(0, 0, w, h);
  const px = imagen.data;

  const idx = (x: number, y: number) => (y * w + x) * 4;
  const distancia = (x: number, y: number, r: number, g: number, b: number) => {
    const dr = px[idx(x, y)] - r;
    const dg = px[idx(x, y) + 1] - g;
    const db = px[idx(x, y) + 2] - b;
    return dr * dr + dg * dg + db * db;
  };

  const tamano = Math.max(1, tolerancia);
  const tolera2 = tamano * tamano;

  const visitado = new Uint8Array(w * h);
  const cola: Array<[number, number]> = [];

  const empujar = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (visitado[y * w + x]) return;
    visitado[y * w + x] = 1;
    cola.push([x, y]);
  };

  for (let x = 0; x < w; x++) {
    empujar(x, 0);
    empujar(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    empujar(0, y);
    empujar(w - 1, y);
  }

  let rBase = 0;
  let gBase = 0;
  let bBase = 0;
  let cuentaBase = 0;
  const esquinas = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  for (const [x, y] of esquinas) {
    rBase += px[idx(x, y)];
    gBase += px[idx(x, y) + 1];
    bBase += px[idx(x, y) + 2];
    cuentaBase++;
  }
  if (cuentaBase > 0) {
    rBase = Math.round(rBase / cuentaBase);
    gBase = Math.round(gBase / cuentaBase);
    bBase = Math.round(bBase / cuentaBase);
  }

  let puntero = 0;
  while (puntero < cola.length) {
    const [x, y] = cola[puntero++];
    if (distancia(x, y, rBase, gBase, bBase) <= tolera2) {
      px[idx(x, y) + 3] = 0;
      empujar(x + 1, y);
      empujar(x - 1, y);
      empujar(x, y + 1);
      empujar(x, y - 1);
    }
  }

  ctx.putImageData(imagen, 0, 0);
  return canvas;
}

function cargarPrendaRecortada(url: string, tolerancia: number): Promise<HTMLCanvasElement> {
  return cargarImagen(url).then((img) => recortarFondo(img, tolerancia));
}

function guardarFotoSesion(foto: string): void {
  sessionStorage.setItem('tm_ultima_foto_ra', foto);
}

function prepararLandmarker(vision: any, fileset: any, runningMode: 'VIDEO' | 'IMAGE'): Promise<any> {
  const base = {
    baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
    runningMode,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  } as Record<string, any>;
  return vision.PoseLandmarker.createFromOptions(fileset, base).catch(() =>
    vision.PoseLandmarker.createFromOptions(fileset, {
      ...base,
      baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'CPU' },
    }),
  );
}

export function VestidorRa({ abierto, prenda, onCerrar, onReservar }: Props) {
  const { usuario, token } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerVideoRef = useRef<any>(null);
  const landmarkerImagenRef = useRef<any>(null);
  const anclasRef = useRef<Anclas | null>(null);
  const prendaObjRef = useRef<ObjetoPrenda | null>(null);
  const puntosRef = useRef<PuntosCuerpo | null>(null);
  const fondoFotoRef = useRef<HTMLImageElement | null>(null);
  const fondoCongeladoRef = useRef<HTMLImageElement | null>(null);

  const [estadoCamara, setEstadoCamara] = useState<EstadoCamara>('solicitando');
  const [poseCargando, setPoseCargando] = useState(false);
  const [poseDetectada, setPoseDetectada] = useState(false);
  const [congelada, setCongelada] = useState(false);
  const [modoFoto, setModoFoto] = useState(false);
  const [medidas, setMedidas] = useState('');
  const [alturaCm, setAlturaCm] = useState('');
  const [escala, setEscala] = useState(1.3);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [rotacion, setRotacion] = useState(0);
  const [opacidad, setOpacidad] = useState(0.92);
  const [tolerancia, setTolerancia] = useState(40);
  const [sesion, setSesion] = useState<RespuestaSesionRa | null>(null);
  const [enviando, setEnviando] = useState<'Gusta' | 'No gusta' | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);
  const [ultimoResultado, setUltimoResultado] = useState<'Gusta' | 'No gusta' | null>(null);
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false);

  const detenerModelo = () => {
    landmarkerVideoRef.current?.close?.();
    landmarkerVideoRef.current = null;
    landmarkerImagenRef.current?.close?.();
    landmarkerImagenRef.current = null;
  };

  const detenerCamara = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!abierto) return;
    setMedidas('');
    setAlturaCm('');
    setEscala(1.3);
    setPosX(0);
    setPosY(0);
    setRotacion(0);
    setOpacidad(0.92);
    setTolerancia(40);
    setSesion(null);
    setMensaje(null);
    setUltimoResultado(null);
    setPoseDetectada(false);
    setCongelada(false);
    setModoFoto(false);
    setEstadoCamara('idle');
    setAvanzadoAbierto(false);
    puntosRef.current = null;
    anclasRef.current = null;
    fondoFotoRef.current = null;
    fondoCongeladoRef.current = null;

    let activo = true;

    const cargarModelo = async () => {
      setPoseCargando(true);
      try {
        const vision = await cargarVision();
        const fileset = await vision.FilesetResolver.forVisionTasks(`${VISION_CDN}/wasm`);
        if (activo) landmarkerVideoRef.current = await prepararLandmarker(vision, fileset, 'VIDEO');
      } catch (err) {
        if (activo) setMensaje({ tipo: 'error', texto: (err as Error).message });
      } finally {
        if (activo) setPoseCargando(false);
      }
    };

    void cargarModelo();
    return () => {
      activo = false;
      detenerCamara();
      detenerModelo();
    };
  }, [abierto, detenerCamara]);

  useEffect(() => {
    if (!abierto || !prenda?.imagen) return;
    let activo = true;
    cargarPrendaRecortada(prenda.imagen, tolerancia)
      .then((canvas) => {
        if (!activo) return;
        prendaObjRef.current = {
          fuente: canvas,
          anchoNatural: canvas.width,
          altoNatural: canvas.height,
        };
      })
      .catch((err) => {
        if (activo) setMensaje({ tipo: 'error', texto: (err as Error).message });
      });
    return () => {
      activo = false;
    };
  }, [abierto, prenda, tolerancia]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, enviando, onCerrar]);

  const calcularAnclas = useCallback((): Anclas | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    let fuenteAncho: number;
    let fuenteAlto: number;

    if (fondoCongeladoRef.current) {
      fuenteAncho = fondoCongeladoRef.current.naturalWidth || canvas.width;
      fuenteAlto = fondoCongeladoRef.current.naturalHeight || canvas.height;
    } else if (fondoFotoRef.current) {
      fuenteAncho = fondoFotoRef.current.naturalWidth || canvas.width;
      fuenteAlto = fondoFotoRef.current.naturalHeight || canvas.height;
    } else if (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
      fuenteAncho = videoRef.current.videoWidth;
      fuenteAlto = videoRef.current.videoHeight;
    } else {
      return null;
    }

    const cw = canvas.width;
    const ch = canvas.height;
    const s = Math.max(cw / fuenteAncho, ch / fuenteAlto);
    const dw = fuenteAncho * s;
    const dh = fuenteAlto * s;
    return { ancho: fuenteAncho, alto: fuenteAlto, dx: (cw - dw) / 2, dy: (ch - dh) / 2, dw, dh };
  }, []);

  const pintarFondo = useCallback(
    (ctx: CanvasRenderingContext2D, anclas: Anclas) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cw = canvas.width;
      const ch = canvas.height;

      const base = fondoCongeladoRef.current || fondoFotoRef.current;
      if (base) {
        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(base, anclas.dx, anclas.dy, anclas.dw, anclas.dh);
        return;
      }

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      ctx.save();
      ctx.clearRect(0, 0, cw, ch);
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, anclas.dx, anclas.dy, anclas.dw, anclas.dh);
      ctx.restore();
    },
    [],
  );

  const dibujarPrenda = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const anclas = anclasRef.current;
    const prendaObj = prendaObjRef.current;
    if (!canvas || !ctx || !anclas || !prendaObj || anclas.dw <= 0) return;

    pintarFondo(ctx, anclas);

    const cw = canvas.width;
    const ch = canvas.height;
    const espejado = !fondoCongeladoRef.current && !fondoFotoRef.current;

    const puntos = puntosRef.current;
    let cx: number;
    let cy: number;
    let anchoObjetivo: number;

    if (puntos) {
      const xI = anclas.dx + puntos.hombroI.x * anclas.dw;
      const xD = anclas.dx + puntos.hombroD.x * anclas.dw;
      const cxNormal = (xI + xD) / 2;
      cx = espejado ? cw - cxNormal : cxNormal;
      cy = anclas.dy + puntos.cy * anclas.dh;
      anchoObjetivo = Math.abs(xD - xI) * escala;
    } else {
      cx = cw / 2;
      cy = ch * 0.55;
      anchoObjetivo = cw * 0.42 * escala;
    }

    const altoImg = (anchoObjetivo * prendaObj.altoNatural) / prendaObj.anchoNatural;
    const cuelloY = altoImg * 0.14;

    ctx.save();
    ctx.translate(cx + posX, cy + posY);
    ctx.rotate((rotacion * Math.PI) / 180);
    ctx.globalAlpha = Math.max(0.2, Math.min(1, opacidad));
    ctx.drawImage(
      prendaObj.fuente,
      -anchoObjetivo / 2,
      -cuelloY,
      anchoObjetivo,
      altoImg,
    );
    ctx.restore();
  }, [escala, posX, posY, rotacion, opacidad, pintarFondo]);

  useEffect(() => {
    if (!abierto) return;
    let raf = 0;
    const bucle = () => {
      raf = requestAnimationFrame(bucle);
      anclasRef.current = calcularAnclas();
      dibujarPrenda();
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, [abierto, calcularAnclas, dibujarPrenda]);

  const detectarVideo = useCallback((): boolean => {
    const landmarker = landmarkerVideoRef.current;
    const video = videoRef.current;
    const anclas = anclasRef.current;
    if (!landmarker || !video || video.readyState < 2 || !anclas) return false;

    let resultados: any;
    try {
      resultados = landmarker.detectForVideo(video, Math.max(1, Math.round(video.currentTime * 1000) + 1));
    } catch {
      return false;
    }

    const pose = resultados?.landmarks?.[0];
    if (!pose || pose.length < 24) return false;

    const F = (i: number) => ({ x: Number(pose[i].x), y: Number(pose[i].y) });
    const hombroI = F(11);
    const hombroD = F(12);
    if (Math.abs(hombroI.x - hombroD.x) < 0.02) return false;

    puntosRef.current = {
      cx: (hombroI.x + hombroD.x) / 2,
      cy: (hombroI.y + hombroD.y) / 2,
      anchoHombrosPx: Math.abs(hombroI.x - hombroD.x) * anclas.dw,
      hombroI,
      hombroD,
      nariz: F(0),
      cintura: F(23),
    };
    return true;
  }, []);

  useEffect(() => {
    if (!abierto || modoFoto || congelada) return;
    let raf = 0;
    let ultima = 0;
    const chequeo = (ts: number) => {
      raf = requestAnimationFrame(chequeo);
      if (ts - ultima < 150) return;
      ultima = ts;
      if (detectarVideo()) setPoseDetectada(true);
    };
    raf = requestAnimationFrame(chequeo);
    return () => cancelAnimationFrame(raf);
  }, [abierto, modoFoto, congelada, detectarVideo]);

  const congelar = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const anclas = anclasRef.current;
    if (!video || !canvas || !anclas) return;
    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    const ctx = snapshot.getContext('2d');
    if (!ctx) return;
    dibujarPrenda();
    ctx.drawImage(canvas, 0, 0);
    const img = new Image();
    img.src = snapshot.toDataURL('image/jpeg', 0.9);
    img.onload = () => {
      fondoCongeladoRef.current = img;
      anclasRef.current = null;
      setCongelada(true);
      detenerCamara();
    };
  };

  const reanudar = () => {
    fondoCongeladoRef.current = null;
    anclasRef.current = null;
    setCongelada(false);
    setPoseDetectada(false);
    setEstadoCamara('solicitando');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 900 } }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        setEstadoCamara('activa');
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }
        });
      })
      .catch(() => setEstadoCamara('denegada'));
  };

  const subirFoto = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      fondoFotoRef.current = img;
      anclasRef.current = null;
      if (streamRef.current) detenerCamara();
      setModoFoto(true);
      setPoseDetectada(false);
      setEstadoCamara('solicitando');
      const detectarEnImagen = async () => {
        try {
          const vision = (window as unknown as Record<string, any>).vision ?? (await cargarVision());
          if (!landmarkerImagenRef.current) {
            const fileset = await vision.FilesetResolver.forVisionTasks(`${VISION_CDN}/wasm`);
            landmarkerImagenRef.current = await prepararLandmarker(vision, fileset, 'IMAGE');
          }
          const resultados = landmarkerImagenRef.current.detectForImage(img as any, Date.now());
          const pose = resultados?.landmarks?.[0];
          if (!pose || pose.length < 24) return;

          const anclas = calcularAnclas();
          if (!anclas) return;
          const F = (i: number) => ({ x: Number(pose[i].x), y: Number(pose[i].y) });
          puntosRef.current = {
            cx: (F(11).x + F(12).x) / 2,
            cy: (F(11).y + F(12).y) / 2,
            anchoHombrosPx: Math.abs(F(11).x - F(12).x) * anclas.dw,
            hombroI: F(11),
            hombroD: F(12),
            nariz: F(0),
            cintura: F(23),
          };
          setPoseDetectada(true);
        } catch {
          // modo manual
        }
      };
      void detectarEnImagen();
    };
    img.src = url;
  };

  const calculaMedidas = useCallback((): string => {
    const puntos = puntosRef.current;
    const altura = Number.parseFloat(alturaCm);
    if (!puntos || !altura || altura <= 0) return '';

    const referenciaCm = 0.245 * altura;
    const pxPorCm = puntos.anchoHombrosPx / referenciaCm;
    if (!pxPorCm || pxPorCm <= 0) return '';

    const hombrosCm = Math.round(puntos.anchoHombrosPx / pxPorCm);
    const torsoCm = Math.round(0.46 * altura);
    return `Ancho hombros ≈ ${hombrosCm} cm · Largo torso ≈ ${torsoCm} cm (estimado con altura ${Math.round(altura)} cm)`;
  }, [alturaCm]);

  const medidaFinal = (): string => {
    const base = medidas.trim();
    const auto = calculaMedidas();
    if (auto && base) return `${base} · ${auto}`;
    return auto || base;
  };

  const generarSnapshot = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    dibujarPrenda();
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const calificar = async (resultado: 'Gusta' | 'No gusta') => {
    if (!token) {
      setMensaje({ tipo: 'error', texto: 'Inicia sesión para guardar tu prueba en el vestidor virtual.' });
      return;
    }
    if (!prenda) return;
    setEnviando(resultado);
    setMensaje(null);
    try {
      let idSesion = sesion?.id_sesion_ra ?? null;
      if (idSesion == null) {
        const snapshot = generarSnapshot();
        guardarFotoSesion(snapshot);
        const creada = await api.crearSesionRa({
          id_ptc: prenda.id_ptc,
          medidas_avatar: medidaFinal() || undefined,
          foto_resultado: snapshot || undefined,
        });
        idSesion = creada.id_sesion_ra;
        setSesion(creada);
      }
      const res = await api.registrarResultadoRa(idSesion, resultado);
      setUltimoResultado(res.resultado);
      setMensaje({
        tipo: 'exito',
        texto: res.actualizado
          ? `Prueba actualizada: ${res.resultado}.`
          : `Prenda marcada como "${res.resultado}".`,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No pudimos guardar tu prueba en el vestidor virtual.';
      setMensaje({ tipo: 'error', texto: msg });
    } finally {
      setEnviando(null);
    }
  };

  const reiniciarCamara = () => {
    fondoFotoRef.current = null;
    anclasRef.current = null;
    setModoFoto(false);
    setPoseDetectada(false);
    setEstadoCamara('solicitando');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 900 } }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        setEstadoCamara('activa');
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }
        });
      })
      .catch(() => setEstadoCamara('denegada'));
  };

  const reiniciarCamaraDespuesDenegada = () => {
    setEstadoCamara('solicitando');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 900 } }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        setEstadoCamara('activa');
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }
        });
      })
      .catch(() => setEstadoCamara('denegada'));
  };

  if (!abierto || !prenda) return null;

  const enVivo = estadoCamara === 'activa' && !congelada && !modoFoto;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-gradient-to-r from-accent-50 to-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
              <ScanLine size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink-900">Vestidor virtual RA</h2>
              <p className="text-xs font-medium text-ink-500">
                {prenda.nombre} · Talla {prenda.talla} · Color {prenda.color}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition"
            aria-label="Cerrar vestidor"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid flex-1 gap-0 overflow-auto md:grid-cols-2">
          <div className="relative min-h-[380px] overflow-hidden bg-gradient-to-b from-ink-900 to-ink-950">
            <canvas ref={canvasRef} width={540} height={720} className="h-full min-h-[380px] w-full object-contain" />
            <video ref={videoRef} playsInline muted className="hidden" />

            <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5">
              {enVivo && (
                <span className="flex items-center gap-1.5 rounded-full bg-ink-950/70 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                  <Camera size={13} /> Cámara activa
                </span>
              )}
              {poseDetectada ? (
                <Badge variant="success" className="shadow-xs">
                  Cuerpo detectado
                </Badge>
              ) : (
                <Badge variant="neutral" className="shadow-xs">
                  Modo manual
                </Badge>
              )}
              {poseCargando && (
                <Badge variant="accent" className="shadow-xs">
                  <Loader2 size={12} className="animate-spin" /> Detección de cuerpo…
                </Badge>
              )}
            </div>

            {enVivo && !poseDetectada && !poseCargando && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-ink-950/70 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
                <AlertTriangle size={12} className="text-amber-400" />
                Ubícate de frente con el cuerpo visible.
              </div>
            )}
            {modoFoto && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-ink-950/70 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
                <ImagePlus size={12} className="text-accent-300" /> Foto cargada
              </div>
            )}
            {congelada && (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-ink-950/70 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur">
                <CameraOff size={12} className="text-accent-300" /> Imagen congelada
              </div>
            )}

            {estadoCamara === 'idle' && !modoFoto && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-ink-950/85 p-6 text-center text-white">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500/20 text-accent-300">
                  <ScanLine size={30} />
                </span>
                <div>
                  <p className="text-sm font-bold">Vestidor virtual RA</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-white/75">
                    Sube una foto de cuerpo completo o usa tu cámara para ver cómo te queda la prenda.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-700 transition">
                    <ImagePlus size={16} /> Subir mi foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => subirFoto(e.target.files?.[0])}
                    />
                  </label>
                  <Button onClick={reiniciarCamaraDespuesDenegada} className="bg-white text-ink-900 hover:bg-white/90">
                    <Camera size={16} /> Usar cámara
                  </Button>
                </div>
              </div>
            )}
            {estadoCamara === 'solicitando' && !modoFoto && !congelada && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950/60 text-center text-white">
                <Loader2 size={30} className="animate-spin text-accent-300" />
                <p className="text-sm font-semibold">Activando cámara…</p>
              </div>
            )}
            {estadoCamara === 'denegada' && !modoFoto && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950/85 p-6 text-center text-white">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <CameraOff size={28} />
                </span>
                <p className="text-sm font-bold">El vestidor virtual requiere acceso a la cámara.</p>
                <p className="max-w-xs text-xs text-white/75">
                  Confirma el permiso de cámara en los ajustes de tu navegador, o sube una foto de cuerpo
                  completo.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={reiniciarCamaraDespuesDenegada} className="bg-white text-ink-900 hover:bg-white/90">
                    <RefreshCw size={15} /> Reintentar
                  </Button>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 transition">
                    <ImagePlus size={15} /> Subir foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => subirFoto(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            )}
            {estadoCamara === 'no_disponible' && !modoFoto && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-950/85 p-6 text-center text-white">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <CameraOff size={28} />
                </span>
                <p className="text-sm font-bold">El vestidor virtual requiere acceso a la cámara.</p>
                <p className="max-w-xs text-xs text-white/75">
                  Tu navegador o dispositivo no expone una cámara. Puedes subir una foto de cuerpo completo.
                </p>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 transition">
                  <ImagePlus size={15} /> Subir foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => subirFoto(e.target.files?.[0])}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 p-5">
            {usuario ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-ink-800">1. Elige cómo probarte la prenda</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-brand-500 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700 hover:bg-brand-100 transition">
                      <ImagePlus size={16} /> Subir mi foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => subirFoto(e.target.files?.[0])}
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        if (modoFoto) {
                          reiniciarCamara();
                        } else if (congelada) {
                          reanudar();
                        } else {
                          setEstadoCamara('solicitando');
                          reiniciarCamaraDespuesDenegada();
                        }
                      }}
                    >
                      {modoFoto || congelada ? <RefreshCw size={15} /> : <Camera size={15} />}
                      {modoFoto || congelada ? 'Reanudar cámara' : 'Usar cámara'}
                    </Button>
                  </div>
                </div>

                {(modoFoto || congelada || enVivo) && (
                  <div className="flex flex-wrap gap-2">
                    {enVivo && (
                      <Button size="sm" variant="secondary" onClick={congelar}>
                        <CameraOff size={15} /> Congelar
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-bold text-ink-800">
                    <Ruler size={15} className="text-brand-600" /> Tu altura (cm)
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={120}
                      max={220}
                      value={alturaCm}
                      onChange={(e) => setAlturaCm(e.target.value.slice(0, 3))}
                      placeholder="Ej. 170"
                    />
                    <span className="text-xs text-ink-400">para estimar tus medidas</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAvanzadoAbierto((v) => !v)}
                  className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/40 px-3 py-2 text-left"
                >
                  <span className="text-sm font-bold text-ink-800">Ajustar prenda</span>
                  <ChevronDown size={16} className={cn('text-ink-400 transition', avanzadoAbierto && 'rotate-180')} />
                </button>

                {avanzadoAbierto && (
                  <div className="flex flex-col gap-3">
                    <SliderValor
                      labelEsq="Tamaño"
                      valor={escala}
                      min={0.5}
                      max={2.5}
                      paso={0.05}
                      onChange={setEscala}
                      formatear={(v) => `${Math.round(v * 100)}%`}
                    />
                    <SliderValor
                      labelEsq="Vertical"
                      valor={posY}
                      min={-160}
                      max={160}
                      paso={1}
                      onChange={setPosY}
                      formatear={(v) => `${v > 0 ? '+' : ''}${v}px`}
                    />
                    <SliderValor
                      labelEsq="Horizontal"
                      valor={posX}
                      min={-160}
                      max={160}
                      paso={1}
                      onChange={setPosX}
                      formatear={(v) => `${v > 0 ? '+' : ''}${v}px`}
                    />
                    <SliderValor
                      labelEsq="Rotación"
                      valor={rotacion}
                      min={-30}
                      max={30}
                      paso={0.5}
                      onChange={setRotacion}
                      formatear={(v) => `${v > 0 ? '+' : ''}${v}°`}
                    />
                    <SliderValor
                      labelEsq="Opacidad"
                      valor={opacidad}
                      min={0.3}
                      max={1}
                      paso={0.01}
                      onChange={setOpacidad}
                      formatear={(v) => `${Math.round(v * 100)}%`}
                    />
                    <SliderValor
                      labelEsq="Borrado de fondo"
                      valor={tolerancia}
                      min={5}
                      max={90}
                      paso={1}
                      onChange={setTolerancia}
                      formatear={(v) => `${v}%`}
                    />
                  </div>
                )}

                <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-3 text-xs text-ink-600">
                  <p className="mb-1 font-bold text-ink-800">Prueba virtual</p>
                  {poseDetectada ? (
                    <span>
                      Detectamos tu cuerpo y colocamos la prenda según la anchura de tus hombros. Ajusta
                      tamaño y posición si lo necesitas.
                    </span>
                  ) : (
                    <span>
                      Ubica tu cuerpo completo de frente a la cámara, o sube una foto. Si no se detecta,
                      ajusta la prenda manualmente con los controles.
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-bold text-ink-800">
                    <Ruler size={15} className="text-brand-600" /> Nota de medidas (opcional)
                  </label>
                  <Input
                    value={medidas}
                    onChange={(e) => setMedidas(e.target.value.slice(0, 255))}
                    placeholder="Ej. Espalda 40 · Pecho 96 · Cintura 78"
                  />
                </div>

                {mensaje && (
                  <div
                    className={cn(
                      'flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-medium',
                      mensaje.tipo === 'exito'
                        ? 'bg-success-50 text-success-800'
                        : 'bg-danger-50 text-danger-700',
                    )}
                  >
                    {mensaje.tipo === 'exito' ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    ) : (
                      <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                    )}
                    <span>{mensaje.texto}</span>
                  </div>
                )}

                {poseDetectada && alturaCm && (
                  <p className="text-center text-[11px] text-ink-400">
                    Medidas estimadas: {medidaFinal()}
                  </p>
                )}

                <div className="mt-auto flex flex-col gap-2.5">
                  {ultimoResultado ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-success-50 px-3 py-2.5 text-sm font-bold text-success-800">
                        <CheckCircle2 size={17} /> Prueba guardada: {ultimoResultado}
                      </div>
                      {ultimoResultado === 'Gusta' && (
                        <Button size="lg" className="w-full" onClick={() => onReservar(prenda)}>
                          Reservar para probar en sucursal
                        </Button>
                      )}
                      <Button variant="ghost" onClick={onCerrar}>
                        Terminar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Button
                          size="lg"
                          variant="secondary"
                          loading={enviando === 'No gusta'}
                          disabled={Boolean(enviando)}
                          onClick={() => void calificar('No gusta')}
                        >
                          <ThumbsDown size={18} /> No gusta
                        </Button>
                        <Button
                          size="lg"
                          loading={enviando === 'Gusta'}
                          disabled={Boolean(enviando)}
                          onClick={() => void calificar('Gusta')}
                          className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800"
                        >
                          <ThumbsUp size={18} /> Me gusta
                        </Button>
                      </div>
                      <p className="text-center text-[11px] text-ink-400">
                        Al calificar guardamos la foto de tu prueba junto a tus medidas; luego podrás cambiar
                        tu opinión cuando quieras.
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
                  <ScanLine size={26} />
                </span>
                <p className="text-sm font-bold text-ink-800">Inicia sesión para usar el vestidor virtual</p>
                <p className="max-w-sm text-xs text-ink-500">
                  Guarda tus pruebas, marca tus prendas favoritas y reserva las que más te gusten.
                </p>
                <Button onClick={onCerrar} variant="secondary">
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SliderValorProps {
  labelEsq: React.ReactNode;
  valor: number;
  min: number;
  max: number;
  paso: number;
  onChange: (v: number) => void;
  formatear: (v: number) => string;
}

function SliderValor({ labelEsq, valor, min, max, paso, onChange, formatear }: SliderValorProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-xs font-semibold text-ink-700">
        <span className="flex items-center gap-1.5">{labelEsq}</span>
        <span className="rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-[10px] text-ink-600">
          {formatear(valor)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-brand-600"
      />
    </label>
  );
}