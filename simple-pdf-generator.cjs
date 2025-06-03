const fs = require('fs');

function createUserGuideHTML() {
  console.log('Creating comprehensive user guide...');
  
  const markdownContent = fs.readFileSync('user-guide.md', 'utf8');
  
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Promellon Task Management System - User Guide</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #ffffff;
            padding: 40px;
            max-width: 1000px;
            margin: 0 auto;
        }
        
        .cover-page {
            text-align: center;
            page-break-after: always;
            margin-bottom: 80px;
            padding: 100px 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 20px;
            margin: -40px -40px 80px -40px;
            padding: 120px 40px;
        }
        
        .cover-page h1 {
            font-size: 3.5em;
            margin-bottom: 20px;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .cover-page p {
            font-size: 1.3em;
            margin-bottom: 40px;
            opacity: 0.9;
        }
        
        .cover-date {
            position: absolute;
            bottom: 40px;
            width: 100%;
            text-align: center;
            font-size: 1.1em;
            opacity: 0.8;
        }
        
        h1 {
            color: #1e40af;
            font-size: 2.5em;
            margin: 40px 0 30px 0;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 15px;
            font-weight: 700;
        }
        
        h2 {
            color: #1e40af;
            font-size: 1.8em;
            margin: 35px 0 20px 0;
            padding-left: 15px;
            border-left: 5px solid #3b82f6;
            font-weight: 600;
        }
        
        h3 {
            color: #1e3a8a;
            font-size: 1.4em;
            margin: 30px 0 15px 0;
            font-weight: 600;
        }
        
        h4 {
            color: #374151;
            font-size: 1.2em;
            margin: 25px 0 12px 0;
            font-weight: 600;
        }
        
        p {
            margin-bottom: 16px;
            text-align: justify;
            font-size: 1em;
        }
        
        ul, ol {
            margin: 16px 0 16px 30px;
        }
        
        li {
            margin: 8px 0;
            line-height: 1.5;
        }
        
        code {
            background: #f3f4f6;
            padding: 3px 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #1f2937;
            border: 1px solid #e5e7eb;
        }
        
        .toc {
            background: #f8fafc;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 30px;
            margin: 40px 0;
            page-break-inside: avoid;
        }
        
        .toc h2 {
            margin-top: 0;
            color: #1f2937;
            text-align: center;
            border: none;
            padding: 0;
        }
        
        .toc ul {
            list-style: none;
            margin: 20px 0;
            padding: 0;
        }
        
        .toc li {
            margin: 12px 0;
            padding: 8px 0;
            border-bottom: 1px dotted #d1d5db;
        }
        
        .toc a {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
            font-size: 1.05em;
        }
        
        .toc a:hover {
            text-decoration: underline;
        }
        
        .feature-box {
            background: #ecfdf5;
            border: 2px solid #10b981;
            border-radius: 10px;
            padding: 25px;
            margin: 30px 0;
            page-break-inside: avoid;
        }
        
        .feature-box h3 {
            color: #047857;
            margin-top: 0;
        }
        
        .note {
            background: #fef3c7;
            border-left: 5px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            page-break-inside: avoid;
        }
        
        .note strong {
            color: #92400e;
        }
        
        .warning {
            background: #fef2f2;
            border-left: 5px solid #ef4444;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            page-break-inside: avoid;
        }
        
        .step-section {
            background: #f0f9ff;
            border: 2px solid #0284c7;
            border-radius: 10px;
            padding: 25px;
            margin: 25px 0;
            page-break-inside: avoid;
        }
        
        .step-section h4 {
            color: #0c4a6e;
            margin-top: 0;
        }
        
        .screenshot-placeholder {
            background: #f3f4f6;
            border: 2px dashed #9ca3af;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            margin: 25px 0;
            color: #6b7280;
            font-style: italic;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        th, td {
            border: 1px solid #e5e7eb;
            padding: 15px;
            text-align: left;
        }
        
        th {
            background: #f9fafb;
            font-weight: 600;
            color: #374151;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        .section-divider {
            border-top: 3px solid #e5e7eb;
            margin: 50px 0;
        }
        
        @media print {
            body {
                font-size: 11pt;
                line-height: 1.4;
                padding: 20px;
            }
            
            .cover-page {
                margin: -20px -20px 40px -20px;
                padding: 80px 20px;
            }
            
            h1 { font-size: 18pt; }
            h2 { font-size: 14pt; }
            h3 { font-size: 12pt; }
            
            .page-break {
                page-break-before: always;
            }
            
            .feature-box, .note, .warning, .step-section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="cover-page">
        <h1>📋 Promellon</h1>
        <p>Task Management System</p>
        <p><strong>Complete User Guide</strong></p>
        <div class="cover-date">
            Generated on ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}
        </div>
    </div>
    
    ${convertMarkdownToHTML(markdownContent)}
    
    <div class="page-break"></div>
    <div style="text-align: center; margin-top: 80px; padding: 40px; background: #f8fafc; border-radius: 12px;">
        <h2 style="color: #374151; margin-bottom: 20px; border: none; padding: 0;">End of User Guide</h2>
        <p style="color: #6b7280; font-size: 1.1em;">For technical support, contact your system administrator</p>
        <p style="color: #9ca3af; font-size: 0.9em; margin-top: 20px;">Document version 1.0</p>
    </div>
</body>
</html>`;

  // Write HTML file
  fs.writeFileSync('Promellon-User-Guide.html', htmlContent);
  console.log('✅ HTML user guide created: Promellon-User-Guide.html');
  
  // Create a printable version notice
  const printInstructions = `
# How to Create PDF from HTML

Since PDF generation requires browser dependencies not available in this environment, 
follow these steps to create a PDF version:

## Method 1: Browser Print
1. Open 'Promellon-User-Guide.html' in your web browser
2. Press Ctrl+P (Windows/Linux) or Cmd+P (Mac)
3. Select "Save as PDF" as the destination
4. Choose appropriate settings:
   - Paper size: A4
   - Margins: Normal
   - Options: Include backgrounds
5. Save as 'Promellon-User-Guide.pdf'

## Method 2: Online PDF Converter
1. Upload 'Promellon-User-Guide.html' to an online HTML-to-PDF converter
2. Download the generated PDF

## Method 3: Command Line (if wkhtmltopdf is available)
\`\`\`bash
wkhtmltopdf --page-size A4 --margin-top 20mm --margin-bottom 20mm Promellon-User-Guide.html Promellon-User-Guide.pdf
\`\`\`

The HTML file is fully formatted and ready for conversion to PDF.
`;

  fs.writeFileSync('PDF-Creation-Instructions.md', printInstructions);
  console.log('✅ PDF creation instructions: PDF-Creation-Instructions.md');
}

function convertMarkdownToHTML(markdown) {
  let html = markdown;
  
  // Add table of contents
  const tocMatch = markdown.match(/## Table of Contents\n([\s\S]*?)\n---/);
  if (tocMatch) {
    const tocContent = tocMatch[1];
    const tocItems = tocContent.split('\n').filter(line => line.trim().startsWith('1.') || line.trim().match(/^\d+\./));
    
    let tocHTML = '<div class="toc"><h2>📑 Table of Contents</h2><ul>';
    tocItems.forEach(item => {
      const match = item.match(/^\d+\.\s*\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        tocHTML += `<li><a href="${match[2]}">${match[1]}</a></li>`;
      }
    });
    tocHTML += '</ul></div>';
    
    html = html.replace(/## Table of Contents\n[\s\S]*?\n---/, tocHTML);
  }
  
  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Convert text formatting
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/\`([^`]+)\`/g, '<code>$1</code>');
  
  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Convert lists
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^  - (.*$)/gim, '<li style="margin-left: 20px;">$1</li>');
  html = html.replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>');
  
  // Wrap consecutive list items
  html = html.replace(/(<li>.*?<\/li>)/gs, function(match) {
    return '<ul>' + match + '</ul>';
  });
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  
  // Convert paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  
  // Clean up formatting around headers and lists
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<div)/g, '$1');
  html = html.replace(/(<\/div>)<\/p>/g, '$1');
  
  // Add special sections
  html = addSpecialSections(html);
  
  return html;
}

function addSpecialSections(html) {
  // Add feature highlights
  html = html.replace(
    /<h3>Key Features<\/h3>/,
    '<div class="feature-box"><h3>🌟 Key Features</h3>'
  );
  html = html.replace(
    /(<div class="feature-box">.*?)<h3>/s,
    '$1</div><h3>'
  );
  
  // Add step sections for procedures
  const stepSections = [
    'Creating a New Task',
    'Editing Tasks', 
    'Creating Projects',
    'Starting Direct Conversations',
    'Uploading Files',
    'Viewing Tasks',
    'Task Comments and Collaboration'
  ];
  
  stepSections.forEach((section, index) => {
    html = html.replace(
      new RegExp(`<h3>${section}</h3>`, 'g'),
      `<div class="step-section"><h4>📋 Step ${index + 1}: ${section}</h4>`
    );
  });
  
  // Add screenshot placeholders
  const screenshotSections = [
    'Login and Authentication',
    'Dashboard Overview', 
    'Task Management',
    'Project Management',
    'Team Communication',
    'Direct Messages',
    'Admin Features'
  ];
  
  screenshotSections.forEach(section => {
    html = html.replace(
      new RegExp(`<h2>${section}</h2>`, 'g'),
      `<h2>${section}</h2><div class="screenshot-placeholder">📸 Screenshot: ${section} Interface<br><em>(Screenshots can be added by taking browser screenshots of each section)</em></div>`
    );
  });
  
  // Add notes and warnings
  html = html.replace(
    /\*Note: (.*?)\*/g,
    '<div class="note"><strong>📝 Note:</strong> $1</div>'
  );
  
  html = html.replace(
    /administrator privileges/g,
    '</p><div class="warning"><strong>⚠️ Administrator Access Required</strong><p>These features require administrator privileges</p></div><p>'
  );
  
  // Add section dividers
  html = html.replace(/<h2>/g, '<div class="section-divider"></div><h2>');
  
  return html;
}

// Create the user guide
createUserGuideHTML();