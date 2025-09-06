import React, { useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { Input, Button, Card } from './ui';

const Auth: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, register, loginAsGuest } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            if (isLogin) {
                await login({ username, password });
            } else {
                await register({ username, password });
            }
        } catch (err: any) {
            setError(err.message || 'Ha ocurrido un error.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4">
            <Card className="w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-primary-500 mb-2">
                        Gestor Total Autónomo
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {isLogin ? 'Inicia sesión para continuar' : 'Crea una cuenta para empezar'}
                    </p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input 
                        label="Nombre de usuario" 
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                    />
                    <Input 
                        label="Contraseña" 
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete={isLogin ? "current-password" : "new-password"}
                    />
                    
                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                           'Procesando...'
                        ) : (
                            isLogin ? 'Iniciar Sesión' : 'Registrarse'
                        )}
                    </Button>
                </form>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t dark:border-slate-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white dark:bg-slate-800 px-2 text-slate-500 dark:text-slate-400">
                        O
                        </span>
                    </div>
                </div>

                <Button variant="secondary" className="w-full" onClick={loginAsGuest}>
                    Entrar como invitado
                </Button>
                
                <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-6">
                    {isLogin ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}
                    <button onClick={() => setIsLogin(!isLogin)} className="font-semibold text-primary-500 hover:text-primary-600 ml-1">
                        {isLogin ? 'Regístrate' : 'Inicia sesión'}
                    </button>
                </p>
            </Card>
        </div>
    );
};

export default Auth;