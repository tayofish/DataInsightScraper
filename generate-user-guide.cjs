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
  
  // Application URL
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
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/03-tasks-page.png', fullPage: true });
    
    // Click on a task to show details
    console.log('Capturing task details...');
    try {
      const taskRows = await page.$$('tr[role="row"]');
      if (taskRows.length > 1) { // Skip header row
        await taskRows[1].click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'screenshots/04-task-details.png', fullPage: true });
        
        // Close the modal/dialog
        const closeButton = await page.$('button[aria-label="Close"], [data-dismiss="modal"], .close');
        if (closeButton) {
          await closeButton.click();
          await page.waitForTimeout(1000);
        }
      }
    } catch (error) {
      console.log('Could not capture task details:', error.message);
    }
    
    // Navigate to Projects
    console.log('Capturing projects page...');
    await page.click('a[href="/projects"]');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/05-projects-page.png', fullPage: true });
    
    // Navigate to Messages
    console.log('Capturing messages page...');
    await page.click('a[href="/messages"]');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/06-messages-page.png', fullPage: true });
    
    // Navigate to Direct Messages
    console.log('Capturing direct messages page...');
    await page.click('a[href="/direct-messages"]');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/07-direct-messages.png', fullPage: true });
    
    // Navigate to Admin
    console.log('Capturing admin page...');
    try {
      await page.click('a[href="/admin"]');
      await page.waitForTimeout(3000);
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
            page-break-before: auto;
        }
        h2 {
            color: #1e40af;
            margin-top: 30px;
            margin-bottom: 15px;
            page-break-before: auto;
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
        .toc {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .toc ul {
            list-style-type: none;
            padding-left: 20px;
        }
        .toc > ul {
            padding-left: 0;
        }
        .toc a {
            text-decoration: none;
            color: #2563eb;
        }
        .toc a:hover {
            text-decoration: underline;
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
    
    // Lists
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^(\d+)\. (.*$)/gim, '<li>$1. $2</li>')
    
    // Line breaks and paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Wrap in paragraphs
  html = '<p>' + html + '</p>';
  
  // Fix list formatting
  html = html.replace(/(<li>.*?<\/li>)/g, function(match) {
    return '<ul>' + match + '</ul>';
  });

  // Add screenshots in appropriate sections
  html = addScreenshotSections(html);

  return html;
}

function addScreenshotSections(html) {
  const screenshots = [
    { pattern: /<h2>Login and Authentication<\/h2>/, image: 'screenshots/01-login-page.png', title: 'Login Page' },
    { pattern: /<h2>Dashboard Overview<\/h2>/, image: 'screenshots/02-dashboard.png', title: 'Dashboard' },
    { pattern: /<h2>Task Management<\/h2>/, image: 'screenshots/03-tasks-page.png', title: 'Tasks Page' },
    { pattern: /<h2>Project Management<\/h2>/, image: 'screenshots/05-projects-page.png', title: 'Projects Page' },
    { pattern: /<h2>Team Communication<\/h2>/, image: 'screenshots/06-messages-page.png', title: 'Messages Page' },
    { pattern: /<h2>Direct Messages<\/h2>/, image: 'screenshots/07-direct-messages.png', title: 'Direct Messages' },
    { pattern: /<h2>Admin Features<\/h2>/, image: 'screenshots/08-admin-page.png', title: 'Admin Page' }
  ];

  screenshots.forEach(({ pattern, image, title }) => {
    const base64Image = getBase64Image(image);
    if (base64Image) {
      const screenshotHtml = `
        <div class="screenshot-section">
          <h4>${title} Screenshot</h4>
          <img src="data:image/png;base64,${base64Image}" alt="${title}">
        </div>
      `;
      html = html.replace(pattern, `$&${screenshotHtml}`);
    }
  });

  // Add task details screenshot after task management section
  const taskDetailsBase64 = getBase64Image('screenshots/04-task-details.png');
  if (taskDetailsBase64) {
    const taskDetailsHtml = `
      <div class="screenshot-section">
        <h4>Task Details Screenshot</h4>
        <img src="data:image/png;base64,${taskDetailsBase64}" alt="Task Details">
      </div>
    `;
    html = html.replace(/(<h2>Task Management<\/h2>.*?)<h2>/s, `$1${taskDetailsHtml}<h2>`);
  }

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