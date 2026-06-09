import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initDatabase, getDatabase, setCurrentEnterpriseId, generateId, queryAll, execute, persistDatabase } from '../db';
import type { Enterprise } from '../types';

interface EnterpriseContextType {
  enterprises: Enterprise[];
  currentEnterprise: Enterprise | null;
  dbReady: boolean;
  switchEnterprise: (id: string) => void;
  createEnterprise: (name: string, industry?: string) => Promise<Enterprise>;
  deleteEnterprise: (id: string) => Promise<void>;
}

const EnterpriseContext = createContext<EnterpriseContextType | null>(null);

export function EnterpriseProvider({ children }: { children: React.ReactNode }) {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [currentEnterprise, setCurrentEnterprise] = useState<Enterprise | null>(null);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    (async () => {
      await initDatabase();
      const list = queryAll<Enterprise>('SELECT * FROM enterprises ORDER BY created_at DESC');
      setEnterprises(list);
      if (list.length > 0) {
        setCurrentEnterprise(list[0]);
        setCurrentEnterpriseId(list[0].id);
      }
      setDbReady(true);
    })();
  }, []);

  const switchEnterprise = useCallback((id: string) => {
    const ent = enterprises.find(e => e.id === id) || null;
    setCurrentEnterprise(ent);
    setCurrentEnterpriseId(id);
  }, [enterprises]);

  const createEnterprise = useCallback(async (name: string, industry?: string): Promise<Enterprise> => {
    const id = generateId('ent');
    const now = new Date().toISOString();
    execute(
      'INSERT INTO enterprises (id, name, industry, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, name, industry || '', now, now]
    );
    await persistDatabase();
    const ent: Enterprise = { id, name, industry, created_at: now, updated_at: now };
    setEnterprises(prev => [ent, ...prev]);
    setCurrentEnterprise(ent);
    setCurrentEnterpriseId(id);
    return ent;
  }, []);

  const deleteEnterprise = useCallback(async (id: string) => {
    const db = getDatabase();
    db.run('DELETE FROM company_profiles WHERE enterprise_id = ?', [id]);
    db.run('DELETE FROM distillation_results WHERE enterprise_id = ?', [id]);
    db.run('DELETE FROM topic_cards WHERE enterprise_id = ?', [id]);
    db.run('DELETE FROM writing_instructions WHERE enterprise_id = ?', [id]);
    db.run('DELETE FROM creation_tasks WHERE enterprise_id = ?', [id]);
    db.run('DELETE FROM articles WHERE enterprise_id = ?', [id]);
    db.run('DELETE FROM enterprises WHERE id = ?', [id]);
    await persistDatabase();
    setEnterprises(prev => prev.filter(e => e.id !== id));
    if (currentEnterprise?.id === id) {
      const remaining = enterprises.filter(e => e.id !== id);
      const next = remaining[0] || null;
      setCurrentEnterprise(next);
      setCurrentEnterpriseId(next?.id || null);
    }
  }, [enterprises, currentEnterprise]);

  return (
    <EnterpriseContext.Provider value={{
      enterprises, currentEnterprise, dbReady,
      switchEnterprise, createEnterprise, deleteEnterprise
    }}>
      {children}
    </EnterpriseContext.Provider>
  );
}

export function useEnterprise() {
  const ctx = useContext(EnterpriseContext);
  if (!ctx) throw new Error('useEnterprise must be used within EnterpriseProvider');
  return ctx;
}
