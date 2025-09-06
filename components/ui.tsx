import React from 'react';

// --- Icon Component ---
export const Icon: React.FC<{ name: string; className?: string }> = ({ name, className = 'w-6 h-6' }) => {
  const icons: { [key: string]: JSX.Element } = {
    sun: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />,
    moon: <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />,
    briefcase: <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    home: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    cog: (<><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>),
    plus: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />,
    pencil: <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />,
    trash: <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
    x: <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
    download: <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
    upload: <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />,
    file: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    question: <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    sparkles: <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18l-1.813-2.096a4.5 4.5 0 00-6.364-6.364l-2.096-1.813L3 6l2.096 1.813a4.5 4.5 0 006.364 6.364zm10.187-.208L21 18l-1.813 2.096a4.5 4.5 0 01-6.364 6.364l-2.096 1.813L9 24l2.096-1.813a4.5 4.5 0 016.364-6.364zM18 3l-2.096 1.813a4.5 4.5 0 00-6.364 6.364L9 12l1.813 2.096a4.5 4.5 0 006.364-6.364L21 6z" />,
    paperclip: <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l7.693-7.693a3 3 0 014.242 4.242l-6.148 6.147a1.5 1.5 0 01-2.121-2.121l4.596-4.596" />,
    'credit-card': <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" />,
    cash: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.75A.75.75 0 013 4.5h.75m0 0h.75A.75.75 0 015.25 6v.75m0 0v-.75A.75.75 0 015.25 4.5h-.75m0 0h.75a.75.75 0 01.75.75v.75m0 0v-.75a.75.75 0 01.75-.75h.75a.75.75 0 01.75.75v.75m0 0v-.75a.75.75 0 01.75-.75h.75a.75.75 0 01.75.75v.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />,
    'office-building': <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6h1.5m-1.5 3h1.5m-1.5 3h1.5M6.75 21v-2.25a2.25 2.25 0 012.25-2.25h3a2.25 2.25 0 012.25 2.25V21m-8.25-18h8.25a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0117.25 21h-8.25a2.25 2.25 0 01-2.25-2.25V5.25A2.25 2.25 0 016.75 3z" />,
    'user-circle': <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />,
    'globe': <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 010-18h.01a9 9 0 010 18h-.01zM3.75 9.75h16.5M3.75 14.25h16.5" />,
    'switch-horizontal': <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />,
    'eye': <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 10.224 7.31 6 12 6c4.69 0 8.577 4.224 9.964 5.683a1.012 1.012 0 010 .639C20.577 13.776 16.69 18 12 18c-4.69 0-8.577-4.224-9.964-5.683z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
    'eye-off': <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 14.334 7.21 18 12 18a10.477 10.477 0 007.456-2.986l-1.524-1.524A3.375 3.375 0 0112 15.75a3.375 3.375 0 01-2.932-1.524L3.98 8.223zM15.75 12c0 .269-.022.533-.064.79l-1.4-1.4a2.25 2.25 0 00-3.182-3.182l-1.4-1.4A9.452 9.452 0 0112 4.5c4.79 0 8.774 3.666 9.994 8.25a.375.375 0 01-.486.486l-1.332-.89a11.169 11.169 0 00-2.413-1.61z" />,
    microphone: <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />,
    'external-link': <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5 0V6.375c0-.621.504-1.125 1.125-1.125h4.5m-4.5 0l4.5-4.5m0 0v4.5m0-4.5h-4.5" />,
    'play': <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />,
    'info': <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {icons[name] || null}
    </svg>
  );
};

// --- Button Component ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
      primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
      secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 focus:ring-slate-500',
      danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
      ghost: 'bg-transparent text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 focus:ring-primary-500',
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
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
        <input
          id={inputId}
          ref={ref}
          className={`block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-slate-800 dark:border-slate-600 dark:placeholder-slate-500 ${error ? 'border-red-500' : ''}`}
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
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
        <select
          id={selectId}
          ref={ref}
          className={`block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-slate-800 dark:border-slate-600 ${error ? 'border-red-500' : ''}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
});


// --- Modal Component ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div 
        className="bg-slate-100 dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[95vh]" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar modal">
            <Icon name="x" className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
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
                    <Icon name="info" className="w-6 h-6 text-primary-500 flex-shrink-0 mt-1" />
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


// --- HelpTooltip Component ---
export const HelpTooltip: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="relative inline-block ml-2 group">
      <Icon name="question" className="w-4 h-4 text-slate-400 cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-slate-800 dark:bg-slate-700 text-white text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-800 dark:border-t-slate-700"></div>
      </div>
    </div>
  );
};


// --- Card Component ---
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 sm:p-6 ${className}`}>
      {children}
    </div>
  );
};


// --- Switch Component ---
interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    disabled?: boolean;
}
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled = false }) => {
    const switchId = `switch-${Math.random().toString(36).substring(2, 9)}`;
    return (
        <div className="flex items-center justify-between">
            <label htmlFor={switchId} className={`text-sm font-medium text-slate-700 dark:text-slate-300 ${disabled ? 'opacity-50' : ''}`}>
                {label}
            </label>
            <button
                id={switchId}
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                disabled={disabled}
                className={`${
                checked ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'
                } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                <span
                aria-hidden="true"
                className={`${
                    checked ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
            </button>
        </div>
    );
};