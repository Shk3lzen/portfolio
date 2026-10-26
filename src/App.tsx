import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Home from './pages/Home';
import Archive from './pages/Archive';
import Vault from './pages/Vault';
import { ThemeProvider } from './theme/ThemeContext';
import Toolbar from './components/Toolbar';
import CommandPalette from './components/CommandPalette';
import Intro from './components/Intro';
import BackgroundBots from './components/BackgroundBots';
import HuntToast from './hunt/HuntToast';
import Terminal from './components/Terminal';
import HireModal from './hunt/HireModal';
import Matrix from './pages/Matrix';
import HowItWorks from './pages/HowItWorks';

// Routes wrapped so each page can animate in/out on navigation.
const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/projects" element={<Archive />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/matrix" element={<Matrix />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
      </Routes>
    </AnimatePresence>
  );
};

// HashRouter keeps routing entirely client-side (URLs like /#/projects), which
// works on GitHub Pages static hosting without any 404 redirect configuration.
const App = () => (
  <ThemeProvider>
    <HashRouter>
      <BackgroundBots />
      <Toolbar />
      <AnimatedRoutes />
      <CommandPalette />
      <Terminal />
      <HireModal />
      <HuntToast />
      <Intro />
    </HashRouter>
  </ThemeProvider>
);

export default App;
