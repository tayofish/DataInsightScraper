const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generateUserGuide() {
  console.log('Starting user guide generation...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  
  // Application URL - adjust if needed
  const baseUrl = 'http://localhost:5000';
  
  try {
    console.log('Capturing login page screenshot...');
    await page.goto(baseUrl);
    await page.waitForSelector('body', { timeout: 10000 });
    await page.screenshot({ path: 'screenshots/01-login-page.png', fullPage: true });
    
    // Login with admin credentials
    console.log('Logging in...');
    await page.type('input[name="username"]', 'admin');
    await page.type('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    console.log('Capturing dashboard screenshot...');
    await page.screenshot({ path: 'screenshots/02-dashboard.png', fullPage: true });
    
    // Navigate to Tasks
    console.log('Capturing tasks page...');
    await page.click('a[href="/tasks"]');
    await page.waitForSelector('[data-testid="tasks-page"], .tasks-container, h1', { timeout: 5000 });
    await page.screenshot({ path: 'screenshots/03-tasks-page.png', fullPage: true });
    
    // Click on a task to show details
    console.log('Capturing task details...');
    const taskElements = await page.$$('.task-item, [data-testid="task-item"], tr[role="row"]');
    if (taskElements.length > 0) {
      await taskElements[0].click();
      await page.waitForTimeout(2000); // Wait for modal/details to load
      await page.screenshot({ path: 'screenshots/04-task-details.png', fullPage: true });
    }
    
    // Navigate to Projects
    console.log('Capturing projects page...');
    await page.click('a[href="/projects"]');
    await page.waitForSelector('[data-testid="projects-page"], .projects-container, h1', { timeout: 5000 });
    await page.screenshot({ path: 'screenshots/05-projects-page.png', fullPage: true });
    
    // Navigate to Messages
    console.log('Capturing messages page...');
    await page.click('a[href="/messages"]');
    await page.waitForSelector('[data-testid="messages-page"], .messages-container, h1', { timeout: 5000 });
    await page.screenshot({ path: 'screenshots/06-messages-page.png', fullPage: true });
    
    // Navigate to Direct Messages
    console.log('Capturing direct messages page...');
    await page.click('a[href="/direct-messages"]');
    await page.waitForSelector('[data-testid="dm-page"], .direct-messages-container, h1', { timeout: 5000 });
    await page.screenshot({ path: 'screenshots/07-direct-messages.png', fullPage: true });
    
    // Navigate to Admin (if accessible)
    console.log('Capturing admin page...');
    try {
      await page.click('a[href="/admin"]');
      await page.waitForSelector('[data-testid="admin-page"], .admin-container, h1', { timeout: 5000 });
      await page.screenshot({ path: 'screenshots/08-admin-page.png', fullPage: true });
    } catch (error) {
      console.log('Admin page not accessible or not found');
    }
    
    console.log('All screenshots captured successfully!');
    
  } catch (error) {
    console.error('Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
  
  // Now generate the PDF
  console.log('Generating PDF from markdown...');
  await generatePDF();
}

async function generatePDF() {
  const htmlPdfNode = require('html-pdf-node');
  
  // Read the markdown content
  const markdownContent = fs.readFileSync('user-guide.md', 'utf8');
  
  // Convert markdown to HTML with embedded screenshots
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Promellon User Guide</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
        }
        h2 {
            color: #1e40af;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        h3 {
            color: #1e3a8a;
            margin-top: 25px;
        }
        img {
            max-width: 100%;
            height: auto;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin: 15px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        code {
            background: #f3f4f6;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
        }
        .screenshot-section {
            margin: 20px 0;
            padding: 15px;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
        }
        .page-break {
            page-break-before: always;
        }
        ol, ul {
            margin: 10px 0;
            padding-left: 25px;
        }
        li {
            margin: 5px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        th, td {
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            text-align: left;
        }
        th {
            background: #f3f4f6;
            font-weight: 600;
        }
        .note {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 12px;
            margin: 15px 0;
        }
        .note strong {
            color: #92400e;
        }
    </style>
</head>
<body>
    ${convertMarkdownToHTML(markdownContent)}
</body>
</html>`;

  const options = {
    format: 'A4',
    margin: {
      top: '20mm',
      bottom: '20mm',
      left: '15mm',
      right: '15mm'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size: 10px; width: 100%; text-align: center; color: #666;">Promellon Task Management System - User Guide</div>',
    footerTemplate: '<div style="font-size: 10px; width: 100%; text-align: center; color: #666;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
  };

  try {
    const file = { content: htmlContent };
    const pdfBuffer = await htmlPdfNode.generatePdf(file, options);
    
    fs.writeFileSync('Promellon-User-Guide.pdf', pdfBuffer);
    console.log('PDF generated successfully: Promellon-User-Guide.pdf');
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
}

function convertMarkdownToHTML(markdown) {
  // Simple markdown to HTML conversion
  let html = markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // Bold and italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    
    // Code
    .replace(/\`(.*?)\`/g, '<code>$1</code>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Wrap in paragraphs
  html = '<p>' + html + '</p>';

  // Add screenshots in appropriate sections
  html = html.replace(
    /<h2>Login and Authentication<\/h2>/,
    '<h2>Login and Authentication</h2><div class="screenshot-section"><h4>Login Page Screenshot</h4><img src="data:image/png;base64,' + getBase64Image('screenshots/01-login-page.png') + '" alt="Login Page"></div>'
  );

  html = html.replace(
    /<h2>Dashboard Overview<\/h2>/,
    '<h2>Dashboard Overview</h2><div class="screenshot-section"><h4>Dashboard Screenshot</h4><img src="data:image/png;base64,' + getBase64Image('screenshots/02-dashboard.png') + '" alt="Dashboard"></div>'
  );

  html = html.replace(
    /<h2>Task Management<\/h2>/,
    '<h2>Task Management</h2><div class="screenshot-section"><h4>Tasks Page Screenshot</h4><img src="data:image/png;base64,' + getBase64Image('screenshots/03-tasks-page.png') + '" alt="Tasks Page"><h4>Task Details Screenshot</h4><img src="data:image/png;base64,' + getBase64Image('screenshots/04-task-details.png') + '" alt="Task Details"></div>'
  );

  html = html.replace(
    /<h2>Project Management<\/h2>/,
    '<h2>Project Management</h2><div class="screenshot-section"><h4>Projects Page Screenshot</h4><img src="data:image/png;base64,' + getBase64Image('screenshots/05-projects-page.png') + '" alt="Projects Page"></div>'
  );

  html = html.replace(
    /<h2>Team Communication<\/h2>/,
    '<h2>Team Communication</h2><div class="screenshot-section"><h4>Messages Page Screenshot</h4><img src="data:image/png;base64,' + getBase64Image('screenshots/06-messages-page.png') + '" alt="Messages Page"></div>'
  );

  html = html.replace(
    /<h2>Direct Messages<\/h2>/,
    '<h2>Direct Messages</h2><div class="screenshot-section"><h4>Direct Messages Screenshot</h4><img src="data:image/png;base64,' + getBase64Image('screenshots/07-direct-messages.png') + '" alt="Direct Messages"></div>'
  );

  html = html.replace(
    /<h2>Admin Features<\/h2>/,
    '<h2>Admin Features</h2><div class="screenshot-section"><h4>Admin Page Screenshot</h4><img src="data:image/png;base64,' + getBase64Image('screenshots/08-admin-page.png') + '" alt="Admin Page"></div>'
  );

  return html;
}

function getBase64Image(imagePath) {
  try {
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      return imageBuffer.toString('base64');
    } else {
      console.log(`Image not found: ${imagePath}`);
      return '';
    }
  } catch (error) {
    console.log(`Error reading image ${imagePath}:`, error);
    return '';
  }
}

// Create screenshots directory
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

// Run the generation
generateUserGuide().catch(console.error);