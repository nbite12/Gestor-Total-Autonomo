import React, { useState, useRef, useEffect } from 'react';
// @ts-ignore
import { icons as lucideIcons } from 'lucide-react';

// --- Icon Component (usando Lucide) ---
export const Icon = ({ name, className = 'w-6 h-6' }) => {
  const LucideIcon = lucideIcons[name];
  if (!LucideIcon) { 
    console.warn(`Icon "${name}" not found.`);
    return null; 
  }
  return <LucideIcon className={className} strokeWidth={1.5} />;
};


// --- Button Component ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-950 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border';
    
    const variantClasses = {
      primary: 'bg-white/20 dark:bg-black/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-semibold hover:bg-white/30 dark:hover:bg-black/20 focus:ring-blue-500',
      secondary: 'bg-white/10 dark:bg-black/10 text-gray-800 dark:text-gray-200 border-transparent hover:bg-white/20 dark:hover:bg-black/20 focus:ring-primary-500',
      danger: 'bg-red-500 border-transparent text-white hover:bg-red-600 focus:ring-red-500',
      ghost: 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-500/10 dark:hover:bg-white/10 focus:ring-primary-500',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm gap-1',
      md: 'px-4 py-2 text-base gap-2',
      lg: 'px-6 py-3 text-lg gap-3',
    };

    return (
      <button ref={ref} className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>
        {children}
      </button>
    );
  }
);


// --- Card Component (Estilo Liquid Glass) ---
export const Card: React.FC<{ children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => {
  return (
    <div 
      className={`bg-white/50 dark:bg-black/20 backdrop-blur-xl saturate-150 border border-white/20 dark:border-white/10 rounded-3xl shadow-lg ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};


// --- Input Component ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, error, containerClassName, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
    return (
      <div className={containerClassName}>
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>}
        <input
          id={inputId}
          ref={ref}
          className={`block w-full px-4 py-2 bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 rounded-xl shadow-inner text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'ring-2 ring-red-500' : ''}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

// --- Select Component ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  containerClassName?: string;
  children: React.ReactNode;
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, id, error, containerClassName, children, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substring(2, 9)}`;
    return (
      <div className={containerClassName}>
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
        <select
          id={selectId}
          ref={ref}
          className={`block w-full px-4 py-2.5 bg-white/10 dark:bg-black/10 backdrop-blur-sm border border-white/20 rounded-lg shadow-inner-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm transition-colors ${error ? 'ring-2 ring-red-500' : ''}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
});


// --- Modal Component (Con Backdrop Blur) ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-50 overflow-y-auto" 
      onClick={onClose}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-center min-h-full p-4">
        <Card 
          className="w-full max-w-lg flex flex-col p-6" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-shrink-0 flex justify-between items-center pb-4 border-b border-white/20">
            <h3 id="modal-title" className="text-xl font-semibold">{title}</h3>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar modal">
              <Icon name="X" className="w-5 h-5" />
            </Button>
          </div>
          <div className="pt-6 overflow-y-auto">
            {children}
          </div>
        </Card>
      </div>
    </div>
  );
};

// --- Unsupported Models Modal Component ---
export const UnsupportedModelsModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Información Adicional">
            <div className="space-y-4 text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-3">
                    <Icon name="Info" className="w-6 h-6 text-primary-500 flex-shrink-0 mt-1" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                        Modelos Fiscales No Incluidos Actualmente
                    </h3>
                </div>
                <p>
                    Nuestra aplicación está diseñada para cubrir los modelos fiscales más comunes para autónomos en régimen de estimación directa que operan en la península. Para garantizar una experiencia simple y eficaz, algunos casos y regímenes específicos aún no están implementados directamente en la app.
                </p>
                <h4 className="font-semibold pt-2 text-slate-700 dark:text-slate-200">Por el momento, los siguientes modelos no se gestionan en la aplicación:</h4>
                <ul className="list-disc list-inside space-y-2 pl-2">
                    <li><strong>Modelo 131</strong> (IRPF para régimen de estimación objetiva - Módulos).</li>
                    <li><strong>Modelos de IGIC Canario</strong> (ej. 420, 425).</li>
                    <li><strong>Declaración Intrastat</strong>.</li>
                    <li><strong>Impuesto sobre el Patrimonio</strong> (Modelo 714).</li>
                    <li><strong>Declaración de bienes en el extranjero</strong> (Modelo 720).</li>
                    <li><strong>Impuesto de Sociedades</strong> (Modelo 200).</li>
                </ul>
                <p className="pt-2">
                    Estamos trabajando constantemente para ampliar la compatibilidad de la aplicación.
                </p>
            </div>
        </Modal>
    );
};


