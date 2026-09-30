import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, FileText, Download, Eye, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/Button.js';
import { Card } from '@/components/ui/Card.js';
import { api, type RespuestaReporteVoz } from '@/lib/api.js';
import { useAuth } from '@/contexts/AuthContext.js';

export function ReportesVoz() {
  const { usuario: _usuario } = useAuth();
  const [estaGrabando, setEstaGrabando] = useState(false);
  const [textoTranscrito, setTextoTranscrito] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [reporte, setReporte] = useState<RespuestaReporteVoz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Web Speech API para transcripción en tiempo real (opcional)
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-BO';

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setTextoTranscrito(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
      };
    }
  }, []);

  const iniciarGrabacion = async () => {
    setError(null);
    setReporte(null);
    setTextoTranscrito('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        enviarComando(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current.start();
      setEstaGrabando(true);

      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (err) {
      setError('No se pudo acceder al micrófono. Por favor otorga los permisos necesarios.');
    }
  };

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && estaGrabando) {
      mediaRecorderRef.current.stop();
      setEstaGrabando(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  };

  const enviarComando = async (audio?: Blob) => {
    setProcesando(true);
    setError(null);
    try {
      const resp = await api.generarReporteVoz(audio, textoTranscrito);
      if (resp.id_reporte === 0) {
        // Es un paso de confirmación
        setTextoTranscrito(resp.resumen);
      } else {
        setReporte(resp);
        // Feedback de voz si es posible
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(resp.resumen);
          utterance.lang = 'es-BO';
          window.speechSynthesis.speak(utterance);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el comando de voz.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-extrabold text-ink-900 flex items-center gap-2">
          <Mic className="text-brand-600" />
          Generar Reporte por Voz
        </h2>
        <p className="text-ink-500 text-sm">
          Dicta el tipo de reporte, la sucursal y el período (ej: "ventas de sucursal Centro del mes pasado en PDF").
        </p>
      </div>

      <Card className="p-8 flex flex-col items-center justify-center gap-6 border-dashed border-2">
        <div className="relative">
          {estaGrabando && (
            <span className="absolute -inset-4 rounded-full bg-brand-500/20 animate-ping" />
          )}
          <Button
            size="lg"
            variant={estaGrabando ? 'danger' : 'primary'}
            className="h-24 w-24 rounded-full shadow-lg transition-transform active:scale-95"
            onClick={estaGrabando ? detenerGrabacion : iniciarGrabacion}
            disabled={procesando}
          >
            {estaGrabando ? <MicOff size={32} /> : <Mic size={32} />}
          </Button>
        </div>

        <div className="text-center space-y-2">
          <p className={cn("font-bold text-lg", estaGrabando ? "text-brand-600" : "text-ink-900")}>
            {estaGrabando ? "Escuchando..." : procesando ? "Procesando audio..." : "Pulsa para hablar"}
          </p>
          {textoTranscrito && (
            <p className="italic text-ink-600 bg-ink-50 px-4 py-2 rounded-lg max-w-lg">
              "{textoTranscrito}"
            </p>
          )}
        </div>
      </Card>

      {error && (
        <Card className="border-danger-200 bg-danger-50 p-4 flex gap-3 items-start">
          <AlertCircle className="text-danger-600 shrink-0" />
          <p className="text-sm text-danger-800 font-medium">{error}</p>
        </Card>
      )}

      {procesando && (
        <div className="flex justify-center py-4">
          <RefreshCw className="animate-spin text-brand-600" size={32} />
        </div>
      )}

      {reporte && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300 border-success-200 bg-success-50/30 overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-success-100 flex items-center justify-center text-success-600">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="font-bold text-ink-900">¡Reporte generado con éxito!</p>
                <p className="text-sm text-ink-600">{reporte.resumen}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <a 
                href={`${api.baseUrl.replace('/api/v1', '')}${reporte.url_archivo}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full gap-2" variant="primary">
                  <Eye size={18} /> Ver Reporte
                </Button>
              </a>
              <a 
                href={`${api.baseUrl.replace('/api/v1', '')}${reporte.url_archivo}`} 
                download
                className="flex-1"
              >
                <Button className="w-full gap-2" variant="secondary">
                  <Download size={18} /> Descargar
                </Button>
              </a>
            </div>
          </div>
        </Card>
      )}

      <div className="pt-4">
        <h3 className="text-sm font-bold text-ink-400 uppercase tracking-wider mb-3">Ejemplos de comandos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            'Reporte de ventas de sucursal Centro de hoy en PDF',
            'Inventario de la sucursal Sur en Excel',
            'Disponibilidad sucursal Norte de esta semana',
            'Ventas del mes pasado de la sucursal Centro en CSV'
          ].map((ej, idx) => (
            <div key={idx} className="p-3 bg-white border border-ink-100 rounded-xl text-xs text-ink-600 flex items-center gap-2">
              <FileText size={14} className="text-ink-300" />
              {ej}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
