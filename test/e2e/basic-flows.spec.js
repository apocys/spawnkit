import { test, expect } from '@playwright/test';

test.describe('Medieval Theme E2E', () => {
  test('should load the medieval theme and show the onboarding overlay', async ({ page }) => {
    // Go to medieval theme directly
    await page.goto('/office-medieval/');
    
    // Wait for the app to initialize
    await page.waitForLoadState('networkidle');
    
    // Check for the onboarding overlay
    const overlay = page.locator('.sk-med-ob-overlay');
    await expect(overlay).toBeVisible();
    
    // Wait for the active beat to be visible and click it
    const activeBeat = page.locator('.sk-med-ob-beat.sk-med-ob-active');
    await expect(activeBeat).toBeVisible();
    
    // Verify 3D canvas is present behind the overlay
    const canvas = page.locator('#scene-container canvas');
    await expect(canvas).toBeVisible();
  });
});

test.describe('Executive Theme E2E', () => {
  test('should load the executive theme and show the hero', async ({ page }) => {
    await page.goto('/office-executive/');
    await page.waitForLoadState('networkidle');
    
    // Verify hero text
    const hero = page.locator('.md-hero h1');
    await expect(hero).toContainText('Hello! Your assistant is ready ✨');
    
    // Verify tasks panel renders
    const tasks = page.locator('#missionDeskTasks');
    await expect(tasks).toBeVisible();
  });
});
