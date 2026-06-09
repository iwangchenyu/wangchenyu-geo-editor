import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { EnterpriseProvider } from './store/enterprise';
import Layout from './components/Layout';
import ArticleOptimizer from './components/Module7/ArticleOptimizer';
import CreationCenter from './components/CreationCenter';
import ArticleManager from './components/Module9/ArticleManager';
import AssetManager from './components/Module8/AssetManager';
import ArticleExport from './components/Module10/ArticleExport';

export default function App() {
  return (
    <EnterpriseProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<CreationCenter />} />
          <Route path="/optimize" element={<ArticleOptimizer />} />
          <Route path="/articles" element={<ArticleManager />} />
          <Route path="/assets" element={<AssetManager />} />
          <Route path="/export" element={<ArticleExport />} />
        </Routes>
      </Layout>
    </EnterpriseProvider>
  );
}
