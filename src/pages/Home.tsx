import { useNavigate } from 'react-router-dom';
import { Building2, User } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v20l4-2 4 2V14M4 6h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"></path></svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3 text-slate-800">Bienvenido a RentFlow</h1>
          <p className="text-slate-500 text-base">¿Cómo deseas acceder a la plataforma?</p>
        </div>

        <div className="grid gap-4">
          <button 
            onClick={() => navigate('/pay')}
            className="group flex items-center gap-5 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100 transition-all text-left w-full"
          >
            <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-600 transition-colors">
              <User className="w-7 h-7 text-indigo-600 group-hover:text-white transition-colors" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Soy Inquilino</h2>
              <p className="text-sm text-slate-500 font-medium">Reportar un pago de alquiler mensual</p>
            </div>
          </button>

          <button 
            onClick={() => navigate('/admin')}
            className="group flex items-center gap-5 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100 transition-all text-left w-full"
          >
            <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-600 transition-colors border border-slate-100 group-hover:border-transparent">
              <Building2 className="w-7 h-7 text-slate-500 group-hover:text-white transition-colors" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Soy Propietario</h2>
              <p className="text-sm text-slate-500 font-medium">Gestionar propiedades y verificar cobros</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
