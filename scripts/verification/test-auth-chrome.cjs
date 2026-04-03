const { chromium } = require('playwright');

(async () => {
  // Launch with args to allow third-party cookies
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
    ]
  });
  
  const context = await browser.newContext({
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  });
  
  const page = await context.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  const frontendUrl = 'https://adaptive-instructional-artifacts-bew4edbz4-hy-d1s-projects.vercel.app';
  
  console.log('Navigating to login...');
  await page.goto(`${frontendUrl}/login`, { waitUntil: 'networkidle' });
  
  // Dismiss welcome modal
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (e) {}
  
  console.log('Filling credentials...');
  await page.fill('#login-email', 'instructor-e2e@example.com');
  await page.fill('#login-password', 'TestPassword123!');
  
  console.log('Clicking login...');
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/login'), { timeout: 30000 }),
    page.locator('form').getByRole('button', { name: /^Sign In$/i }).click({ timeout: 10000 }),
  ]);
  
  console.log('Login response status:', response.status());
  
  // Check cookies
  const cookies = await context.cookies();
  console.log('Cookies:', cookies.filter(c => c.name.includes('sql_adapt')).map(c => ({ 
    name: c.name, 
    domain: c.domain, 
    path: c.path,
    secure: c.secure,
    sameSite: c.sameSite
  })));
  
  // Wait for navigation
  await page.waitForTimeout(5000);
  console.log('Current URL:', page.url());
  
  // Check if page is still loading
  const loading = await page.locator('text=Loading...').isVisible().catch(() => false);
  console.log('Loading visible:', loading);
  
  const header = await page.locator('header').textContent().catch(() => 'No header');
  console.log('Header:', header.substring(0, 100));
  
  await browser.close();
})();
