import { InputHTMLAttributes, useId, useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  success?: boolean;
}

export function Input({ label, error, success, required, className = '', type = 'text', ...props }: InputProps) {
  const generatedId=useId();
  const inputId=props.id||generatedId;
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="space-y-2 input-enhanced">
      <label htmlFor={inputId} className="block text-sm font-semibold text-gray-700 transition-colors">
        {label} {required && <span className="text-red-500 text-base">*</span>}
      </label>
      <div className="relative group">
        {/* Input com estilo premium */}
        <input
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          type={inputType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-300 bg-white text-gray-900 font-medium placeholder:text-gray-400 ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100'
              : success
              ? 'border-green-400 focus:border-green-500 focus:ring-4 focus:ring-green-100'
              : 'border-gray-200 focus:border-red-500 focus:ring-4 focus:ring-red-100 hover:border-gray-300'
          } ${isPassword ? 'pr-12' : ''} ${props.disabled ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''} ${className}`}
          {...props}
        />
        
        {/* Botão toggle password */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-red-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}

        {/* Ícone de status */}
        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <AlertCircle className="w-5 h-5 text-red-500 animate-bounce-in" />
          </div>
        )}
        {success && !error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <CheckCircle2 className="w-5 h-5 text-green-500 animate-bounce-in" />
          </div>
        )}

        {/* Barra de progresso no focus */}
        {isFocused && !error && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-600 via-red-500 to-red-600 animate-pulse"></div>
        )}
      </div>
      
      {/* Mensagem de erro com animação */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 animate-slide-in">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
