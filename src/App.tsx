import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Home from './pages/Home';
import Archive from './pages/Archive';
import { ThemeProvider } from './theme/ThemeContext';
import Toolbar from './components/Toolbar';
import CommandPalette from './components/CommandPalette';
import AiChat from './components/AiChat';

// Routes wrapped so each page can animate in/out on navigation.
const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/projects" element={<Archive />} />
      </Routes>
    </AnimatePresence>
  );
};

// HashRouter keeps routing entirely client-side (URLs like /#/projects), which
// works on GitHub Pages static hosting without any 404 redirect configuration.
const App = () => (
  <ThemeProvider>
    <HashRouter>
      <Toolbar />
      <AnimatedRoutes />
      <CommandPalette />
      <AiChat />
    </HashRouter>
  </ThemeProvider>
);

export default App;
