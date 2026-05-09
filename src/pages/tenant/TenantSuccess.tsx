import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export default function TenantSuccess() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-emerald-200">
        <Check className="w-8 h-8" strokeWidth={3} />
      </div>
      
      <h1 className="text-2xl font-bold tracking-tight mb-2 text-slate-800">¡Comprobante enviado!</h1>
      <p className="text-slate-500 mb-8 max-w-[280px]">
        El propietario ha sido notificado y revisará tu pago pronto.
      </p>
      
      <Button 
        onClick={() => navigate('/pay')} 
        className="w-full max-w-[280px] bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 active:scale-95 transition-transform h-auto"
      >
        Volver al inicio
      </Button>
    </div>
  );
}
