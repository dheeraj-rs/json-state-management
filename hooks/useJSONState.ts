import { useState, useEffect, useCallback } from 'react';

type AppState = {
  theme: {
    mode: string;
    color: string;
  };
  layout: {
    sidebar: boolean;
  };
  content: {
    title: string;
  };
  settings: {
    fontSize: number;
  };
};

const DEFAULT_STATE: AppState = {
  theme: {
    mode: 'light',
    color: '#3B82F6',
  },
  layout: {
    sidebar: true,
  },
  content: {
    title: 'JSON State Manager',
  },
  settings: {
    fontSize: 16,
  },
};

const STORAGE_KEY = 'app-json-state';
const API_ENDPOINT = '/api/save-state';
const JSON_FILE_PATH = '/app-state.json';

export function useJSONState() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [isSaving, setIsSaving] = useState(false);

  const saveToStorage = useCallback((data: AppState) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, []);

  const loadFromStorage = useCallback(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  }, []);

  const saveToFile = useCallback(
    async (data: AppState) => {
      if (isSaving) return;
      setIsSaving(true);
      try {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data, null, 2),
        });
        if (!response.ok) {
          throw new Error(`Save failed: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message);
        }
      } catch (error) {
        console.error('File save error:', error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving]
  );

  const loadFromFile = useCallback(async () => {
    try {
      const response = await fetch(`${JSON_FILE_PATH}?t=${Date.now()}`);
      if (response.ok) {
        const fileState = await response.json();
        const mergedState = { ...DEFAULT_STATE, ...fileState };
        setState(mergedState);
        saveToStorage(mergedState);
        return true;
      }
    } catch (error) {
      console.error('File load error:', error);
    }
    await saveToFile(DEFAULT_STATE);
    return false;
  }, [saveToFile, saveToStorage]);

  const updateState = useCallback(
    (path: string, value: string | number | boolean | object) => {
      if (isSaving) return;
      setState((prevState) => {
        const keys = path.split('.');
        const newState = JSON.parse(JSON.stringify(prevState));
        let current = newState;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) current[keys[i]] = {};
          current = current[keys[i]];
        }
        const lastKey = keys[keys.length - 1];
        if (current[lastKey] !== value) {
          current[lastKey] = value;
          saveToStorage(newState);
          saveToFile(newState).catch(console.error);
          return newState;
        }
        return prevState;
      });
    },
    [isSaving, saveToFile, saveToStorage]
  );

  const downloadJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'app-state.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state]);

  useEffect(() => {
    const savedState = loadFromStorage();
    if (savedState) {
      setState(savedState);
    } else {
      loadFromFile();
    }
  }, [loadFromFile, loadFromStorage]);

  return {
    state,
    updateState,
    downloadJSON,
    isSaving,
  };
}

export default useJSONState;
