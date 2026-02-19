import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsContextType {
    showDecimals: boolean;
    toggleShowDecimals: () => void;
    cifrasEnMillones: boolean;
    toggleCifrasEnMillones: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [showDecimals, setShowDecimals] = useState<boolean>(() => {
        const saved = localStorage.getItem('showDecimals');
        return saved === 'true';
    });

    const [cifrasEnMillones, setCifrasEnMillones] = useState<boolean>(() => {
        const saved = localStorage.getItem('cifrasEnMillones');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('showDecimals', showDecimals.toString());
    }, [showDecimals]);

    useEffect(() => {
        localStorage.setItem('cifrasEnMillones', cifrasEnMillones.toString());
    }, [cifrasEnMillones]);

    const toggleShowDecimals = () => {
        setShowDecimals(prev => !prev);
    };

    const toggleCifrasEnMillones = () => {
        setCifrasEnMillones(prev => !prev);
    };

    return (
        <SettingsContext.Provider value={{ showDecimals, toggleShowDecimals, cifrasEnMillones, toggleCifrasEnMillones }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