// --- HelpTooltip (Estilo Apple) ---
export const HelpTooltip: React.FC<{ content: string }> = ({ content }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleInteraction = (event: MouseEvent | TouchEvent) => {
      if (isOpen && wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    return () => {
      document.removeEventListener('mousedown', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block ml-2" ref={wrapperRef}>
        <button type="button" onClick={() => setIsOpen(o => !o)} aria-label="Mostrar ayuda" aria-expanded={isOpen}>
            <Icon name="HelpCircle" className="w-4 h-4 text-gray-500" />
        </button>
        {isOpen && <div className="fixed md:hidden inset-0 bg-black bg-opacity-30 z-40" onClick={() => setIsOpen(false)} />}
        <div
            className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-black/80 text-white text-sm rounded-lg shadow-lg transition-opacity duration-300 z-50 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            role="tooltip"
        >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-black/80" />
        </div>
    </div>
  );
};


// --- Switch Component ---
interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
}
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label }) => {
    return (
        <div className="flex items-center justify-between w-full">
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {label}
            </label>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`${checked ? 'bg-green-500' : 'bg-black/10 dark:bg-white/10'} relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
                <span
                    aria-hidden="true"
                    className={`${checked ? 'translate-x-6' : 'translate-x-0'} pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
            </button>
        </div>
    );
};


// --- Celebration Component (Unchanged) ---
export const Celebration: React.FC<{
  type: 'contribution' | 'goalComplete' | 'none';
  onComplete: () => void;
}> = ({ type, onComplete }) => {
  useEffect(() => {
    if (type === 'none') return;
    if (type === 'goalComplete') {
      const playSound = () => {
        // @ts-ignore
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const audioContext = new AudioContext();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        const playNote = (frequency: number, startTime: number, duration: number) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            gainNode.gain.setValueAtTime(1, audioContext.currentTime + startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + startTime + duration);
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start(audioContext.currentTime + startTime);
            oscillator.stop(audioContext.currentTime + startTime + duration);
        };
        const now = 0;
        playNote(261.63, now, 0.15); // C4
        playNote(329.63, now + 0.1, 0.15); // E4
        playNote(392.00, now + 0.2, 0.15); // G4
        playNote(523.25, now + 0.3, 0.3);  // C5
      };
      playSound();
    }
    const timer = setTimeout(() => {
      onComplete();
    }, type === 'goalComplete' ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [type, onComplete]);

  if (type === 'none') return null;

  if (type === 'contribution') {
    return (
      <div className="celebration-overlay">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="rising-emoji" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 1}s` }}>
            {['💰', '✨', '🎉', '🚀'][Math.floor(Math.random() * 4)]}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'goalComplete') {
    return (
      <div className="celebration-overlay goal-complete-backdrop">
        {Array.from({ length: 30 }).map((_, i) => {
          const angle = Math.random() * 360;
          const radius = Math.random() * 250 + 150;
          const x = Math.cos(angle * (Math.PI / 180)) * radius;
          const y = Math.sin(angle * (Math.PI / 180)) * radius;
          return (
            <div
              key={i}
              className="particle"
              style={{
                // @ts-ignore
                '--x': `${x}px`,
                '--y': `${y}px`,
                animationDelay: `${Math.random() * 0.5}s`,
                color: ['#FFD700', '#FFC300', '#FFFFFF'][Math.floor(Math.random() * 3)]
              }}
            >
              {['✨', '⭐', '✦'][Math.floor(Math.random() * 3)]}
            </div>
          );
        })}
        <div className="trophy-container">
          <span className="trophy-icon">🏆</span>
        </div>
        <div className="elegant-message">
          <h1>¡OBJETIVO CONSEGUIDO!</h1>
          <p>¡Enhorabuena, tu esfuerzo ha dado sus frutos!</p>
        </div>
      </div>
    );
  }

  return null;
};