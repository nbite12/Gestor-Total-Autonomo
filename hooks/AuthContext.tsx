import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../services/api';

interface User {
    id: string;
    username: string;
    role: 'user' | 'admin';
    isGuest?: boolean;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: any) => Promise<void>;
    register: (credentials: any) => Promise<void>;
    logout: () => void;
    loginAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const validateToken = async () => {
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    // This endpoint should verify the token and return the user
                    const userData = await api<User>('/auth/me'); 
                    setUser(userData);
                } catch (error) {
                    console.error("Token validation failed", error);
                    localStorage.removeItem('authToken');
                }
            }
            setIsLoading(false);
        };
        validateToken();
    }, []);

    const login = async (credentials: any) => {
        const { token, user: loggedInUser } = await api<{token: string, user: User}>('/auth/login', {
            method: 'POST',
            body: credentials
        });
        localStorage.setItem('authToken', token);
        setUser(loggedInUser);
    };

    const register = async (credentials: any) => {
        // Your backend should return the same structure on register as on login
        const { token, user: newUser } = await api<{token: string, user: User}>('/auth/register', {
            method: 'POST',
            body: credentials
        });
        localStorage.setItem('authToken', token);
        setUser(newUser);
    };
    
    const logout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
    };

    const loginAsGuest = () => {
        setUser({
            id: 'guest-user',
            username: 'Invitado',
            role: 'user',
            isGuest: true,
        });
        setIsLoading(false);
    };

    const value = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        loginAsGuest,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};