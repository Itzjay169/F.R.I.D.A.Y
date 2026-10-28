import { describe, it, expect } from 'vitest';
import { DEVELOPER_CONFIG } from '../../../shared/developerConfig.js';

describe('DEVELOPER_CONFIG — Developer, Vexora Technology & F.R.I.D.A.Y. Identity Contract', () => {
  it('defines the correct Developer identity hierarchy', () => {
    expect(DEVELOPER_CONFIG.developer.name).toBe('Jaykishan Das');
    expect(DEVELOPER_CONFIG.developer.role).toBe('Software Developer | Full-Stack Developer | AI Enthusiast');
    expect(DEVELOPER_CONFIG.developer.subtitle).toBe('Creator of F.R.I.D.A.Y. – The Trading Desk');
    expect(DEVELOPER_CONFIG.developer.socialLinks.github).toBe('https://github.com/Itzjay169');
    expect(DEVELOPER_CONFIG.developer.socialLinks.linkedin).toBe('https://linkedin.com/in/jaykishandas');
    expect(DEVELOPER_CONFIG.developer.introduction).toContain('Jaykishan Das');
    expect(DEVELOPER_CONFIG.developer.introduction).toContain('Vexora Technology');
  });

  it('defines the official Vexora Technology company branding and vision', () => {
    expect(DEVELOPER_CONFIG.company.name).toBe('VEXORA TECHNOLOGY');
    expect(DEVELOPER_CONFIG.company.tagline).toBe('Building Intelligent Digital Experiences.');
    expect(DEVELOPER_CONFIG.company.slogan).toBe('Innovating Today. Building Tomorrow.');
    expect(DEVELOPER_CONFIG.company.vision).toBe(
      "To become a trusted global technology company that transforms ideas into innovative digital solutions, empowers businesses through technology, and makes people's lives simpler, smarter, and better."
    );
    expect(DEVELOPER_CONFIG.company.extendedVision.length).toBeGreaterThanOrEqual(3);
    expect(DEVELOPER_CONFIG.company.closingSlogan).toBe('Vexora Technology — Innovating Today. Building Tomorrow.');
  });

  it('contains the 4 official company focus areas', () => {
    const focusTitles = DEVELOPER_CONFIG.company.focusAreas.map(f => f.title);
    expect(focusTitles).toContain('Web Application Development');
    expect(focusTitles).toContain('Mobile Application Development');
    expect(focusTitles).toContain('AI-Powered Solutions');
    expect(focusTitles).toContain('Custom Software & Digital Products');
  });

  it('defines the F.R.I.D.A.Y. product identity with verified architecture and disclaimer', () => {
    expect(DEVELOPER_CONFIG.product.name).toBe('F.R.I.D.A.Y. — THE TRADING DESK');
    expect(DEVELOPER_CONFIG.product.subtitle).toBe('A PRODUCT BY VEXORA TECHNOLOGY');
    expect(DEVELOPER_CONFIG.product.disclaimer).toBe('Educational only. Not financial advice. Paper trading only.');
    expect(DEVELOPER_CONFIG.product.architecture.length).toBeGreaterThanOrEqual(6);
  });

  it('defines the 4 core development philosophies', () => {
    const titles = DEVELOPER_CONFIG.philosophy.map(p => p.title);
    expect(titles).toContain('Security First');
    expect(titles).toContain('Honest Data');
    expect(titles).toContain('Modular Engineering');
    expect(titles).toContain('User-Centered Design');
  });

  it('contains only verified technologies in the tech stack', () => {
    const techNames = DEVELOPER_CONFIG.techStack.map(t => t.name);
    expect(techNames.some(n => n.includes('Electron'))).toBe(true);
    expect(techNames.some(n => n.includes('React 18'))).toBe(true);
    expect(techNames.some(n => n.includes('Vite 6'))).toBe(true);
    expect(techNames.some(n => n.includes('Gemini'))).toBe(true);
    expect(techNames.some(n => n.includes('Finnhub'))).toBe(true);
    expect(techNames.some(n => n.includes('TradingView'))).toBe(true);
    expect(techNames.some(n => n.includes('Vitest'))).toBe(true);
  });
});
