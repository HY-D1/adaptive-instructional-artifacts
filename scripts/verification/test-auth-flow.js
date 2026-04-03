const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    bypassCSP: true,
  });
  const page = await context.newPage();
  
  // Listen for console logs
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  const frontendUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://adaptive-instructional-artifacts-bew4edbz4-hy-d1s-projects.vercel.app';
  const apiUrl = process.env.PLAYWRIGHT_API_BASE_URL || 'https://adaptive-instructional-artifacts-api-backend-4kqtfv0ra.vercel.app';
  
  console.log('Frontend:', frontendUrl);
  console.log('API:', apiUrl);
  
  // Go to login page
  await page.goto(`${frontendUrl}/login`, { waitUntil: 'domcontentloaded' });
  console.log('Page loaded');
  
  // Fill in credentials  
  await page.fill('#login-email', 'instructor-e2e@example.com');
  await page.fill('#login-password', 'TestPassword123!');
  console.log('Filled credentials');
  
  // Click sign in and wait for response
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/login')),
    page.locator('form').getByRole('button', { name: /^Sign In$/i }).click(),
  ]);
  
  console.log('Login response status:', response.status());
  const cookies = await context.cookies();
  console.log('Cookies after login:', cookies.map(c => ({ name: c.name, domain: c.domain })));
  
  // Wait a bit for navigation
  await page.waitForTimeout(5000);
  console.log('Current URL:', page.url());
  
  // Check page state
  const loadingVisible = await page.locator('text=Loading...').isVisible().catch(() => false);
  console.log('Loading spinner visible:', loadingVisible);
  
  const headerText = await page.locator('header').textContent().catch(() => 'No header');
  console.log('Header text:', headerText.substring(0, 100));
  
  await browser.close();
})();
