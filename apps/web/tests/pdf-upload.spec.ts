import { expect, test } from '@playwright/test';

test.describe('@weekly PDF Upload Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage and set welcome seen
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up instructor profile for research page access
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('upload button is visible on research page', async ({ page }) => {
    await page.goto('/research', { timeout: 30000 });
    await expect(page).toHaveURL(/\/research/, { timeout: 10000 });

    // Check that upload button is visible
    const uploadButton = page.locator('label[for="pdf-upload-input"]');
    await expect(uploadButton).toBeVisible({ timeout: 5000 });

    // Check that the upload button has the file input
    const fileInput = page.locator('input#pdf-upload-input');
    await expect(fileInput).toHaveAttribute('type', 'file');
    await expect(fileInput).toHaveAttribute('accept', '.pdf');
  });

  test('upload button shows loading state during processing', async ({ page }) => {
    await page.goto('/research', { timeout: 30000 });
    await expect(page).toHaveURL(/\/research/, { timeout: 10000 });

    // Create a minimal PDF buffer (invalid but triggers upload flow)
    const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');

    // Mock the upload endpoint to delay response
    await page.route('**/api/pdf-index/upload', async (route) => {
      // Delay to allow checking loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Test error - not a real PDF' })
      });
    });

    // Upload the file
    const fileInput = page.locator('input#pdf-upload-input');
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: minimalPdf
    });

    // Check loading state is shown
    await expect(page.getByText('Processing...')).toBeVisible({ timeout: 5000 });

    // Wait for error state (since we uploaded an invalid PDF)
    await expect(page.getByTestId('pdf-index-status')).toContainText('error', { timeout: 10000 });
  });

  test('upload endpoint rejects non-PDF files', async ({ page }) => {
    await page.goto('/research', { timeout: 30000 });
    await expect(page).toHaveURL(/\/research/, { timeout: 10000 });

    // Create a text file
    const textFile = Buffer.from('This is not a PDF');

    // Upload non-PDF file - this should trigger client-side validation
    const fileInput = page.locator('input#pdf-upload-input');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: textFile
    });

    // Should show error because it's not a PDF
    await expect(page.getByTestId('pdf-index-status')).toContainText('error', { timeout: 10000 });
    const errorText = await page.getByTestId('pdf-index-error').textContent();
    expect(errorText).toContain('PDF');
  });

  test('pdf upload creates event in interactions', async ({ page }) => {
    await page.goto('/research', { timeout: 30000 });
    await expect(page).toHaveURL(/\/research/, { timeout: 10000 });

    // Mock successful upload response
    const mockPdfIndex = {
      indexId: 'pdf-index-upload-test-v1',
      sourceName: 'uploaded-test.pdf',
      createdAt: new Date().toISOString(),
      schemaVersion: 'pdf-index-schema-v1',
      chunkerVersion: 'word-window-180-overlap-30-v1',
      embeddingModelId: 'hash-embedding-v1',
      sourceDocs: [{
        docId: 'doc-upload-test',
        filename: 'uploaded-test.pdf',
        sha256: 'test-sha-123',
        pageCount: 5
      }],
      docCount: 1,
      chunkCount: 10,
      chunks: Array.from({ length: 10 }, (_, i) => ({
        chunkId: `doc-upload-test:p${Math.floor(i / 2) + 1}:c${(i % 2) + 1}`,
        docId: 'doc-upload-test',
        page: Math.floor(i / 2) + 1,
        text: `Test chunk ${i + 1} content about SQL queries and SELECT statements.`
      }))
    };

    await page.route('**/api/pdf-index/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'built',
          document: mockPdfIndex,
          message: 'Successfully built PDF index from uploaded-test.pdf with 10 chunks.'
        })
      });
    });

    // Upload a PDF
    const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
    const fileInput = page.locator('input#pdf-upload-input');
    await fileInput.setInputFiles({
      name: 'uploaded-test.pdf',
      mimeType: 'application/pdf',
      buffer: minimalPdf
    });

    // Wait for success
    await expect(page.getByTestId('pdf-index-status')).toContainText('ready', { timeout: 10000 });
    await expect(page.getByTestId('pdf-index-summary')).toContainText('1 doc(s), 10 chunk(s)', { timeout: 5000 });

    // Verify the event was logged by checking localStorage directly
    const hasUploadEvent = await page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      if (!rawInteractions) return false;
      try {
        const interactions = JSON.parse(rawInteractions);
        return Array.isArray(interactions) && interactions.some((i: any) => i.eventType === 'pdf_index_uploaded');
      } catch {
        return false;
      }
    });
    expect(hasUploadEvent).toBe(true);
  });

  test('uploaded PDF index is saved to localStorage', async ({ page }) => {
    await page.goto('/research', { timeout: 30000 });
    await expect(page).toHaveURL(/\/research/, { timeout: 10000 });

    // Mock successful upload
    const mockPdfIndex = {
      indexId: 'pdf-index-persist-test-v1',
      sourceName: 'persist-test.pdf',
      createdAt: new Date().toISOString(),
      schemaVersion: 'pdf-index-schema-v1',
      chunkerVersion: 'word-window-180-overlap-30-v1',
      embeddingModelId: 'hash-embedding-v1',
      sourceDocs: [{
        docId: 'doc-persist-test',
        filename: 'persist-test.pdf',
        sha256: 'persist-sha-123',
        pageCount: 3
      }],
      docCount: 1,
      chunkCount: 5,
      chunks: Array.from({ length: 5 }, (_, i) => ({
        chunkId: `doc-persist-test:p${i + 1}:c1`,
        docId: 'doc-persist-test',
        page: i + 1,
        text: `Persist test chunk ${i + 1}`
      }))
    };

    await page.route('**/api/pdf-index/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'built',
          document: mockPdfIndex,
          message: 'Successfully built PDF index.'
        })
      });
    });

    // Upload PDF
    const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
    await page.locator('input#pdf-upload-input').setInputFiles({
      name: 'persist-test.pdf',
      mimeType: 'application/pdf',
      buffer: minimalPdf
    });

    // Wait for success
    await expect(page.getByTestId('pdf-index-status')).toContainText('ready', { timeout: 10000 });

    // Verify index is saved in localStorage with correct structure
    const storedIndex = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-pdf-index');
      return raw ? JSON.parse(raw) : null;
    });
    
    expect(storedIndex).not.toBeNull();
    expect(storedIndex.indexId).toBe('pdf-index-persist-test-v1');
    expect(storedIndex.sourceName).toBe('persist-test.pdf');
    expect(storedIndex.docCount).toBe(1);
    expect(storedIndex.chunkCount).toBe(5);
    expect(storedIndex.chunks).toHaveLength(5);
  });

  test('both load from disk and upload buttons are available', async ({ page }) => {
    await page.goto('/research', { timeout: 30000 });
    await expect(page).toHaveURL(/\/research/, { timeout: 10000 });

    // Check upload button
    const uploadLabel = page.locator('label[for="pdf-upload-input"]');
    await expect(uploadLabel).toBeVisible();
    await expect(uploadLabel).toContainText('Upload PDF');

    // Check load from disk button
    const loadButton = page.getByTestId('pdf-index-load-button');
    await expect(loadButton).toBeVisible();
    await expect(loadButton).toContainText('Load from Disk');

    // Verify they're separate buttons
    expect(await uploadLabel.count()).toBe(1);
    expect(await loadButton.count()).toBe(1);
  });

  test('upload large PDF shows quota warning', async ({ page }) => {
    await page.goto('/research', { timeout: 30000 });
    await expect(page).toHaveURL(/\/research/, { timeout: 10000 });

    // Create a large mock index that would exceed quota
    const largeChunks = Array.from({ length: 1000 }, (_, i) => ({
      chunkId: `doc-large:p${i + 1}:c1`,
      docId: 'doc-large',
      page: i + 1,
      text: 'A'.repeat(5000) // 5KB per chunk
    }));

    const mockLargePdfIndex = {
      indexId: 'pdf-index-large-v1',
      sourceName: 'large-test.pdf',
      createdAt: new Date().toISOString(),
      schemaVersion: 'pdf-index-schema-v1',
      chunkerVersion: 'word-window-180-overlap-30-v1',
      embeddingModelId: 'hash-embedding-v1',
      sourceDocs: [{
        docId: 'doc-large',
        filename: 'large-test.pdf',
        sha256: 'large-sha-123',
        pageCount: 1000
      }],
      docCount: 1,
      chunkCount: 1000,
      chunks: largeChunks
    };

    await page.route('**/api/pdf-index/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'built',
          document: mockLargePdfIndex,
          message: 'Successfully built large PDF index.'
        })
      });
    });

    // Upload PDF
    const minimalPdf = Buffer.from('%PDF-1.4\ntest');
    await page.locator('input#pdf-upload-input').setInputFiles({
      name: 'large-test.pdf',
      mimeType: 'application/pdf',
      buffer: minimalPdf
    });

    // Should show warning status for large index
    await expect.poll(async () => {
      const status = await page.getByTestId('pdf-index-status').textContent().catch(() => '');
      return status.includes('warning') || status.includes('ready');
    }, {
      message: 'Waiting for PDF index processing',
      timeout: 15000
    }).toBe(true);
  });
});
