import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) {
        return initialValue;
      }
      
      const storedData = JSON.parse(item);

      // Handle data migration by merging. Ensures new fields in `initialValue` are added.
      // This is a shallow merge for the top level, with a specific deeper merge for settings.
      const hydratedData = {
        ...initialValue, // Provides all default keys
        ...storedData, // Overwrites with user's saved data
        // Explicitly merge settings to ensure new settings keys are not lost
        settings: {
          ...(initialValue as any).settings,
          ...(storedData as any).settings,
        },
      };

      return hydratedData;

    } catch (error) {
      console.error(`Error al leer o migrar la clave "${key}" de localStorage. Se usarán los valores por defecto.`, error);
      return initialValue;
    }
  });

  // 2. Usar useEffect para sincronizar el estado con localStorage cada vez que `storedValue` cambie.
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error al escribir la clave “${key}” en localStorage:`, error);
    }
  }, [key, storedValue]);

  // 3. Usar otro useEffect para escuchar eventos de almacenamiento y sincronizar entre pestañas.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
            console.error(`Error al parsear el cambio de storage para la clave “${key}”:`, error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  // 4. Devolver el valor y la función de actualización de estado, igual que en un `useState` normal.
  return [storedValue, setStoredValue];
}